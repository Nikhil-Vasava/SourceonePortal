import Link from "next/link";
import { fdate, fmt } from "@/lib/util";
import { Badge } from "@/components/ui";

// Phone view of a booking row.
//
// The tracking sheet has 16 columns, which is fine on a desktop and unreadable
// on a 390px screen. Rather than shrink the table, each booking becomes a card:
// the route and the cut-off dates lead, since those are what people check on
// the move, and the rest follows underneath.
//
// Rendered below `lg`; the full grid takes over above it. Both read the same
// booking object, so nothing can drift between them.

const dash = <span className="text-ink-300">—</span>;

function Row({ label, children }) {
  return (
    <div className="rec-row">
      <span className="rec-key">{label}</span>
      <span className="rec-val">{children}</span>
    </div>
  );
}

export default function BookingCard({ booking: b, children }) {
  const route = [b.pol, b.pod].filter(Boolean).join(" → ");

  return (
    <div className="rec-card">
      {/* Heading: booking number, status, route */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/bookings/${b.id}`}
            className="text-base font-semibold text-brand-700 hover:underline"
          >
            {b.number}
          </Link>
          {route && <div className="mt-0.5 truncate text-xs text-ink-500">{route}</div>}
        </div>
        <Badge value={b.status} />
      </div>

      {/* Vessel */}
      {(b.vessel || b.voyage) && (
        <div className="mt-2 text-sm font-medium text-ink-800">
          {b.vessel || "Vessel TBC"}
          {b.voyage && <span className="ml-1.5 font-normal text-ink-400">· {b.voyage}</span>}
        </div>
      )}

      {/* Containers and price — the numbers worth seeing at a glance */}
      <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-ink-100 p-2.5 text-center">
        <div>
          <div className="text-2xs uppercase tracking-wider text-ink-400">Booked</div>
          <div className="tnum text-sm font-semibold text-ink-900">{b.bookedContainers ?? "—"}</div>
        </div>
        <div>
          <div className="text-2xs uppercase tracking-wider text-ink-400">Loaded</div>
          <div className="tnum text-sm font-semibold text-ink-900">{b.loadedContainers ?? "—"}</div>
        </div>
        <div>
          <div className="text-2xs uppercase tracking-wider text-ink-400">USD / cont.</div>
          <div className="tnum text-sm font-semibold text-ink-900">
            {b.pricePerContainer != null ? fmt(b.pricePerContainer) : "—"}
          </div>
        </div>
      </div>

      {/* Cut-offs — the dates that actually bite */}
      <div className="mt-3 space-y-0.5 border-t border-ink-100 pt-2">
        <Row label="ERD">{b.erd ? fdate(b.erd) : dash}</Row>
        <Row label="Docs cut-off">{b.docsCutOff ? fdate(b.docsCutOff) : dash}</Row>
        <Row label="Cargo cut-off">{b.cargoCutOff ? fdate(b.cargoCutOff) : dash}</Row>
        <Row label="SI sent">{b.siSentDate ? fdate(b.siSentDate) : dash}</Row>
      </div>

      {/* Everything else */}
      <details className="mt-2 border-t border-ink-100 pt-2">
        <summary className="cursor-pointer list-none text-xs font-medium text-brand-600">
          More details
        </summary>
        <div className="mt-1 space-y-0.5">
          <Row label="Forwarder">{b.freightForwarder || b.forwarder?.name || dash}</Row>
          <Row label="Shipping line">{b.shippingLine?.name || dash}</Row>
          <Row label="Place of delivery">{b.placeOfDelivery || dash}</Row>
          <Row label="Other containers">{b.otherContainers || dash}</Row>
        </div>
      </details>

      {/* PO linking + edit, passed through from the page */}
      {children && <div className="mt-3 border-t border-ink-100 pt-3">{children}</div>}
    </div>
  );
}
