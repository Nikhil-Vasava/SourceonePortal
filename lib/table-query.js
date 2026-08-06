// Search, date-range and sort state for the data tables.
//
// All of it lives in the URL rather than component state. That means a filtered
// view can be bookmarked or pasted to someone else, the back button works, and
// the pages stay server components — no client-side data fetching, no loading
// spinner between filter changes.

/** Reads the table controls out of a Next.js searchParams object. */
export function readTableQuery(searchParams = {}, { defaultSort, defaultDir = "desc" } = {}) {
  const s = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return {
    q: s(searchParams.q),
    from: s(searchParams.from),
    to: s(searchParams.to),
    sort: s(searchParams.sort) || defaultSort || null,
    dir: searchParams.dir === "asc" ? "asc" : searchParams.dir === "desc" ? "desc" : defaultDir,
  };
}

/** True when anything is narrowing the list — drives the "Clear" button. */
export function hasActiveFilters(query) {
  return Boolean(query.q || query.from || query.to);
}

/**
 * Link for a column header.
 *
 * Clicking the column you're already sorted by flips the direction; clicking a
 * different one starts that column at its natural direction — text ascending
 * (A first), dates and numbers descending (newest and largest first), which is
 * what people expect without having to click twice.
 */
export function sortHref(basePath, query, column, naturalDir = "asc") {
  const next = query.sort === column
    ? (query.dir === "asc" ? "desc" : "asc")
    : naturalDir;

  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  params.set("sort", column);
  params.set("dir", next);

  return `${basePath}?${params.toString()}`;
}

/**
 * Sorts rows in memory.
 *
 * Deliberately not Prisma's orderBy: several sortable columns live on relations
 * (shipping line name, supplier name) or are derived, and null handling differs
 * between Postgres and what people expect. Doing it here keeps one consistent
 * rule — blanks always sink to the bottom, whichever direction you're sorting —
 * because a column of em-dashes at the top is never what you wanted.
 */
export function sortRows(rows, accessor, dir = "desc") {
  const sign = dir === "asc" ? 1 : -1;

  return [...rows].sort((a, b) => {
    const va = accessor(a);
    const vb = accessor(b);

    const aEmpty = va === null || va === undefined || va === "";
    const bEmpty = vb === null || vb === undefined || vb === "";
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;    // blanks last, regardless of direction
    if (bEmpty) return -1;

    if (va instanceof Date || vb instanceof Date) {
      return (new Date(va) - new Date(vb)) * sign;
    }
    if (typeof va === "number" && typeof vb === "number") {
      return (va - vb) * sign;
    }
    return String(va).localeCompare(String(vb), undefined, {
      numeric: true,      // "10" sorts after "9", not before it
      sensitivity: "base",
    }) * sign;
  });
}

/**
 * Prisma `where` for a free-text search across several fields.
 * `mode: "insensitive"` is Postgres-specific and is why this isn't portable.
 */
export function searchWhere(q, fields) {
  if (!q) return {};
  return {
    OR: fields.map(f =>
      f.includes(".")
        ? { [f.split(".")[0]]: { [f.split(".")[1]]: { contains: q, mode: "insensitive" } } }
        : { [f]: { contains: q, mode: "insensitive" } }
    ),
  };
}

/**
 * In-memory text match across a list of values.
 *
 * The Supplier and Buyer tabs are grouped into per-booking panels and need to
 * search the lines inside each panel as well as the booking itself — a shape
 * Prisma's `where` can't express without either a raw query or two round trips.
 * These pages hold one screen of shipments, so filtering the loaded rows is
 * both simpler and faster than going back to the database.
 */
export function matchesText(q, values) {
  if (!q) return true;
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return values.some(v => v != null && String(v).toLowerCase().includes(needle));
}

/**
 * Prisma `where` for an inclusive date range on one field.
 *
 * `to` is pushed to the end of that day: a range ending 2026-08-31 should
 * include everything that happened on the 31st, not stop at its midnight.
 */
export function dateRangeWhere(field, from, to) {
  if (!from && !to) return {};
  const range = {};
  if (from) range.gte = new Date(`${from}T00:00:00`);
  if (to) range.lte = new Date(`${to}T23:59:59.999`);
  return { [field]: range };
}
