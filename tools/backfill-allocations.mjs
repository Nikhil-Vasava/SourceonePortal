/**
 * Turns the old single PO→booking links into allocation rows.
 *
 * Run once, after `npm run db:push` adds the PoAllocation table. Without it,
 * every purchase order already attached to a booking would read as "0 of 40
 * placed · 40 left" — the link is still on screen, but the balance can't see it.
 *
 *   npm run allocations            # dry run: prints what it would do
 *   npm run allocations:apply      # writes
 *
 * Additive only. It never deletes an allocation and never touches one that
 * already exists, so a second run changes nothing.
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

const apply = process.argv.includes("--apply");

/**
 * Mirrors bookingCapacity() in lib/po-allocation.js.
 *
 * Copied rather than imported: that file is ES module syntax in a .js, which a
 * plain node script can only load on newer releases. Four lines of duplication
 * beats a migration script that dies on someone's older Node.
 */
function bookingCapacity(booking) {
  if (booking?.bookedContainers != null && booking.bookedContainers > 0) {
    return booking.bookedContainers;
  }
  const lines = booking?.lines?.length ?? 0;
  return lines > 0 ? lines : 0;
}

const pos = await prisma.purchaseOrder.findMany({
  where: { fromBookingId: { not: null } },
  include: {
    lines: { select: { uom: true } },
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

  const qty = bookingCapacity(po.fromBooking);
  const unit = po.lines[0]?.uom ?? null;
  console.log(`${apply ? "+" : " "} ${po.number} → ${po.fromBooking.number}   ${qty}${unit ? " " + unit : ""}`);

  if (apply) {
    await prisma.poAllocation.create({ data: { poId: po.id, bookingId: po.fromBookingId, qty, unit } });
  }
  made++;
}

console.log(`\n${made} to create, ${skipped} already covered.`);
if (!apply && made) console.log("Nothing was written. Re-run with --apply to save these.");
await prisma.$disconnect();
