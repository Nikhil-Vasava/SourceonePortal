"use client";

// Row selection + export buttons for the Bookings register.
//
// The checkboxes sit inside table rows that already contain their own forms
// (link PO, edit booking), so wrapping the table in a form would nest forms —
// invalid HTML, and browsers silently drop the inner ones. Instead selection is
// held in React state and the export builds a throwaway form at click time.

import { createContext, useContext, useMemo, useRef, useState, useEffect } from "react";
import { IconDownload } from "@/components/icons";

const Ctx = createContext(null);

export function SelectionProvider({ ids, children }) {
  const [selected, setSelected] = useState(() => new Set());

  // Rows change when the filters change. Drop ids that are no longer on screen,
  // otherwise an invisible selection would quietly widen the export.
  const key = ids.join(",");
  useEffect(() => {
    setSelected(prev => {
      const next = new Set([...prev].filter(id => ids.includes(id)));
      return next.size === prev.size ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const value = useMemo(() => ({
    ids,
    selected,
    toggle: (id) => setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    }),
    setAll: (on) => setSelected(on ? new Set(ids) : new Set()),
  }), [ids, selected]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function useSelection() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("Selection components must be inside <SelectionProvider>");
  return ctx;
}

const BOX = "h-3.5 w-3.5 cursor-pointer rounded border-ink-300 bg-transparent " +
            "text-brand-500 accent-brand-500 focus:ring-1 focus:ring-brand-500";

/** Checkbox for a single row. */
export function SelectRow({ id, label }) {
  const { selected, toggle } = useSelection();
  return (
    <input
      type="checkbox"
      className={BOX}
      checked={selected.has(id)}
      onChange={() => toggle(id)}
      aria-label={label ? `Select ${label}` : "Select row"}
    />
  );
}

/** Header checkbox — shows a dash when only some rows are ticked. */
export function SelectAll() {
  const { ids, selected, setAll } = useSelection();
  const ref = useRef(null);
  const all = ids.length > 0 && selected.size === ids.length;
  const some = selected.size > 0 && !all;

  useEffect(() => { if (ref.current) ref.current.indeterminate = some; }, [some]);

  return (
    <input
      ref={ref}
      type="checkbox"
      className={BOX}
      checked={all}
      onChange={e => setAll(e.target.checked)}
      aria-label={all ? "Clear selection" : "Select all rows"}
    />
  );
}

/**
 * The two export buttons.
 * With rows ticked, exports exactly those. With none ticked, exports the whole
 * filtered view — which is what "filter, then export" is meant to do.
 */
export function ExportButtons({ query, endpoint = "/api/export/bookings" }) {
  const { selected } = useSelection();
  const [busy, setBusy] = useState(null);

  function run(format) {
    setBusy(format);
    const form = document.createElement("form");
    form.method = "POST";
    form.action = endpoint;
    form.style.display = "none";

    const add = (name, value) => {
      if (value === undefined || value === null || value === "") return;
      const i = document.createElement("input");
      i.type = "hidden";
      i.name = name;
      i.value = String(value);
      form.appendChild(i);
    };

    add("format", format);
    ["q", "from", "to", "sort", "dir"].forEach(k => add(k, query?.[k]));
    selected.forEach(id => add("id", id));

    document.body.appendChild(form);
    form.submit();
    // The response is a download, so the page never navigates — clean up and
    // re-enable the buttons shortly after.
    setTimeout(() => { form.remove(); setBusy(null); }, 1200);
  }

  const n = selected.size;
  const what = n ? `${n} selected` : "all shown";

  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-2xs text-ink-400 sm:inline">
        Export {what}
      </span>
      <button
        type="button"
        onClick={() => run("pdf")}
        disabled={busy !== null}
        title={`Download ${what} as a PDF`}
        className="btn-secondary !px-2.5 !py-1.5 !text-2xs disabled:opacity-50"
      >
        <IconDownload size={14} /> {busy === "pdf" ? "…" : "PDF"}
      </button>
      <button
        type="button"
        onClick={() => run("xlsx")}
        disabled={busy !== null}
        title={`Download ${what} as a spreadsheet`}
        className="btn-secondary !px-2.5 !py-1.5 !text-2xs disabled:opacity-50"
      >
        <IconDownload size={14} /> {busy === "xlsx" ? "…" : "XLSX"}
      </button>
    </div>
  );
}
