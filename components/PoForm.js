import Link from "next/link";
import { Field } from "@/components/ui";
import PoLinesEditor from "@/components/PoLinesEditor";

// The purchase order form, shared by Generate and Edit.
//
// One component rather than two near-identical pages: a field added to creation
// but forgotten on the edit screen is exactly how the Info tab drifted out of
// sync before — a column that could be set but never corrected.

// The currencies SourceOne actually trades in. Suppliers here invoice in NZD,
// overseas buyers in USD, and AUD comes up on the Australian side.
export const CURRENCIES = ["USD", "NZD", "AUD", "EUR", "GBP", "INR"];

const PO_STATUSES = ["DRAFT", "CONFIRMED", "RECEIVED", "BILLED", "CANCELLED"];

export default function PoForm({
  action,
  suppliers,
  products,
  bookings,
  po = null,               // existing order when editing
  defaultTerms = "",
  submitLabel = "Generate PO",
  cancelHref = "/purchase",
}) {
  const editing = Boolean(po?.id);
  const terms = po?.terms ?? defaultTerms;

  return (
    <form action={action} className="card space-y-4">
      {editing && <input type="hidden" name="id" value={po.id} />}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Supplier *">
          <select name="supplierId" required defaultValue={po?.partnerId ?? ""} className="input">
            <option value="">Select supplier…</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>

        {/* Prices aren't always USD — this drives the "Currency mentioned is in
            …" line on the document as well as how values are read back. */}
        <Field label="Currency">
          <select name="currency" defaultValue={po?.currency ?? "USD"} className="input">
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>

        <Field label="Pricing Term (prints in the Pricing column)">
          <input name="pricingTerm" defaultValue={po?.shippingTerms ?? ""} placeholder="FAS (Auckland)" className="input" />
        </Field>
      </div>

      {editing && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="P.O. Number">
            <input name="number" defaultValue={po.number} required className="input font-medium" />
          </Field>
          <Field label="Status">
            <select name="status" defaultValue={po.status} className="input">
              {PO_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Payment Terms">
            <input name="paymentTerms" defaultValue={po.paymentTerms ?? ""} placeholder="e.g. 30 days from invoice" className="input" />
          </Field>
        </div>
      )}

      {!editing && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Payment Terms">
            <input name="paymentTerms" placeholder="e.g. 30 days from invoice" className="input" />
          </Field>
        </div>
      )}

      <PoLinesEditor products={products} lines={po?.lines ?? []} />

      <Field label="Terms & Conditions (prints on the PDF — edit for this order only)">
        <textarea
          name="terms"
          rows={6}
          defaultValue={terms}
          className="input font-mono text-xs leading-relaxed"
          placeholder="- Weight loss of more than 2% is claimable."
        />
        <p className="mt-1 text-2xs text-ink-400">
          One condition per line. Saved with this order, so reprinting it later shows
          the terms as agreed. Change the starting text in{" "}
          <Link href="/settings" className="text-brand-600 hover:underline">Settings</Link>.
        </p>
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {!editing && (
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
        )}
        <Field label="Notes (internal)">
          <input name="notes" defaultValue={po?.notes ?? ""} className="input" />
        </Field>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="btn">{submitLabel}</button>
        <Link href={cancelHref} className="btn-secondary">Cancel</Link>
        {editing && (
          <a href={`/api/po/${po.id}`} target="_blank" rel="noreferrer" className="btn-secondary ml-auto">
            Preview current PDF
          </a>
        )}
      </div>
    </form>
  );
}
