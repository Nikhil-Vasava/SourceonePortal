"use server";

// Reset actions for re-running the booking → PO → packing slip → buyer flow
// during testing.
//
// These are destructive and deliberately narrow: each one clears exactly the
// stage it names and nothing else. Master data — suppliers, buyers, products,
// ports, company settings, users — is never touched by anything in this file,
// so the dropdowns across the app keep working after a reset.
//
// Every action re-checks the caller's role on the server. The Settings page
// hides these from non-admins, but a hidden button is not a permission check;
// a server action is a public HTTP endpoint to anyone who knows its id.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

/** Screens that show any of this data and need re-rendering after a reset. */
const AFFECTED = ["/", "/bookings", "/suppliers", "/buyers", "/purchase", "/settings"];

function refresh() {
  for (const path of AFFECTED) revalidatePath(path);
}

/**
 * Clears everything the Supplier tab writes: the stored slip, the raw
 * extraction, and the weights/packages/date it filled in.
 *
 * Container and seal numbers are left alone — those arrive with the booking
 * import, not the packing slip, and wiping them would break the matching that
 * distributeContainers() relies on when you re-upload.
 */
export async function clearPackingSlipsAction() {
  requireRole("ADMIN");

  const { count } = await prisma.bookingLine.updateMany({
    data: {
      packingSlipFile: null,
      packingSlipJson: null,
      netWeightKg: null,
      grossWeightKg: null,
      packages: null,
      packingDate: null,
    },
  });

  refresh();
  return { ok: true, message: `Cleared packing slip details from ${count} container line${count === 1 ? "" : "s"}.` };
}

/** Clears everything the Buyer tab writes, leaving bookings and slips intact. */
export async function clearBuyerAllocationsAction() {
  requireRole("ADMIN");

  const { count } = await prisma.bookingLine.updateMany({
    data: {
      buyerId: null,
      salePrice: null,
      saleTerms: null,
      buyerAllocatedAt: null,
    },
  });

  refresh();
  return { ok: true, message: `Cleared buyer allocation from ${count} container line${count === 1 ? "" : "s"}.` };
}

/**
 * Removes all bookings and purchase orders so the flow can be run from a fresh
 * booking import.
 *
 * Order matters, and more tables point here than is obvious. Six foreign keys
 * reference Booking or PurchaseOrder as nullable columns with no cascade —
 * Booking.poId, BookingLine.poId, Container.bookingId, Invoice.poId,
 * Invoice.bookingId, Document.poId and Document.bookingId. Postgres rejects a
 * delete while any of them still points at the row, so every link is cleared
 * before anything is removed. Container, Invoice and Document rows survive with
 * their link blanked; they belong to other modules and aren't ours to delete.
 *
 * Only two relations cascade (BookingLine from Booking, PurchaseOrderLine from
 * PurchaseOrder). The child deletes below are therefore belt-and-braces, but
 * they keep the intent explicit and make the row counts predictable.
 *
 * The whole thing runs in one transaction: a foreign key we've missed rolls the
 * lot back rather than leaving the database half-cleared.
 */
export async function deleteAllBookingsAction() {
  requireRole("ADMIN");

  const [bookings, pos] = await Promise.all([
    prisma.booking.count(),
    prisma.purchaseOrder.count(),
  ]);

  await prisma.$transaction([
    // 1. break every inbound link
    prisma.bookingLine.updateMany({ data: { poId: null } }),
    prisma.booking.updateMany({ data: { poId: null } }),
    prisma.purchaseOrder.updateMany({ data: { fromBookingId: null } }),
    prisma.container.updateMany({ data: { bookingId: null } }),
    prisma.invoice.updateMany({ data: { poId: null, bookingId: null } }),
    prisma.document.updateMany({ data: { poId: null, bookingId: null } }),

    // 2. then remove children before parents
    prisma.purchaseOrderLine.deleteMany(),
    prisma.purchaseOrder.deleteMany(),
    prisma.bookingLine.deleteMany(),
    prisma.booking.deleteMany(),
  ]);

  refresh();
  return {
    ok: true,
    message:
      `Deleted ${bookings} booking${bookings === 1 ? "" : "s"} and ` +
      `${pos} purchase order${pos === 1 ? "" : "s"}. Suppliers, buyers, products and ports are untouched.`,
  };
}

/** Row counts for the Settings page, so you can see what a reset would affect. */
export async function getResetCounts() {
  const [bookings, lines, pos, withSlip, withBuyer] = await Promise.all([
    prisma.booking.count(),
    prisma.bookingLine.count(),
    prisma.purchaseOrder.count(),
    prisma.bookingLine.count({ where: { packingSlipFile: { not: null } } }),
    prisma.bookingLine.count({ where: { buyerId: { not: null } } }),
  ]);
  return { bookings, lines, pos, withSlip, withBuyer };
}
