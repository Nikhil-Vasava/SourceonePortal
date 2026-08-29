// Outbound email over SMTP.
//
// Configured entirely from environment variables, never the database and never
// the repo — the same rule the Gemini key follows. A mailbox password in a
// table is a password one careless export away from being shared, and one
// nobody can rotate without a developer.
//
//   SMTP_HOST   smtp.office365.com
//   SMTP_PORT   587
//   SMTP_USER   Info@sourceoneventures.nz
//   SMTP_PASS   an app password, set by the account owner
//   SMTP_FROM   SourceOne Ventures <Info@sourceoneventures.nz>   (optional)
//   SMTP_SECURE "true" to force TLS on connect (port 465)
//
// Nothing here logs the password, and errors are rewritten before they reach
// the browser so a misconfiguration can't echo credentials back to the screen.

const REQUIRED = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"];

export function mailConfigured() {
  return REQUIRED.every(k => Boolean(process.env[k]));
}

/** Which settings are missing — for a helpful message, never their values. */
export function missingMailSettings() {
  return REQUIRED.filter(k => !process.env[k]);
}

export function mailFrom() {
  return process.env.SMTP_FROM || process.env.SMTP_USER || "";
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
export function mailReplyTo() {
  return process.env.SMTP_REPLY_TO || mailFrom() || process.env.SMTP_USER || "";
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
export function fromDiffersFromLogin() {
  const from = bareAddress(mailFrom());
  const user = bareAddress(process.env.SMTP_USER);
  return Boolean(from && user && from !== user);
}

/**
 * Sends one message with attachments.
 * @param {{to:string[], cc?:string[], subject:string, text:string,
 *          attachments?:Array<{filename:string, content:Buffer, contentType?:string}>}} msg
 */
export async function sendMail(msg) {
  if (!mailConfigured()) {
    throw new Error(
      `Email isn't set up yet. Add ${missingMailSettings().join(", ")} to the ` +
      `environment variables, then redeploy.`
    );
  }

  // Imported here rather than at module scope so pages that merely check
  // mailConfigured() don't pull nodemailer into their bundle.
  const nodemailer = (await import("nodemailer")).default;

  const port = Number(process.env.SMTP_PORT || 587);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // 465 is implicit TLS; 587 starts plaintext and upgrades via STARTTLS.
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });

  try {
    const info = await transport.sendMail({
      from: mailFrom(),
      to: msg.to.join(", "),
      cc: msg.cc?.length ? msg.cc.join(", ") : undefined,
      replyTo: mailReplyTo(),
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
