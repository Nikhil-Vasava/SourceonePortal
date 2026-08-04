import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { readBookingDocument, createBookingFromExtract } from "@/lib/booking-import";
import { hasGeminiKey } from "@/lib/gemini";
import { PageHeader } from "@/components/ui";
import { IconAlert } from "@/components/icons";

export const dynamic = "force-dynamic";

async function importBooking(formData) {
  "use server";
  const files = formData.getAll("file").filter(f => f && f.size);
  if (!files.length) {
    redirect("/bookings/import?error=" + encodeURIComponent("Please choose at least one file."));
  }

  const created = [];
  const notes = [];

  for (const file of files) {
    if (!/\.(pdf|png|jpe?g|webp|heic)$/i.test(file.name)) {
      redirect("/bookings/import?error=" + encodeURIComponent(
        `${file.name}: upload a PDF or a photo of the booking confirmation.`));
    }

    let read;
    try {
      read = await readBookingDocument(Buffer.from(await file.arrayBuffer()), file.name);
    } catch (e) {
      redirect("/bookings/import?error=" + encodeURIComponent(`${file.name}: ${e.message}`));
    }

    try {
      const b = await createBookingFromExtract(read.data, file.name);
      created.push(b.id);
      notes.push(`${read.data.bookingNumber} · ${read.provider}`);
    } catch (e) {
      const msg = String(e.message).includes("Unique constraint")
        ? `${file.name}: booking ${read.data.bookingNumber} already exists.`
        : `${file.name}: ${e.message}`;
      redirect("/bookings/import?error=" + encodeURIComponent(msg));
    }
  }

  const how = encodeURIComponent(notes.join(" · "));
  if (created.length === 1) redirect(`/bookings/${created[0]}?imported=1&how=${how}`);
  redirect(`/bookings?imported=${created.length}&how=${how}`);
}

export default function ImportBooking({ searchParams }) {
  requireUser();
  const aiReady = hasGeminiKey();

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Import Booking"
        subtitle="Upload carrier booking confirmations — read on this machine first, AI only if needed"
      />

      {searchParams?.error && (
        <div className="alert-error mb-5">
          <IconAlert size={18} className="mt-0.5 shrink-0" />
          <div><b>Import failed.</b> {decodeURIComponent(searchParams.error)}</div>
        </div>
      )}

      {!aiReady && (
        <div className="alert-warn mb-5">
          <IconAlert size={18} className="mt-0.5 shrink-0" />
          <div>
            <b>No <code className="rounded bg-black/30 px-1 font-mono">GEMINI_API_KEY</code> set.</b>{" "}
            Maersk, MSC and ONE still import normally. Other carriers and scanned
            documents will need adding by hand.
          </div>
        </div>
      )}

      <form action={importBooking} className="card">
        <span className="label">Booking confirmation(s)</span>
        <input
          type="file" name="file" multiple required
          accept=".pdf,.png,.jpg,.jpeg,.webp,.heic"
          className="input file:mr-3 file:rounded-md file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand-950 hover:file:bg-brand-400"
        />

        <div className="mt-4 rounded-lg border border-ink-200 bg-ink-100 p-4 text-xs leading-relaxed text-ink-600">
          <b className="text-ink-700">How each file is read</b>
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            <li>
              <b className="text-ink-700">Built-in parser</b> — Maersk, MSC and ONE are
              recognised exactly, on this machine. Instant, free, no usage limits.
            </li>
            <li>
              <b className="text-ink-700">Gemini</b> — used only when the layout isn&apos;t
              recognised, or the PDF is a scan with no text in it. Anything the parser
              did find is kept in preference to the model&apos;s reading.
            </li>
          </ol>

          <div className="mt-3 border-t border-ink-200 pt-3">
            <b className="text-ink-700">Read from the document:</b> Freight Forwarder · Booking No ·
            Shipping Line · Vessel · Voyage · Port of Loading · Port of Destination ·
            Place of Delivery · Booked Cont. · Container Type · ERD · Docs Cut Off ·
            Cargo Cut-Off · ETD/ETA · Commodity · Gross Weight
          </div>

          <div className="mt-3">
            <b className="text-ink-700">You fill in later:</b> Price / Cont. · Loaded Cont. ·
            Other Cont. · SI Sent Date — these never appear in carrier documents.
            Use <b>Edit</b> on the booking row.
          </div>
        </div>

        <p className="mt-2 text-xs text-ink-500">
          Select several files to import multiple bookings at once. Scans and photos are
          fine now — they&apos;re read as images when there&apos;s no text layer.
        </p>

        <div className="mt-4 flex gap-2">
          <button className="btn">Read &amp; create booking</button>
          <Link href="/bookings" className="btn-secondary">Cancel</Link>
        </div>
      </form>

      <p className="mt-3 text-xs text-ink-500">
        Nothing to upload? <Link href="/bookings/new" className="text-brand-600 hover:underline">Add a booking manually</Link>.
      </p>
    </div>
  );
}
