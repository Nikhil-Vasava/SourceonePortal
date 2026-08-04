// Which bookings the operational screens should show.
//
// A cancelled booking still exists — the Bookings tab is the register and must
// keep showing it, with its CANCELLED badge, because the containers were booked
// and there may be cancellation charges to account for.
//
// But it has no work left against it. It shouldn't sit in the Supplier queue
// waiting for a packing slip, or the Buyer queue waiting for an allocation, and
// it certainly shouldn't have a 45-day delivery clock ticking on the Tracking
// page. Those screens are to-do lists, and a cancelled shipment is not a to-do.

/** Bookings that still have work against them. Use in a `where` on Booking. */
export const ACTIVE_BOOKING = { status: { not: "CANCELLED" } };

/** The same rule, applied through the relation. Use in a `where` on BookingLine. */
export const ACTIVE_BOOKING_LINE = { booking: { status: { not: "CANCELLED" } } };

/** In-memory equivalent, for filtering a list already fetched. */
export function isActiveBooking(b) {
  return b?.status !== "CANCELLED";
}
