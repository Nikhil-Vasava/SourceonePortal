import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { PageHeader, Empty } from "@/components/ui";
import { AUDIT_AREAS, AUDIT_ACTIONS, ACTION_TONE, FIELD_LABELS } from "@/lib/audit";
import { readTableQuery, paginate } from "@/lib/table-query";
import Pagination from "@/components/Pagination";
import AuditFilters from "@/components/AuditFilters";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit trail" };

/**
 * Grouped by day, newest first, written as sentences.
 *
 * The thing being avoided here is the usual audit screen: a wall of
 * UPDATE / PurchaseOrder / 41 that tells you something happened without ever
 * telling you what. Each row already carries a summary written when the event
 * happened, so this page reads it out rather than reconstructing it.
 */

const DAY = new Intl.DateTimeFormat("en-NZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const TIME = new Intl.DateTimeFormat("en-NZ", { hour: "2-digit", minute: "2-digit", hour12: false });

function dayKey(d) { return d.toISOString().slice(0, 10); }

function heading(iso) {
  const d = new Date(iso + "T12:00:00Z");
  const today = dayKey(new Date());
  const yest = dayKey(new Date(Date.now() - 86400000));
  if (iso === today) return "Today";
  if (iso === yest) return "Yesterday";
  return DAY.format(d);
}

function initials(name = "") {
  return name.replace(/\(.*?\)/g, "").trim().split(/\s+/).slice(0, 2)
    .map(w => w[0]).join("").toUpperCase() || "?";
}

/** "price 125 → 140", or "notes added" when there was nothing there before. */
function describeChange(c) {
  const field = FIELD_LABELS[c.field] || c.field;
  if (c.from === null && c.to !== null) return `${field} set to ${c.to}`;
  if (c.to === null) return `${field} cleared (was ${c.from})`;
  return `${field} ${c.from} → ${c.to}`;
}

export default async function Audit({ searchParams }) {
  requireRole("ADMIN");

  const query = readTableQuery(searchParams, { defaultSort: "at", defaultDir: "desc", perPage: 60 });
  const who = searchParams?.who ? Number(searchParams.who) : null;
  const area = AUDIT_AREAS[searchParams?.area] ? searchParams.area : null;
  const action = AUDIT_ACTIONS.includes(searchParams?.action) ? searchParams.action : null;

  const where = {
    ...(who ? { userId: who } : {}),
    ...(area ? { entity: area } : {}),
    ...(action ? { action } : {}),
    ...(query.q ? {
      OR: [
        { summary: { contains: query.q, mode: "insensitive" } },
        { label:   { contains: query.q, mode: "insensitive" } },
        { userName:{ contains: query.q, mode: "insensitive" } },
      ],
    } : {}),
    ...(query.from || query.to ? {
      at: {
        ...(query.from ? { gte: new Date(query.from + "T00:00:00") } : {}),
        // The whole of the closing day, not midnight at the start of it.
        ...(query.to ? { lte: new Date(query.to + "T23:59:59.999") } : {}),
      },
    } : {}),
  };

  const [rows, total, people] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { at: "desc" }, take: 2000 }),
    prisma.auditLog.count(),
    // Everyone who has ever appeared in the trail, including people whose
    // account has since been removed — their entries still name them.
    prisma.auditLog.findMany({
      distinct: ["userName"],
      select: { userId: true, userName: true },
      orderBy: { userName: "asc" },
    }),
  ]);

  const paged = paginate(rows, query);

  // Group the page's rows by day.
  const days = [];
  for (const r of paged.rows) {
    const key = dayKey(r.at);
    const last = days[days.length - 1];
    if (last && last.key === key) last.rows.push(r);
    else days.push({ key, rows: [r] });
  }

  const filtering = Boolean(who || area || action || query.q || query.from || query.to);

  return (
    <div>
      <PageHeader
        title="Audit trail"
        subtitle="Everything that has changed, who changed it, and when. Nothing here can be edited or deleted."
      />

      {total === 0 ? (
        <Empty text="Nothing recorded yet. Entries appear here as soon as anyone creates, edits, approves or deletes something." />
      ) : (
        <>
          <AuditFilters
            people={people.filter(p => p.userId)}
            areas={AUDIT_AREAS}
            actions={AUDIT_ACTIONS}
            current={{ who, area, action, q: query.q, from: query.from, to: query.to }}
            shown={paged.rows.length}
            matched={rows.length}
            total={total}
          />

          {paged.rows.length === 0 ? (
            <Empty text="Nothing matches those filters." />
          ) : (
            <div className="space-y-6">
              {days.map(day => (
                <div key={day.key}>
                  <h2 className="mb-2 text-2xs font-semibold uppercase tracking-widest text-ink-400">
                    {heading(day.key)}
                  </h2>

                  <div className="card-flush divide-y divide-ink-100">
                    {day.rows.map(r => (
                      <div key={r.id} className="flex gap-3 px-4 py-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-2xs font-semibold text-brand-700"
                             title={`${r.userName} · ${r.userRole}`}>
                          {initials(r.userName)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <span className={`badge ${ACTION_TONE[r.action] || "bg-ink-100 text-ink-600"}`}>
                              {r.action.toLowerCase()}
                            </span>
                            <span className="text-sm text-ink-800">{r.summary}</span>
                          </div>

                          {/* The detail, only when there is any. */}
                          {Array.isArray(r.changes) && r.changes.length > 0 && (
                            <ul className="mt-1.5 space-y-0.5">
                              {r.changes.map((c, i) => (
                                <li key={i} className="text-2xs text-ink-500">
                                  <span className="text-ink-400">·</span> {describeChange(c)}
                                </li>
                              ))}
                            </ul>
                          )}

                          <div className="mt-1 text-2xs text-ink-400">
                            {r.userName} · {r.userRole}
                            {AUDIT_AREAS[r.entity] ? ` · ${AUDIT_AREAS[r.entity]}` : ""}
                          </div>
                        </div>

                        <time className="shrink-0 text-2xs tabular-nums text-ink-400"
                              dateTime={r.at.toISOString()}
                              title={r.at.toLocaleString("en-NZ")}>
                          {TIME.format(r.at)}
                        </time>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* extra carries who/area/action, or page 2 would drop the filter. */}
              <Pagination
                basePath="/audit" query={query}
                page={paged.page} pages={paged.pages}
                from={paged.from} to={paged.to} total={paged.total}
                unit="entry"
                extra={{ who, area, action }}
              />
            </div>
          )}

          {rows.length >= 2000 && !filtering && (
            <p className="mt-4 text-2xs text-ink-400">
              Showing the most recent 2,000 entries. Narrow it with the filters above to reach older ones.
            </p>
          )}
        </>
      )}
    </div>
  );
}
