// Shipment schedule as a printable PDF.
//
// Same letterhead as the purchase order — logo right, company block centred —
// so the two documents read as coming from the same company. Landscape A4,
// because twelve columns will not fit portrait at a legible size.

const fs = require("fs");
const path = require("path");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const { SHIPMENT_COLUMNS, HEADERS, toRow } = require("./export-columns");

let fontkit = null;
try { fontkit = require("@pdf-lib/fontkit"); } catch { /* optional */ }

const read = (...p) => {
  try { return fs.readFileSync(path.join(process.cwd(), ...p)); } catch { return null; }
};

// A4 landscape
const PAGE_W = 841.89;
const PAGE_H = 595.28;
const M = 28;
const BOX_W = PAGE_W - M * 2;

const COLORS = {
  brand: rgb(0.118, 0.298, 0.561),   // #1E4C8F
  head: rgb(1, 1, 1),
  text: rgb(0.09, 0.11, 0.15),
  muted: rgb(0.42, 0.47, 0.55),
  line: rgb(0.72, 0.78, 0.85),
  band: rgb(0.949, 0.965, 0.988),
};

const HEADER_H = 26;
const ROW_H = 22;

/** Splits a string to fit a width, breaking mid-word only when a word can't fit. */
function wrap(text, font, size, maxWidth) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) { cur = test; continue; }
    if (cur) lines.push(cur);
    if (font.widthOfTextAtSize(w, size) <= maxWidth) { cur = w; continue; }
    // A single word too long for the column — hard-break it.
    let chunk = "";
    for (const ch of w) {
      if (font.widthOfTextAtSize(chunk + ch, size) > maxWidth) { lines.push(chunk); chunk = ch; }
      else chunk += ch;
    }
    cur = chunk;
  }
  if (cur) lines.push(cur);
  return lines;
}

async function buildShipmentPdf(bookings, company, meta = {}) {
  const doc = await PDFDocument.create();

  let reg, bold;
  const regBytes = read("public", "fonts", "Sans-Regular.ttf");
  const boldBytes = read("public", "fonts", "Sans-Bold.ttf");
  if (fontkit && regBytes && boldBytes) {
    doc.registerFontkit(fontkit);
    reg = await doc.embedFont(regBytes, { subset: true });
    bold = await doc.embedFont(boldBytes, { subset: true });
  } else {
    reg = await doc.embedFont(StandardFonts.Helvetica);
    bold = await doc.embedFont(StandardFonts.HelveticaBold);
  }

  const logoBytes = read("public", "logo-mark-blue-512.png");
  let logo = null;
  if (logoBytes) { try { logo = await doc.embedPng(logoBytes); } catch { logo = null; } }

  // Column widths share the page in the same proportion as the spreadsheet's,
  // so a reader sees the same shape in either format.
  const totalUnits = SHIPMENT_COLUMNS.reduce((s, c) => s + c.width, 0);
  const widths = SHIPMENT_COLUMNS.map(c => (c.width / totalUnits) * BOX_W);

  let page, y;

  function drawLetterhead() {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - M;

    const nameSize = 17;
    const name = `${company?.name || "SOURCEONE"}  ${company?.legalName || ""}`.trim();
    const nameW = bold.widthOfTextAtSize(name, nameSize);
    y -= 20;
    page.drawText(name, { x: M + (BOX_W - nameW) / 2, y, size: nameSize, font: bold, color: COLORS.brand });

    const addr = [company?.address, company?.phone, company?.email].filter(Boolean).join("   ·   ");
    const addrSize = 7.5;
    const addrW = reg.widthOfTextAtSize(addr, addrSize);
    y -= 12;
    page.drawText(addr, { x: M + (BOX_W - addrW) / 2, y, size: addrSize, font: reg, color: COLORS.muted });

    const t = "SHIPMENT SCHEDULE";
    const tSize = 11;
    const tW = bold.widthOfTextAtSize(t, tSize);
    y -= 18;
    page.drawText(t, { x: M + (BOX_W - tW) / 2, y, size: tSize, font: bold, color: COLORS.brand });

    const sub = [
      `${bookings.length} shipment${bookings.length === 1 ? "" : "s"}`,
      meta.filterNote,
      `Generated ${new Date().toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" })}`,
    ].filter(Boolean).join("   ·   ");
    const sSize = 7.5;
    const sW = reg.widthOfTextAtSize(sub, sSize);
    y -= 11;
    page.drawText(sub, { x: M + (BOX_W - sW) / 2, y, size: sSize, font: reg, color: COLORS.muted });

    if (logo) {
      const size = 42;
      page.drawImage(logo, { x: M + BOX_W - size, y: PAGE_H - M - size + 4, width: size, height: size });
    }

    y -= 14;
    drawHeaderRow();
  }

  // Headings must never be clipped — a column called "No Of Container" or
  // "Port of Discharge" (with the "(POD)" lost) misleads the reader. So the
  // type shrinks until the whole heading fits in at most two lines.
  function fitHeading(h, w) {
    for (let size = 6.8; size >= 4.6; size -= 0.2) {
      const lines = wrap(h, bold, size, w - 5);
      if (lines.length <= 2) return { size, lines };
    }
    return { size: 4.6, lines: wrap(h, bold, 4.6, w - 5).slice(0, 2) };
  }

  function drawHeaderRow() {
    page.drawRectangle({ x: M, y: y - HEADER_H, width: BOX_W, height: HEADER_H, color: COLORS.brand });
    let x = M;
    HEADERS.forEach((h, i) => {
      const w = widths[i];
      const { size, lines } = fitHeading(h, w);
      lines.forEach((ln, li) => {
        const lw = bold.widthOfTextAtSize(ln, size);
        page.drawText(ln, {
          x: x + (w - lw) / 2,
          y: y - 11 - li * 8 + (lines.length > 1 ? 3 : 0),
          size, font: bold, color: COLORS.head,
        });
      });
      x += w;
    });
    y -= HEADER_H;
  }

  drawLetterhead();

  const size = 7.2;
  bookings.forEach((b, idx) => {
    const cells = toRow(b).map((v, i) => wrap(String(v), reg, size, widths[i] - 6));
    const lineCount = Math.min(Math.max(...cells.map(c => c.length)), 3);
    const rowH = Math.max(ROW_H, 8 + lineCount * 8.5);

    // Start a new page before a row would run off the bottom.
    if (y - rowH < M + 18) drawLetterhead();

    if (idx % 2 === 1) {
      page.drawRectangle({ x: M, y: y - rowH, width: BOX_W, height: rowH, color: COLORS.band });
    }

    let x = M;
    cells.forEach((lines, i) => {
      const w = widths[i];
      const align = SHIPMENT_COLUMNS[i].align || "left";
      lines.slice(0, 3).forEach((ln, li) => {
        const lw = reg.widthOfTextAtSize(ln, size);
        const tx = align === "center" ? x + (w - lw) / 2 : x + 3;
        page.drawText(ln, { x: tx, y: y - 11 - li * 8.5, size, font: reg, color: COLORS.text });
      });
      page.drawLine({
        start: { x, y }, end: { x, y: y - rowH },
        thickness: 0.4, color: COLORS.line,
      });
      x += w;
    });

    page.drawLine({ start: { x: M, y: y - rowH }, end: { x: M + BOX_W, y: y - rowH }, thickness: 0.4, color: COLORS.line });
    page.drawLine({ start: { x: M + BOX_W, y }, end: { x: M + BOX_W, y: y - rowH }, thickness: 0.4, color: COLORS.line });
    y -= rowH;
  });

  // Page numbers, added at the end so the total is known.
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const label = `Page ${i + 1} of ${pages.length}`;
    const w = reg.widthOfTextAtSize(label, 7);
    p.drawText(label, { x: PAGE_W - M - w, y: M - 14, size: 7, font: reg, color: COLORS.muted });
    p.drawText(company?.legalName || "", { x: M, y: M - 14, size: 7, font: reg, color: COLORS.muted });
  });

  return Buffer.from(await doc.save());
}

module.exports = { buildShipmentPdf };
