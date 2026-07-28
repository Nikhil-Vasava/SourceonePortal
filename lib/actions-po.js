"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { nextPoNumber } from "@/lib/numbering";
import { toNum } from "@/lib/booking-import";

/** Creates a standalone purchase order: one supplier, any number of product lines. */
export async function createPoAction(formData) {
  const supplierId = Number(formData.get("supplierId"));
  const pricingTerm = formData.get("pricingTerm") || null;
  const bookingId = formData.get("bookingId") ? Number(formData.get("bookingId")) : null;

  const productIds = formData.getAll("productId");
  const qtys = formData.getAll("qty");
  const units = formData.getAll("qtyUnit");
  const prices = formData.getAll("price");
  const priceUnits = formData.getAll("priceUnit");

  const items = [];
  for (let i = 0; i < productIds.length; i++) {
    if (!productIds[i]) continue;
    items.push({
      productId: Number(productIds[i]),
      qty: toNum(qtys[i]) ?? 0,
      uom: units[i] || "MT",
      price: toNum(prices[i]) ?? 0,
      priceUnit: priceUnits[i] || "",
    });
  }
  if (!items.length) redirect("/purchase/new?error=" + encodeURIComponent("Add at least one product."));

  const supplier = await prisma.partner.findUnique({ where: { id: supplierId } });

  const po = await prisma.purchaseOrder.create({
    data: {
      number: await nextPoNumber(),
      partnerId: supplierId,
      fromBookingId: bookingId,
      status: "CONFIRMED",
      currency: supplier?.currency || "USD",
      paymentTerms: formData.get("paymentTerms") || null,
      incoterm: supplier?.incoterm || null,
      shippingTerms: pricingTerm,
      notes: formData.get("notes") || null,
      lines: {
        create: items.map(it => ({
          productId: it.productId, qty: it.qty, uom: it.uom, price: it.price, taxRate: 0,
        })),
      },
    },
  });

  // remember the per-unit label so the PDF prints "260 / MT"
  if (items[0].priceUnit) {
    await prisma.purchaseOrder.update({ where: { id: po.id }, data: { notes: (po.notes || "") } });
  }

  revalidatePath("/purchase");
  revalidatePath("/bookings");
  redirect(`/purchase?created=${po.id}`);
}

export async function deletePoAction(formData) {
  const id = Number(formData.get("id"));
  await prisma.bookingLine.updateMany({ where: { poId: id }, data: { poId: null } });
  await prisma.purchaseOrder.delete({ where: { id } });
  revalidatePath("/purchase");
  revalidatePath("/bookings");
}

/** Booking grid: attach an existing PO to a booking. */
export async function linkPoAction(formData) {
  const bookingId = Number(formData.get("bookingId"));
  const poId = formData.get("poId") ? Number(formData.get("poId")) : null;
  if (!poId) return;

  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId }, include: { lines: true } });
  await prisma.purchaseOrder.update({ where: { id: poId }, data: { fromBookingId: bookingId } });

  // give unassigned container lines this supplier so the Supplier tab is usable
  const free = await prisma.bookingLine.findMany({ where: { bookingId, poId: null }, orderBy: { lineNo: "asc" } });
  for (const l of free) {
    await prisma.bookingLine.update({
      where: { id: l.id },
      data: {
        supplierId: po.partnerId,
        poId: po.id,
        productId: po.lines[0]?.productId ?? null,
        price: po.lines[0]?.price ?? null,
        qtyUnit: po.lines[0]?.uom ?? null,
        pricingTerm: po.shippingTerms,
      },
    });
  }

  revalidatePath("/bookings");
  revalidatePath("/suppliers");
}

export async function unlinkPoAction(formData) {
  const bookingId = Number(formData.get("bookingId"));
  const poId = Number(formData.get("poId"));
  await prisma.purchaseOrder.update({ where: { id: poId }, data: { fromBookingId: null } });
  await prisma.bookingLine.updateMany({ where: { bookingId, poId }, data: { poId: null, supplierId: null } });
  revalidatePath("/bookings");
  revalidatePath("/suppliers");
}
