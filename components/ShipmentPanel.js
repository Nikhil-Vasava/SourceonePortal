"use client";

// A shipment panel that only renders its container table when opened.
//
// The Supplier and Buyer tabs both list every shipment with every container
// line expanded. At 19 shipments and 138 lines that's roughly ten screens of
// scrolling before you reach the one you came for, and the rows you need are
// mixed in among the ones that are already done.
//
// `defaultOpen` is set by the page from whether the shipment still needs work,
// so the useful rows are open on arrival and finished ones stay out of the way.
//
// Children are ordinary elements, not a render function. A render prop would
// avoid building the collapsed rows at all, but functions can't cross the
// server/client boundary — the pages using this are server components, so a
// function prop would fail at runtime. The rows are therefore built on the
// server either way; what collapsing removes is the DOM, which is what makes
// the page long and the scrolling heavy.

import { useState } from "react";
import { IconChevron } from "@/components/icons";

export default function ShipmentPanel({
  defaultOpen = false,
  header,          // always visible
  actions,         // always visible, right-aligned — upload, allocate, etc.
  summary,         // one-line description shown when collapsed
  children,
  className = "",
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`panel overflow-hidden ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200 bg-ink-100 px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            aria-expanded={open}
            className="icon-btn shrink-0"
            title={open ? "Hide containers" : "Show containers"}
          >
            <IconChevron
              size={15}
              className={`transition-transform duration-150 ${open ? "rotate-90" : ""}`}
            />
          </button>
          <div className="min-w-0 flex-1">{header}</div>
        </div>
        {actions && <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">{actions}</div>}
      </div>

      {open ? (
        <div className="overflow-x-auto">{children}</div>
      ) : (
        summary && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="block w-full px-4 py-2 text-left text-2xs text-ink-400 transition hover:bg-ink-100 hover:text-ink-500"
          >
            {summary}
          </button>
        )
      )}
    </div>
  );
}
