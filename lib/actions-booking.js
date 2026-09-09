"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { toDate, toNum } from "@/lib/booking-import";
import { record, recordUpdate } from "@/lib/audit";

export async function updateBookingAction(formData) {
  const id = Number(formData.get("id"));
  const before = await prisma.booking.findUnique({ where: { id } });
  const updated = await prisma.booking.update({
    where: { id },
    data: {
      number: formData.get("number"),
      // The carrier. Set by the importer from the booking PDF, which gets it
      // wrong often enough that it needs correcting by hand.
      //
      // Same rule as pricePerContainer below: a field that isn't in the form
      // submits nothing, and absent must mean "leave it alone". Without the
      // has() guard, any form that omits this select would silently unlink the
      // carrier on save. Choosing the blank option DOES clear it — that's an
      // empty string, which is present.
      ...(formData.has("shippingLine") && {
        shippingLineId: formData.get("shippingLine")
          ? Number(formData.get("shippingLine"))
          : null,
      }),
      freightForwarder: formData.get("freightForwarder") || null,
      vessel: formData.get("vessel") || null,
      voyage: formData.get("voyage") || null,
      pol: formData.get("pol") || null,
      pod: formData.get("pod") || null,
      placeOfDelivery: formData.get("placeOfDelivery") || null,
      // Same reasoning as the buyer sale price: the input is hidden from
      // non-purchase staff, and a hidden input submits nothing. Absent means
      // "leave it alone", not "clear it".
      ...(formData.has("pricePerContainer") && {
        pricePerContainer: toNum(formData.get("pricePerContainer")),
      }),
      bookedContainers: toNum(formData.get("bookedContainers")),
      loadedContainers: toNum(formData.get("loadedContainers")),
      otherContainers: formData.get("otherContainers") || null,
      erd: toDate(formData.get("erd")),
      docsCutOff: toDate(formData.get("docsCutOff")),
      cargoCutOff: toDate(formData.get("cargoCutOff")),
      siSentDate: toDate(formData.get("siSentDate")),
      containerType: formData.get("containerType") || null,
    emptyDepot: formData.get("emptyDepot") || null,
      commodity: formData.get("commodity") || null,
      etd: toDate(formData.get("etd")),
      eta: toDate(formData.get("eta")),
      status: formData.get("status") || "DRAFT",
    },
  });

  await recordUpdate({
    entity: "Booking", entityId: id, label: updated.number, noun: "booking",
    before, after: updated,
    // Set by the importer and the packing-slip reader, not by a person.
    ignore: ["sourceFile", "pickupNoticeAt"],
  });

  revalidatePath("/bookings");
  revalidatePath(`/bookings/${id}`);
}

export async function deleteBookingAction(formData) {
  const id = Number(formData.get("id"));
  const b = await prisma.booking.findUnique({
    where: { id },
    select: { number: true, vessel: true, _count: { select: { lines: true } } },
  });
  await prisma.purchaseOrder.updateMany({ where: { fromBookingId: id }, data: { fromBookingId: null } });
  await prisma.booking.delete({ where: { id } });

  await record({
    action: "DELETE", entity: "Booking", entityId: id, label: b?.number || `#${id}`,
    summary: `Deleted booking ${b?.number || `#${id}`}`
           + (b?.vessel ? ` (${b.vessel})` : "")
           + (b?._count?.lines ? ` and its ${b._count.lines} container line${b._count.lines === 1 ? "" : "s"}` : ""),
  });

  revalidatePath("/bookings");
}
