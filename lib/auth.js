import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";

const IS_PROD = process.env.NODE_ENV === "production";

/**
 * Signing key for session cookies. In production this must be supplied —
 * falling back to a known constant would let anyone forge a session.
 */
function secret() {
  const s = process.env.SESSION_SECRET;
  if (s && s.trim().length >= 16) return s;

  if (IS_PROD) {
    throw new Error(
      "SESSION_SECRET is missing or too short. Set it to a random string of at " +
      "least 32 characters in the project's Environment Variables."
    );
  }
  return "dev-only-insecure-secret";
}

/** Cookie options — HTTPS-only once deployed. */
export const SESSION_COOKIE = "session";
export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: IS_PROD,
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};

export function sign(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verify(token) {
  if (!token) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;

  const expected = crypto.createHmac("sha256", secret()).update(data).digest("base64url");
  // constant-time compare so a wrong signature can't be guessed byte by byte
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try { return JSON.parse(Buffer.from(data, "base64url").toString()); } catch { return null; }
}

export function getUser() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verify(token);
}

export function requireUser() {
  const user = getUser();
  if (!user) redirect("/login");
  return user;
}

export function requireRole(...roles) {
  const user = requireUser();
  if (!roles.includes(user.role)) redirect("/");
  return user;
}
