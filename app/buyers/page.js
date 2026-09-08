import Link from "next/link";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser, canSeePrices } from "@/lib/auth";
import { fdate, fmt } from "@/lib/util";
import { PageHeader, Empty, Table } from "@/components/ui";
import { ACTIVE_BOOKING } from "@/lib/booking-scope";
import TableToolbar from "@/components/TableToolbar";
import ShipmentPanel from "@/components/ShipmentPanel";
import WorkSection from "@/components/WorkSection";
import { readTableQuery, matchesText } from "@/lib/table-query";

export const dynamic = "force-dynamic";

async function allocateLine(formData) {
  "use server";
  requireUser();
  const lineId = Number(formData.get("lineId"));
  const buyerId = formData.get("buyerId") ? Number(formData.get("buyerId")) : null;

  // The sale price input is hidden from anyone who can't see prices — and a
  // hidden input submits nothing at all. Writing `null` on its absence would
  // let an operations user silently erase a figure they were never shown, just
  // by allocating a buyer. Only touch it when the field was actually present.
  const hasSalePrice = formData.has("salePrice");

  await prisma.bookingLine.update({ where: { id: lineId }, data: {
    buyerId,
    ...(hasSalePrice && {
      salePrice: formData.get("salePrice") ? Number(formData.get("salePrice")) : null,
    }),
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

export default async function Buyers({ searchParams }) {
  const user = requireUser();
  const seePrices = canSeePrices(user);
  const query = readTableQuery(searchParams);

  const [allBookings, buyers] = await Promise.all([
    prisma.booking.findMany({
      where: ACTIVE_BOOKING,
      include: { buyer: true, lines: { orderBy: { lineNo: "asc" }, include: { buyer: true, product: true, supplier: true } } },
      orderBy: { id: "desc" },
    }),
    prisma.partner.findMany({ where: { type: { in: ["CUSTOMER", "BUYER"] }, active: true }, orderBy: { name: "asc" } }),
  ]);

  // A shipment stays if it matches, or if any line inside it does — searching a
  // buyer name should surface the shipments allocated to them.
  const bookings = allBookings.filter(b => matchesText(query.q, [
    b.number, b.vessel, b.voyage, b.pol, b.pod, b.placeOfDelivery, b.buyer?.name,
    ...b.lines.flatMap(l => [
      l.containerNo, l.buyer?.name, l.supplier?.name, l.product?.name, l.description, l.saleTerms,
    ]),
  ]));

  const allLines = bookings.flatMap(b => b.lines);
  const allocated = allLines.filter(l => l.buyerId).length;

  // Done means every container on the shipment has a buyer against it.
  const isComplete = (b) => b.lines.length > 0 && b.lines.every(l => l.buyerId);
  const pending = bookings.filter(b => !isComplete(b));
  const complete = bookings.filter(isComplete);

  const countNote = (list) => {
    const c = list.reduce((s, b) => s + b.lines.length, 0);
    return `${list.length} shipment${list.length === 1 ? "" : "s"} · ${c} line${c === 1 ? "" : "s"}`;
  };

  const panel = (b, open) => {
    const done = b.lines.filter(l => l.buyerId).length;
    return (
      <ShipmentPanel
        key={b.id}
        defaultOpen={open}
        summary={`${b.lines.length} line${b.lines.length === 1 ? "" : "s"} — show details`}
        header={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link href={`/bookings/${b.id}`} className="font-semibold text-brand-700 hover:underline">{b.number}</Link>
            <span className="text-xs text-ink-500">
              {b.pol || "?"} → {b.pod || "?"} · ETA {fdate(b.eta)} · {b.lines.length} line{b.lines.length === 1 ? "" : "s"}
            </span>
            <span className={`badge ${done === b.lines.length && b.lines.length ? "bg-emerald-50 text-emerald-700" : "bg-ink-100 text-ink-600"}`}>
              {done}/{b.lines.length} allocated
            </span>
          </div>
        }
        actions={
          <form action={allocateBooking} className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <input type="hidden" name="bookingId" value={b.id} />
            <span className="text-xs text-ink-500">Shipment buyer:</span>
            <select name="buyerId" defaultValue={b.buyerId || ""} className="input input-sm w-full min-w-0 sm:w-44">
              <option value="">— none —</option>
              {buyers.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            <label className="flex items-center gap-1 text-xs text-ink-600">
              <input type="checkbox" name="applyToLines" value="1" defaultChecked /> apply to all lines
            </label>
            <button className="btn-secondary btn-sm">Save</button>
          </form>
        }
      >
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
                    {seePrices && <input name="salePrice" type="number" step="0.01" defaultValue={l.salePrice ?? ""} placeholder="Sale price" className="input w-28" />}
                    <input name="saleTerms" defaultValue={l.saleTerms || ""} placeholder="e.g. CIF Jebel Ali" className="input w-40" />
                    <span className="text-xs text-ink-400">{l.buyerAllocatedAt ? fdate(l.buyerAllocatedAt) : ""}</span>
                    <button className="btn-secondary">Save</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ShipmentPanel>
    );
  };

  return (
    <div>
      <PageHeader title="Buyer" subtitle="Allocate buyers to shipments and container lines" />

      {buyers.length === 0 && (
        <div className="alert-warn mb-5">
          No buyers yet — add them in the <Link href="/info?tab=buyers" className="font-medium underline">Info tab</Link> first.
        </div>
      )}

      {allBookings.length > 0 && (
        <TableToolbar
          action="/buyers"
          query={query}
          searchPlaceholder="Booking no, container, buyer, product, terms…"
          showDates={false}
          sortable={false}
          unit="shipment"
          total={allBookings.length}
          shown={bookings.length}
        />
      )}

      {bookings.length === 0 ? (
        <Empty
          text={allBookings.length === 0
            ? "No shipments yet — create a booking first"
            : "No shipments match that search."}
          action={allBookings.length > 0
            ? <Link href="/buyers" className="btn-secondary">Clear search</Link>
            : undefined}
        />
      ) : (
        <>
          <div className="mb-4 text-sm text-ink-500">{allocated} of {allLines.length} container lines allocated to a buyer</div>

          <WorkSection
            title="Needs a buyer"
            count={pending.length}
            note={countNote(pending)}
            tone="work"
            collapsible={false}
          >
            {pending.map(b => panel(b, true))}
          </WorkSection>

          <WorkSection
            title="Fully allocated"
            count={complete.length}
            note={countNote(complete)}
            tone="done"
            defaultOpen={false}
          >
            {complete.map(b => panel(b, false))}
          </WorkSection>

        </>
      )}
    </div>
  );
}
