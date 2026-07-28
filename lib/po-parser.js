// Deterministic parser for purchase order PDFs in the SourceOne layout.
// No AI, no API keys, no quotas.

const clean = (v) => {
  if (v == null) return null;
  const s = String(v).replace(/\s+/g, " ").trim().replace(/[:,]$/, "").trim();
  return s || null;
};

const num = (v) => {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : n;
};

/** Value after "Label :" on the same line, stopping at the next column's label. */
function after(text, label, { stop } = {}) {
  const m = text.match(new RegExp(label + String.raw`[ \t]*:?[ \t]*([^\n]*)`, "i"));
  if (!m) return null;
  let v = m[1];
  const next = v.match(/\s{2,}[A-Z][A-Za-z'/.()\s]{2,30}\s*:/);
  if (next) v = v.slice(0, next.index);
  if (stop) {
    const i = v.search(stop);
    if (i > 0) v = v.slice(0, i);
  }
  return clean(v);
}

/** "07-25-2026" (US) or "2026-07-25" -> YYYY-MM-DD */
function poDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${String(+m[2]).padStart(2, "0")}-${String(+m[3]).padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) {
    let a = +m[1], b = +m[2];
    const [mo, d] = a > 12 ? [b, a] : [a, b];   // month-first unless impossible
    return `${m[3]}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return null;
}

/**
 * Reads the address block, which is right-aligned and can wrap over
 * the lines above and below the "Address :" label.
 */
function readAddress(lines, idx) {
  const parts = [];
  const grab = (i) => {
    if (i < 0 || i >= lines.length) return;
    const l = lines[i];
    // only the right-hand column, and never another labelled field
    if (/:/.test(l) && !/Address\s*:/i.test(l)) return;
    const tail = l.slice(60).trim();
    if (tail && !/^\d+$/.test(tail)) parts.push(tail);
  };
  grab(idx - 1);
  const own = lines[idx].replace(/^.*Address\s*:?\s*/i, "").trim();
  if (own) parts.push(own);
  grab(idx + 1);
  return clean(parts.join(", ").replace(/,\s*,/g, ",")) || null;
}

/**
 * Parses purchase order text.
 * @returns {{data: object, missing: string[]}}
 */
export function parsePoText(text) {
  const lines = text.split("\n");
  const d = {};

  d.poNumber = after(text, String.raw`P\.?\s?O\.?\s?No\.?`, { stop: /\bDate\b/i })
            || after(text, String.raw`(?:Purchase )?Order (?:No|Number)\.?`);
  d.date = poDate(after(text, String.raw`\bDate\b`));

  d.vendorName = after(text, String.raw`(?:Vendor|Supplier)(?: Name)?`, { stop: /Address/i });
  d.vendorPhone = after(text, String.raw`Phone No\.?`, { stop: /E-?mail/i });
  d.vendorEmail = after(text, String.raw`E-?mail ID`);

  // the issuer's own phone/email appear first — prefer the second occurrence
  const phones = [...text.matchAll(/Phone No\.?[ \t]*:?[ \t]*([^\n]{3,40})/gi)]
    .map(m => clean(String(m[1]).split(/\s{2,}/)[0].replace(/E-?mail.*$/i, "")));
  if (phones.length > 1 && phones[1]) d.vendorPhone = phones[1];
  const emails = [...text.matchAll(/E-?mail ID\s*:?\s*([^\s]+@[^\s]+)/gi)].map(m => clean(m[1]));
  if (emails.length > 1) d.vendorEmail = emails[1];

  const ai = lines.findIndex(l => /Address\s*:/i.test(l));
  if (ai >= 0) d.vendorAddress = readAddress(lines, ai);

  d.paymentTerms = after(text, String.raw`Payment Terms[^:\n]*`);
  d.comments = after(text, "Comments");
  d.minimumWeight = after(text, String.raw`-?\s*Minimum Weight`);

  const cur = String(d.comments || text).match(/\b(USD|NZD|EUR|INR|AED|GBP|CNY|AUD)\b/i);
  d.currency = cur ? cur[1].toUpperCase() : null;

  // Line items: "1   LDPE 98/2   3 Loads   260 / MT   FAS (Auckland)"
  d.lines = [];
  const start = lines.findIndex(l => /Sr\.?\s*No\.?/i.test(l) && /Description/i.test(l));
  if (start >= 0) {
    for (let i = start + 1; i < lines.length; i++) {
      const l = lines[i];
      if (/Payment Terms|Comments|TERMS\s*&|Minimum Weight/i.test(l)) break;
      if (!l.trim()) continue;

      const m = l.match(
        /^\s*(\d{1,3})\s{2,}(.+?)\s{2,}([\d.,]+)\s*([A-Za-z.']+)?\s{2,}([\d.,]+)\s*(\/\s*[A-Za-z.']+)?\s*(?:\s{2,}(.+))?$/
      );
      if (m) {
        d.lines.push({
          description: clean(m[2]),
          quantity: num(m[3]),
          qtyUnit: clean(m[4]),
          price: num(m[5]),
          priceUnit: clean(m[6]) ? clean(m[6]).replace(/\s+/g, " ") : null,
          pricing: clean(m[7]),
        });
        continue;
      }
      // looser fallback: leading serial number then a description
      const m2 = l.match(/^\s*(\d{1,3})\s{2,}(.+)$/);
      if (m2) {
        const cells = m2[2].split(/\s{2,}/).map(s => s.trim()).filter(Boolean);
        if (cells.length >= 2) {
          const q = (cells[1] || "").match(/([\d.,]+)\s*(.*)/);
          const p = (cells[2] || "").match(/([\d.,]+)\s*(.*)/);
          d.lines.push({
            description: clean(cells[0]),
            quantity: q ? num(q[1]) : null,
            qtyUnit: q ? clean(q[2]) : null,
            price: p ? num(p[1]) : null,
            priceUnit: p && p[2] ? clean(p[2]) : null,
            pricing: clean(cells[3]),
          });
        }
      }
    }
  }

  const missing = [];
  if (!d.vendorName) missing.push("vendorName");
  if (!d.lines.length) missing.push("lines");
  return { data: d, missing };
}
