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

/** Every role the app knows about, in descending order of reach. */
export const ROLES = ["ADMIN", "PURCHASE", "MANAGER", "USER"];

export const ROLE_NOTES = {
  ADMIN:    "Everything, including approving purchase orders and Settings.",
  PURCHASE: "Commercials — sees and edits prices, raises and sends purchase orders.",
  MANAGER:  "Operations — shipments, containers and buyers, but no prices.",
  USER:     "Day-to-day operations. No prices.",
};

/**
 * Whether this person may see money.
 *
 * One function, used by every screen that shows a figure, so a new page can't
 * accidentally invent its own rule. Commercials are limited to the purchase
 * team and admins; everyone else works in quantities, dates and containers.
 *
 * Takes a user object or a bare role string, since some call sites have one
 * and some the other.
 */
export function canSeePrices(userOrRole) {
  const role = typeof userOrRole === "string" ? userOrRole : userOrRole?.role;
  return role === "ADMIN" || role === "PURCHASE";
}

/**
 * Whether this person may handle purchase orders at all — open the PDF, email
 * one to a supplier, create or edit one. The document itself is priced, so
 * this is the same audience as `canSeePrices`; kept separate so the two can
 * diverge later without hunting through call sites.
 */
export function canHandlePurchaseOrders(userOrRole) {
  return canSeePrices(userOrRole);
}
