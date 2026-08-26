import { prisma } from "@/lib/db";

/** True for a product category that earns the "P" suffix on the PO prefix. */
export function isPlasticCategory(category) {
  return /plastic/i.test(String(category || ""));
}

/**
 * The prefix for a PO: "NZP" for plastics, "NZ" for everything else.
 *
 * The stored setting has historically been "NZP", so a trailing P is stripped
 * to recover the base — otherwise appending another would produce "NZPP".
 */
export function poPrefixFor(category, storedPrefix) {
  const base = String(storedPrefix || "NZ").replace(/P$/, "") || "NZ";
  return isPlasticCategory(category) ? `${base}P` : base;
}

/**
 * PO numbers: <PREFIX><YY><MM>_<seq>, e.g. NZP2608_004 (plastics) or
 * NZ2608_005 (everything else).
 *
 * The sequence is shared across both prefixes within a month rather than kept
 * per-prefix. Separate counters would let NZ2608_001 and NZP2608_001 both
 * exist, two different orders a month apart from each other in name only — and
 * "PO oh-oh-one" would stop identifying anything. One counter costs a few gaps
 * in each series and buys an unambiguous number.
 *
 * @param {string|null} category product category of the PO's first line
 */
export async function nextPoNumber(category = null) {
  const company = await prisma.companySetting.findFirst();
  const prefix = poPrefixFor(category, company?.poPrefix);

  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const period = `${yy}${mm}_`;

  // Look at both series for this month. `endsWith` isn't indexed, but a month
  // of purchase orders is a handful of rows.
  const base = prefix.replace(/P$/, "");
  const thisMonth = await prisma.purchaseOrder.findMany({
    where: { OR: [{ number: { startsWith: `${base}${period}` } },
                  { number: { startsWith: `${base}P${period}` } }] },
    select: { number: true },
  });

  const lastSeq = thisMonth.reduce((max, { number }) => {
    const n = parseInt(number.split("_")[1], 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);

  return `${prefix}${period}${String(lastSeq + 1).padStart(3, "0")}`;
}

/** Booking numbers: BK-YYYY-NNNN */
export async function nextBookingNumber() {
  const year = new Date().getFullYear();
  const stem = `BK-${year}-`;
  const last = await prisma.booking.findMany({
    where: { number: { startsWith: stem } },
    orderBy: { number: "desc" },
    take: 1,
  });
  const lastSeq = last.length ? parseInt(last[0].number.split("-")[2], 10) || 0 : 0;
  return stem + String(lastSeq + 1).padStart(4, "0");
}

export function usDate(d) {
  const x = d ? new Date(d) : new Date();
  const mm = String(x.getMonth() + 1).padStart(2, "0");
  const dd = String(x.getDate()).padStart(2, "0");
  return `${mm}-${dd}-${x.getFullYear()}`;
}
