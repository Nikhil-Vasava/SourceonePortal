"use server";

// Create / update / deactivate / delete for the master data on the Info tab.
//
// Deleting is the interesting part. A supplier that has already been used on a
// purchase order can't simply be removed — Postgres would reject it, and even
// if it didn't, the PO would lose the name it was raised against. So a delete
// counts every relation first and refuses with a message naming what is using
// the record, offering deactivation instead.
//
// Deactivating keeps the history intact and takes the record out of the
// dropdowns, which is what "remove this supplier" almost always means in
// practice.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

/** Everything that shows master data. */
const AFFECTED = ["/info", "/bookings", "/purchase", "/suppliers", "/buyers", "/"];
function refresh() {
  for (const p of AFFECTED) revalidatePath(p);
}

const str = (v) => {
  const s = (v ?? "").toString().trim();
  return s === "" ? null : s;
};
const num = (v) => {
  const n = Number(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/* ------------------------------------------------------------------ partners */

export async function savePartnerAction(formData) {
  requireUser();

  const id = formData.get("id") ? Number(formData.get("id")) : null;
  const name = str(formData.get("name"));
  if (!name) throw new Error("A name is required.");

  const data = {
    name,
    type: str(formData.get("type")) || "VENDOR",
    email: str(formData.get("email")),
    phone: str(formData.get("phone")),
    taxId: str(formData.get("taxId")),
    currency: str(formData.get("currency")) || "USD",
    country: str(formData.get("country")),
    region: str(formData.get("region")),
    paymentTerms: str(formData.get("paymentTerms")),
    incoterm: str(formData.get("incoterm")),
    notes: str(formData.get("notes")),
  };

  const partner = id
    ? await prisma.partner.update({ where: { id }, data })
    : await prisma.partner.create({ data });

  // The billing address lives on its own table but is edited inline here.
  const line1 = str(formData.get("addrLine1"));
  if (line1) {
    const existing = await prisma.address.findFirst({
      where: { partnerId: partner.id, type: "BILLING" },
    });
    const addr = {
      partnerId: partner.id,
      type: "BILLING",
      line1,
      city: str(formData.get("addrCity")),
      state: str(formData.get("addrState")),
      country: str(formData.get("addrCountry")) || data.country,
      zip: str(formData.get("addrZip")),
    };
    if (existing) await prisma.address.update({ where: { id: existing.id }, data: addr });
    else await prisma.address.create({ data: addr });
  }

  refresh();
  return { ok: true, message: `${partner.name} saved.` };
}

/**
 * Counts every place a partner is referenced.
 * Kept beside the delete so a new relation added to the schema is obvious here.
 */
async function partnerUsage(id) {
  const [pos, sos, invoices, payments, pricelists, catalog,
         asLine, asForwarder, asCha, asBuyer, lineSupplier, lineBuyer] = await Promise.all([
    prisma.purchaseOrder.count({ where: { partnerId: id } }),
    prisma.salesOrder.count({ where: { partnerId: id } }),
    prisma.invoice.count({ where: { partnerId: id } }),
    prisma.payment.count({ where: { partnerId: id } }),
    prisma.pricelistItem.count({ where: { partnerId: id } }),
    prisma.partnerProduct.count({ where: { partnerId: id } }),
    prisma.booking.count({ where: { shippingLineId: id } }),
    prisma.booking.count({ where: { forwarderId: id } }),
    prisma.booking.count({ where: { chaId: id } }),
    prisma.booking.count({ where: { buyerId: id } }),
    prisma.bookingLine.count({ where: { supplierId: id } }),
    prisma.bookingLine.count({ where: { buyerId: id } }),
  ]);

  const parts = [];
  if (pos) parts.push(`${pos} purchase order${pos === 1 ? "" : "s"}`);
  if (sos) parts.push(`${sos} sales order${sos === 1 ? "" : "s"}`);
  if (invoices) parts.push(`${invoices} invoice${invoices === 1 ? "" : "s"}`);
  if (payments) parts.push(`${payments} payment${payments === 1 ? "" : "s"}`);
  if (pricelists) parts.push(`${pricelists} pricelist entr${pricelists === 1 ? "y" : "ies"}`);
  if (catalog) parts.push(`${catalog} product link${catalog === 1 ? "" : "s"}`);

  const bookings = asLine + asForwarder + asCha + asBuyer;
  if (bookings) parts.push(`${bookings} booking${bookings === 1 ? "" : "s"}`);

  const lines = lineSupplier + lineBuyer;
  if (lines) parts.push(`${lines} container line${lines === 1 ? "" : "s"}`);

  return parts;
}

export async function deletePartnerAction(formData) {
  requireUser();
  const id = Number(formData.get("id"));
  const partner = await prisma.partner.findUnique({ where: { id } });
  if (!partner) throw new Error("That record no longer exists.");

  const used = await partnerUsage(id);
  if (used.length) {
    throw new Error(
      `${partner.name} can't be deleted — it's used by ${used.join(", ")}. ` +
      "Deactivate it instead: it disappears from the dropdowns and the existing records keep their history."
    );
  }

  // Only children that exist purely to describe this partner.
  await prisma.$transaction([
    prisma.address.deleteMany({ where: { partnerId: id } }),
    prisma.contactPerson.deleteMany({ where: { partnerId: id } }),
    prisma.bankAccount.deleteMany({ where: { partnerId: id } }),
    prisma.partner.delete({ where: { id } }),
  ]);

  refresh();
  return { ok: true, message: `${partner.name} deleted.` };
}

export async function togglePartnerActiveAction(formData) {
  requireUser();
  const id = Number(formData.get("id"));
  const partner = await prisma.partner.findUnique({ where: { id } });
  if (!partner) throw new Error("That record no longer exists.");

  await prisma.partner.update({ where: { id }, data: { active: !partner.active } });
  refresh();
  return {
    ok: true,
    message: partner.active
      ? `${partner.name} deactivated — hidden from dropdowns, existing records unchanged.`
      : `${partner.name} reactivated.`,
  };
}

/* ------------------------------------------------------------------ products */

export async function saveProductAction(formData) {
  requireUser();

  const id = formData.get("id") ? Number(formData.get("id")) : null;
  const sku = str(formData.get("sku"));
  const name = str(formData.get("name"));
  if (!sku) throw new Error("A SKU is required.");
  if (!name) throw new Error("A name is required.");

  // sku is unique in the schema; catching it here gives a better message than a
  // raw constraint error.
  const clash = await prisma.product.findFirst({
    where: { sku, ...(id ? { NOT: { id } } : {}) },
  });
  if (clash) throw new Error(`SKU "${sku}" is already used by ${clash.name}.`);

  const data = {
    sku, name,
    category: str(formData.get("category")),
    grade: str(formData.get("grade")),
    uom: str(formData.get("uom")) || "MT",
    taxRate: num(formData.get("taxRate")),
    costPrice: num(formData.get("costPrice")),
    salePrice: num(formData.get("salePrice")),
  };

  const product = id
    ? await prisma.product.update({ where: { id }, data })
    : await prisma.product.create({ data });

  refresh();
  return { ok: true, message: `${product.name} saved.` };
}

async function productUsage(id) {
  const [poLines, soLines, invoiceLines, bookingLines, stocks, pricelists, links] = await Promise.all([
    prisma.purchaseOrderLine.count({ where: { productId: id } }),
    prisma.salesOrderLine.count({ where: { productId: id } }),
    prisma.invoiceLine.count({ where: { productId: id } }),
    prisma.bookingLine.count({ where: { productId: id } }),
    prisma.stock.count({ where: { productId: id } }),
    prisma.pricelistItem.count({ where: { productId: id } }),
    prisma.partnerProduct.count({ where: { productId: id } }),
  ]);

  const parts = [];
  if (poLines) parts.push(`${poLines} purchase order line${poLines === 1 ? "" : "s"}`);
  if (soLines) parts.push(`${soLines} sales order line${soLines === 1 ? "" : "s"}`);
  if (invoiceLines) parts.push(`${invoiceLines} invoice line${invoiceLines === 1 ? "" : "s"}`);
  if (bookingLines) parts.push(`${bookingLines} container line${bookingLines === 1 ? "" : "s"}`);
  if (stocks) parts.push(`${stocks} stock record${stocks === 1 ? "" : "s"}`);
  if (pricelists) parts.push(`${pricelists} pricelist entr${pricelists === 1 ? "y" : "ies"}`);
  if (links) parts.push(`${links} supplier link${links === 1 ? "" : "s"}`);
  return parts;
}

export async function deleteProductAction(formData) {
  requireUser();
  const id = Number(formData.get("id"));
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new Error("That record no longer exists.");

  const used = await productUsage(id);
  if (used.length) {
    throw new Error(
      `${product.name} can't be deleted — it's used by ${used.join(", ")}. ` +
      "Deactivate it instead: it disappears from the dropdowns and the existing records keep their history."
    );
  }

  await prisma.product.delete({ where: { id } });
  refresh();
  return { ok: true, message: `${product.name} deleted.` };
}

export async function toggleProductActiveAction(formData) {
  requireUser();
  const id = Number(formData.get("id"));
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new Error("That record no longer exists.");

  await prisma.product.update({ where: { id }, data: { active: !product.active } });
  refresh();
  return {
    ok: true,
    message: product.active
      ? `${product.name} deactivated — hidden from dropdowns, existing records unchanged.`
      : `${product.name} reactivated.`,
  };
}

/* --------------------------------------------------------------------- ports */

export async function savePortAction(formData) {
  requireUser();

  const id = formData.get("id") ? Number(formData.get("id")) : null;
  const code = str(formData.get("code"))?.toUpperCase();
  const name = str(formData.get("name"));
  if (!code) throw new Error("A UN/LOCODE is required.");
  if (!name) throw new Error("A port name is required.");

  const clash = await prisma.port.findFirst({
    where: { code, ...(id ? { NOT: { id } } : {}) },
  });
  if (clash) throw new Error(`Code "${code}" is already used by ${clash.name}.`);

  const data = { code, name, country: str(formData.get("country")) };
  const port = id
    ? await prisma.port.update({ where: { id }, data })
    : await prisma.port.create({ data });

  refresh();
  return { ok: true, message: `${port.code} — ${port.name} saved.` };
}

export async function deletePortAction(formData) {
  requireUser();
  const id = Number(formData.get("id"));
  const port = await prisma.port.findUnique({ where: { id } });
  if (!port) throw new Error("That record no longer exists.");

  // Bookings store ports as free text (pol / pod), not as a foreign key, so
  // nothing breaks structurally. Warn anyway if the code is in use, because the
  // dropdown that offered it will stop doing so.
  const inUse = await prisma.booking.count({
    where: { OR: [{ pol: port.code }, { pod: port.code }, { pol: port.name }, { pod: port.name }] },
  });

  await prisma.port.delete({ where: { id } });
  refresh();
  return {
    ok: true,
    message: inUse
      ? `${port.code} deleted. ${inUse} booking${inUse === 1 ? "" : "s"} still show it — those keep the text as typed.`
      : `${port.code} — ${port.name} deleted.`,
  };
}

/* --------------------------------------------- partner contacts & bank accounts */
// Both hang off a single partner and are referenced by nothing else, so unlike
// partners and products they can be removed outright with no usage check.

export async function saveContactAction(formData) {
  requireUser();
  const id = formData.get("id") ? Number(formData.get("id")) : null;
  const partnerId = Number(formData.get("partnerId"));
  const name = str(formData.get("name"));
  if (!name) throw new Error("A contact name is required.");

  const data = {
    name,
    role: str(formData.get("role")),
    email: str(formData.get("email")),
    phone: str(formData.get("phone")),
  };

  if (id) await prisma.contactPerson.update({ where: { id }, data });
  else await prisma.contactPerson.create({ data: { ...data, partnerId } });

  revalidatePath(`/info/partner/${partnerId}`);
  return { ok: true, message: `${name} saved.` };
}

export async function deleteContactAction(formData) {
  requireUser();
  const id = Number(formData.get("id"));
  const contact = await prisma.contactPerson.findUnique({ where: { id } });
  if (!contact) throw new Error("That contact no longer exists.");

  await prisma.contactPerson.delete({ where: { id } });
  revalidatePath(`/info/partner/${contact.partnerId}`);
  return { ok: true, message: `${contact.name} removed.` };
}

export async function saveBankAction(formData) {
  requireUser();
  const id = formData.get("id") ? Number(formData.get("id")) : null;
  const partnerId = Number(formData.get("partnerId"));
  const bankName = str(formData.get("bankName"));
  const accountNo = str(formData.get("accountNo"));
  if (!bankName) throw new Error("A bank name is required.");
  if (!accountNo) throw new Error("An account number is required.");

  const data = {
    bankName, accountNo,
    swift: str(formData.get("swift")),
    currency: str(formData.get("currency")) || "USD",
  };

  if (id) await prisma.bankAccount.update({ where: { id }, data });
  else await prisma.bankAccount.create({ data: { ...data, partnerId } });

  revalidatePath(`/info/partner/${partnerId}`);
  return { ok: true, message: `${bankName} saved.` };
}

export async function deleteBankAction(formData) {
  requireUser();
  const id = Number(formData.get("id"));
  const bank = await prisma.bankAccount.findUnique({ where: { id } });
  if (!bank) throw new Error("That bank account no longer exists.");

  await prisma.bankAccount.delete({ where: { id } });
  revalidatePath(`/info/partner/${bank.partnerId}`);
  return { ok: true, message: `${bank.bankName} removed.` };
}
