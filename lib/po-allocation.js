// How much of a purchase order has been placed on ships, and how much hasn't.
//
// The unit is whatever the PO was written in — 40 Loads, 12 Containers — and
// each booking consumes its own container count from that balance. Nobody
// types the number: the app already knows how many containers a booking holds,
// and a figure that isn't entered can't be entered wrongly.
//
// Pure functions, so the arithmetic can be tested without a database.

/**
 * How many containers a booking holds in total.
 *
 * `bookedContainers` is the figure on the tracking sheet and the one people
 * quote, so it wins. Container lines are the fallback for a booking imported
 * before that column was filled in.
 *
 * This is the SIZE OF THE SHIP, not the size of any one order on it. See
 * linkQuantity() below for what an individual PO takes.
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

/**
 * What's left on a purchase order, ignoring one booking.
 *
 * `exceptBookingId` is what makes re-linking safe: when a PO is already on this
 * booking, its own share must not count against it, or every re-link would
 * shrink the quantity a little further.
 */
export function remainingOnPo(po, exceptBookingId = null) {
  const placed = (po?.allocations || [])
    .filter(a => a.bookingId !== exceptBookingId)
    .reduce((s, a) => s + (Number(a.qty) || 0), 0);
  return orderedQty(po) - placed;
}

/** Space left on a booking, ignoring one purchase order — same reasoning. */
export function roomOnBooking(booking, exceptPoId = null) {
  const taken = (booking?.poAllocations || [])
    .filter(a => a.poId !== exceptPoId)
    .reduce((s, a) => s + (Number(a.qty) || 0), 0);
  return bookingCapacity(booking) - taken;
}

/**
 * How much of a PO goes onto a booking when the two are linked.
 *
 * The rule is the smaller of the two: what the order still has to place, and
 * what the ship still has room for. Anything else is wrong in one direction or
 * the other —
 *
 *   1-container PO onto a 2-container booking  → 1, leaving a slot for the
 *     next order. (Taking the booking's size would put the whole ship against
 *     one small order and hide the fact that half of it is still unfilled.)
 *   40-load PO onto a 10-container booking     → 10, leaving 30 to place.
 *
 * Returns a reason instead of a quantity when neither side has anything to
 * give, so the caller can say why rather than silently writing a zero.
 */
export function linkQuantity(po, booking, { poId, bookingId } = {}) {
  const remaining = remainingOnPo(po, bookingId);
  const capacity = bookingCapacity(booking);
  const room = roomOnBooking(booking, poId);

  if (remaining <= 0) {
    return { qty: 0, remaining, room, error:
      `${po?.number || "That order"} is already fully placed on other shipments.` };
  }

  // A booking with no container count and no lines yet — usually one keyed in
  // by hand before the carrier confirmed. We can't work out a share, so take
  // the order's word for it rather than blocking the link.
  if (capacity <= 0) {
    return { qty: remaining, remaining, room, unknownCapacity: true };
  }

  if (room <= 0) {
    return { qty: 0, remaining, room, error:
      `${booking?.number || "That booking"} is full — all ${capacity} container${capacity === 1 ? "" : "s"} are already spoken for. Unlink something first.` };
  }

  return { qty: Math.min(remaining, room), remaining, room };
}

/** "30 of 40 Loads placed · 10 left" — one phrasing, used everywhere. */
export function describeBalance(b) {
  if (!b.meaningful) return null;
  const unit = b.unit ? ` ${b.unit}` : "";
  if (b.over) return `over-allocated by ${Math.abs(b.remaining)}${unit}`;
  if (b.fullyPlaced) return `all ${b.ordered}${unit} placed`;
  return `${b.allocated} of ${b.ordered}${unit} placed · ${b.remaining} left`;
}
