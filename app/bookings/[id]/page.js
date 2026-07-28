import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fdate, fmt } from "@/lib/util";
import { PageHeader, Info, Badge } from "@/components/ui";
import EditBookingModal from "@/components/EditBookingModal";
import { updateBookingAction } from "@/lib/actions-booking";

export const dynamic = "force-dynamic";

const FLOW = { DRAFT: ["CONFIRMED", "CANCELLED"], CONFIRMED: ["SHIPPED", "CANCELLED"], SHIPPED: ["DELIVERED"], DELIVERED: ["CLOSED"] };

async function setStatus(formData) {
  "use server";
  const id = Number(formData.get("id"));
  await prisma.booking.update({ where: { id }, data: { status: formData.get("status") } });
  revalidatePath(`/bookings/${id}`);
}

async function addLine(formData) {
  "use server";
  const bookingId = Number(formData.get("bookingId"));
  const count = await prisma.bookingLine.count({ where: { bookingId } });
  await prisma.bookingLine.create({ data: { bookingId, lineNo: count + 1 } });
  revalidatePath(`/bookings/${bookingId}`);
}

async function deleteLine(formData) {
  "use server";
  const bookingId = Number(formData.get("bookingId"));
  await prisma.bookingLine.delete({ where: { id: Number(formData.get("lineId")) } });
  revalidatePath(`/bookings/${bookingId}`);
}

export default async function BookingDetail({ params, searchParams }) {
  requireUser();
  const id = Number(params.id);
  const b = await prisma.booking.findUnique({
    where: { id },
    include: {
      shippingLine: true, forwarder: true, cha: true, buyer: true,
      purchaseOrders: true,
      lines: { orderBy: { lineNo: "asc" }, include: { supplier: true, product: true, po: true, buyer: true } },
    },
  });
  if (!b) notFound();

  const [suppliers, products] = await Promise.all([
    prisma.partner.findMany({ where: { type: { in: ["VENDOR", "BUYER"] } }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader title={b.number} subtitle={<span>Booking · <Badge value={b.status} />{b.sourceFile && <span className="ml-2 text-xs text-ink-400">imported from {b.sourceFile}</span>}</span>}
        action={<div className="flex flex-wrap gap-2">
          <EditBookingModal booking={JSON.parse(JSON.stringify(b))} action={updateBookingAction} />
          {(FLOW[b.status] || []).map(s => (
            <form key={s} action={setStatus}>
              <input type="hidden" name="id" value={b.id} /><input type="hidden" name="status" value={s} />
              <button className={s === "CANCELLED" ? "btn-danger" : "btn-secondary"}>{s === "CANCELLED" ? "Cancel" : `Mark ${s}`}</button>
            </form>
          ))}
        </div>} />

      {searchParams?.imported && (
        <div className="alert-success mb-5">
          ✓ Booking imported. Review the details below, then use <b>Generate PO</b> on each line.
        </div>
      )}

      <div className="card mb-5 grid grid-cols-2 gap-5 sm:grid-cols-4">
        <Info label="Shipping Line" value={b.shippingLine?.name} />
        <Info label="Forwarder" value={b.forwarder?.name} />
        <Info label="CHA" value={b.cha?.name} />
        <Info label="Buyer" value={b.buyer?.name} />
        <Info label="Vessel / Voyage" value={[b.vessel, b.voyage].filter(Boolean).join(" / ") || "—"} />
        <Info label="Route" value={`${b.pol || "?"} → ${b.pod || "?"}`} />
        <Info label="Place of Delivery" value={b.placeOfDelivery} />
        <Info label="ETD / ETA" value={`${fdate(b.etd)} / ${fdate(b.eta)}`} />
        <Info label="ERD" value={fdate(b.erd)} />
        <Info label="Docs Cut Off" value={fdate(b.docsCutOff)} />
        <Info label="Cargo Cut-Off" value={fdate(b.cargoCutOff)} />
        <Info label="SI Sent Date" value={fdate(b.siSentDate)} />
        <Info label="Booked / Loaded Cont." value={`${b.bookedContainers ?? "—"} / ${b.loadedContainers ?? "—"}`} />
        <Info label="Price / Cont. (USD)" value={b.pricePerContainer != null ? fmt(b.pricePerContainer) : null} />
        <Info label="Container Type" value={b.containerType} />
        <Info label="Commodity" value={b.commodity} />
        <Info label="Other Cont." value={b.otherContainers} />
      </div>

      <div className="card p-0">
        <div className="flex items-center justify-between border-b p-3">
          <h3 className="text-sm font-semibold">Container Lines <span className="font-normal text-ink-400">({b.lines.length})</span></h3>
          <form action={addLine}><input type="hidden" name="bookingId" value={b.id} /><button className="btn-secondary">+ Add Line</button></form>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-ink-200">
            <thead className="bg-ink-50"><tr>
              {["#", "Container", "Type", "Description", "Qty", "Supplier", "Product", "Price", "Pricing", "PO", ""].map(h => <th key={h} className="th">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-ink-100">
              {b.lines.map(l => (
                <tr key={l.id} className="hover:bg-ink-50">
                  <td className="td">{l.lineNo}</td>
                  <td className="td font-mono text-xs">{l.containerNo || "—"}</td>
                  <td className="td">{l.containerType || "—"}</td>
                  <td className="td">{l.description || "—"}</td>
                  <td className="td">{l.quantity != null ? `${l.quantity} ${l.qtyUnit || ""}` : "—"}</td>
                  <td className="td">{l.supplier?.name || <span className="text-ink-300">not set</span>}</td>
                  <td className="td">{l.product?.name || <span className="text-ink-300">not set</span>}</td>
                  <td className="td">{l.price != null ? `${fmt(l.price)} ${l.priceUnit || ""}` : "—"}</td>
                  <td className="td">{l.pricingTerm || "—"}</td>
                  <td className="td">
                    {l.po ? (
                      <a href={`/api/po/${l.po.id}`} target="_blank" rel="noreferrer" className="font-medium text-brand-700 underline">{l.po.number}</a>
                    ) : <span className="text-ink-300">—</span>}
                  </td>
                  <td className="td">
                    {!l.poId && (
                      <form action={deleteLine}>
                        <input type="hidden" name="lineId" value={l.id} /><input type="hidden" name="bookingId" value={b.id} />
                        <button className="text-xs text-red-500">✕</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {b.extractedJson && (
        <details className="card mt-4">
          <summary className="cursor-pointer text-sm font-semibold">Raw extracted data</summary>
          <pre className="mt-2 overflow-x-auto rounded bg-ink-50 p-3 text-xs">{b.extractedJson}</pre>
        </details>
      )}
    </div>
  );
}
