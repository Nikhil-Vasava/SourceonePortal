"use client";

// One user row, with edit and password reset behind modals.
//
// Both are destructive-ish in different ways — a wrong role silently grants or
// removes access, and a password reset locks someone out until they're told the
// new one — so neither happens from a single click in a table.

import { useCallback, useState } from "react";
import Portal from "@/components/Portal";
import Toast from "@/components/Toast";
import { IconPencil, IconAlert, IconX, IconCheck } from "@/components/icons";

const ROLE_TONE = {
  ADMIN:    "bg-brand-500/15 text-brand-300",
  PURCHASE: "bg-emerald-500/15 text-emerald-300",
  MANAGER:  "bg-ink-200 text-ink-500",
  USER:     "bg-ink-200 text-ink-500",
};

function Modal({ title, onClose, busy, children }) {
  return (
    <Portal>
      <div className="overlay" onClick={() => !busy && onClose()}>
        <div className="modal max-w-lg" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
          <div className="mb-4 flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold text-ink-900">{title}</h3>
            <button type="button" onClick={onClose} disabled={busy} className="icon-btn" aria-label="Close">
              <IconX size={16} />
            </button>
          </div>
          {children}
        </div>
      </div>
    </Portal>
  );
}

export default function UserRow({ user, isMe, roles, roleNotes, onUpdate, onSetPassword, onToggle }) {
  const [editing, setEditing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [role, setRole] = useState(user.role);

  const close = useCallback(() => { setEditing(false); setResetting(false); setError(""); }, []);

  async function run(action, form, onDone) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const r = await action(new FormData(form));
      if (r?.error) { setError(r.error); return; }
      onDone?.();
      close();
      setToast({ kind: "success", message: r.message || "Saved." });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Toast message={toast?.message} kind={toast?.kind} onDone={() => setToast(null)} />

      <tr className={`row ${user.active ? "" : "opacity-55"}`}>
        <td className="td font-medium">
          {user.name}
          {isMe && <span className="ml-1.5 text-2xs text-ink-400">(you)</span>}
        </td>
        <td className="td">{user.email}</td>
        <td className="td">
          <span className={`badge ${ROLE_TONE[user.role] || ROLE_TONE.USER}`}>{user.role}</span>
        </td>
        <td className="td">{user.region || "—"}</td>
        <td className="td">
          {user.active
            ? <span className="text-emerald-400">Active</span>
            : <span className="text-ink-400">Disabled</span>}
        </td>
        <td className="td">
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => { setEditing(true); setRole(user.role); setError(""); }}
                    className="icon-btn" title={`Edit ${user.name}`} aria-label={`Edit ${user.name}`}>
              <IconPencil size={14} />
            </button>
            <button type="button" onClick={() => { setResetting(true); setError(""); }}
                    className="text-2xs text-brand-500 hover:underline">
              Reset password
            </button>
            <form action={onToggle} className="ml-1">
              <input type="hidden" name="id" value={user.id} />
              <button className="text-2xs text-ink-400 hover:text-ink-600 hover:underline"
                      title={isMe ? "You can't disable your own account" : ""}>
                {user.active ? "Disable" : "Enable"}
              </button>
            </form>
          </div>
        </td>
      </tr>

      {editing && (
        <Modal title={`Edit ${user.name}`} onClose={close} busy={busy}>
          {error && (
            <div className="alert-error mb-4"><IconAlert size={16} className="mt-0.5 shrink-0" /><div>{error}</div></div>
          )}
          <form onSubmit={e => { e.preventDefault(); run(onUpdate, e.currentTarget); }} className="space-y-3">
            <input type="hidden" name="id" value={user.id} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><span className="label">Name</span><input name="name" defaultValue={user.name} required className="input" /></div>
              <div><span className="label">Email (this is the login)</span><input name="email" type="email" defaultValue={user.email} required className="input" /></div>
              <div>
                <span className="label">Role</span>
                <select name="role" value={role} onChange={e => setRole(e.target.value)}
                        disabled={isMe} className="input disabled:opacity-60">
                  {roles.map(r => <option key={r}>{r}</option>)}
                </select>
                {isMe && <p className="mt-1 text-2xs text-ink-400">You can't change your own role.</p>}
              </div>
              <div><span className="label">Region</span><input name="region" defaultValue={user.region || ""} className="input" /></div>
            </div>

            <p className="rounded-lg border border-ink-200 bg-ink-100 px-3 py-2 text-2xs text-ink-500">
              <b className="text-ink-700">{role}</b> — {roleNotes[role]}
            </p>

            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              <button type="button" onClick={close} disabled={busy} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={busy} className="btn">{busy ? "Saving…" : "Save changes"}</button>
            </div>
          </form>
        </Modal>
      )}

      {resetting && (
        <Modal title={`Reset password for ${user.name}`} onClose={close} busy={busy}>
          {error && (
            <div className="alert-error mb-4"><IconAlert size={16} className="mt-0.5 shrink-0" /><div>{error}</div></div>
          )}
          <form onSubmit={e => { e.preventDefault(); run(onSetPassword, e.currentTarget); }} className="space-y-3">
            <input type="hidden" name="id" value={user.id} />
            <div>
              <span className="label">New password</span>
              <input name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
              <p className="mt-1 text-2xs text-ink-400">
                At least 8 characters. {user.name} won't be told automatically — pass it on yourself,
                and not by email.
              </p>
            </div>
            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              <button type="button" onClick={close} disabled={busy} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={busy} className="btn">{busy ? "Resetting…" : "Reset password"}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
