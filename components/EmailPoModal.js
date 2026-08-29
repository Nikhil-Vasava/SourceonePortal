"use client";

// Emails a purchase order to its supplier.
//
// The draft is fetched when the modal opens, not rendered with the page — 25
// rows would otherwise each ship a full email body and their suppliers'
// contact lists to the browser for a dialog that usually stays shut.
//
// Nothing leaves until the send button is pressed, and the action re-checks
// that on the server: this is the one place in the app that puts a message in
// front of someone outside the company, so a mis-click has to be harmless.

import { useCallback, useEffect, useState } from "react";
import Portal from "@/components/Portal";
import Toast from "@/components/Toast";
import { IconMail, IconAlert, IconCheck, IconX } from "@/components/icons";

const fmtWhen = (iso) => {
  try { return new Date(iso).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return ""; }
};

export default function EmailPoModal({ poId, poNumber, supplier, emailedAt, getDraft, sendAction }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);

  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const close = useCallback(() => { setOpen(false); setError(""); }, []);

  async function openModal() {
    setOpen(true);
    setLoading(true);
    setError("");
    try {
      const d = await getDraft(poId);
      if (d?.error) { setError(d.error); setDraft(null); }
      else {
        setDraft(d);
        setTo(d.to.join(", "));
        setCc(d.cc.join(", "));
        setSubject(d.subject);
        setBody(d.body);
      }
    } catch {
      setError("Couldn't prepare the draft. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape" && !busy) close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, close]);

  async function send(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.set("id", String(poId));
      fd.set("to", to);
      fd.set("cc", cc);
      fd.set("subject", subject);
      fd.set("body", body);
      fd.set("confirm", "yes");          // matched server-side
      const r = await sendAction(fd);
      if (r?.error) { setError(r.error); return; }
      close();
      setToast({
        kind: "success",
        message: r.rejected?.length
          ? `Sent ${poNumber}, but ${r.rejected.join(", ")} was refused.`
          : `${poNumber} sent to ${r.sentTo.length} recipient${r.sentTo.length === 1 ? "" : "s"}.`,
      });
    } catch {
      setError("The message couldn't be sent. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const addAddress = (addr) => {
    const cur = cc.split(/[,;]/).map(s => s.trim()).filter(Boolean);
    if (cur.includes(addr) || to.includes(addr)) return;
    setCc([...cur, addr].join(", "));
  };

  const sent = Boolean(emailedAt);

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="icon-btn"
        title={sent ? `Emailed ${fmtWhen(emailedAt)} — send again` : `Email ${poNumber} to ${supplier}`}
        aria-label={`Email ${poNumber}`}
      >
        <IconMail size={14} className={sent ? "text-emerald-500" : ""} />
      </button>

      <Toast message={toast?.message} kind={toast?.kind} onDone={() => setToast(null)} />

      {open && (
        <Portal>
          <div className="overlay" onClick={() => !busy && close()}>
            <div className="modal max-w-2xl" onClick={e => e.stopPropagation()}
                 role="dialog" aria-modal="true" aria-label={`Email ${poNumber}`}>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-ink-900">Email {poNumber}</h3>
                  <p className="mt-0.5 text-sm text-ink-500">to {supplier}</p>
                </div>
                <button type="button" onClick={close} disabled={busy} className="icon-btn" aria-label="Close">
                  <IconX size={16} />
                </button>
              </div>

              {loading && <p className="py-8 text-center text-sm text-ink-400">Preparing the draft…</p>}

              {!loading && draft && !draft.configured && (
                <div className="alert-warn mb-4">
                  <IconAlert size={18} className="mt-0.5 shrink-0" />
                  <div>
                    <b>Email isn't set up yet.</b> Add{" "}
                    <code className="rounded bg-black/30 px-1 font-mono text-2xs">{draft.missing.join(", ")}</code>{" "}
                    to the environment variables and redeploy. You can still write the draft, but it can't be sent.
                  </div>
                </div>
              )}

              {!loading && draft?.configured && (
                <div className="mb-4 rounded-lg border border-ink-200 bg-ink-100 px-3 py-2 text-2xs text-ink-500">
                  <div>From: <span className="text-ink-700">{draft.from}</span></div>
                  {draft.replyTo && draft.replyTo !== draft.from && (
                    <div>Replies to: <span className="text-ink-700">{draft.replyTo}</span></div>
                  )}
                  {draft.aliasSend && (
                    <div className="mt-1 text-amber-500">
                      Sending as a different address from the one the portal signs in with. This
                      only works if it's a verified “Send mail as” alias — otherwise the provider
                      quietly replaces it. Check the first one that goes out.
                    </div>
                  )}
                </div>
              )}

              {!loading && draft?.alreadySent && (
                <div className="alert-warn mb-4">
                  <IconCheck size={18} className="mt-0.5 shrink-0" />
                  <div>
                    Already sent on <b>{fmtWhen(draft.alreadySent.at)}</b>
                    {draft.alreadySent.to ? <> to {draft.alreadySent.to}</> : null}. Sending again will deliver a second copy.
                  </div>
                </div>
              )}

              {error && (
                <div className="alert-error mb-4">
                  <IconAlert size={18} className="mt-0.5 shrink-0" />
                  <div>{error}</div>
                </div>
              )}

              {!loading && draft && (
                <form onSubmit={send} className="space-y-3">
                  <div>
                    <label className="label" htmlFor="po-to">To</label>
                    <input id="po-to" value={to} onChange={e => setTo(e.target.value)}
                           className="input" placeholder="supplier@example.com" />
                  </div>

                  <div>
                    <label className="label" htmlFor="po-cc">Cc</label>
                    <input id="po-cc" value={cc} onChange={e => setCc(e.target.value)}
                           className="input" placeholder="Optional — comma separated" />
                    {draft.known.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-2xs text-ink-400">Contacts:</span>
                        {draft.known.map(k => (
                          <button key={k.email} type="button" onClick={() => addAddress(k.email)}
                                  className="rounded border border-ink-200 px-1.5 py-0.5 text-2xs text-ink-500 transition hover:border-brand-500 hover:text-brand-500"
                                  title={k.email}>
                            + {k.name}{k.role ? ` (${k.role})` : ""}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="label" htmlFor="po-subject">Subject</label>
                    <input id="po-subject" value={subject} onChange={e => setSubject(e.target.value)} className="input" />
                  </div>

                  <div>
                    <label className="label" htmlFor="po-body">Message</label>
                    <textarea id="po-body" value={body} onChange={e => setBody(e.target.value)}
                              rows={12} className="input font-mono text-xs leading-relaxed" />
                  </div>

                  <div className="flex items-center gap-2 rounded-lg border border-ink-200 bg-ink-100 px-3 py-2 text-xs text-ink-600">
                    <IconCheck size={14} className="shrink-0 text-emerald-500" />
                    <span>
                      <b className="text-ink-800">{draft.filename}</b> attached — generated from this order when you send.
                    </span>
                    <a href={`/api/po/${poId}`} target="_blank" rel="noreferrer"
                       className="ml-auto shrink-0 text-brand-600 hover:underline">Preview</a>
                  </div>

                  <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                    <button type="button" onClick={close} disabled={busy} className="btn-secondary">Cancel</button>
                    <button type="submit" disabled={busy || !draft.configured}
                            className="btn disabled:opacity-50"
                            title={draft.configured ? "" : "Email isn't set up yet"}>
                      {busy ? "Sending…" : "Send email"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
