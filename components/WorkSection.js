"use client";

// The "needs attention" / "complete" split above a list of shipment panels.
//
// Sorting finished work below unfinished isn't enough on its own — at 19
// shipments the boundary between them is invisible while scrolling. A labelled
// section with a count makes it explicit, and lets the completed group stay
// collapsed as a single line until someone actually wants it.

import { useState } from "react";
import { IconChevron } from "@/components/icons";

export default function WorkSection({
  title,
  count,
  note,            // e.g. "13 shipments · 96 containers"
  tone = "work",   // "work" | "done"
  defaultOpen = true,
  collapsible = true,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!count) return null;

  const done = tone === "done";

  const heading = (
    <>
      <span className={`text-2xs font-semibold uppercase tracking-wider ${done ? "text-ink-400" : "text-brand-500"}`}>
        {title}
      </span>
      <span className="text-2xs text-ink-400">{note}</span>
    </>
  );

  return (
    <section className="mb-5">
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className="mb-2.5 flex w-full items-center gap-2 rounded-md px-1 py-1 text-left transition hover:bg-ink-100"
        >
          <IconChevron
            size={13}
            className={`shrink-0 text-ink-400 transition-transform duration-150 ${open ? "rotate-90" : ""}`}
          />
          {heading}
          <span className="ml-auto text-2xs text-ink-400">{open ? "hide" : "show"}</span>
        </button>
      ) : (
        <div className="mb-2.5 flex items-center gap-2 px-1 py-1">{heading}</div>
      )}

      {open && <div className="space-y-3">{children}</div>}
    </section>
  );
}
