export function fmt(n, currency) {
  const v = Number(n || 0);
  return (currency ? currency + " " : "") + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function fdate(d) {
  if (!d) return "—";
  return new Date(d).toISOString().slice(0, 10);
}
// Order totals deliberately do NOT live here.
//
// There used to be a lineTotal/orderTotal pair doing `qty * price`, which is
// wrong whenever a line is ordered by the container but priced by the tonne —
// it turned "2 containers at USD 266/MT" into "USD 532". Use `orderValue` from
// lib/po-value.js, which only multiplies when the two units agree.
export async function nextNumber(prisma, model, prefix) {
  const count = await prisma[model].count();
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(count + 1).padStart(4, "0")}`;
}
export const STATUS_COLORS = {
  DRAFT: "bg-gray-100 text-gray-700", CONFIRMED: "bg-blue-100 text-blue-700",
  SHIPPED: "bg-indigo-100 text-indigo-700", IN_TRANSIT: "bg-indigo-100 text-indigo-700",
  DELIVERED: "bg-green-100 text-green-700", RECEIVED: "bg-green-100 text-green-700",
  ARRIVED: "bg-green-100 text-green-700", CLOSED: "bg-gray-200 text-gray-600",
  CANCELLED: "bg-red-100 text-red-700", POSTED: "bg-blue-100 text-blue-700",
  PAID: "bg-green-100 text-green-700", BILLED: "bg-purple-100 text-purple-700",
  INVOICED: "bg-purple-100 text-purple-700", PLANNED: "bg-gray-100 text-gray-700",
  LOADED: "bg-blue-100 text-blue-700",
};
