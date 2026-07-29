// Two contractual clocks, both 45 days by default:
//
//   Carrier — the shipping line delivers within 45 days of the vessel sailing.
//   Buyer   — the buyer receives within 45 days of the order being placed,
//             which in this app is when containers are allocated to them.
//
// The point is to spot a shipment at day 40 and start chasing before the
// deadline passes, so every clock reports days elapsed, days left, and a band
// that says whether to act.
//
// Pure functions with no database access, so the maths can be tested directly.

/** Day counts must ignore the time of day, or a clock ticks over at 3pm. */
function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Whole days from `from` to `to`, ignoring time of day.
 *
 * Uses the local-midnight difference rounded to the nearest day rather than a
 * straight division: across a daylight-saving boundary a "day" is 23 or 25
 * hours, and dividing by a fixed 86,400,000 would silently drop or add one.
 */
export function daysBetween(from, to) {
  if (!from || !to) return null;
  const ms = startOfDay(to) - startOfDay(from);
  return Math.round(ms / 86_400_000);
}

export const SLA_DEFAULTS = { carrierSlaDays: 45, buyerSlaDays: 45, slaWarnDays: 40 };

/** Bands, worst first. `tone` maps to the colour classes used in the UI. */
export const BANDS = {
  breached: { label: "Overdue", tone: "red" },
  due:      { label: "Due now", tone: "amber" },
  warn:     { label: "Follow up", tone: "amber" },
  ok:       { label: "On track", tone: "emerald" },
  done:     { label: "Delivered", tone: "ink" },
  unknown:  { label: "No start date", tone: "ink" },
};

/**
 * Works out one clock.
 *
 * @param {Date|string|null} start   when the clock started
 * @param {Date|string|null} stop    when it stopped, or null if still running
 * @param {number} limitDays         the contractual window
 * @param {number} warnDays          when to start chasing
 * @param {Date}   now               injectable for testing
 * @returns {{
 *   band: string, label: string, tone: string,
 *   elapsed: number|null, remaining: number|null,
 *   dueDate: Date|null, running: boolean, overdueBy: number|null
 * }}
 */
export function clock(start, stop, limitDays, warnDays, now = new Date()) {
  if (!start) {
    return { band: "unknown", ...BANDS.unknown, elapsed: null, remaining: null,
             dueDate: null, running: false, overdueBy: null };
  }

  const from = new Date(start);
  const dueDate = new Date(startOfDay(from));
  dueDate.setDate(dueDate.getDate() + limitDays);

  // Once delivered the clock is frozen at the delivery date — the useful
  // question afterwards is whether it landed inside the window, not how long
  // ago it was.
  if (stop) {
    const elapsed = daysBetween(from, stop);
    return {
      band: "done",
      label: elapsed > limitDays ? `Delivered late (${elapsed}d)` : `Delivered in ${elapsed}d`,
      tone: elapsed > limitDays ? "red" : "emerald",
      elapsed,
      remaining: limitDays - elapsed,
      dueDate,
      running: false,
      overdueBy: elapsed > limitDays ? elapsed - limitDays : 0,
    };
  }

  const elapsed = daysBetween(from, now);
  const remaining = limitDays - elapsed;

  let band;
  if (elapsed > limitDays) band = "breached";
  else if (elapsed === limitDays) band = "due";
  else if (elapsed >= warnDays) band = "warn";
  else band = "ok";

  return {
    band,
    label: BANDS[band].label,
    tone: BANDS[band].tone,
    elapsed,
    remaining,
    dueDate,
    running: true,
    overdueBy: band === "breached" ? elapsed - limitDays : 0,
  };
}

/**
 * Both clocks for one booking.
 *
 * Carrier start: the actual sailing date if recorded, otherwise the scheduled
 * ETD. Falling back matters — most bookings never get an actual departure typed
 * in, and a clock that doesn't run is worse than one running off a close-enough
 * date. `carrierStartIsEstimate` says which was used so the UI can mark it.
 *
 * Buyer start: the earliest allocation across the booking's lines. A booking
 * split between two buyers is chased on whichever was sold first, which is the
 * one that will complain first.
 */
export function bookingClocks(booking, settings = SLA_DEFAULTS, now = new Date()) {
  const limit = {
    carrier: settings.carrierSlaDays ?? SLA_DEFAULTS.carrierSlaDays,
    buyer: settings.buyerSlaDays ?? SLA_DEFAULTS.buyerSlaDays,
  };
  const warn = settings.slaWarnDays ?? SLA_DEFAULTS.slaWarnDays;

  const carrierStart = booking.actualDeparture || booking.etd || null;

  const allocations = (booking.lines || [])
    .map(l => l.buyerAllocatedAt)
    .filter(Boolean)
    .map(d => new Date(d));
  const buyerStart = allocations.length ? new Date(Math.min(...allocations)) : null;

  const carrier = clock(carrierStart, booking.deliveredAt, limit.carrier, warn, now);
  const buyer = clock(buyerStart, booking.deliveredAt, limit.buyer, warn, now);

  return {
    carrier,
    buyer,
    carrierStartIsEstimate: !booking.actualDeparture && Boolean(booking.etd),
    // Sorting and filtering use the more urgent of the two.
    worst: severity(carrier) >= severity(buyer) ? carrier : buyer,
  };
}

/** Higher means more urgent. Used for sorting and for picking the worse clock. */
export function severity(c) {
  const rank = { breached: 4, due: 3, warn: 2, ok: 1, done: 0, unknown: 0 };
  // Within a band, more days elapsed is more urgent.
  return (rank[c.band] ?? 0) * 1000 + Math.min(c.elapsed ?? 0, 999);
}

/** True when a booking should appear on the follow-up list. */
export function needsFollowUp(clocks) {
  return ["warn", "due", "breached"].includes(clocks.carrier.band)
      || ["warn", "due", "breached"].includes(clocks.buyer.band);
}

/** Tailwind classes per tone, kept here so every screen colours a band the same. */
export const TONE_CLASS = {
  red: "bg-red-50 text-red-700 border-red-200",
  amber: "bg-amber-50 text-amber-800 border-amber-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ink: "bg-ink-100 text-ink-600 border-ink-200",
};
