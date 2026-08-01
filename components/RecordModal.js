"use client";

// One modal for adding and editing every kind of master data.
//
// The alternative was a bespoke form per entity, which is how the Info page
// drifted out of sync in the first place: partners and products had update
// support in their server action but no UI to reach it. Driving the form from a
// field spec means adding a column to a table is a one-line change here.
//
// Errors are shown inside the modal rather than thrown away, because the
// interesting failures are the ones the server raises — a duplicate SKU, a
// record that something else is using.

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { IconX, IconPlus, IconPencil, IconAlert } from "@/components/icons";
import Portal from "@/components/Portal";

/**
 * @param {Array}  fields   [{ name, label, type, options, required, placeholder, full }]
 * @param {object} record   existing values; omit for a new record
 * @param {object} fixed    hidden values always submitted (e.g. { type: "VENDOR" })
 */
export default function RecordModal({
  fields, record = null, fixed = {}, action, title, trigger = "button", triggerLabel,
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef(null);
  const router = useRouter();
  const editing = Boolean(record?.id);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape" && !busy) close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy]);   // eslint-disable-line react-hooks/exhaustive-deps

  function close() {
    setOpen(false);
    setError("");
  }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action(new FormData(formRef.current));
      close();
      router.refresh();
    } catch (err) {
      // A redirect inside a server action surfaces as an error — let it through.
      if (err?.digest?.startsWith?.("NEXT_REDIRECT")) throw err;
      setError(err?.message || "Couldn't save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {trigger === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="icon-btn"
          aria-label={`Edit ${record?.name || "record"}`}
          title="Edit"
        >
          <IconPencil size={14} />
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="btn">
          <IconPlus size={16} />
          {triggerLabel || title}
        </button>
      )}

      {open && (
        <Portal>
        <div className="overlay" onClick={() => !busy && close()}>
          <div
            className="modal max-w-3xl"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h3 className="text-base font-semibold text-ink-900">
                {editing ? `Edit ${record.name || title}` : title}
              </h3>
              <button type="button" onClick={close} className="icon-btn" aria-label="Close">
                <IconX size={16} />
              </button>
            </div>

            {error && (
              <div className="alert-error mb-4">
                <IconAlert size={18} className="mt-0.5 shrink-0" />
                <div>{error}</div>
              </div>
            )}

            <form ref={formRef} onSubmit={submit}>
              {editing && <input type="hidden" name="id" value={record.id} />}
              {Object.entries(fixed).map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
              ))}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {fields.map(f => (
                  <div key={f.name} className={f.full ? "sm:col-span-2 lg:col-span-3" : ""}>
                    <label className="label" htmlFor={`f-${f.name}`}>
                      {f.label}{f.required && " *"}
                    </label>

                    {f.type === "select" ? (
                      <select
                        id={`f-${f.name}`}
                        name={f.name}
                        required={f.required}
                        defaultValue={record?.[f.name] ?? f.defaultValue ?? ""}
                        className="input"
                      >
                        {!f.required && <option value="">—</option>}
                        {f.options.map(o => {
                          const value = typeof o === "string" ? o : o.value;
                          const label = typeof o === "string" ? o : o.label;
                          return <option key={value} value={value}>{label}</option>;
                        })}
                      </select>
                    ) : (
                      <input
                        id={`f-${f.name}`}
                        name={f.name}
                        type={f.type || "text"}
                        step={f.type === "number" ? "0.01" : undefined}
                        required={f.required}
                        placeholder={f.placeholder}
                        defaultValue={record?.[f.name] ?? ""}
                        className="input"
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={close} disabled={busy} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={busy} className="btn">
                  {busy ? "Saving…" : editing ? "Save changes" : "Create"}
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
