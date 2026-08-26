import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { PageHeader } from "@/components/ui";
import PoForm from "@/components/PoForm";
import { updatePoAction } from "@/lib/actions-po";
import { fdate } from "@/lib/util";

export const dynamic = "force-dynamic";

export default async function EditPo({ params, searchParams }) {
  requireUser();
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();

  const [po, suppliers, products, company] = await Promise.all([
    prisma.purchaseOrder.findUnique({
      where: { id },
      include: { lines: { orderBy: { id: "asc" } }, partner: true, fromBooking: true },
    }),
    prisma.partner.findMany({ where: { type: { in: ["VENDOR", "BUYER"] }, active: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    getCompany(),
  ]);

  if (!po) notFound();

  // Only what the form needs, and plain — Prisma objects don't cross into
  // client components intact.
  const plain = {
    id: po.id,
    number: po.number,
    partnerId: po.partnerId,
    currency: po.currency,
    status: po.status,
    paymentTerms: po.paymentTerms,
    shippingTerms: po.shippingTerms,
    notes: po.notes,
    terms: po.terms,
    lines: po.lines.map(l => ({
      productId: l.productId, qty: l.qty, uom: l.uom, price: l.price, priceUnit: l.priceUnit,
    })),
  };

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={`Edit ${po.number}`}
        subtitle={`${po.partner.name} · raised ${fdate(po.orderDate)}${po.fromBooking ? ` · booking ${po.fromBooking.number}` : ""}`}
      />

      {searchParams?.error && (
        <div className="alert-error mb-5">{decodeURIComponent(searchParams.error)}</div>
      )}

      <div className="alert-warn mb-5">
        Changes apply to the PDF the moment you save. If this order has already gone
        to <b>{po.partner.name}</b>, send them the updated copy.
      </div>

      <PoForm
        action={updatePoAction}
        suppliers={suppliers}
        products={products}
        bookings={[]}
        po={plain}
        defaultTerms={company.defaultTerms || ""}
        submitLabel="Save changes"
        cancelHref="/purchase"
      />

      <p className="mt-3 text-2xs text-ink-400">
        To attach or detach a booking, use the Purchase Order column on the{" "}
        <Link href="/bookings" className="text-brand-600 hover:underline">Booking</Link> tab.
      </p>
    </div>
  );
}
