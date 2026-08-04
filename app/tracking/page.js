import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { fdate } from "@/lib/util";
import { PageHeader, Empty, Badge } from "@/components/ui";
import { SlaBadge } from "@/components/SlaBadge";
import { MarkDelivered, UndoDelivered, SetDeparture } from "@/components/DeliveryControls";
import { markDeliveredAction, undoDeliveredAction, setDepartureAction } from "@/lib/actions-delivery";
import { bookingClocks, severity, needsFollowUp } from "@/lib/sla";
import { IconAlert, IconCheck, IconShip } from "@/components/icons";
import { ACTIVE_BOOKING } from "@/lib/booking-scope";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "open", label: "In transit" },
  { key: "followup", label: "Needs follow-up" },
  { key: "overdue", label: "Overdue" },
  { key: "delivered", label: "Delivered" },
  { key: "all", label: "All" },
];

export default async function Tracking({ searchParams }) {
  requireUser();
  const filter = searchParams?.filter || "followup";

  const [bookings, company] = await Promise.all([
    prisma.booking.findMany({
      // A cancelled shipment has no delivery to chase — no clock should run on it.
      where: ACTIVE_BOOKING,
      include: {
        shippingLine: true,
        lines: { select: { buyerAllocatedAt: true, buyer: { select: { name: true } } } },
      },
      orderBy: { id: "desc" },
    }),
    getCompany(),
  ]);

  const now = new Date();

  // Clocks are computed once here and reused for filtering, sorting and display,
  // so a booking can't be counted urgent in one place and calm in another.
  const rows = bookings.map(b => {
    const clocks = bookingClocks(b, company, now);
    const buyers = [...new Set(b.lines.map(l => l.buyer?.name).filter(Boolean))];
    return { b, clocks, buyers, follow: needsFollowUp(clocks) };
  });

  const visible = rows
    .filter(r => {
      switch (filter) {
        case "open": return !r.b.deliveredAt;
        case "followup": return !r.b.deliveredAt && r.follow;
        case "overdue": return !r.b.deliveredAt &&
          (r.clocks.carrier.band === "breached" || r.clocks.buyer.band === "breached");
        case "delivered": return Boolean(r.b.deliveredAt);
        default: return true;
      }
    })
    .sort((a, z) => severity(z.clocks.worst) - severity(a.clocks.worst));

  const counts = {
    open: rows.filter(r => !r.b.deliveredAt).length,
    followup: rows.filter(r => !r.b.deliveredAt && r.follow).length,
    overdue: rows.filter(r => !r.b.deliveredAt &&
      (r.clocks.carrier.band === "breached" || r.clocks.buyer.band === "breached")).length,
    delivered: rows.filter(r => r.b.deliveredAt).length,
    all: rows.length,
  };

  return (
    <div>
      <PageHeader
        title="Tracking"
        subtitle={`Carrier ${company.carrierSlaDays} days from sailing · buyer ${company.buyerSlaDays} days from allocation · chase from day ${company.slaWarnDays}`}
      />

      {counts.overdue > 0 && (
        <div className="alert-error mb-5">
          <IconAlert size={18} className="mt-0.5 shrink-0" />
          <div>
            <b>{counts.overdue} shipment{counts.overdue === 1 ? " is" : "s are"} past the contractual window.</b>{" "}
            These are already breached — chase the carrier or buyer today.
          </div>
        </div>
      )}

      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <Link key={f.key} href={`/tracking?filter=${f.key}`}
            className={`chip px-3 py-1.5 ${filter === f.key ? "chip-active" : ""}`}>
            {f.label}
            <span className={`ml-1 tnum ${filter === f.key ? "opacity-80" : "text-ink-400"}`}>
              {counts[f.key]}
            </span>
          </Link>
        ))}
      </div>

      {visible.length === 0 ? (
        <Empty
          text={
            filter === "followup"
              ? `Nothing needs chasing — no shipment has passed day ${company.slaWarnDays}.`
              : filter === "overdue"
                ? "Nothing is overdue."
                : "No shipments here."
          }
          action={<Link href="/bookings" className="btn-secondary"><IconShip size={16} /> Go to bookings</Link>}
        />
      ) : (
        <div className="space-y-3">
          {visible.map(({ b, clocks, buyers }) => (
            <div
              key={b.id}
              className={`panel border-l-4 p-4 ${
                clocks.worst.tone === "red" ? "border-l-red-500"
                : clocks.worst.tone === "amber" ? "border-l-amber-400"
                : clocks.worst.tone === "emerald" ? "border-l-emerald-400"
                : "border-l-ink-200"
              }`}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                {/* Who and where */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Link href={`/bookings/${b.id}`} className="font-semibold text-brand-700 hover:underline">
                      {b.number}
                    </Link>
                    <Badge value={b.status} />
                    {b.deliveredAt && (
                      <span className="badge bg-emerald-50 text-emerald-700">
                        <IconCheck size={11} /> Delivered {fdate(b.deliveredAt)}
                      </span>
                    )}
                  </div>

                  <div className="mt-1 text-sm text-ink-600">
                    {[b.pol, b.pod].filter(Boolean).join(" → ") || "Route not set"}
                    {b.vessel && <span className="text-ink-400"> · {b.vessel}</span>}
                  </div>

                  <div className="mt-1.5 space-y-0.5 text-2xs text-ink-500">
                    <div>
                      Carrier: <b className="text-ink-700">{b.shippingLine?.name || b.freightForwarder || "—"}</b>
                      {" · sailed "}
                      <b className="text-ink-700">
                        {b.actualDeparture ? fdate(b.actualDeparture)
                          : b.etd ? `${fdate(b.etd)} (scheduled)` : "not recorded"}
                      </b>
                    </div>
                    <div>
                      Buyer: <b className="text-ink-700">{buyers.length ? buyers.join(", ") : "not allocated"}</b>
                      {clocks.carrier.dueDate && !b.deliveredAt && (
                        <> · due <b className="text-ink-700">{fdate(clocks.carrier.dueDate)}</b></>
                      )}
                    </div>
                    {b.deliveryNote && <div className="italic text-ink-400">{b.deliveryNote}</div>}
                  </div>

                  {!b.deliveredAt && (
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <SetDeparture
                        booking={{ id: b.id, number: b.number, actualDeparture: b.actualDeparture }}
                        action={setDepartureAction}
                      />
                    </div>
                  )}
                </div>

                {/* The two clocks */}
                <div className="grid shrink-0 grid-cols-2 gap-2 lg:w-72">
                  <SlaBadge clock={clocks.carrier} label="Carrier" estimate={clocks.carrierStartIsEstimate} />
                  <SlaBadge clock={clocks.buyer} label="Buyer" />
                </div>

                {/* Action */}
                <div className="flex shrink-0 items-center gap-2 lg:w-36 lg:justify-end">
                  {b.deliveredAt ? (
                    <UndoDelivered booking={{ id: b.id }} action={undoDeliveredAction} />
                  ) : (
                    <MarkDelivered
                      booking={{ id: b.id, number: b.number }}
                      action={markDeliveredAction}
                      compact
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-2xs text-ink-400">
        The carrier clock runs from the actual sailing date, falling back to the scheduled
        ETD and marked <b>est.</b> when it does. The buyer clock runs from the earliest
        allocation on the <Link href="/buyers" className="text-brand-600 hover:underline">Buyer</Link> tab.
        Both stop when a shipment is marked delivered. Change the day limits in{" "}
        <Link href="/settings" className="text-brand-600 hover:underline">Settings</Link>.
      </p>
    </div>
  );
}
