import { prisma } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { usDate } from "@/lib/numbering";
const { buildPoPdf } = require("@/lib/po-pdf");

export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  if (!getUser()) return new Response("Unauthorized", { status: 401 });

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: Number(params.id) },
    include: {
      partner: { include: { addresses: true, contacts: true } },
      lines: { include: { product: true } },
      bookingLines: true,
    },
  });
  if (!po) return new Response("Purchase order not found", { status: 404 });

  const company = await getCompany();
  const addr = po.partner.addresses[0];
  const addressText = addr
    ? [addr.line1, addr.line2, addr.city, addr.state, addr.country, addr.zip].filter(Boolean).join(", ")
    : "";

  const bl = po.bookingLines[0];
  const num = (n) => (n % 1 === 0 ? String(n) : n.toFixed(2));
  const lines = po.lines.map(l => ({
    description: l.product?.name || "",
    quantity: `${num(l.qty)} ${l.uom}`,
    price: `${num(l.price)} ${bl?.priceUnit || "/ MT"}`,
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
    comments: company.defaultComments,
    minimumWeight: company.minimumWeight,
  }, company);

  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${po.number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
