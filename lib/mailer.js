// Outbound email over SMTP.
//
// Configured entirely from environment variables, never the database and never
// the repo — the same rule the Gemini key follows. A mailbox password in a
// table is a password one careless export away from being shared, and one
// nobody can rotate without a developer.
//
//   SMTP_HOST   smtp.gmail.com
//   SMTP_PORT   587
//   SMTP_USER   nikhil@sourceoneventures.nz
//   SMTP_PASS   an app password, set by the account owner
//   SMTP_FROM   SourceOne Ventures <nikhil@sourceoneventures.nz>  (optional)
//   SMTP_SECURE "true" to force TLS on connect (port 465)
//
// Nothing here logs the password, and errors are rewritten before they reach
// the browser so a misconfiguration can't echo credentials back to the screen.

// Different kinds of mail go out as different people. Purchase orders come
// from the purchasing address suppliers know; the operations notice comes from
// whoever owns that job. Each is an "identity".
//
// Every setting falls back to the unprefixed one, so a single mailbox still
// works with no extra configuration:
//
//   SMTP_PO_FROM   / SMTP_PO_USER   / SMTP_PO_PASS   … purchase orders
//   SMTP_OPS_FROM  / SMTP_OPS_USER  / SMTP_OPS_PASS  … operations notices
//
// Setting only the _FROM shares one login and varies the sender, which needs
// that address to be a verified "Send mail as" alias. Setting _USER and _PASS
// too authenticates as a separate mailbox, which needs no alias at all.
const IDENTITIES = ["PO", "OPS"];

function envFor(identity, key) {
  const id = String(identity || "").toUpperCase();
  return (IDENTITIES.includes(id) ? process.env[`SMTP_${id}_${key}`] : null)
      || process.env[`SMTP_${key}`]
      || null;
}

/** Everything needed to send as one identity. */
export function mailIdentity(identity = null) {
  const user = envFor(identity, "USER");
  const from = envFor(identity, "FROM") || user || "";
  return {
    host: envFor(identity, "HOST"),
    port: Number(envFor(identity, "PORT") || 587),
    secure: envFor(identity, "SECURE") === "true",
    user,
    pass: envFor(identity, "PASS"),
    from,
    // Replies follow the From, never the login — see the note below.
    replyTo: envFor(identity, "REPLY_TO") || from,
  };
}

const REQUIRED = ["HOST", "USER", "PASS"];

export function mailConfigured(identity = null) {
  const c = mailIdentity(identity);
  return Boolean(c.host && c.user && c.pass);
}

/** Which settings are missing — for a helpful message, never their values. */
export function missingMailSettings(identity = null) {
  const c = mailIdentity(identity);
  return REQUIRED.filter(k => !c[k.toLowerCase()]).map(k => `SMTP_${k}`);
}

export function mailFrom(identity = null) {
  return mailIdentity(identity).from;
}

/**
 * Where replies should go.
 *
 * Defaults to the From address, NOT the account we authenticate with. Those
 * are often different — signing in as one mailbox to send as another is a
 * normal Workspace arrangement — and defaulting to the login address would
 * quietly route every supplier reply to whichever account happens to hold the
 * SMTP password, on whichever domain that is.
 */
export function mailReplyTo(identity = null) {
  return mailIdentity(identity).replyTo;
}

/** Just the address out of "Name <a@b.com>", for comparisons. */
export function bareAddress(s) {
  const m = String(s || "").match(/<([^>]+)>\s*$/);
  return (m ? m[1] : String(s || "")).trim().toLowerCase();
}

/**
 * True when From is a different mailbox from the one we log in as.
 *
 * Legitimate — but only if that address is a verified "Send mail as" alias on
 * the account. If it isn't, Gmail doesn't error: it silently rewrites From to
 * the authenticated address, and the supplier sees the wrong sender with no
 * indication anything went wrong. Surfaced so the UI can warn.
 */
export function fromDiffersFromLogin(identity = null) {
  const c = mailIdentity(identity);
  const from = bareAddress(c.from);
  const user = bareAddress(c.user);
  return Boolean(from && user && from !== user);
}

/**
 * Sends one message with attachments.
 * @param {{to:string[], cc?:string[], subject:string, text:string,
 *          attachments?:Array<{filename:string, content:Buffer, contentType?:string}>}} msg
 */
export async function sendMail(msg, identity = null) {
  if (!mailConfigured(identity)) {
    throw new Error(
      `Email isn't set up yet. Add ${missingMailSettings(identity).join(", ")} to the ` +
      `environment variables, then redeploy.`
    );
  }

  const cfg = mailIdentity(identity);

  // Imported here rather than at module scope so pages that merely check
  // mailConfigured() don't pull nodemailer into their bundle.
  const nodemailer = (await import("nodemailer")).default;

  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    // 465 is implicit TLS; 587 starts plaintext and upgrades via STARTTLS.
    secure: cfg.secure || cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });

  try {
    const info = await transport.sendMail({
      from: cfg.from,
      to: msg.to.join(", "),
      cc: msg.cc?.length ? msg.cc.join(", ") : undefined,
      replyTo: cfg.replyTo,
      subject: msg.subject,
      text: msg.text,
      attachments: msg.attachments || [],
    });
    return { id: info.messageId, accepted: info.accepted || [], rejected: info.rejected || [] };
  } catch (e) {
    // SMTP errors can quote the failed AUTH exchange. Translate the common
    // ones and never pass the raw message through to the browser.
    const raw = String(e?.message || "");
    const code = e?.code || e?.responseCode;
    if (code === "EAUTH" || /535|authentication|username and password/i.test(raw)) {
      // Nearly always an app password problem rather than a typo: Google and
      // Microsoft both refuse ordinary account passwords over SMTP now, and
      // Microsoft additionally leaves SMTP AUTH switched off per mailbox.
      throw new Error(
        "The mail server rejected the sign-in. SMTP_PASS must be an app password, " +
        "not the mailbox's normal password — and on Microsoft 365, SMTP AUTH has to " +
        "be enabled for this mailbox by an admin."
      );
    }
    // Gmail rewrites or refuses a From it doesn't own; say so plainly rather
    // than leaving someone hunting through the SMTP settings.
    if (/5\.7\.(0|1|60)|not allowed|sender address|from address/i.test(raw)) {
      throw new Error(
        "The mail server refused the From address. SMTP_FROM must be the same " +
        "mailbox as SMTP_USER, or one of its verified aliases."
      );
    }
    if (code === "ECONNECTION" || code === "ETIMEDOUT" || /ENOTFOUND|EHOSTUNREACH/.test(raw)) {
      throw new Error("Couldn't reach the mail server. Check SMTP_HOST and SMTP_PORT.");
    }
    if (/self.signed|certificate/i.test(raw)) {
      throw new Error("The mail server's TLS certificate was rejected.");
    }
    throw new Error("The message couldn't be sent. Check the mail settings and try again.");
  } finally {
    transport.close?.();
  }
}
