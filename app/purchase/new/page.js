import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { PageHeader } from "@/components/ui";
import PoForm from "@/components/PoForm";
import { createPoAction } from "@/lib/actions-po";
import { ACTIVE_BOOKING } from "@/lib/booking-scope";
import { poPrefixFor } from "@/lib/numbering";

export const dynamic = "force-dynamic";

export default async function NewPo({ searchParams }) {
  requireRole("ADMIN", "PURCHASE");
  const [suppliers, products, bookings, company] = await Promise.all([
    prisma.partner.findMany({ where: { type: { in: ["VENDOR", "BUYER"] }, active: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.booking.findMany({ where: ACTIVE_BOOKING, orderBy: { id: "desc" } }),
    getCompany(),
  ]);

  // The prefix depends on the first product's category, which isn't chosen yet,
  // so show both forms rather than a single number that might be wrong.
  const now = new Date();
  const period = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}_`;
  const plastic = `${poPrefixFor("Plastics", company.poPrefix)}${period}00X`;
  const other = `${poPrefixFor("Paper", company.poPrefix)}${period}00X`;

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Generate Purchase Order"
        subtitle={`Numbered automatically — ${plastic} for plastics, ${other} for everything else`}
      />

      {suppliers.length === 0 && (
        <div className="alert-warn mb-5">
          No suppliers yet — add them in the <Link href="/info?tab=suppliers" className="font-medium underline">Info tab</Link> first.
        </div>
      )}
      {searchParams?.error && (
        <div className="alert-error mb-5">{decodeURIComponent(searchParams.error)}</div>
      )}

      <PoForm
        action={createPoAction}
        suppliers={suppliers}
        products={products}
        bookings={bookings}
        defaultTerms={company.defaultTerms || ""}
        submitLabel="Generate PO"
      />
    </div>
  );
}
