import { prisma } from "@/lib/db";
import { nextPoNumber } from "@/lib/numbering";
import { toNum, toDate } from "@/lib/booking-import";

const norm = (s) =>
  String(s || "").toLowerCase()
    .replace(/\b(ltd|limited|llc|inc|co|company|pte|pvt|corp)\b/g, "")
    .replace(/[^a-z0-9]/g, "");

/** Find a supplier by name, or create one from the extracted vendor block. */
async function resolveSupplier(data) {
  const name = (data.vendorName || "").trim();
  if (!name) return { supplier: null, createdSupplier: false };

  // Deliberately not filtered to active records. This matches names read out of a
  // PDF against partners we already know; an inactive supplier is still that same
  // company, and skipping it would silently create a duplicate instead.
  const vendors = await prisma.partner.findMany({ where: { type: { in: ["VENDOR", "BUYER"] } } });
  const t = norm(name);
  const hit =
    vendors.find(p => norm(p.name) === t) ||
    vendors.find(p => norm(p.name) && (norm(p.name).includes(t) || t.includes(norm(p.name))));
  if (hit) return { supplier: hit, createdSupplier: false };

  const supplier = await prisma.partner.create({
    data: {
      name,
      type: "VENDOR",
      email: data.vendorEmail || null,
      phone: data.vendorPhone || null,
      currency: data.currency || "USD",
      addresses: data.vendorAddress
        ? { create: [{ type: "BILLING", line1: String(data.vendorAddress).slice(0, 250) }] }
        : undefined,
    },
  });
  return { supplier, createdSupplier: true };
}

/** Find a product by name, or create it. */
async function resolveProduct(description, uom) {
  const name = (description || "").trim();
  if (!name) return { product: null, created: false };

  // Same reasoning as the vendor lookup above — match against every product,
  // including deactivated ones, so re-importing an old PO still lines up.
  const all = await prisma.product.findMany();
  const t = norm(name);
  const hit = all.find(p => norm(p.name) === t) || all.find(p => norm(p.name) && (norm(p.name).includes(t) || t.includes(norm(p.name))));
  if (hit) return { product: hit, created: false };

  let sku = name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "ITEM";
  if (await prisma.product.findUnique({ where: { sku } })) sku = `${sku}-${Date.now().toString().slice(-4)}`;

  const product = await prisma.product.create({ data: { name, sku, uom: uom || "MT" } });
  return { product, created: true };
}

/** Turns an extracted PO document into a PurchaseOrder record. */
export async function createPoFromExtract(data, fileName) {
  const { supplier, createdSupplier } = await resolveSupplier(data);
  if (!supplier) throw new Error("No vendor name found in the document.");

  const rawLines = (Array.isArray(data.lines) ? data.lines : []).filter(l => l && l.description);
  if (!rawLines.length) throw new Error("No line items found in the document.");

  const newProducts = [];
  const items = [];
  for (const l of rawLines) {
    const { product, created } = await resolveProduct(l.description, l.qtyUnit);
    if (created) newProducts.push(product.name);
    items.push({
      productId: product.id,
      qty: toNum(l.quantity) ?? 0,
      uom: l.qtyUnit || product.uom || "MT",
      price: toNum(l.price) ?? 0,
      taxRate: 0,
    });
  }

  // Keep the document's own PO number when it has one and it isn't already used.
  let number = (data.poNumber || "").trim();
  if (!number || (await prisma.purchaseOrder.findUnique({ where: { number } }))) {
    number = await nextPoNumber();
  }

  const po = await prisma.purchaseOrder.create({
    data: {
      number,
      partnerId: supplier.id,
      orderDate: toDate(data.date) || new Date(),
      status: "CONFIRMED",
      currency: data.currency || supplier.currency || "USD",
      paymentTerms: data.paymentTerms || null,
      shippingTerms: rawLines[0]?.pricing || null,
      notes: data.comments || null,
      sourceFile: fileName,
      extractedJson: JSON.stringify(data, null, 2),
      lines: { create: items },
    },
  });

  return { po, createdSupplier: createdSupplier ? supplier.name : null, newProducts };
}
