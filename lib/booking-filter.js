// What "the bookings I'm looking at" means, defined once.
//
// The register and the export have to agree exactly. If they don't, ticking
// nothing and pressing Export gives you a different set of rows than the one on
// screen — which is the sort of bug nobody reports because it looks like the
// export "just included a few extra". Both now build their where clause here.

import { searchWhere, dateRangeWhere } from "@/lib/table-query";

/** Free-text search covers the columns someone can actually see. */
export const BOOKING_SEARCH_FIELDS = [
  "number", "vessel", "voyage", "pol", "pod", "placeOfDelivery",
  "freightForwarder", "commodity",
];

/**
 * Bookings carrying cargo from one supplier.
 *
 * Goes through the allocations, because that's where a booking's purchase
 * orders actually live. `purchaseOrders` is the old single `fromBookingId`
 * pointer and only names the first shipment an order was put on, so filtering
 * by it would hide the other legs of a split order. Both are checked so
 * bookings imported before allocations existed still match.
 */
export function supplierWhere(supplierId) {
  if (!supplierId) return {};
  return {
    OR: [
      { poAllocations: { some: { po: { partnerId: supplierId } } } },
      { purchaseOrders: { some: { partnerId: supplierId } } },
    ],
  };
}

/**
 * The full filter for the bookings register.
 *
 * @param query      from readTableQuery — q, from, to
 * @param supplierId partner id, or null for every supplier
 */
export function bookingWhere(query, supplierId = null) {
  const search = searchWhere(query.q, BOOKING_SEARCH_FIELDS);
  const supplier = supplierWhere(supplierId);

  // searchWhere also produces an OR. Two OR keys in one object would overwrite
  // each other, so when both are active they're combined with AND — meaning
  // "matches the text AND is from this supplier", which is what the two
  // controls sitting side by side imply.
  if (search.OR && supplier.OR) {
    return {
      ...dateRangeWhere("erd", query.from, query.to),
      AND: [{ OR: search.OR }, { OR: supplier.OR }],
    };
  }

  return {
    ...search,
    ...supplier,
    ...dateRangeWhere("erd", query.from, query.to),
  };
}

/** Only suppliers that appear on at least one booking — no dead entries. */
export const SUPPLIERS_ON_BOOKINGS = {
  where: {
    purchaseOrders: {
      some: {
        OR: [
          { allocations: { some: {} } },
          { fromBookingId: { not: null } },
        ],
      },
    },
  },
  select: { id: true, name: true },
  orderBy: { name: "asc" },
};
