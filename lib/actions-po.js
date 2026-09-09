"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { nextPoNumber } from "@/lib/numbering";
import { toNum, toDate } from "@/lib/booking-import";
import { requireUser, requireRole } from "@/lib/auth";
import { linkQuantity } from "@/lib/po-allocation";
import { record, recordUpdate } from "@/lib/audit";

/**
 * Raising, editing or deleting a purchase order is purchase work.
 *
 * This has to live in the action, not on the page. Server actions are POST
 * endpoints in their own right — reaching one does not require rendering the
 * screen that offers the button. That matters more now that the Purchase tab
 * is open to everyone: deletePoAction ships in the bundle of a page operations
 * staff legitimately load, so the role check has to be here.
 */
const purchaseOnly = () => requireRole("ADMIN", "PURCHASE");

/** Creates a standalone purchase order: one supplier, any number of product lines. */
export async function createPoAction(formData) {
  purchaseOnly();
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

  await record({
    action: "CREATE", entity: "PurchaseOrder", entityId: po.id, label: po.number,
    summary: `Raised purchase order ${po.number} to ${supplier?.name || "a supplier"}`
           + ` — ${items.length} line${items.length === 1 ? "" : "s"}`,
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
  purchaseOnly();
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

  await recordUpdate({
    entity: "PurchaseOrder", entityId: id, label: number, noun: "purchase order",
    before: existing,
    after: {
      number,
      partnerId: Number.isFinite(supplierId) ? supplierId : existing.partnerId,
      currency: formData.get("currency") || existing.currency,
      paymentTerms: formData.get("paymentTerms") || null,
      shippingTerms: formData.get("pricingTerm") || null,
      notes: formData.get("notes") || null,
      terms: (formData.get("terms") || "").toString().trim() || null,
      status: formData.get("status") || existing.status,
      orderDate: toDate(formData.get("orderDate")) || existing.orderDate,
    },
  });

  // Losing an approval is the consequential half of an edit — it means the
  // stamped PDF someone may already have seen is no longer the current one —
  // so it gets its own entry rather than hiding inside a field list.
  if (wasApproved) {
    await record({
      action: "UNAPPROVE", entity: "PurchaseOrder", entityId: id, label: number,
      summary: `Approval withdrawn from ${number} automatically — the order was edited after approval`,
    });
  }

  revalidatePath("/purchase");
  revalidatePath("/bookings");
  redirect(`/purchase?updated=${id}${wasApproved ? "&unapproved=1" : ""}`);
}

export async function deletePoAction(formData) {
  purchaseOnly();
  const id = Number(formData.get("id"));

  // Read it before it's gone — after the delete there is nothing left to name
  // it by, and a deletion is the entry people most want to be able to find.
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    select: { number: true, partner: { select: { name: true } } },
  });

  await prisma.bookingLine.updateMany({ where: { poId: id }, data: { poId: null } });
  await prisma.purchaseOrder.delete({ where: { id } });

  await record({
    action: "DELETE", entity: "PurchaseOrder", entityId: id, label: po?.number || `#${id}`,
    summary: `Deleted purchase order ${po?.number || `#${id}`}`
           + (po?.partner?.name ? ` (${po.partner.name})` : ""),
  });

  revalidatePath("/purchase");
  revalidatePath("/bookings");
}

/** Booking grid: attach an existing PO to a booking. */
export async function linkPoAction(formData) {
  requireUser();
  const bookingId = Number(formData.get("bookingId"));
  const poId = formData.get("poId") ? Number(formData.get("poId")) : null;
  if (!poId || !Number.isFinite(bookingId)) return;

  const [po, booking] = await Promise.all([
    // Both sides need their existing allocations: the share this link takes
    // depends on what each of them has already committed elsewhere.
    prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: { lines: true, allocations: true },
    }),
    prisma.booking.findUnique({
      where: { id: bookingId },
      include: { lines: true, poAllocations: true },
    }),
  ]);
  if (!po || !booking) return { error: "That purchase order or booking no longer exists." };

  // The smaller of "what this order still has to place" and "what this ship
  // still has room for". Nobody types it in — see lib/po-allocation.js.
  const { qty, error } = linkQuantity(po, booking, { poId, bookingId });
  if (error) return { error };

  await prisma.poAllocation.upsert({
    where: { poId_bookingId: { poId, bookingId } },
    create: { poId, bookingId, qty, unit: po.lines[0]?.uom ?? null },
    // Re-linking recalculates rather than adds, so correcting a booking's
    // container count fixes the balance instead of double-counting it.
    update: { qty, unit: po.lines[0]?.uom ?? null },
  });

  // The old single link stays in step for the first booking a PO lands on, so
  // anything still reading `fromBookingId` keeps working.
  if (!po.fromBookingId) {
    await prisma.purchaseOrder.update({ where: { id: poId }, data: { fromBookingId: bookingId } });
  }

  // Give this order's share of the container lines its supplier, so the
  // Supplier tab knows whose cargo is in which box.
  //
  // Only its share. This used to claim every free line on the booking, which
  // is how a 1-container order ended up owning both containers of a 2-container
  // shipment and left nothing for the second order to attach to.
  const free = await prisma.bookingLine.findMany({
    where: { bookingId, poId: null },
    orderBy: { lineNo: "asc" },
    take: Math.max(0, Math.round(qty)),
  });
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

  await record({
    action: "LINK", entity: "PoAllocation", entityId: bookingId, label: po.number,
    summary: `Put ${qty} ${po.lines[0]?.uom || "load"}${qty === 1 ? "" : "s"} of ${po.number}`
           + ` on booking ${booking.number}`,
  });

  revalidatePath("/bookings");
  revalidatePath("/purchase");
  revalidatePath("/suppliers");
  return { ok: true, qty };
}

export async function unlinkPoAction(formData) {
  requireUser();
  const bookingId = Number(formData.get("bookingId"));
  const poId = Number(formData.get("poId"));
  if (!Number.isFinite(bookingId) || !Number.isFinite(poId)) return;

  const [poRow, bookingRow] = await Promise.all([
    prisma.purchaseOrder.findUnique({ where: { id: poId }, select: { number: true } }),
    prisma.booking.findUnique({ where: { id: bookingId }, select: { number: true } }),
  ]);

  // Removing the allocation gives the quantity back to the PO's balance.
  await prisma.poAllocation.deleteMany({ where: { poId, bookingId } });
  await prisma.bookingLine.updateMany({ where: { bookingId, poId }, data: { poId: null, supplierId: null } });

  // If this was the booking the legacy pointer named, move it to whichever
  // allocation is left rather than leaving it pointing at a detached shipment.
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    select: { fromBookingId: true, allocations: { select: { bookingId: true }, orderBy: { id: "asc" }, take: 1 } },
  });
  if (po?.fromBookingId === bookingId) {
    await prisma.purchaseOrder.update({
      where: { id: poId },
      data: { fromBookingId: po.allocations[0]?.bookingId ?? null },
    });
  }

  await record({
    action: "UNLINK", entity: "PoAllocation", entityId: bookingId,
    label: poRow?.number || `#${poId}`,
    summary: `Took ${poRow?.number || `PO #${poId}`} off booking ${bookingRow?.number || `#${bookingId}`}`,
  });

  revalidatePath("/bookings");
  revalidatePath("/purchase");
  revalidatePath("/suppliers");
}
