"use client";

// Confirmation gate for the destructive actions on the Settings page.
//
// A plain confirm() is too easy to dismiss by reflex, so the exact word has to
// be typed before the button enables. Nothing here is a security boundary —
// the server action re-checks the admin role — this only guards against a
// mis-click wiping a database.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconAlert, IconX } from "@/components/icons";
import Portal from "@/components/Portal";

export default function ResetButton({ action, label, confirmWord, severe = false }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  const armed = typed.trim().toUpperCase() === confirmWord;

  function close() {
    setOpen(false);
    setTyped("");
  }

  function run() {
    if (!armed || pending) return;
    start(async () => {
      try {
        const res = await action();
        close();
        router.push(`/settings?done=${encodeURIComponent(res?.message || "Done.")}`);
        router.refresh();
      } catch (e) {
        close();
        router.push(`/settings?error=${encodeURIComponent(e?.message || "Something went wrong.")}`);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${severe ? "btn btn-danger" : "btn btn-secondary"} w-full shrink-0 justify-center sm:w-auto`}
      >
        {severe ? "Delete" : "Clear"}
      </button>

      {open && (
        <Portal>
        <div
          className="overlay items-center"
          onClick={close}
        >
          <div
            className="modal max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-1 flex items-start justify-between gap-3">
              <h3 className="flex items-center gap-2 text-base font-semibold text-ink-900">
                <IconAlert size={18} className="text-red-600" />
                {label}
              </h3>
              <button type="button" onClick={close} className="icon-btn" aria-label="Close">
                <IconX size={16} />
              </button>
            </div>

            <p className="mb-4 text-sm text-ink-600">
              This cannot be undone. Type{" "}
              <b className="font-mono text-ink-900">{confirmWord}</b> to confirm.
            </p>

            <input
              autoFocus
              value={typed}
              onChange={e => setTyped(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") run();
                if (e.key === "Escape") close();
              }}
              placeholder={confirmWord}
              className="input font-mono"
              aria-label={`Type ${confirmWord} to confirm`}
            />

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={close} className="btn btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={run}
                disabled={!armed || pending}
                className="btn btn-danger disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pending ? "Working…" : "Yes, do it"}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </>
  );
}
