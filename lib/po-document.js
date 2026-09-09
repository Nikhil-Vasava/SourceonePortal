// Renders a purchase order to PDF bytes.
//
// Lifted out of the download route so the emailed attachment and the document
// behind the Open button are produced by the same code. Two copies of this
// mapping would drift, and the day they did, the supplier would be holding a
// PDF that didn't match what the portal showed.

import { prisma } from "@/lib/db";
import { getCompany } from "@/lib/company";
import { usDate } from "@/lib/numbering";
const { buildPoPdf } = require("@/lib/po-pdf");

export const PO_INCLUDE = {
  partner: { include: { addresses: true, contacts: true } },
  lines: { include: { product: true } },
  bookingLines: true,
};

/** @returns {Promise<{po: object, company: object, pdf: Buffer, filename: string}|null>} */
export async function renderPoPdf(id) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: Number(id) },
    include: PO_INCLUDE,
  });
  if (!po) return null;

  const company = await getCompany();
  const addr = po.partner.addresses[0];
  const addressText = addr
    ? [addr.line1, addr.line2, addr.city, addr.state, addr.country, addr.zip].filter(Boolean).join(", ")
    : "";

  const bl = po.bookingLines[0];
  const num = (n) => (n % 1 === 0 ? String(n) : n.toFixed(2));
  // The PO line's own price unit wins; the booking line is only a fallback for
  // orders created before PurchaseOrderLine had the field.
  const perUnit = (l) => {
    const u = l.priceUnit || bl?.priceUnit || "/ MT";
    return u.startsWith("/") ? u : `/ ${u}`;
  };
  const lines = po.lines.map(l => ({
    description: l.product?.name || "",
    quantity: `${num(l.qty)} ${l.uom}`,
    price: `${num(l.price)} ${perUnit(l)}`,
    pricing: po.shippingTerms || bl?.pricingTerm || "",
  }));

  const bytes = await buildPoPdf({
    number: po.number,
    date: usDate(po.orderDate),
    vendorName: po.partner.name,
    vendorAddress: addressText,
    vendorPhone: po.partner.phone || po.partner.contacts[0]?.phone || "",
    vendorEmail: po.partner.email || po.partner.contacts[0]?.email || "",
    lines,
    paymentTerms: po.paymentTerms || "",
    // State the order's own currency, not the company default — that line is
    // the only place the document says which currency the prices are in.
    comments: `Currency mentioned is in ${po.currency || "USD"}`,
    // Terms as agreed on this order; older orders fall back to the old
    // single-line minimum weight so their PDFs still print something.
    terms: po.terms || company.defaultTerms || null,
    minimumWeight: company.minimumWeight,
    // Drives the stamp. Read from the order itself, never passed in by a
    // caller — the document says "approved" only when the database does.
    //
    // The approver's name and the approval date are deliberately NOT sent: the
    // PDF carries the stamp and nothing else. Both are still stored on the
    // order and shown in the app.
    approved: Boolean(po.approvedAt),
  }, company);

  return { po, company, pdf: Buffer.from(bytes), filename: `${po.number}.pdf` };
}
