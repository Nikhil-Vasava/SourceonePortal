import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { PageHeader, Field } from "@/components/ui";
import PoLinesEditor from "@/components/PoLinesEditor";
import { createPoAction } from "@/lib/actions-po";

export const dynamic = "force-dynamic";

export default async function NewPo({ searchParams }) {
  requireUser();
  const [suppliers, products, bookings, company] = await Promise.all([
    prisma.partner.findMany({ where: { type: { in: ["VENDOR", "BUYER"] }, active: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.booking.findMany({ orderBy: { id: "desc" } }),
    getCompany(),
  ]);

  const now = new Date();
  const nextStem = `${company.poPrefix}${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}_`;

  return (
    <div className="max-w-4xl">
      <PageHeader title="Generate Purchase Order" subtitle={`Numbered automatically as ${nextStem}00X`} />

      {suppliers.length === 0 && (
        <div className="alert-warn mb-5">
          No suppliers yet — add them in the <Link href="/info?tab=suppliers" className="font-medium underline">Info tab</Link> first.
        </div>
      )}
      {searchParams?.error && (
        <div className="alert-error mb-5">{decodeURIComponent(searchParams.error)}</div>
      )}

      <form action={createPoAction} className="card space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Supplier *">
            <select name="supplierId" required className="input">
              <option value="">Select supplier…</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Payment Terms"><input name="paymentTerms" placeholder="e.g. 30 days from invoice" className="input" /></Field>
          <Field label="Pricing Term (prints in the Pricing column)"><input name="pricingTerm" placeholder="FAS (Auckland)" className="input" /></Field>
        </div>

        <PoLinesEditor products={products} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Link to Booking (optional — you can also do this from the Booking tab)">
            <select name="bookingId" className="input">
              <option value="">— none —</option>
              {bookings.map(b => (
                <option key={b.id} value={b.id}>
                  {b.number}{b.pol ? ` · ${b.pol} → ${b.pod || "?"}` : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Notes (internal)"><input name="notes" className="input" /></Field>
        </div>

        <div className="flex gap-2">
          <button className="btn">Generate PO</button>
          <Link href="/purchase" className="btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
