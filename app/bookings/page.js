import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fdate, fmt } from "@/lib/util";
import { PageHeader, Empty, Badge } from "@/components/ui";
import EditBookingModal from "@/components/EditBookingModal";
import LinkPoCell from "@/components/LinkPoCell";
import { updateBookingAction } from "@/lib/actions-booking";
import { linkPoAction, unlinkPoAction } from "@/lib/actions-po";
import { IconUpload, IconPlus, IconCheck } from "@/components/icons";

export const dynamic = "force-dynamic";

// Matches the tracking sheet, column for column.
const COLS = [
  { label: "Freight Forwarder", w: 150 },
  { label: "Booking No.", w: 120, sticky: true },
  { label: "Shipping Line", w: 130 },
  { label: "Vessel Name", w: 140 },
  { label: "Voyage No.", w: 80 },
  { label: "Port of Loading", w: 110 },
  { label: "Port of Destination", w: 120 },
  { label: "Place of Delivery", w: 130 },
  { label: "Price / Cont. (In USD)", w: 100, align: "right" },
  { label: "Booked Cont.", w: 70, align: "center" },
  { label: "Loaded Cont.", w: 70, align: "center" },
  { label: "Other Cont. (If Cancel, mention WO/Charge or W/Charge)", w: 190 },
  { label: "ERD", w: 90 },
  { label: "Docs Cut Off", w: 90 },
  { label: "Cargo Cut-Off", w: 90 },
  { label: "SI Sent Date", w: 90 },
];

const dash = <span className="text-ink-300">—</span>;

export default async function Bookings({ searchParams }) {
  requireUser();
  const [bookings, allPosRaw] = await Promise.all([
    prisma.booking.findMany({
      include: {
        shippingLine: true, forwarder: true, lines: true,
        purchaseOrders: { include: { partner: true } },
      },
      orderBy: { id: "desc" },
    }),
    prisma.purchaseOrder.findMany({
      include: { partner: true, lines: { include: { product: true } } },
      orderBy: { id: "desc" },
    }),
  ]);

  const allPos = allPosRaw.map(p => ({
    id: p.id,
    number: p.number,
    fromBookingId: p.fromBookingId,
    partnerName: p.partner.name,
    summary: p.lines.map(l => l.product?.name).filter(Boolean).join(", ").slice(0, 40),
  }));

  const plain = (o) => JSON.parse(JSON.stringify(o));
  const td = "border-b border-r border-ink-200/60 px-2.5 py-2 align-middle";

  return (
    <div>
      <PageHeader
        title="Bookings"
        subtitle={`${bookings.length} shipment${bookings.length === 1 ? "" : "s"} · import carrier confirmations or add manually`}
        action={<>
          <Link href="/bookings/import" className="btn"><IconUpload size={16} /> Import booking</Link>
          <Link href="/bookings/new" className="btn-secondary"><IconPlus size={16} /> Add booking</Link>
        </>}
      />

      {searchParams?.imported && (
        <div className="alert-success mb-5">
          <IconCheck size={18} className="mt-0.5 shrink-0 text-emerald-600" />
          <div>
            <b>Imported {searchParams.imported} booking{searchParams.imported === "1" ? "" : "s"}.</b>{" "}
            Review the rows below, then fill in Price / Cont. via <b>Edit</b>.
          </div>
        </div>
      )}

      {bookings.length === 0 ? (
        <Empty
          text="No bookings yet. Import a carrier booking PDF — Maersk, MSC and ONE are read automatically."
          action={<Link href="/bookings/import" className="btn"><IconUpload size={16} /> Import booking</Link>}
        />
      ) : (
        <div className="card-flush overflow-hidden">
          <div className="max-h-[calc(100vh-15rem)] overflow-auto">
            <table className="min-w-full border-separate border-spacing-0 text-xs">
              <thead>
                <tr>
                  {COLS.map(c => (
                    <th key={c.label}
                        style={{ minWidth: c.w }}
                        className={`sticky top-0 z-20 border-b border-r border-ink-200 bg-ink-50 px-2.5 py-2.5
                                   text-left text-2xs font-semibold uppercase leading-tight tracking-wide text-ink-500
                                   ${c.sticky ? "left-0 z-30" : ""}`}>
                      {c.label}
                    </th>
                  ))}
                  {["Status", "Purchase Order", ""].map(h => (
                    <th key={h} className="sticky top-0 z-20 border-b border-r border-ink-200 bg-ink-50 px-2.5 py-2.5
                                           text-left text-2xs font-semibold uppercase tracking-wide text-ink-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bookings.map(b => (
                  <tr key={b.id} className="group transition-colors hover:bg-brand-50/40">
                    <td className={td}>{b.freightForwarder || b.forwarder?.name || dash}</td>
                    <td className={`${td} sticky left-0 z-10 bg-white font-semibold group-hover:bg-brand-50/40`}>
                      <Link href={`/bookings/${b.id}`} className="text-brand-700 hover:text-brand-800 hover:underline">
                        {b.number}
                      </Link>
                    </td>
                    <td className={td}>{b.shippingLine?.name || dash}</td>
                    <td className={`${td} font-medium text-ink-800`}>{b.vessel || dash}</td>
                    <td className={`${td} tnum`}>{b.voyage || dash}</td>
                    <td className={td}>{b.pol || dash}</td>
                    <td className={td}>{b.pod || dash}</td>
                    <td className={td}>{b.placeOfDelivery || dash}</td>
                    <td className={`${td} text-right tnum font-medium`}>
                      {b.pricePerContainer != null ? fmt(b.pricePerContainer) : dash}
                    </td>
                    <td className={`${td} text-center tnum`}>{b.bookedContainers ?? dash}</td>
                    <td className={`${td} text-center tnum`}>{b.loadedContainers ?? dash}</td>
                    <td className={td}>{b.otherContainers || dash}</td>
                    <td className={`${td} whitespace-nowrap`}>{b.erd ? fdate(b.erd) : dash}</td>
                    <td className={`${td} whitespace-nowrap`}>{b.docsCutOff ? fdate(b.docsCutOff) : dash}</td>
                    <td className={`${td} whitespace-nowrap`}>{b.cargoCutOff ? fdate(b.cargoCutOff) : dash}</td>
                    <td className={`${td} whitespace-nowrap`}>{b.siSentDate ? fdate(b.siSentDate) : dash}</td>
                    <td className={td}><Badge value={b.status} /></td>
                    <td className={td}>
                      <LinkPoCell
                        booking={plain({
                          id: b.id,
                          purchaseOrders: b.purchaseOrders.map(p => ({ id: p.id, number: p.number, partnerName: p.partner.name })),
                        })}
                        allPos={allPos}
                        linkAction={linkPoAction}
                        unlinkAction={unlinkPoAction}
                      />
                    </td>
                    <td className={td}>
                      <EditBookingModal booking={plain(b)} action={updateBookingAction} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {bookings.length > 0 && (
        <p className="mt-3 text-2xs text-ink-400">
          Scroll sideways for all 16 columns — the booking number stays pinned. Create purchase orders on the{" "}
          <Link href="/purchase" className="text-brand-600 hover:underline">Purchase</Link> tab, then attach one here.
        </p>
      )}
    </div>
  );
}
