"use client";

// A brief confirmation that something saved.
//
// Server actions revalidate the page, so the new data appears on its own — but
// silently. Without a word of acknowledgement the only way to know a save
// worked is to hunt for the changed value, which is why "nothing happened" is
// the natural reading of a successful save.
//
// Portalled for the same reason the modals are: `backdrop-filter` on the cards
// creates a containing block, and a `position: fixed` toast rendered inside one
// would be trapped in the card instead of pinned to the window.

import { useEffect } from "react";
import Portal from "@/components/Portal";
import { IconCheck, IconAlert, IconX } from "@/components/icons";

export default function Toast({ message, kind = "success", onDone, duration = 3200 }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => onDone?.(), duration);
    return () => clearTimeout(t);
  }, [message, duration, onDone]);

  if (!message) return null;

  const success = kind === "success";

  return (
    <Portal>
      <div
        // aria-live so screen readers announce it without stealing focus.
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex justify-center px-4
                   sm:bottom-6 sm:left-auto sm:right-6 sm:justify-end sm:px-0"
      >
        <div
          className={`pointer-events-auto flex max-w-sm items-start gap-2.5 rounded-lg border px-3.5 py-2.5
                      text-sm shadow-lg backdrop-blur animate-toast-in
                      ${success
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-900"
                        : "border-red-500/30 bg-red-500/10 text-red-900"}`}
        >
          {success
            ? <IconCheck size={16} className="mt-0.5 shrink-0" />
            : <IconAlert size={16} className="mt-0.5 shrink-0" />}
          <div className="min-w-0 flex-1">{message}</div>
          <button
            type="button"
            onClick={() => onDone?.()}
            className="-mr-1 shrink-0 rounded p-0.5 opacity-60 transition hover:opacity-100"
            aria-label="Dismiss"
          >
            <IconX size={14} />
          </button>
        </div>
      </div>
    </Portal>
  );
}
