// How much of a purchase order has been placed on ships, and how much hasn't.
//
// The unit is whatever the PO was written in — 40 Loads, 12 Containers — and
// each booking consumes its own container count from that balance. Nobody
// types the number: the app already knows how many containers a booking holds,
// and a figure that isn't entered can't be entered wrongly.
//
// Pure functions, so the arithmetic can be tested without a database.

/**
 * What one booking takes off a PO.
 *
 * `bookedContainers` is the figure on the tracking sheet and the one people
 * quote, so it wins. Container lines are the fallback for a booking imported
 * before that column was filled in.
 */
export function bookingCapacity(booking) {
  if (booking?.bookedContainers != null && booking.bookedContainers > 0) {
    return booking.bookedContainers;
  }
  const lines = booking?.lines?.length ?? 0;
  return lines > 0 ? lines : 0;
}

/** Total ordered on a PO, in its own unit. */
export function orderedQty(po) {
  return (po?.lines || []).reduce((sum, l) => sum + (Number(l.qty) || 0), 0);
}

/** The unit the PO is counted in — "Loads", "Containers", … */
export function orderedUnit(po) {
  const first = (po?.lines || [])[0];
  return first?.uom || "";
}

/**
 * The balance for one PO.
 *
 * `over` is deliberately not an error. Suppliers ship more than ordered, a
 * booking gets upsized after the fact, and blocking the entry would only mean
 * the truth stops being recorded — so it's allowed and shown in red.
 */
export function poBalance(po, allocations = null) {
  const list = allocations ?? po?.allocations ?? [];
  const ordered = orderedQty(po);
  const allocated = list.reduce((s, a) => s + (Number(a.qty) || 0), 0);
  const remaining = ordered - allocated;
  return {
    ordered,
    allocated,
    remaining,
    unit: orderedUnit(po),
    over: remaining < 0,
    fullyPlaced: ordered > 0 && remaining === 0,
    // Nothing ordered means nothing to place — don't render "0 of 0 left".
    meaningful: ordered > 0,
  };
}

/** "30 of 40 Loads placed · 10 left" — one phrasing, used everywhere. */
export function describeBalance(b) {
  if (!b.meaningful) return null;
  const unit = b.unit ? ` ${b.unit}` : "";
  if (b.over) return `over-allocated by ${Math.abs(b.remaining)}${unit}`;
  if (b.fullyPlaced) return `all ${b.ordered}${unit} placed`;
  return `${b.allocated} of ${b.ordered}${unit} placed · ${b.remaining} left`;
}
