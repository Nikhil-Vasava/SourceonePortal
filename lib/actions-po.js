"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { nextPoNumber } from "@/lib/numbering";
import { toNum, toDate } from "@/lib/booking-import";

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

  const orderDate = toDate(formData.get("orderDate"));

  const [supplier, firstProduct, company] = await Promise.all([
    prisma.partner.findUnique({ where: { id: supplierId } }),
    // The first line decides NZP vs NZ.
    prisma.product.findUnique({ where: { id: items[0].productId }, select: { category: true } }),
    prisma.companySetting.findFirst(),
  ]);

  // Terms are captured onto the order now. A PO is a contract — reprinting it
  // later must show what was agreed, not today's default.
  const terms = (formData.get("terms") ?? company?.defaultTerms ?? "").toString().trim() || null;

  const po = await prisma.purchaseOrder.create({
    data: {
      number: await nextPoNumber(firstProduct?.category),
      // Midday UTC so the date reads the same either side of the dateline.
      ...(orderDate && { orderDate }),
      partnerId: supplierId,
      fromBookingId: bookingId,
      status: "CONFIRMED",
      currency: formData.get("currency") || supplier?.currency || "USD",
      paymentTerms: formData.get("paymentTerms") || null,
      incoterm: supplier?.incoterm || null,
      shippingTerms: pricingTerm,
      notes: formData.get("notes") || null,
      terms,
      lines: {
        create: items.map(it => ({
          productId: it.productId, qty: it.qty, uom: it.uom,
          price: it.price, priceUnit: it.priceUnit || null, taxRate: 0,
        })),
      },
    },
  });

  revalidatePath("/purchase");
  revalidatePath("/bookings");
  redirect(`/purchase?created=${po.id}`);
}

/**
 * Edits an existing purchase order, lines included.
 *
 * Lines are replaced wholesale rather than diffed. A PO line carries no history
 * of its own — no receipts or invoices point at it — so identity isn't worth
 * preserving, and delete-then-recreate can't leave a half-updated set behind.
 * The `containerId` link is the one thing that would be lost, so it's carried
 * across for any line that keeps its position.
 */
export async function updatePoAction(formData) {
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) redirect("/purchase");

  const existing = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { lines: { orderBy: { id: "asc" } } },
  });
  if (!existing) redirect("/purchase?error=" + encodeURIComponent("That purchase order no longer exists."));

  const back = `/purchase/${id}/edit?error=`;

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
      priceUnit: priceUnits[i] || null,
      // keep the container link where a line stays in the same slot
      containerId: existing.lines[items.length]?.containerId ?? null,
    });
  }
  if (!items.length) redirect(back + encodeURIComponent("A purchase order needs at least one product."));

  const number = (formData.get("number") || "").toString().trim();
  if (!number) redirect(back + encodeURIComponent("The PO number can't be blank."));

  // The number is editable, so it can now collide with another order.
  const clash = await prisma.purchaseOrder.findFirst({
    where: { number, id: { not: id } },
    select: { id: true },
  });
  if (clash) redirect(back + encodeURIComponent(`Another purchase order is already numbered ${number}.`));

  const supplierId = Number(formData.get("supplierId"));

  // Editing an approved order withdraws its approval. The stamp on the PDF
  // stands in for a signature, so it must never end up on a document the
  // approver didn't see — an admin has to look again and re-approve.
  const wasApproved = Boolean(existing.approvedAt);

  await prisma.$transaction([
    prisma.purchaseOrderLine.deleteMany({ where: { poId: id } }),
    prisma.purchaseOrder.update({
      where: { id },
      data: {
        number,
        ...(toDate(formData.get("orderDate")) && { orderDate: toDate(formData.get("orderDate")) }),
        partnerId: Number.isFinite(supplierId) ? supplierId : existing.partnerId,
        currency: formData.get("currency") || existing.currency,
        paymentTerms: formData.get("paymentTerms") || null,
        shippingTerms: formData.get("pricingTerm") || null,
        notes: formData.get("notes") || null,
        terms: (formData.get("terms") || "").toString().trim() || null,
        status: formData.get("status") || existing.status,
        approvedAt: null,
        approvedById: null,
        approvedName: null,
        lines: { create: items.map(({ containerId, ...l }) => ({ ...l, taxRate: 0, containerId })) },
      },
    }),
  ]);

  revalidatePath("/purchase");
  revalidatePath("/bookings");
  redirect(`/purchase?updated=${id}${wasApproved ? "&unapproved=1" : ""}`);
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
        // Carry the price unit across too, or the booking line shows a bare
        // number and loses the fact that it's a per-tonne rate.
        priceUnit: po.lines[0]?.priceUnit ?? null,
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
