"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { toDate, toNum } from "@/lib/booking-import";

export async function updateBookingAction(formData) {
  const id = Number(formData.get("id"));
  await prisma.booking.update({
    where: { id },
    data: {
      number: formData.get("number"),
      freightForwarder: formData.get("freightForwarder") || null,
      vessel: formData.get("vessel") || null,
      voyage: formData.get("voyage") || null,
      pol: formData.get("pol") || null,
      pod: formData.get("pod") || null,
      placeOfDelivery: formData.get("placeOfDelivery") || null,
      pricePerContainer: toNum(formData.get("pricePerContainer")),
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
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${id}`);
}

export async function deleteBookingAction(formData) {
  const id = Number(formData.get("id"));
  await prisma.purchaseOrder.updateMany({ where: { fromBookingId: id }, data: { fromBookingId: null } });
  await prisma.booking.delete({ where: { id } });
  revalidatePath("/bookings");
}
