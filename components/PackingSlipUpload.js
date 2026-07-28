"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { IconUpload } from "@/components/icons";

function SubmitBtn({ done }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="btn">
      {pending ? "Reading…" : done ? "Replace slip" : "Read slip"}
    </button>
  );
}

/**
 * One packing slip per booking — the supplier sends a single document
 * covering every container, so this sits on the booking header row.
 */
export default function PackingSlipUpload({ booking, action }) {
  const [open, setOpen] = useState(false);
  const { id, number, lineCount, filled, slipFile } = booking;
  const done = filled > 0;

  return (
    <>
      <button onClick={() => setOpen(true)} className={`${done ? "btn-secondary" : "btn"} btn-sm`}>
        <IconUpload size={13} />
        {done ? "Replace slip" : "Upload packing slip"}
      </button>

      {open && (
        <div className="overlay items-center" onClick={() => setOpen(false)}>
          <div className="modal max-w-lg" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold tracking-tight text-ink-900">
              Packing slip · {number}
            </h3>
            <p className="mb-5 mt-1 text-sm text-ink-500">
              Upload the supplier's slip for this booking. It should list all{" "}
              <b>{lineCount} container{lineCount === 1 ? "" : "s"}</b> — every row is filled in
              from the one document.
            </p>

            {slipFile && (
              <div className="mb-4 rounded-lg border border-ink-200 bg-ink-50/70 px-3 py-2 text-xs text-ink-600">
                Current: <span className="font-medium text-ink-800">{slipFile}</span>
                {" · "}{filled} of {lineCount} containers filled
              </div>
            )}

            <form action={action}>
              <input type="hidden" name="bookingId" value={id} />
              <input
                type="file" name="file" required
                accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.docx"
                className="input file:mr-3 file:rounded-md file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-brand-700"
              />
              <p className="mt-2 text-2xs text-ink-400">
                PDF, Word or a photo. Container numbers already on a row are matched first;
                anything else fills the remaining rows in the order the slip lists them.
              </p>

              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
                <SubmitBtn done={done} />
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
