import { prisma } from "@/lib/db";

/** PO numbers: <PREFIX><YY><MM>_<seq>, sequence resets each month. e.g. NZP2607_003 */
export async function nextPoNumber() {
  const company = await prisma.companySetting.findFirst();
  const prefix = company?.poPrefix || "NZP";
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const stem = `${prefix}${yy}${mm}_`;

  const last = await prisma.purchaseOrder.findMany({
    where: { number: { startsWith: stem } },
    orderBy: { number: "desc" },
    take: 1,
  });
  const lastSeq = last.length ? parseInt(last[0].number.split("_")[1], 10) || 0 : 0;
  return stem + String(lastSeq + 1).padStart(3, "0");
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
