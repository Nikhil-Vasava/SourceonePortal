import { TONE_CLASS } from "@/lib/sla";

/**
 * One clock, shown as a day count plus what to do about it.
 *
 * The number is the headline because that's the question being asked — "how
 * many days has this been running?" — and the band underneath says whether it
 * matters yet.
 */
export function SlaBadge({
  clock, label, estimate = false, note = null, doneLabel = null, overdueLabel = null,
}) {
  if (clock.band === "unknown") {
    return (
      <div className="rounded-lg border border-ink-200 bg-ink-100 px-3 py-2">
        <div className="text-2xs uppercase tracking-wider text-ink-400">{label}</div>
        <div className="mt-0.5 text-sm text-ink-400">Not started</div>
        {/* "Not started" alone doesn't distinguish "nothing is due yet" from
            "the date this depends on is missing, so this will never start".
            The caller says which. */}
        {note && <div className="mt-0.5 text-2xs text-ink-400">{note}</div>}
      </div>
    );
  }

  // A clock whose start date is in the future hasn't begun. The generic maths
  // reports a negative elapsed and calls it "On track", which reads as though
  // something is already running when nothing is.
  if (clock.running && clock.elapsed < 0) {
    const away = Math.abs(clock.elapsed);
    return (
      <div className="rounded-lg border border-ink-200 bg-ink-100 px-3 py-2">
        <div className="text-2xs uppercase tracking-wider text-ink-400">{label}</div>
        <div className="mt-0.5 text-sm text-ink-500">
          Starts in {away} day{away === 1 ? "" : "s"}
        </div>
        {note && <div className="mt-0.5 text-2xs text-ink-400">{note}</div>}
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
            // A count of days overdue suits a contractual clock, where the
            // question is how late you are. A pickup window just shuts on a
            // date, so the caller can say that instead.
            : (overdueLabel || `${clock.label} by ${clock.overdueBy}d`)
          // "Delivered in 9d" is right for a shipment and wrong for a stopped
          // pickup clock, so the caller can supply its own wording.
          : (doneLabel || clock.label)}
      </div>
      {/* The note is dropped once an overdue label is showing — that label
          already carries the date, and repeating it reads as two facts. */}
      {note && !(overdueLabel && clock.running && clock.remaining < 0) && (
        <div className="mt-0.5 text-2xs opacity-60">{note}</div>
      )}
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
