// Second gate in front of the Settings page.
//
// Being an admin gets you to the page; the PIN is what lets you press the
// destructive buttons. It exists so a signed-in laptop left open on a desk
// can't have the database wiped by whoever walks past.
//
// The PIN lives in SETTINGS_PIN — never in the database or the repo. Unlocking
// sets a short-lived signed cookie; the signature means it can't be forged by
// editing the cookie in devtools, and the embedded expiry means a stolen cookie
// stops working on its own.

import { cookies } from "next/headers";
import crypto from "crypto";

export const UNLOCK_COOKIE = "settings_unlock";

/** How long an unlock survives. Also re-locked on leaving the page, client-side. */
export const UNLOCK_MINUTES = 15;

/** Signing key. Reuses the session secret — same trust boundary, one thing to rotate. */
function secret() {
  const s = process.env.SESSION_SECRET;
  if (s && s.trim().length >= 16) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is missing — the settings lock can't be signed.");
  }
  return "dev-only-insecure-secret";
}

/** Whether a PIN has been configured at all. */
export function hasSettingsPin() {
  const p = process.env.SETTINGS_PIN;
  return Boolean(p && String(p).trim().length >= 4);
}

/**
 * Compares against SETTINGS_PIN without leaking length or content through timing.
 * Both sides are hashed first so timingSafeEqual always gets equal-length buffers.
 */
export function pinMatches(entered) {
  if (!hasSettingsPin()) return false;
  const h = (v) => crypto.createHash("sha256").update(String(v ?? "").trim()).digest();
  return crypto.timingSafeEqual(h(entered), h(process.env.SETTINGS_PIN));
}

/** Builds the signed cookie value: an expiry timestamp plus its signature. */
export function makeUnlockToken() {
  const exp = Date.now() + UNLOCK_MINUTES * 60_000;
  const data = String(exp);
  const sig = crypto.createHmac("sha256", secret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

/** True only for an untampered, unexpired token. */
export function tokenValid(token) {
  if (!token) return false;
  const [data, sig] = String(token).split(".");
  if (!data || !sig) return false;

  const expected = crypto.createHmac("sha256", secret()).update(data).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  const exp = Number(data);
  return Number.isFinite(exp) && Date.now() < exp;
}

/** Server-side check used by the Settings page. */
export function settingsUnlocked() {
  return tokenValid(cookies().get(UNLOCK_COOKIE)?.value);
}

export const unlockCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: UNLOCK_MINUTES * 60,
};
