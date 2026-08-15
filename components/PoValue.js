import { fmt } from "@/lib/util";
import { orderValue } from "@/lib/po-value";

/**
 * A purchase order's value.
 *
 * Shows a total only when the quantity and the price are in units that can be
 * multiplied. When they can't — ordered by the container, priced by the tonne —
 * it shows the agreed rate instead, because the tonnage isn't known until the
 * containers are weighed and any "total" would be fiction.
 */
export default function PoValue({ po }) {
  const v = orderValue(po.lines);
  const cur = po.currency || "USD";

  if (v.kind === "total") {
    return <span className="font-medium">{fmt(v.amount, cur)}</span>;
  }

  if (v.kind === "rate") {
    return (
      <span className="whitespace-nowrap font-medium">
        {fmt(v.amount, cur)}
        <span className="ml-1 font-normal text-ink-400">/ {v.unit || "unit"}</span>
      </span>
    );
  }

  // Some lines total, others are only a rate. Showing the partial sum alone
  // would read as the whole order, so it's labelled as partial and the
  // remaining rates are listed under it.
  if (v.kind === "mixed") {
    return (
      <span className="whitespace-nowrap">
        {v.amount != null && (
          <span className="font-medium">
            {fmt(v.amount, cur)}
            <span className="ml-1 text-2xs font-normal text-ink-400">part</span>
          </span>
        )}
        {v.rates.map((r, i) => (
          <span key={i} className={`block text-2xs text-ink-400 ${v.amount != null ? "" : "font-medium text-ink-500"}`}>
            {fmt(r.amount, cur)} / {r.unit || "unit"}
          </span>
        ))}
      </span>
    );
  }

  return <span className="text-ink-300">—</span>;
}
