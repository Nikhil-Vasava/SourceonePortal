import { TONE_CLASS } from "@/lib/sla";

/**
 * One clock, shown as a day count plus what to do about it.
 *
 * The number is the headline because that's the question being asked — "how
 * many days has this been running?" — and the band underneath says whether it
 * matters yet.
 */
export function SlaBadge({ clock, label, estimate = false }) {
  if (clock.band === "unknown") {
    return (
      <div className="rounded-lg border border-ink-200 bg-ink-100 px-3 py-2">
        <div className="text-2xs uppercase tracking-wider text-ink-400">{label}</div>
        <div className="mt-0.5 text-sm text-ink-400">Not started</div>
      </div>
    );
  }

  const tone = TONE_CLASS[clock.tone] || TONE_CLASS.ink;

  return (
    <div className={`rounded-lg border px-3 py-2 ${tone}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xs uppercase tracking-wider opacity-70">{label}</span>
        {estimate && (
          <span className="text-2xs opacity-60" title="Counting from the scheduled ETD — no actual departure date recorded">
            est.
          </span>
        )}
      </div>

      <div className="mt-0.5 flex items-baseline gap-1.5">
        <span className="tnum text-lg font-semibold leading-none">{clock.elapsed}</span>
        <span className="text-2xs opacity-70">days</span>
      </div>

      <div className="mt-1 text-2xs font-medium">
        {clock.running
          ? clock.remaining >= 0
            ? `${clock.label} · ${clock.remaining} left`
            : `${clock.label} by ${clock.overdueBy}d`
          : clock.label}
      </div>
    </div>
  );
}

/** Compact one-line version for table rows. */
export function SlaPill({ clock }) {
  if (clock.band === "unknown") return <span className="text-ink-300">—</span>;

  const tone = TONE_CLASS[clock.tone] || TONE_CLASS.ink;
  return (
    <span className={`badge border ${tone}`} title={clock.label}>
      <span className="tnum font-semibold">{clock.elapsed}d</span>
      {clock.running && clock.remaining < 0 && <span>· +{clock.overdueBy}</span>}
    </span>
  );
}
