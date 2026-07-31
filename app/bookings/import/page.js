import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { pdfToText } from "@/lib/pdf-text";
import { parseBookingText } from "@/lib/booking-parsers";
import { createBookingFromExtract } from "@/lib/booking-import";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

async function importBooking(formData) {
  "use server";
  const files = formData.getAll("file").filter(f => f && f.size);
  if (!files.length) redirect("/bookings/import?error=" + encodeURIComponent("Please choose at least one file."));

  const created = [];
  const notes = [];

  for (const file of files) {
    if (!/\.pdf$/i.test(file.name)) {
      redirect("/bookings/import?error=" + encodeURIComponent(
        `${file.name}: only PDF booking confirmations can be read. Add this one manually.`));
    }

    let parsed;
    try {
      const text = await pdfToText(Buffer.from(await file.arrayBuffer()));
      parsed = parseBookingText(text);
    } catch (e) {
      redirect("/bookings/import?error=" + encodeURIComponent(`${file.name}: ${e.message}`));
    }

    if (!parsed.data.bookingNumber) {
      redirect("/bookings/import?error=" + encodeURIComponent(
        `${file.name}: couldn't find a booking number — this layout isn't recognised yet. Add it manually, or send me the PDF so I can add support.`));
    }

    try {
      const b = await createBookingFromExtract(parsed.data, file.name);
      created.push(b.id);
      notes.push(`${parsed.data.bookingNumber} (${parsed.carrier})`);
    } catch (e) {
      const msg = String(e.message).includes("Unique constraint")
        ? `${file.name}: booking ${parsed.data.bookingNumber} already exists.`
        : `${file.name}: ${e.message}`;
      redirect("/bookings/import?error=" + encodeURIComponent(msg));
    }
  }

  if (created.length === 1) redirect(`/bookings/${created[0]}?imported=1`);
  redirect(`/bookings?imported=${created.length}`);
}

export default function ImportBooking({ searchParams }) {
  requireUser();
  return (
    <div className="max-w-2xl">
      <PageHeader title="Import Booking" subtitle="Upload carrier booking confirmations — read instantly, no AI service involved" />

      {searchParams?.error && (
        <div className="alert-error mb-5">
          <b>Import failed.</b> {decodeURIComponent(searchParams.error)}
        </div>
      )}

      <form action={importBooking} className="card">
        <span className="label">Booking confirmation(s) — PDF</span>
        <input type="file" name="file" multiple required accept=".pdf"
          className="input file:mr-3 file:rounded-md file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand-950 hover:file:bg-brand-400" />

        <div className="mt-4 rounded-lg border border-ink-200 bg-ink-100 p-4 text-xs leading-relaxed text-ink-600">
          <b className="text-ink-700">Recognised formats:</b> Maersk · MSC · ONE (Ocean Network Express).
          Other carriers fall back to a generic reader and may need a few fields filled in by hand.
          <br /><br />
          <b className="text-ink-700">Read from the document:</b> Freight Forwarder · Booking No · Shipping Line · Vessel · Voyage ·
          Port of Loading · Port of Destination · Place of Delivery · Booked Cont. · Container Type · ERD · Docs Cut Off ·
          Cargo Cut-Off · ETD/ETA · Commodity · Gross Weight
          <br /><br />
          <b className="text-ink-700">You fill in later:</b> Price / Cont. · Loaded Cont. · Other Cont. · SI Sent Date —
          these never appear in carrier documents. Use <b>Edit</b> on the booking row.
        </div>

        <p className="mt-2 text-xs text-ink-500">
          Select several files to import multiple bookings at once. Reading happens on your own machine, so there are no
          usage limits and nothing is sent to an external service.
        </p>

        <div className="mt-4 flex gap-2">
          <button className="btn">Read &amp; Create Booking</button>
          <Link href="/bookings" className="btn-secondary">Cancel</Link>
        </div>
      </form>

      <p className="mt-3 text-xs text-ink-500">
        Scanned or photographed bookings have no text layer and can't be read — <Link href="/bookings/new" className="underline">add those manually</Link>.
      </p>
    </div>
  );
}
