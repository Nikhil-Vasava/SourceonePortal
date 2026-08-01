"use client";

// Deactivate / reactivate / delete controls for a master-data row.
//
// Delete is expected to fail often — the server refuses when anything is using
// the record — so the message it returns is the useful part and gets shown in a
// dialog rather than swallowed. That message is also where the suggestion to
// deactivate instead comes from.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconTrash, IconAlert, IconX, IconCheck } from "@/components/icons";
import Portal from "@/components/Portal";

export function ToggleActive({ id, active, action }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function run() {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("id", String(id));
      await action(fd);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      className="text-2xs font-medium text-ink-500 underline-offset-2 hover:text-ink-800 hover:underline disabled:opacity-50"
      title={active ? "Hide from dropdowns, keep the history" : "Show in dropdowns again"}
    >
      {busy ? "…" : active ? "Deactivate" : "Reactivate"}
    </button>
  );
}

export function DeleteRecord({ id, name, action, label = "record" }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function run() {
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.set("id", String(id));
      await action(fd);
      setOpen(false);
      router.refresh();
    } catch (e) {
      // Usually "can't be deleted — it's used by ...", which is worth reading.
      setError(e?.message || "Couldn't delete this record.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setError(""); }}
        className="icon-btn-danger"
        aria-label={`Delete ${name}`}
        title="Delete"
      >
        <IconTrash size={14} />
      </button>

      {open && (
        <Portal>
        <div className="overlay" onClick={() => !busy && setOpen(false)}>
          <div className="modal max-w-md" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="mb-3 flex items-start justify-between gap-3">
              <h3 className="flex items-center gap-2 text-base font-semibold text-ink-900">
                <IconAlert size={18} className="text-red-600" />
                Delete this {label}?
              </h3>
              <button type="button" onClick={() => setOpen(false)} className="icon-btn" aria-label="Close">
                <IconX size={16} />
              </button>
            </div>

            {error ? (
              <div className="alert-warn mb-4">
                <IconAlert size={18} className="mt-0.5 shrink-0" />
                <div>{error}</div>
              </div>
            ) : (
              <p className="mb-4 text-sm text-ink-600">
                <b className="text-ink-900">{name}</b> will be removed permanently. If anything
                is already using it, the delete is refused and you&apos;ll be told what.
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
                {error ? "Close" : "Cancel"}
              </button>
              {!error && (
                <button type="button" onClick={run} disabled={busy} className="btn btn-danger">
                  {busy ? "Deleting…" : "Delete"}
                </button>
              )}
            </div>
          </div>
        </div>
        </Portal>
      )}
    </>
  );
}

/** Green tick / grey dash showing whether a record is active. */
export function ActiveDot({ active }) {
  return active ? (
    <span className="inline-flex items-center gap-1 text-2xs font-medium text-emerald-700">
      <IconCheck size={12} /> Active
    </span>
  ) : (
    <span className="badge bg-ink-100 text-ink-500">Inactive</span>
  );
}
