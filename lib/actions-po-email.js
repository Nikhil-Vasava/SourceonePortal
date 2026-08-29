"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { renderPoPdf, PO_INCLUDE } from "@/lib/po-document";
import { sendMail, mailConfigured, missingMailSettings, mailFrom, mailReplyTo, fromDiffersFromLogin } from "@/lib/mailer";
import { buildDraft, parseAddresses } from "@/lib/po-email";

/**
 * The draft shown in the modal.
 *
 * Fetched on open rather than rendered with the page: 25 rows would otherwise
 * each carry a full email body and their suppliers' contact lists into the
 * browser, for a modal that mostly never opens.
 */
export async function poDraftAction(poId) {
  requireUser();

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: Number(poId) },
    include: PO_INCLUDE,
  });
  if (!po) return { error: "That purchase order no longer exists." };

  const company = await getCompany();
  const draft = buildDraft(po, company);

  return {
    ...draft,
    poNumber: po.number,
    supplier: po.partner?.name || "",
    // Surfaced so the modal can warn before the user writes an email that
    // can't be sent, rather than after.
    configured: mailConfigured(),
    missing: mailConfigured() ? [] : missingMailSettings(),
    // Show who the supplier will see it from, and where replies land — these
    // can be three different addresses across two domains, and getting it
    // wrong is invisible until a supplier replies into the void.
    from: mailFrom(),
    replyTo: mailReplyTo(),
    // Sending as an address other than the login only works if it's a verified
    // "Send mail as" alias. When it isn't, Gmail rewrites From silently rather
    // than failing — so warn rather than wait for someone to notice.
    aliasSend: fromDiffersFromLogin(),
    // Offer the supplier's other addresses as one-click additions.
    known: (po.partner?.contacts || [])
      .filter(c => c.email)
      .map(c => ({ name: c.name, role: c.role, email: c.email })),
    alreadySent: po.emailedAt ? { at: po.emailedAt.toISOString(), to: po.emailedTo } : null,
  };
}

/**
 * Sends the purchase order.
 *
 * Everything that matters is re-derived on the server: the recipient list is
 * re-validated, and the PDF is rendered here from the database rather than
 * accepted from the browser. A form field is a suggestion, not a fact — the
 * attachment a supplier receives has to be the order as stored.
 */
export async function sendPoEmailAction(formData) {
  const user = requireUser();

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return { error: "Missing purchase order." };

  // Staff may only email an approved order. Checked here, not just hidden in
  // the table — the button being absent is a courtesy, not a permission, and
  // this action is reachable without it.
  const gate = await prisma.purchaseOrder.findUnique({
    where: { id },
    select: { number: true, approvedAt: true },
  });
  if (!gate) return { error: "That purchase order no longer exists." };
  if (user.role !== "ADMIN" && !gate.approvedAt) {
    return { error: `${gate.number} hasn't been approved yet. An admin needs to approve it before it can be sent.` };
  }

  // Explicit confirmation, checked server-side. Without it a stray POST to
  // this action would put mail in front of a supplier.
  if (formData.get("confirm") !== "yes") {
    return { error: "Sending wasn't confirmed." };
  }

  const to = parseAddresses(formData.get("to"));
  const cc = parseAddresses(formData.get("cc"));
  if (!to.good.length) return { error: "Add at least one valid recipient address." };
  if (to.bad.length || cc.bad.length) {
    return { error: `Not a valid email address: ${[...to.bad, ...cc.bad].join(", ")}` };
  }

  const subject = String(formData.get("subject") || "").trim();
  const body = String(formData.get("body") || "").trim();
  if (!subject) return { error: "The subject can't be empty." };
  if (!body) return { error: "The message can't be empty." };

  const doc = await renderPoPdf(id);
  if (!doc) return { error: "That purchase order no longer exists." };

  try {
    const result = await sendMail({
      to: to.good,
      cc: cc.good,
      subject,
      text: body,
      attachments: [{ filename: doc.filename, content: doc.pdf, contentType: "application/pdf" }],
    });

    const everyone = [...to.good, ...cc.good];
    await prisma.purchaseOrder.update({
      where: { id },
      data: { emailedAt: new Date(), emailedTo: everyone.join(", ") },
    });

    revalidatePath("/purchase");
    return {
      ok: true,
      sentTo: everyone,
      // A server can accept a message and still refuse one address.
      rejected: result.rejected || [],
    };
  } catch (e) {
    // mailer.js has already stripped anything sensitive from this message.
    return { error: e.message };
  }
}
