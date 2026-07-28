// Unlock / lock endpoint for the Settings PIN.
//
// A route handler rather than a server action because the lock-on-leave path
// fires from a component unmount, where sendBeacon / keepalive fetch is the only
// thing that reliably survives the navigation.

import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import {
  UNLOCK_COOKIE,
  hasSettingsPin,
  pinMatches,
  makeUnlockToken,
  unlockCookieOptions,
} from "@/lib/settings-lock";

/** Slows down guessing without needing anywhere to store attempt counts. */
const WRONG_PIN_DELAY_MS = 700;

export async function POST(request) {
  const user = getUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Not allowed." }, { status: 403 });
  }

  if (!hasSettingsPin()) {
    return NextResponse.json(
      { ok: false, error: "No SETTINGS_PIN is configured on the server." },
      { status: 400 },
    );
  }

  let pin = "";
  try { pin = (await request.json())?.pin || ""; } catch { /* empty body */ }

  if (!pinMatches(pin)) {
    await new Promise(r => setTimeout(r, WRONG_PIN_DELAY_MS));
    return NextResponse.json({ ok: false, error: "That PIN isn't right." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(UNLOCK_COOKIE, makeUnlockToken(), unlockCookieOptions);
  return res;
}

/** Re-locks: called when leaving the Settings page, and by the Lock button. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(UNLOCK_COOKIE, "", { ...unlockCookieOptions, maxAge: 0 });
  return res;
}
