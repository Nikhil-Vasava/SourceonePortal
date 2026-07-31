import Link from "next/link";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fdate, fmt } from "@/lib/util";
import { PageHeader, Empty, Table } from "@/components/ui";

export const dynamic = "force-dynamic";

async function allocateLine(formData) {
  "use server";
  const lineId = Number(formData.get("lineId"));
  const buyerId = formData.get("buyerId") ? Number(formData.get("buyerId")) : null;
  await prisma.bookingLine.update({ where: { id: lineId }, data: {
    buyerId,
    salePrice: formData.get("salePrice") ? Number(formData.get("salePrice")) : null,
    saleTerms: formData.get("saleTerms") || null,
    buyerAllocatedAt: buyerId ? new Date() : null,
  }});
  revalidatePath("/buyers");
}

async function allocateBooking(formData) {
  "use server";
  const bookingId = Number(formData.get("bookingId"));
  const buyerId = formData.get("buyerId") ? Number(formData.get("buyerId")) : null;
  await prisma.booking.update({ where: { id: bookingId }, data: { buyerId } });
  if (buyerId && formData.get("applyToLines")) {
    await prisma.bookingLine.updateMany({ where: { bookingId }, data: { buyerId, buyerAllocatedAt: new Date() } });
  }
  revalidatePath("/buyers");
}

export default async function Buyers() {
  requireUser();
  const [bookings, buyers] = await Promise.all([
    prisma.booking.findMany({
      include: { buyer: true, lines: { orderBy: { lineNo: "asc" }, include: { buyer: true, product: true, supplier: true } } },
      orderBy: { id: "desc" },
    }),
    prisma.partner.findMany({ where: { type: { in: ["CUSTOMER", "BUYER"] }, active: true }, orderBy: { name: "asc" } }),
  ]);

  const allLines = bookings.flatMap(b => b.lines);
  const allocated = allLines.filter(l => l.buyerId).length;

  return (
    <div>
      <PageHeader title="Buyer" subtitle="Allocate buyers to shipments and container lines" />

      {buyers.length === 0 && (
        <div className="alert-warn mb-5">
          No buyers yet — add them in the <Link href="/info?tab=buyers" className="font-medium underline">Info tab</Link> first.
        </div>
      )}

      {bookings.length === 0 ? <Empty text="No shipments yet — create a booking first" /> : (
        <>
          <div className="mb-4 text-sm text-ink-500">{allocated} of {allLines.length} container lines allocated to a buyer</div>

          {bookings.map(b => (
            <div key={b.id} className="panel mb-4 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-ink-100 p-3">
                <div>
                  <Link href={`/bookings/${b.id}`} className="font-semibold text-brand-700">{b.number}</Link>
                  <span className="ml-2 text-xs text-ink-500">
                    {b.pol || "?"} → {b.pod || "?"} · ETA {fdate(b.eta)} · {b.lines.length} line{b.lines.length === 1 ? "" : "s"}
                  </span>
                </div>
                <form action={allocateBooking} className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                  <input type="hidden" name="bookingId" value={b.id} />
                  <span className="text-xs text-ink-500">Shipment buyer:</span>
                  <select name="buyerId" defaultValue={b.buyerId || ""} className="input w-52">
                    <option value="">— none —</option>
                    {buyers.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                  <label className="flex items-center gap-1 text-xs text-ink-600">
                    <input type="checkbox" name="applyToLines" value="1" defaultChecked /> apply to all lines
                  </label>
                  <button className="btn-secondary">Save</button>
                </form>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-ink-200">
                  <thead className="bg-sticky"><tr>
                    {["#", "Container", "Product", "Supplier", "Net (kg)", "Buyer", "Sale Price", "Terms", "Allocated", ""].map(h => <th key={h} className="th">{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-ink-100">
                    {b.lines.map(l => (
                      <tr key={l.id} className="row">
                        <td className="td">{l.lineNo}</td>
                        <td className="td font-mono text-xs">{l.containerNo || "—"}</td>
                        <td className="td">{l.product?.name || l.description || "—"}</td>
                        <td className="td">{l.supplier?.name || "—"}</td>
                        <td className="td">{l.netWeightKg != null ? fmt(l.netWeightKg) : "—"}</td>
                        <td className="td" colSpan={4}>
                          <form action={allocateLine} className="flex flex-wrap items-center gap-2">
                            <input type="hidden" name="lineId" value={l.id} />
                            <select name="buyerId" defaultValue={l.buyerId || ""} className="input w-44">
                              <option value="">— none —</option>
                              {buyers.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                            </select>
                            <input name="salePrice" type="number" step="0.01" defaultValue={l.salePrice ?? ""} placeholder="Sale price" className="input w-28" />
                            <input name="saleTerms" defaultValue={l.saleTerms || ""} placeholder="e.g. CIF Jebel Ali" className="input w-40" />
                            <span className="text-xs text-ink-400">{l.buyerAllocatedAt ? fdate(l.buyerAllocatedAt) : ""}</span>
                            <button className="btn-secondary">Save</button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
