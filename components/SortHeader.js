import Link from "next/link";
import { sortHref } from "@/lib/table-query";

/**
 * A clickable column heading.
 *
 * The arrow only appears on the active column — showing a faint arrow on every
 * header turns the row into visual noise, and the underline on hover already
 * signals that the rest are clickable.
 */
export default function SortHeader({
  column,
  label,
  query,
  basePath,
  naturalDir = "asc",
  align = "left",
  className = "",
  style,
}) {
  const active = query.sort === column;
  const asc = active && query.dir === "asc";

  return (
    <th
      style={style}
      className={className}
      aria-sort={active ? (asc ? "ascending" : "descending") : "none"}
    >
      <Link
        href={sortHref(basePath, query, column, naturalDir)}
        scroll={false}
        className={[
          "group inline-flex items-baseline gap-1",
          align === "right" ? "flex-row-reverse" : "",
          active ? "text-brand-600" : "hover:text-ink-700",
        ].join(" ")}
        title={`Sort by ${label}${active ? (asc ? " (descending)" : " (ascending)") : ""}`}
      >
        <span className="group-hover:underline">{label}</span>
        <span className="shrink-0 text-[9px] leading-none">
          {active ? (asc ? "▲" : "▼") : <span className="opacity-0 group-hover:opacity-40">▼</span>}
        </span>
      </Link>
    </th>
  );
}
