"use client";

import { useState } from "react";
import { IconAlert, IconCheck } from "@/components/icons";

/** Anyone can rotate their own password — no admin needed, and none involved. */
export default function ChangePasswordForm({ action }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    setBusy(true); setError(""); setDone(false);
    try {
      const r = await action(new FormData(form));
      if (r?.error) { setError(r.error); return; }
      form.reset();
      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card max-w-md space-y-3">
      <h3 className="text-sm font-semibold text-ink-900">Change your password</h3>

      {done && (
        <div className="alert-success">
          <IconCheck size={16} className="mt-0.5 shrink-0 text-emerald-500" />
          <div>Password changed. Use it next time you sign in.</div>
        </div>
      )}
      {error && (
        <div className="alert-error"><IconAlert size={16} className="mt-0.5 shrink-0" /><div>{error}</div></div>
      )}

      <div>
        <span className="label">Current password</span>
        <input name="current" type="password" required autoComplete="current-password" className="input" />
      </div>
      <div>
        <span className="label">New password</span>
        <input name="next" type="password" required minLength={8} autoComplete="new-password" className="input" />
      </div>
      <div>
        <span className="label">New password again</span>
        <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className="input" />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button disabled={busy} className="btn">{busy ? "Changing…" : "Change password"}</button>
        <span className="text-2xs text-ink-400">At least 8 characters.</span>
      </div>
    </form>
  );
}
