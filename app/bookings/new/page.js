import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { nextBookingNumber } from "@/lib/numbering";
import { PageHeader, Field } from "@/components/ui";

export const dynamic = "force-dynamic";

async function createBooking(formData) {
  "use server";
  const d = (k) => formData.get(k) ? new Date(formData.get(k)) : null;
  const n = (k) => formData.get(k) ? Number(formData.get(k)) : null;
  const lineCount = Math.max(1, Number(formData.get("lineCount") || 1));

  const b = await prisma.booking.create({ data: {
    number: await nextBookingNumber(),
    shippingLineId: n("shippingLineId"), forwarderId: n("forwarderId"), chaId: n("chaId"),
    vessel: formData.get("vessel") || null, voyage: formData.get("voyage") || null,
    pol: formData.get("pol") || null, pod: formData.get("pod") || null,
    cutoffDate: d("cutoffDate"), etd: d("etd"), eta: d("eta"),
    notes: formData.get("notes") || null,
    lines: { create: Array.from({ length: lineCount }, (_, i) => ({
      lineNo: i + 1,
      containerType: formData.get("containerType") || null,
      description: formData.get("description") || null,
      quantity: formData.get("quantity") ? Number(formData.get("quantity")) : null,
      qtyUnit: formData.get("qtyUnit") || null,
    }))},
  }});
  redirect(`/bookings/${b.id}`);
}

export default async function NewBooking() {
  requireUser();
  const [lines, forwarders, chas, ports] = await Promise.all([
    prisma.partner.findMany({ where: { type: "SHIPPING_LINE" }, orderBy: { name: "asc" } }),
    prisma.partner.findMany({ where: { type: "FORWARDER" }, orderBy: { name: "asc" } }),
    prisma.partner.findMany({ where: { type: "CHA" }, orderBy: { name: "asc" } }),
    prisma.port.findMany({ orderBy: { name: "asc" } }),
  ]);
  const opts = (arr) => [<option key="" value="">—</option>, ...arr.map(x => <option key={x.id} value={x.id}>{x.name}</option>)];
  const portOpts = [<option key="" value="">—</option>, ...ports.map(p => <option key={p.id} value={`${p.code} (${p.name})`}>{p.code} — {p.name}</option>)];
  return (
    <div className="max-w-4xl">
      <PageHeader title="Add Booking" subtitle="Manual entry — use Import to read a booking PDF instead" />
      <form action={createBooking} className="card grid grid-cols-3 gap-4">
        <Field label="Shipping Line"><select name="shippingLineId" className="input">{opts(lines)}</select></Field>
        <Field label="Freight Forwarder"><select name="forwarderId" className="input">{opts(forwarders)}</select></Field>
        <Field label="CHA"><select name="chaId" className="input">{opts(chas)}</select></Field>
        <Field label="Vessel"><input name="vessel" className="input" /></Field>
        <Field label="Voyage"><input name="voyage" className="input" /></Field>
        <div />
        <Field label="Port of Loading"><select name="pol" className="input">{portOpts}</select></Field>
        <Field label="Port of Discharge"><select name="pod" className="input">{portOpts}</select></Field>
        <div />
        <Field label="Cutoff Date"><input name="cutoffDate" type="date" className="input" /></Field>
        <Field label="ETD"><input name="etd" type="date" className="input" /></Field>
        <Field label="ETA"><input name="eta" type="date" className="input" /></Field>

        <div className="col-span-3 mt-2 border-t pt-4">
          <h3 className="mb-3 text-sm font-semibold">Container lines</h3>
          <div className="grid grid-cols-5 gap-3">
            <Field label="How many lines?"><input name="lineCount" type="number" min="1" defaultValue="1" className="input" /></Field>
            <Field label="Container Type">
              <select name="containerType" className="input"><option value="">—</option>{["20GP","40GP","40HC","45HC","20RF","40RF"].map(t => <option key={t}>{t}</option>)}</select>
            </Field>
            <Field label="Description"><input name="description" className="input" placeholder="e.g. LDPE 98/2" /></Field>
            <Field label="Quantity"><input name="quantity" type="number" step="0.01" className="input" /></Field>
            <Field label="Unit">
              <select name="qtyUnit" className="input">{["Loads","MT","Containers","KG"].map(u => <option key={u}>{u}</option>)}</select>
            </Field>
          </div>
        </div>

        <div className="col-span-3"><Field label="Notes"><textarea name="notes" rows="2" className="input" /></Field></div>
        <div className="col-span-3"><button className="btn">Create Booking</button></div>
      </form>
    </div>
  );
}
