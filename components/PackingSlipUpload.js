"use client";
import { useCallback, useState } from "react";
import { IconUpload, IconAlert } from "@/components/icons";
import Portal from "@/components/Portal";
import { useModalForm } from "@/lib/use-modal-form";

/**
 * One packing slip per booking — the supplier sends a single document
 * covering every container, so this sits on the booking header row.
 */
export default function PackingSlipUpload({ booking, action }) {
  const [open, setOpen] = useState(false);
  const { id, number, lineCount, filled, slipFile } = booking;
  const done = filled > 0;

  const close = useCallback(() => setOpen(false), []);
  // No toast here: this action redirects with its own result banner, which
  // reports how many containers were filled — more useful than "saved".
  const { formRef, busy, error, submit } = useModalForm(action, { onSuccess: close });

  return (
    <>
      <button onClick={() => setOpen(true)} className={`${done ? "btn-secondary" : "btn"} btn-sm`}>
        <IconUpload size={13} />
        {done ? "Replace slip" : "Upload packing slip"}
      </button>

      {open && (
        <Portal>
        <div className="overlay items-center" onClick={() => !busy && close()}>
          <div className="modal max-w-lg" onClick={e => e.stopPropagation()}
               role="dialog" aria-modal="true" aria-label={`Packing slip for ${number}`}>
            <h3 className="text-lg font-semibold tracking-tight text-ink-900">
              Packing slip · {number}
            </h3>
            <p className="mb-5 mt-1 text-sm text-ink-500">
              Upload the supplier's slip for this booking. It should list all{" "}
              <b>{lineCount} container{lineCount === 1 ? "" : "s"}</b> — every row is filled in
              from the one document.
            </p>

            {slipFile && (
              <div className="mb-4 rounded-lg border border-ink-200 bg-ink-100 px-3 py-2 text-xs text-ink-600">
                Current: <span className="font-medium text-ink-800">{slipFile}</span>
                {" · "}{filled} of {lineCount} containers filled
              </div>
            )}

            {error && (
              <div className="alert-error mb-4">
                <IconAlert size={18} className="mt-0.5 shrink-0" />
                <div>{error}</div>
              </div>
            )}

            <form ref={formRef} onSubmit={submit}>
              <input type="hidden" name="bookingId" value={id} />
              <input
                type="file" name="file" required
                accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.docx"
                className="input file:mr-3 file:rounded-md file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand-950 hover:file:bg-brand-400"
              />
              <p className="mt-2 text-2xs text-ink-400">
                PDF, Word or a photo. Container numbers already on a row are matched first;
                anything else fills the remaining rows in the order the slip lists them.
              </p>

              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={close} disabled={busy} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={busy} className="btn disabled:opacity-60">
                  {busy ? "Reading…" : done ? "Replace slip" : "Read slip"}
                </button>
              </div>
            </form>
          </div>
        </div>
        </Portal>
      )}
    </>
  );
}
