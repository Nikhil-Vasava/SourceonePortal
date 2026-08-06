import Link from "next/link";
import { IconSearch, IconX } from "@/components/icons";

/**
 * Filter bar above a data table.
 *
 * A plain GET form rather than a client component: the browser puts the fields
 * into the query string itself, so the page stays a server component, filtering
 * happens in the database, and the whole thing still works if JavaScript hasn't
 * loaded yet. Submitting is an explicit action, which also avoids firing a
 * query on every keystroke.
 */
export default function TableToolbar({
  action,
  query,
  searchPlaceholder = "Search…",
  dateLabel = "ERD",
  showDates = true,
  sortable = true,          // the grouped panel views have no sortable headings
  unit = "row",
  total,
  shown,
  children,
}) {
  const filtered = shown !== total;

  return (
    <form action={action} method="get" className="mb-4">
      <div className="flex flex-wrap items-end gap-2">
        {/* Search */}
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <label className="label" htmlFor="tbl-q">Search</label>
          <div className="relative">
            <IconSearch
              size={15}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400"
            />
            <input
              id="tbl-q"
              name="q"
              defaultValue={query.q || ""}
              placeholder={searchPlaceholder}
              className="input pl-8"
            />
          </div>
        </div>

        {showDates && (
          <>
            <div>
              <label className="label" htmlFor="tbl-from">{dateLabel} from</label>
              <input id="tbl-from" name="from" type="date" defaultValue={query.from || ""}
                     className="input w-auto" />
            </div>
            <div>
              <label className="label" htmlFor="tbl-to">to</label>
              <input id="tbl-to" name="to" type="date" defaultValue={query.to || ""}
                     className="input w-auto" />
            </div>
          </>
        )}

        {children}

        {/* Sorting is carried in the URL, so it must survive a filter submit. */}
        {query.sort && <input type="hidden" name="sort" value={query.sort} />}
        {query.sort && <input type="hidden" name="dir" value={query.dir} />}

        <button type="submit" className="btn">Apply</button>

        {filtered && (
          <Link href={action} className="btn-secondary">
            <IconX size={14} /> Clear
          </Link>
        )}
      </div>

      {typeof total === "number" && (
        <p className="mt-2 text-2xs text-ink-400">
          {filtered
            ? <>Showing <b className="text-ink-600">{shown}</b> of {total}</>
            : <>{total} {unit}{total === 1 ? "" : "s"}</>}
          {sortable && " · click any column heading to sort"}
        </p>
      )}
    </form>
  );
}
