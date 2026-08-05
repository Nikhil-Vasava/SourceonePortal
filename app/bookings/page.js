import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fdate, fmt } from "@/lib/util";
import { PageHeader, Empty, Badge } from "@/components/ui";
import EditBookingModal from "@/components/EditBookingModal";
import BookingCard from "@/components/BookingCard";
import LinkPoCell from "@/components/LinkPoCell";
import { updateBookingAction } from "@/lib/actions-booking";
import { linkPoAction, unlinkPoAction } from "@/lib/actions-po";
import { IconUpload, IconPlus, IconCheck } from "@/components/icons";
import TableToolbar from "@/components/TableToolbar";
import SortHeader from "@/components/SortHeader";
import { readTableQuery, sortRows, searchWhere, dateRangeWhere } from "@/lib/table-query";

export const dynamic = "force-dynamic";

// Matches the tracking sheet, column for column.
// `key` is what the row sorts by; `dir` is the direction a first click uses —
// text reads best A-Z, dates and counts newest/largest first.
const COLS = [
  { label: "Freight Forwarder", w: 150, key: "forwarder", dir: "asc" },
  { label: "Booking No.", w: 120, sticky: true, key: "number", dir: "asc" },
  { label: "Shipping Line", w: 130, key: "line", dir: "asc" },
  { label: "Vessel Name", w: 140, key: "vessel", dir: "asc" },
  { label: "Voyage No.", w: 80, key: "voyage", dir: "asc" },
  { label: "Port of Loading", w: 110, key: "pol", dir: "asc" },
  { label: "Port of Destination", w: 120, key: "pod", dir: "asc" },
  { label: "Place of Delivery", w: 130, key: "delivery", dir: "asc" },
  { label: "Price / Cont. (In USD)", w: 100, align: "right", key: "price", dir: "desc" },
  { label: "Booked Cont.", w: 70, align: "center", key: "booked", dir: "desc" },
  { label: "Loaded Cont.", w: 70, align: "center", key: "loaded", dir: "desc" },
  { label: "Other Cont. (If Cancel, mention WO/Charge or W/Charge)", w: 190, key: "other", dir: "asc" },
  { label: "ERD", w: 90, key: "erd", dir: "desc" },
  { label: "Docs Cut Off", w: 90, key: "docsCutOff", dir: "desc" },
  { label: "Cargo Cut-Off", w: 90, key: "cargoCutOff", dir: "desc" },
  { label: "SI Sent Date", w: 90, key: "siSentDate", dir: "desc" },
];

// How each sort key reads a value off a booking row.
const SORT_ACCESSORS = {
  forwarder:   b => b.freightForwarder || b.forwarder?.name,
  number:      b => b.number,
  line:        b => b.shippingLine?.name,
  vessel:      b => b.vessel,
  voyage:      b => b.voyage,
  pol:         b => b.pol,
  pod:         b => b.pod,
  delivery:    b => b.placeOfDelivery,
  price:       b => b.pricePerContainer,
  booked:      b => b.bookedContainers,
  loaded:      b => b.loadedContainers,
  other:       b => b.otherContainers,
  erd:         b => b.erd,
  docsCutOff:  b => b.docsCutOff,
  cargoCutOff: b => b.cargoCutOff,
  siSentDate:  b => b.siSentDate,
  status:      b => b.status,
};

const dash = <span className="text-ink-300">—</span>;

export default async function Bookings({ searchParams }) {
  requireUser();

  // Newest first by default — most people are looking at what just came in.
  const query = readTableQuery(searchParams, { defaultSort: "erd", defaultDir: "desc" });

  const where = {
    ...searchWhere(query.q, [
      "number", "vessel", "voyage", "pol", "pod", "placeOfDelivery",
      "freightForwarder", "commodity",
    ]),
    ...dateRangeWhere("erd", query.from, query.to),
  };

  const [bookings, allPosRaw, total] = await Promise.all([
    prisma.booking.findMany({
      where,
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
    prisma.booking.count(),
  ]);

  // Sorted here rather than in the query: several columns come off relations,
  // and this keeps blanks at the bottom in both directions.
  const rows = sortRows(bookings, SORT_ACCESSORS[query.sort] || SORT_ACCESSORS.erd, query.dir);

  const allPos = allPosRaw.map(p => ({
    id: p.id,
    number: p.number,
    fromBookingId: p.fromBookingId,
    partnerName: p.partner.name,
    summary: p.lines.map(l => l.product?.name).filter(Boolean).join(", ").slice(0, 40),
  }));

  const plain = (o) => JSON.parse(JSON.stringify(o));
  const td = "border-b border-r border-ink-200 px-2.5 py-2 align-middle text-ink-700";

  return (
    <div>
      <PageHeader
        title="Bookings"
        subtitle={`${total} shipment${total === 1 ? "" : "s"} · import carrier confirmations or add manually`}
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
            {searchParams.how && (
              <div className="mt-1 text-2xs opacity-80">Read by: {decodeURIComponent(searchParams.how)}</div>
            )}
          </div>
        </div>
      )}

      {total > 0 && (
        <TableToolbar
          action="/bookings"
          query={query}
          searchPlaceholder="Booking no, vessel, voyage, port…"
          dateLabel="ERD"
          total={total}
          shown={rows.length}
        />
      )}

      {rows.length === 0 ? (
        <Empty
          text={total === 0
            ? "No bookings yet. Import a carrier booking PDF — Maersk, MSC and ONE are read automatically."
            : "No bookings match those filters."}
          action={<Link href="/bookings/import" className="btn"><IconUpload size={16} /> Import booking</Link>}
        />
      ) : (
        <>
        {/* Phone: one card per booking. The 16-column grid is unusable at this width. */}
        <div className="space-y-3 lg:hidden">
          {rows.map(b => (
            <BookingCard key={b.id} booking={plain(b)}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <LinkPoCell
                  booking={plain({
                    id: b.id,
                    purchaseOrders: b.purchaseOrders.map(p => ({ id: p.id, number: p.number, partnerName: p.partner.name })),
                  })}
                  allPos={allPos}
                  linkAction={linkPoAction}
                  unlinkAction={unlinkPoAction}
                />
                <EditBookingModal booking={plain(b)} action={updateBookingAction} />
              </div>
            </BookingCard>
          ))}
        </div>

        {/* Desktop: the full tracking sheet */}
        <div className="card-flush hidden overflow-hidden lg:block">
          <div className="max-h-[calc(100vh-15rem)] overflow-auto">
            <table className="min-w-full border-separate border-spacing-0 text-xs">
              <thead>
                <tr>
                  {COLS.map(c => (
                    <SortHeader
                      key={c.label}
                      column={c.key}
                      label={c.label}
                      query={query}
                      basePath="/bookings"
                      naturalDir={c.dir}
                      align={c.align}
                      style={{ minWidth: c.w }}
                      className={`sticky top-0 z-20 border-b border-r border-ink-200 bg-sticky px-2.5 py-2.5
                                 text-left text-2xs font-semibold uppercase leading-tight tracking-wide text-ink-400
                                 ${c.sticky ? "left-0 z-30 frozen-edge" : ""}`}
                    />
                  ))}
                  <SortHeader
                    column="status" label="Status" query={query} basePath="/bookings" naturalDir="asc"
                    className="sticky top-0 z-20 border-b border-r border-ink-200 bg-sticky px-2.5 py-2.5
                               text-left text-2xs font-semibold uppercase tracking-wide text-ink-400"
                  />
                  {["Purchase Order", ""].map(h => (
                    <th key={h} className="sticky top-0 z-20 border-b border-r border-ink-200 bg-sticky px-2.5 py-2.5
                                           text-left text-2xs font-semibold uppercase tracking-wide text-ink-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(b => (
                  <tr key={b.id} className="group row">
                    <td className={td}>{b.freightForwarder || b.forwarder?.name || dash}</td>
                    <td className={`${td} frozen-cell frozen-edge left-0 z-10 font-semibold`}>
                      <Link href={`/bookings/${b.id}`} className="text-brand-600 hover:text-brand-400 hover:underline">
                        {b.number}
                      </Link>
                    </td>
                    <td className={td}>{b.shippingLine?.name || dash}</td>
                    <td className={`${td} font-medium text-ink-800`}>{b.vessel || dash}</td>
                    <td className={`${td} tnum`}>{b.voyage || dash}</td>
                    <td className={td}>{b.pol || dash}</td>
                    <td className={td}>{b.pod || dash}</td>
                    <td className={td}>{b.placeOfDelivery || dash}</td>
                    <td className={`${td} text-right tnum font-semibold figure-key`}>
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
        </>
      )}

      {rows.length > 0 && (
        <p className="mt-3 text-2xs text-ink-400">
          <span className="hidden lg:inline">
            Scroll sideways for all 16 columns — the booking number stays pinned.{" "}
          </span>
          <span className="lg:hidden">Tap a booking number to open it.{" "}</span>
          Create purchase orders on the{" "}
          <Link href="/purchase" className="text-brand-600 hover:underline">Purchase</Link> tab, then attach one here.
        </p>
      )}
    </div>
  );
}
