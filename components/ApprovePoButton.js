"use client";

// Approve / withdraw approval on a purchase order. Admins only.
//
// Approving applies the company stamp to the PDF and unlocks emailing for
// staff, so it asks first — this is the click that commits the company, and
// the difference between it and the one next to it is one row of pixels.

import { useState } from "react";
import Portal from "@/components/Portal";
import Toast from "@/components/Toast";
import { IconCheck, IconAlert, IconX } from "@/components/icons";

export default function ApprovePoButton({ poId, poNumber, supplier, approvedAt, approvedName, approve, unapprove }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);

  const approved = Boolean(approvedAt);

  async function run() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.set("id", String(poId));
      const r = approved ? await unapprove(fd) : await approve(fd);
      if (r?.error) { setError(r.error); return; }
      setAsking(false);
      setToast({
        kind: "success",
        message: r.withdrawn
          ? `Approval withdrawn from ${r.number}. The stamp is off the PDF.`
          : `${r.number} approved. The stamp is on the PDF and staff can email it.`,
      });
    } catch {
      setError("Couldn't complete that. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setAsking(true); setError(""); }}
        className="icon-btn"
        title={approved
          ? `Approved${approvedName ? ` by ${approvedName}` : ""} — click to withdraw`
          : `Approve ${poNumber}`}
        aria-label={approved ? `Withdraw approval of ${poNumber}` : `Approve ${poNumber}`}
      >
        <IconCheck size={15} className={approved ? "text-emerald-500" : "text-ink-400"} />
      </button>

      <Toast message={toast?.message} kind={toast?.kind} onDone={() => setToast(null)} />

      {asking && (
        <Portal>
          <div className="overlay" onClick={() => !busy && setAsking(false)}>
            <div className="modal max-w-md" onClick={e => e.stopPropagation()}
                 role="dialog" aria-modal="true">
              <div className="mb-3 flex items-start justify-between gap-3">
                <h3 className="text-base font-semibold text-ink-900">
                  {approved ? `Withdraw approval of ${poNumber}?` : `Approve ${poNumber}?`}
                </h3>
                <button type="button" onClick={() => setAsking(false)} disabled={busy}
                        className="icon-btn" aria-label="Close">
                  <IconX size={16} />
                </button>
              </div>

              <p className="text-sm text-ink-500">
                {approved ? (
                  <>The company stamp comes off the PDF, and staff lose the ability to email
                     it to <b className="text-ink-700">{supplier}</b> until it's approved again.</>
                ) : (
                  <>This puts the company stamp on the PDF and lets staff email it to{" "}
                     <b className="text-ink-700">{supplier}</b>. Check the figures on the
                     document first — the stamp stands for your signature.</>
                )}
              </p>

              {approved && approvedName && (
                <p className="mt-2 text-2xs text-ink-400">Approved by {approvedName}.</p>
              )}

              {error && (
                <div className="alert-error mt-3">
                  <IconAlert size={16} className="mt-0.5 shrink-0" />
                  <div>{error}</div>
                </div>
              )}

              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <a href={`/api/po/${poId}`} target="_blank" rel="noreferrer"
                   className="btn-secondary sm:mr-auto">Open the PDF</a>
                <button type="button" onClick={() => setAsking(false)} disabled={busy} className="btn-secondary">
                  Cancel
                </button>
                <button type="button" onClick={run} disabled={busy}
                        className={approved ? "btn-secondary !border-red-500/40 !text-red-400" : "btn"}>
                  {busy ? "Working…" : approved ? "Withdraw approval" : "Approve"}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
