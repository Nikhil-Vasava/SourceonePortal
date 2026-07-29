// Loads the real suppliers and buyers into a database that is already running,
// so you don't have to wipe and re-seed.
//
//   node tools/import-partners.mjs            # dry run — shows the plan, changes nothing
//   node tools/import-partners.mjs --apply    # actually does it
//
// Matching is by name. An existing partner with the same name is updated in
// place (keeping its id, so bookings and purchase orders pointing at it stay
// intact) and its address and contacts are replaced. Anything not in the sheet
// is removed — or deactivated instead, if a purchase order or booking still
// refers to it, since deleting would either be rejected by Postgres or strip
// the name off a document that has already gone out.

import { createRequire } from "module";
const require = createRequire(import.meta.url);

const { prisma } = require("../lib/db");
const { SUPPLIERS, BUYERS, supplierRecords, buyerRecords } = require("../prisma/master-data.js");

const APPLY = process.argv.includes("--apply");
const say = (...a) => console.log(...a);

/** Pulls the nested address / contacts out so the scalar fields can be updated alone. */
function split(record) {
  const { addresses, contacts, ...scalars } = record;
  return {
    scalars,
    address: addresses?.create?.[0] || null,
    contacts: contacts?.create || [],
  };
}

async function usageOf(id) {
  const [pos, sos, invoices, payments, bookings, lines] = await Promise.all([
    prisma.purchaseOrder.count({ where: { partnerId: id } }),
    prisma.salesOrder.count({ where: { partnerId: id } }),
    prisma.invoice.count({ where: { partnerId: id } }),
    prisma.payment.count({ where: { partnerId: id } }),
    prisma.booking.count({
      where: { OR: [{ shippingLineId: id }, { forwarderId: id }, { chaId: id }, { buyerId: id }] },
    }),
    prisma.bookingLine.count({ where: { OR: [{ supplierId: id }, { buyerId: id }] } }),
  ]);
  const parts = [];
  if (pos) parts.push(`${pos} PO`);
  if (sos) parts.push(`${sos} SO`);
  if (invoices) parts.push(`${invoices} invoice`);
  if (payments) parts.push(`${payments} payment`);
  if (bookings) parts.push(`${bookings} booking`);
  if (lines) parts.push(`${lines} container line`);
  return parts;
}

async function upsert(record) {
  const { scalars, address, contacts } = split(record);
  const existing = await prisma.partner.findFirst({ where: { name: scalars.name } });

  if (!APPLY) {
    say(`  ${existing ? "update" : "create"}  ${scalars.name}`);
    return existing ? "updated" : "created";
  }

  // One nested write per partner rather than a sequence of separate creates: if
  // anything in it is rejected, the whole partner rolls back instead of being
  // left half-written with no address or contacts.
  if (existing) {
    await prisma.partner.update({
      where: { id: existing.id },
      data: {
        ...scalars,
        // Replace rather than merge, so a corrected sheet doesn't leave stale rows.
        addresses: { deleteMany: {}, ...(address && { create: [address] }) },
        contacts: { deleteMany: {}, ...(contacts.length && { create: contacts }) },
      },
    });
    return "updated";
  }

  await prisma.partner.create({ data: record });
  return "created";
}

async function main() {
  const suppliers = supplierRecords();
  const buyers = buyerRecords();
  const keep = new Set([...suppliers, ...buyers].map(r => r.name));

  say(APPLY ? "APPLYING CHANGES\n" : "DRY RUN — nothing will be written. Re-run with --apply to commit.\n");

  say(`Suppliers from the sheet (${suppliers.length}):`);
  const sCounts = { created: 0, updated: 0 };
  for (const r of suppliers) sCounts[await upsert(r)]++;

  say(`\nBuyers from the sheet (${buyers.length}):`);
  const bCounts = { created: 0, updated: 0 };
  for (const r of buyers) bCounts[await upsert(r)]++;

  // Anything of these two types that the sheet doesn't mention.
  const stale = await prisma.partner.findMany({
    where: { type: { in: ["VENDOR", "CUSTOMER", "BUYER"] }, name: { notIn: [...keep] } },
  });

  say(`\nNot in the sheet (${stale.length}):`);
  let deleted = 0, deactivated = 0;
  for (const p of stale) {
    const used = await usageOf(p.id);
    if (used.length) {
      say(`  deactivate  ${p.name}  — referenced by ${used.join(", ")}`);
      if (APPLY) await prisma.partner.update({ where: { id: p.id }, data: { active: false } });
      deactivated++;
    } else {
      say(`  delete      ${p.name}`);
      if (APPLY) {
        // Pricelist entries and catalog links describe this partner only.
        await prisma.pricelistItem.deleteMany({ where: { partnerId: p.id } });
        await prisma.partnerProduct.deleteMany({ where: { partnerId: p.id } });
        await prisma.address.deleteMany({ where: { partnerId: p.id } });
        await prisma.contactPerson.deleteMany({ where: { partnerId: p.id } });
        await prisma.bankAccount.deleteMany({ where: { partnerId: p.id } });
        await prisma.partner.delete({ where: { id: p.id } });
      }
      deleted++;
    }
  }
  if (!stale.length) say("  nothing");

  say(
    `\nSummary: ${sCounts.created + bCounts.created} created, ` +
    `${sCounts.updated + bCounts.updated} updated, ` +
    `${deleted} deleted, ${deactivated} deactivated.`
  );
  if (!APPLY) say("\nNothing was written. Re-run with --apply when the plan looks right.");
  if (deactivated) {
    say(
      "\nDeactivated partners stay on the Info tab, greyed out, and keep their history. " +
      "To remove them entirely, clear the bookings and purchase orders that use them " +
      "(Settings → Delete all bookings and purchase orders), then run this again."
    );
  }
}

main()
  .catch(e => { console.error("\nFailed:", e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
