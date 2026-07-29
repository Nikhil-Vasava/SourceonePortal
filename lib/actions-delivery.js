"use server";

// Recording the dates the two SLA clocks depend on.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const AFFECTED = ["/", "/tracking", "/bookings"];
function refresh() {
  for (const p of AFFECTED) revalidatePath(p);
}

/**
 * Dates arrive from a date input as "YYYY-MM-DD", which `new Date()` reads as
 * UTC midnight. East of Greenwich that's still the previous day locally, which
 * would knock every clock out by one. Building the date from its parts keeps it
 * at local midnight.
 */
function localDate(value) {
  if (!value) return null;
  const [y, m, d] = String(value).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** Stops the carrier clock. Defaults to today when no date is given. */
export async function markDeliveredAction(formData) {
  requireUser();

  const id = Number(formData.get("bookingId"));
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw new Error("That booking no longer exists.");

  const when = localDate(formData.get("deliveredAt")) || new Date();

  const start = booking.actualDeparture || booking.etd;
  if (start && when < new Date(start)) {
    throw new Error("The delivery date is before the departure date. Check which is wrong.");
  }

  await prisma.booking.update({
    where: { id },
    data: {
      deliveredAt: when,
      deliveryNote: (formData.get("deliveryNote") || "").toString().trim() || null,
      // A delivered shipment shouldn't sit in the pipeline as "confirmed".
      status: booking.status === "CANCELLED" ? booking.status : "DELIVERED",
    },
  });

  refresh();
  return { ok: true, message: `${booking.number} marked delivered.` };
}

/** Puts a booking back in transit — for a delivery date entered by mistake. */
export async function undoDeliveredAction(formData) {
  requireUser();

  const id = Number(formData.get("bookingId"));
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw new Error("That booking no longer exists.");

  await prisma.booking.update({
    where: { id },
    data: {
      deliveredAt: null,
      deliveryNote: null,
      status: booking.status === "DELIVERED" ? "SHIPPED" : booking.status,
    },
  });

  refresh();
  return { ok: true, message: `${booking.number} is back in transit.` };
}

/**
 * Records the date the vessel actually sailed.
 *
 * The carrier clock runs from ETD until this is filled in. ETD is a schedule
 * and slips, so a shipment can look overdue purely because it left late —
 * setting the real date fixes the count.
 */
export async function setDepartureAction(formData) {
  requireUser();

  const id = Number(formData.get("bookingId"));
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw new Error("That booking no longer exists.");

  const when = localDate(formData.get("actualDeparture"));

  if (when && booking.deliveredAt && when > new Date(booking.deliveredAt)) {
    throw new Error("That departure date is after the delivery date. Check which is wrong.");
  }

  await prisma.booking.update({ where: { id }, data: { actualDeparture: when } });

  refresh();
  return {
    ok: true,
    message: when
      ? `Departure recorded for ${booking.number}.`
      : `Departure cleared for ${booking.number} — the clock runs from ETD again.`,
  };
}
