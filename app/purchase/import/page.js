import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { pdfToText } from "@/lib/pdf-text";
import { parsePoText } from "@/lib/po-parser";
import { createPoFromExtract } from "@/lib/po-import";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

async function importPo(formData) {
  "use server";
  const files = formData.getAll("file").filter(f => f && f.size);
  if (!files.length) redirect("/purchase/import?error=" + encodeURIComponent("Please choose at least one file."));

  const ids = [];
  const suppliers = [];
  const products = [];

  for (const file of files) {
    if (!/\.pdf$/i.test(file.name)) {
      redirect("/purchase/import?error=" + encodeURIComponent(
        `${file.name}: only PDF purchase orders can be read. Create this one with Generate PO instead.`));
    }

    let data;
    try {
      const text = await pdfToText(Buffer.from(await file.arrayBuffer()));
      const parsed = parsePoText(text);
      if (parsed.missing.includes("vendorName")) {
        redirect("/purchase/import?error=" + encodeURIComponent(
          `${file.name}: couldn't find a vendor name — this layout isn't recognised.`));
      }
      if (parsed.missing.includes("lines")) {
        redirect("/purchase/import?error=" + encodeURIComponent(
          `${file.name}: no line items found. The table needs a "Sr. No. / Description / Quantity / Price" header row.`));
      }
      data = parsed.data;
    } catch (e) {
      redirect("/purchase/import?error=" + encodeURIComponent(`${file.name}: ${e.message}`));
    }

    try {
      const r = await createPoFromExtract(data, file.name);
      ids.push(r.po.id);
      if (r.createdSupplier) suppliers.push(r.createdSupplier);
      products.push(...r.newProducts);
    } catch (e) {
      redirect("/purchase/import?error=" + encodeURIComponent(`${file.name}: ${e.message}`));
    }
  }

  const q = new URLSearchParams({ imported: String(ids.length) });
  if (ids.length === 1) q.set("created", String(ids[0]));
  if (suppliers.length) q.set("newSuppliers", suppliers.join(", "));
  if (products.length) q.set("newProducts", [...new Set(products)].join(", "));
  redirect(`/purchase?${q.toString()}`);
}

export default function ImportPo({ searchParams }) {
  requireUser();
  return (
    <div className="max-w-2xl">
      <PageHeader title="Import Purchase Order" subtitle="Upload an existing PO PDF — read instantly, no AI service involved" />

      {searchParams?.error && (
        <div className="alert-error mb-5">
          <b>Import failed.</b> {decodeURIComponent(searchParams.error)}
        </div>
      )}

      <form action={importPo} className="card">
        <span className="label">Purchase order(s) — PDF</span>
        <input type="file" name="file" multiple required accept=".pdf"
          className="input file:mr-3 file:rounded-md file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-brand-700" />

        <div className="mt-4 rounded-lg border border-ink-200/70 bg-ink-50/70 p-4 text-xs leading-relaxed text-ink-600">
          <b className="text-ink-700">Read from the document:</b> P.O. No. · Date · Vendor name, address, phone, email ·
          every line item (description, quantity, unit, price, per-unit, pricing term) · payment terms · comments
          <br /><br />
          <b className="text-ink-700">Auto-created if new:</b> the supplier (with address and contact details) and any
          products not already in your catalogue — so your <Link href="/info" className="underline">Info</Link> lists fill themselves in.
          <br /><br />
          Built for the SourceOne purchase order layout. The document's own P.O. number is kept; if it's missing or
          already used, a new one is assigned.
        </div>

        <p className="mt-2 text-xs text-ink-500">
          Select several files to import multiple POs at once. Reading happens on your own machine — no usage limits.
        </p>

        <div className="mt-4 flex gap-2">
          <button className="btn">Read &amp; Create PO</button>
          <Link href="/purchase" className="btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
