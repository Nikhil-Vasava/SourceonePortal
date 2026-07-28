import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fdate, fmt } from "@/lib/util";
import { PageHeader, Badge, Stat, SectionTitle } from "@/components/ui";
import { IconUpload, IconArrowRight } from "@/components/icons";

export const dynamic = "force-dynamic";

/** Small inline progress meter used in the pipeline table. */
function Meter({ done, total }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  const complete = total > 0 && done === total;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-ink-100">
        <div className={`h-full rounded-full ${complete ? "bg-emerald-500" : "bg-brand-500"}`}
             style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-2xs tnum ${complete ? "text-emerald-600" : "text-ink-500"}`}>{done}/{total}</span>
    </div>
  );
}

export default async function Dashboard() {
  requireUser();
  const [bookings, lines, pos] = await Promise.all([
    prisma.booking.findMany({ include: { lines: true }, orderBy: { id: "desc" } }),
    prisma.bookingLine.findMany(),
    prisma.purchaseOrder.findMany({ select: { id: true, fromBookingId: true } }),
  ]);

  const active = bookings.filter(b => ["DRAFT", "CONFIRMED", "SHIPPED"].includes(b.status)).length;
  const needPo = lines.filter(l => !l.poId).length;
  const needSlip = lines.filter(l => !l.packingSlipFile).length;
  const needBuyer = lines.filter(l => !l.buyerId).length;
  const totalNet = lines.reduce((s, l) => s + (l.netWeightKg || 0), 0);
  const unlinkedPos = pos.filter(p => !p.fromBookingId).length;
  const n = lines.length || 1;

  const kpis = [
    { label: "Active bookings", value: active, href: "/bookings", hint: `${bookings.length} total` },
    { label: "Container lines", value: lines.length, href: "/suppliers", hint: `${fmt(totalNet)} kg net recorded` },
    { label: "Purchase orders", value: pos.length, href: "/purchase", hint: `${unlinkedPos} not yet linked to a booking` },
    { label: "Awaiting PO", value: needPo, href: "/bookings", tone: needPo ? "warn" : "good",
      progress: ((n - needPo) / n) * 100, hint: `${lines.length - needPo} of ${lines.length} allocated` },
    { label: "Awaiting packing slip", value: needSlip, href: "/suppliers", tone: needSlip ? "warn" : "good",
      progress: ((n - needSlip) / n) * 100, hint: `${lines.length - needSlip} of ${lines.length} received` },
    { label: "Awaiting buyer", value: needBuyer, href: "/buyers", tone: needBuyer ? "warn" : "good",
      progress: ((n - needBuyer) / n) * 100, hint: `${lines.length - needBuyer} of ${lines.length} allocated` },
  ];

  const recent = bookings.slice(0, 8);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Booking → Supplier → Buyer pipeline at a glance"
        action={
          <Link href="/bookings/import" className="btn">
            <IconUpload size={16} /> Import booking
          </Link>
        }
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map(k => <Stat key={k.label} {...k} />)}
      </div>

      <SectionTitle right={
        <Link href="/bookings" className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
          View all <IconArrowRight size={13} />
        </Link>
      }>
        Recent bookings
      </SectionTitle>

      {recent.length === 0 ? (
        <div className="card flex flex-col items-center py-14 text-center">
          <p className="text-sm text-ink-500">No bookings yet.</p>
          <Link href="/bookings/import" className="btn mt-4"><IconUpload size={16} /> Import your first booking</Link>
        </div>
      ) : (
        <div className="card-flush overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b border-ink-200/70 bg-ink-50/60">
                <tr>{["Booking", "Route", "ETD", "ETA", "Lines", "PO", "Slips", "Buyers", "Status"]
                  .map(h => <th key={h} className="th">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {recent.map(b => {
                  const bl = lines.filter(l => l.bookingId === b.id);
                  return (
                    <tr key={b.id} className="row">
                      <td className="td">
                        <Link href={`/bookings/${b.id}`} className="font-semibold text-brand-700 hover:text-brand-800">
                          {b.number}
                        </Link>
                      </td>
                      <td className="td">
                        <span className="text-ink-800">{b.pol || "—"}</span>
                        <span className="mx-1.5 text-ink-300">→</span>
                        <span className="text-ink-800">{b.pod || "—"}</span>
                      </td>
                      <td className="td whitespace-nowrap text-ink-600">{fdate(b.etd)}</td>
                      <td className="td whitespace-nowrap text-ink-600">{fdate(b.eta)}</td>
                      <td className="td tnum">{bl.length}</td>
                      <td className="td"><Meter done={bl.filter(l => l.poId).length} total={bl.length} /></td>
                      <td className="td"><Meter done={bl.filter(l => l.packingSlipFile).length} total={bl.length} /></td>
                      <td className="td"><Meter done={bl.filter(l => l.buyerId).length} total={bl.length} /></td>
                      <td className="td"><Badge value={b.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
