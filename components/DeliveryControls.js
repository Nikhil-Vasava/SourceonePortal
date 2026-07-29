"use client";

// Mark delivered / undo / record the real sailing date.
//
// Both dates default to today and can be back-dated, which is the normal case:
// you find out a container landed on Tuesday when you check on Thursday.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconCheck, IconX, IconAlert, IconClock } from "@/components/icons";

const today = () => new Date().toISOString().slice(0, 10);

function Dialog({ title, children, onClose }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal max-w-md" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-ink-900">{title}</h3>
          <button type="button" onClick={onClose} className="icon-btn" aria-label="Close">
            <IconX size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function MarkDelivered({ booking, action, compact = false }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const fd = new FormData();
      fd.set("bookingId", String(booking.id));
      fd.set("deliveredAt", date);
      fd.set("deliveryNote", note);
      await action(fd);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err?.message || "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setError(""); }}
        className={compact ? "btn btn-sm" : "btn"}
      >
        <IconCheck size={compact ? 13 : 15} /> Mark delivered
      </button>

      {open && (
        <Dialog title={`Mark ${booking.number} delivered`} onClose={() => !busy && setOpen(false)}>
          {error && (
            <div className="alert-error mb-4">
              <IconAlert size={18} className="mt-0.5 shrink-0" />
              <div>{error}</div>
            </div>
          )}

          <form onSubmit={submit}>
            <label className="label" htmlFor="delivered-on">Delivered on</label>
            <input
              id="delivered-on"
              type="date"
              value={date}
              max={today()}
              onChange={e => setDate(e.target.value)}
              required
              className="input"
            />
            <p className="mt-1.5 text-2xs text-ink-400">
              Back-date this if the container landed before you got to it — the clock
              is measured to the real arrival, not to today.
            </p>

            <label className="label mt-4" htmlFor="delivered-note">Note (optional)</label>
            <input
              id="delivered-note"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. 3 days late, carrier advised congestion"
              className="input"
            />

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setOpen(false)} disabled={busy} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={busy} className="btn">
                {busy ? "Saving…" : "Mark delivered"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}

export function UndoDelivered({ booking, action }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function run() {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("bookingId", String(booking.id));
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
      title="Clear the delivery date and restart the clock"
    >
      {busy ? "…" : "Undo"}
    </button>
  );
}

export function SetDeparture({ booking, action }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(
    booking.actualDeparture ? String(booking.actualDeparture).slice(0, 10) : today()
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const fd = new FormData();
      fd.set("bookingId", String(booking.id));
      fd.set("actualDeparture", date);
      await action(fd);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err?.message || "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setError(""); }}
        className="text-2xs font-medium text-brand-600 underline-offset-2 hover:underline"
        title="Record the date the vessel actually sailed"
      >
        <IconClock size={11} className="mr-0.5 inline" />
        {booking.actualDeparture ? "Change sailed date" : "Set sailed date"}
      </button>

      {open && (
        <Dialog title={`When did ${booking.number} sail?`} onClose={() => !busy && setOpen(false)}>
          {error && (
            <div className="alert-error mb-4">
              <IconAlert size={18} className="mt-0.5 shrink-0" />
              <div>{error}</div>
            </div>
          )}

          <form onSubmit={submit}>
            <label className="label" htmlFor="sailed-on">Actually sailed on</label>
            <input
              id="sailed-on"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
              className="input"
            />
            <p className="mt-1.5 text-2xs text-ink-400">
              Until this is set the 45 days are counted from the scheduled ETD. A vessel
              that left late will look overdue sooner than it should.
            </p>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setOpen(false)} disabled={busy} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={busy} className="btn">
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
