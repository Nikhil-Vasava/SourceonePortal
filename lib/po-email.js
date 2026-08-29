// The email that goes out with a purchase order.
//
// Composing lives apart from sending so the draft shown in the modal and the
// message actually sent come from one function — otherwise the two drift and
// people edit a preview that isn't what leaves the building.

/** Reasonable-effort address check: catches typos, not exotic-but-legal addresses. */
export function isEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || "").trim());
}

/** Splits a comma/semicolon/newline separated list into valid, unique addresses. */
export function parseAddresses(input) {
  const parts = String(input || "").split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
  const good = [], bad = [];
  for (const p of parts) {
    // tolerate "Name <a@b.com>"
    const m = p.match(/<([^>]+)>\s*$/);
    const addr = (m ? m[1] : p).trim();
    if (isEmail(addr)) { if (!good.includes(addr)) good.push(addr); }
    else bad.push(p);
  }
  return { good, bad };
}

const money = (n, cur) =>
  n == null ? null : `${cur || "USD"} ${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Default recipients: the supplier's own address, with its named contacts cc'd.
 * A contact whose address is the same as the company's isn't repeated.
 */
export function defaultRecipients(partner) {
  const to = [];
  if (isEmail(partner?.email)) to.push(partner.email.trim());

  const cc = [];
  for (const c of partner?.contacts || []) {
    if (isEmail(c.email) && !to.includes(c.email.trim()) && !cc.includes(c.email.trim())) {
      cc.push(c.email.trim());
    }
  }
  // With no company address, promote the first contact so the draft isn't empty.
  if (!to.length && cc.length) to.push(cc.shift());
  return { to, cc };
}

export function defaultSubject(po, company) {
  const who = company?.legalName || company?.name || "SourceOne Ventures";
  return `Purchase Order ${po.number} — ${who}`;
}

/**
 * The body. Deliberately plain text: it renders identically everywhere, can't
 * trip a spam filter on markup, and is what a trade counterparty expects.
 */
export function defaultBody(po, company, { contactName } = {}) {
  const greetingName = contactName || po.partner?.name || "Sir/Madam";
  const lines = [];

  lines.push(`Dear ${greetingName},`);
  lines.push("");
  lines.push(`Please find attached our purchase order ${po.number}.`);
  lines.push("");

  for (const l of po.lines || []) {
    const qty = l.qty != null ? `${l.qty} ${l.uom || ""}`.trim() : "";
    const unit = l.priceUnit ? (String(l.priceUnit).startsWith("/") ? l.priceUnit : `/ ${l.priceUnit}`) : "";
    const price = l.price != null ? `${money(l.price, po.currency)} ${unit}`.trim() : "";
    const bits = [l.product?.name || l.description, qty, price].filter(Boolean);
    if (bits.length) lines.push(`  · ${bits.join("  —  ")}`);
  }
  if (po.lines?.length) lines.push("");

  if (po.shippingTerms) lines.push(`Pricing: ${po.shippingTerms}`);
  if (po.paymentTerms) lines.push(`Payment terms: ${po.paymentTerms}`);
  if (po.shippingTerms || po.paymentTerms) lines.push("");

  lines.push("Please confirm receipt and let us know the expected loading date.");
  lines.push("");
  lines.push("Kind regards,");
  lines.push(company?.name || "SourceOne");
  if (company?.legalName) lines.push(company.legalName);
  const tail = [company?.phone, company?.email].filter(Boolean).join("  ·  ");
  if (tail) lines.push(tail);

  return lines.join("\n");
}

/** Everything the modal needs to show a ready-to-edit draft. */
export function buildDraft(po, company) {
  const { to, cc } = defaultRecipients(po.partner);
  const firstContact = po.partner?.contacts?.[0]?.name || null;
  return {
    to, cc,
    subject: defaultSubject(po, company),
    body: defaultBody(po, company, { contactName: firstContact }),
    filename: `${po.number}.pdf`,
  };
}
