"use client";

// The PIN screen, plus the re-lock behaviour.
//
// Deliberately rendered inside the normal page area, so the sidebar stays put
// and this reads as one locked section rather than a modal that has taken over
// the app. You can navigate away at any time.

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { IconAlert, IconSettings } from "@/components/icons";

export default function SettingsPinGate({ configured, minutes }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function submit(e) {
    e.preventDefault();
    if (busy || !pin) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/settings-lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        setPin("");
        router.refresh();          // page re-renders server-side, now unlocked
      } else {
        setError(json.error || "That PIN isn't right.");
        setPin("");
        inputRef.current?.focus();
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <div className="alert-warn max-w-xl">
        <IconAlert size={18} className="mt-0.5 shrink-0" />
        <div>
          <b>No PIN is set.</b> Settings is locked until{" "}
          <code className="rounded bg-white px-1">SETTINGS_PIN</code> is added to the
          environment variables — at least 4 characters. On Vercel that&apos;s
          Settings → Environment Variables, then redeploy.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-sm">
      <div className="card p-6">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-ink-100">
          <IconSettings size={20} className="text-ink-600" />
        </div>

        <h2 className="text-base font-semibold text-ink-900">Enter your PIN</h2>
        <p className="mt-1 text-sm text-ink-500">
          Settings can permanently delete data, so it asks again even though
          you&apos;re signed in. Unlocks for {minutes} minutes, and re-locks when you
          leave the page.
        </p>

        <form onSubmit={submit} className="mt-5">
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={e => { setPin(e.target.value); setError(""); }}
            placeholder="••••"
            aria-label="Settings PIN"
            aria-invalid={Boolean(error)}
            className="input text-center text-lg tracking-[0.4em]"
          />

          {error && (
            <p role="alert" className="mt-2 text-xs font-medium text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={busy || !pin}
            className="btn mt-4 w-full justify-center disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Checking…" : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * Re-locks Settings the moment you navigate elsewhere.
 *
 * keepalive lets the request outlive the unmount — a normal fetch would be
 * cancelled mid-flight by the navigation. The cookie also carries its own
 * expiry, so the lock still happens if this never fires (tab closed, offline).
 */
export function LockOnLeave() {
  useEffect(() => {
    return () => {
      try {
        fetch("/api/settings-lock", { method: "DELETE", keepalive: true });
      } catch { /* navigating away — nothing useful to do */ }
    };
  }, []);
  return null;
}
