export function fmt(n, currency) {
  const v = Number(n || 0);
  return (currency ? currency + " " : "") + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function fdate(d) {
  if (!d) return "—";
  return new Date(d).toISOString().slice(0, 10);
}
export function lineTotal(l) {
  return l.qty * l.price * (1 + (l.taxRate || 0) / 100);
}
export function orderTotal(lines) {
  return (lines || []).reduce((s, l) => s + lineTotal(l), 0);
}
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
