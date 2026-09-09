/**
 * Allocation maintenance.
 *
 *   npm run allocations              dry run of the backfill
 *   npm run allocations:apply        backfill: old single links → allocation rows
 *   npm run allocations:repair       dry run of the repair
 *   npm run allocations:repair:apply repair: recompute every allocation
 *
 * BACKFILL turns the old single PO→booking pointer into an allocation row, for
 * orders linked before the allocation table existed.
 *
 * REPAIR fixes rows written by the earlier version of linkPoAction, which gave
 * each order the WHOLE booking's container count instead of its own share. A
 * one-container order attached to a two-container shipment was recorded as
 * taking both containers, and claimed both container lines, leaving nothing for
 * the second order. Repair recomputes each allocation as the smaller of what
 * the order had left and what the booking still had room for — the same rule
 * the app now applies when you link — and re-deals the container lines to match.
 *
 * Both modes print what they would do and change nothing without --apply.
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Next reads .env for us; a plain node script doesn't. This has to happen
// before lib/db is loaded, which is why the require below is not a top-level
// import — those are hoisted and would run first.
if (!process.env.DATABASE_URL) {
  const envFile = path.join(ROOT, ".env");
  if (fs.existsSync(envFile) && typeof process.loadEnvFile === "function") {
    process.loadEnvFile(envFile);
  }
}

const { prisma } = require("../lib/db.js");

const apply  = process.argv.includes("--apply");
const repair = process.argv.includes("--repair");

/**
 * Mirrors bookingCapacity() in lib/po-allocation.js.
 *
 * Copied rather than imported: that file is ES module syntax in a .js, which a
 * plain node script can only load on newer releases. A few lines of duplication
 * beats a migration script that dies on someone's older Node.
 */
function bookingCapacity(booking) {
  if (booking?.bookedContainers != null && booking.bookedContainers > 0) {
    return booking.bookedContainers;
  }
  const lines = booking?.lines?.length ?? 0;
  return lines > 0 ? lines : 0;
}
const orderedQty = (po) => (po?.lines || []).reduce((s, l) => s + (Number(l.qty) || 0), 0);

// ---------------------------------------------------------------- backfill
async function backfill() {
  const pos = await prisma.purchaseOrder.findMany({
    where: { fromBookingId: { not: null } },
    include: {
      lines: { select: { uom: true, qty: true } },
      allocations: { select: { bookingId: true } },
      fromBooking: { select: { number: true, bookedContainers: true, lines: { select: { id: true } } } },
    },
    orderBy: { id: "asc" },
  });

  let made = 0, skipped = 0;
  for (const po of pos) {
    if (!po.fromBooking || po.allocations.some(a => a.bookingId === po.fromBookingId)) {
      skipped++;
      continue;
    }

    // The order's share, not the whole ship — the same rule as linkQuantity().
    const qty = Math.min(orderedQty(po), bookingCapacity(po.fromBooking)) || orderedQty(po);
    const unit = po.lines[0]?.uom ?? null;
    console.log(`${apply ? "+" : " "} ${po.number} → ${po.fromBooking.number}   ${qty}${unit ? " " + unit : ""}`);

    if (apply) {
      await prisma.poAllocation.create({ data: { poId: po.id, bookingId: po.fromBookingId, qty, unit } });
    }
    made++;
  }

  console.log(`\n${made} to create, ${skipped} already covered.`);
  if (!apply && made) console.log("Nothing was written. Re-run with --apply to save these.");
}

// ------------------------------------------------------------------ repair
async function repairAll() {
  // Every allocation in the order it was made, so replaying them reproduces
  // what the app would do today given the same sequence of clicks.
  const allocations = await prisma.poAllocation.findMany({
    orderBy: { id: "asc" },
    include: {
      po: { select: { id: true, number: true, lines: { select: { qty: true, uom: true } } } },
      booking: {
        select: { id: true, number: true, bookedContainers: true,
                  lines: { select: { id: true, lineNo: true }, orderBy: { lineNo: "asc" } } },
      },
    },
  });

  if (!allocations.length) { console.log("No allocations to check."); return; }

  const placedOnPo = new Map();     // poId      -> quantity already placed
  const takenOnBooking = new Map(); // bookingId -> containers already spoken for
  const fixes = [];

  for (const a of allocations) {
    const ordered = orderedQty(a.po);
    const capacity = bookingCapacity(a.booking);
    const placed = placedOnPo.get(a.poId) || 0;
    const taken = takenOnBooking.get(a.bookingId) || 0;

    const remaining = ordered - placed;
    const room = capacity - taken;

    // Same three branches as linkQuantity().
    let qty;
    if (remaining <= 0) qty = 0;
    else if (capacity <= 0) qty = remaining;
    else qty = Math.max(0, Math.min(remaining, room));

    placedOnPo.set(a.poId, placed + qty);
    takenOnBooking.set(a.bookingId, taken + qty);

    if (Number(a.qty) !== qty) {
      fixes.push({ id: a.id, poId: a.poId, bookingId: a.bookingId,
                   number: a.po.number, booking: a.booking.number, from: a.qty, to: qty });
    }
  }

  if (!fixes.length) console.log("Every allocation quantity is already correct.");
  for (const f of fixes) {
    const note = f.to === 0 ? "  (nothing left to place — consider unlinking)" : "";
    console.log(`${apply ? "~" : " "} ${f.number} on ${f.booking}:  ${f.from} → ${f.to}${note}`);
  }

  // Re-deal the container lines: within each booking, allocations take lines in
  // the order they were made. This is what the first order claiming every line
  // got wrong, and it can't be fixed by the quantities alone.
  const byBooking = new Map();
  for (const a of allocations) {
    if (!byBooking.has(a.bookingId)) byBooking.set(a.bookingId, []);
    byBooking.get(a.bookingId).push(a);
  }

  const lineMoves = [];
  for (const [bookingId, list] of byBooking) {
    const lines = list[0].booking.lines;
    let i = 0;
    for (const a of list) {
      const share = Math.max(0, Math.round(qtyAfter(a, fixes)));
      for (let n = 0; n < share && i < lines.length; n++, i++) {
        lineMoves.push({ lineId: lines[i].id, poId: a.poId, number: a.po.number, booking: a.booking.number, lineNo: lines[i].lineNo });
      }
    }
    // Anything past the allocated total goes back to unassigned.
    for (; i < lines.length; i++) {
      lineMoves.push({ lineId: lines[i].id, poId: null, number: "—", booking: list[0].booking.number, lineNo: lines[i].lineNo });
    }
  }

  console.log(`\n${lineMoves.length} container line assignment${lineMoves.length === 1 ? "" : "s"} to rewrite.`);

  if (apply) {
    for (const f of fixes) {
      await prisma.poAllocation.update({ where: { id: f.id }, data: { qty: f.to } });
    }
    for (const m of lineMoves) {
      const po = m.poId
        ? await prisma.purchaseOrder.findUnique({
            where: { id: m.poId },
            select: { partnerId: true, shippingTerms: true,
                      lines: { select: { productId: true, price: true, uom: true, priceUnit: true }, take: 1 } },
          })
        : null;
      await prisma.bookingLine.update({
        where: { id: m.lineId },
        data: po
          ? {
              poId: m.poId,
              supplierId: po.partnerId,
              productId: po.lines[0]?.productId ?? null,
              price: po.lines[0]?.price ?? null,
              qtyUnit: po.lines[0]?.uom ?? null,
              priceUnit: po.lines[0]?.priceUnit ?? null,
              pricingTerm: po.shippingTerms,
            }
          : { poId: null, supplierId: null },
      });
    }
    console.log(`\nApplied ${fixes.length} quantity change${fixes.length === 1 ? "" : "s"} and ${lineMoves.length} line assignment${lineMoves.length === 1 ? "" : "s"}.`);
  } else {
    console.log("Nothing was written. Re-run with --apply to save these.");
  }
}

/** The corrected quantity for an allocation — the fix if there is one, else what's stored. */
function qtyAfter(a, fixes) {
  const f = fixes.find(x => x.id === a.id);
  return f ? f.to : Number(a.qty) || 0;
}

if (repair) await repairAll();
else await backfill();

await prisma.$disconnect();
