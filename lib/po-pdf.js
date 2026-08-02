// Generates the SourceOne purchase order PDF, matching the approved layout.
const fs = require("fs");
const path = require("path");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

let fontkit = null;
try { fontkit = require("@pdf-lib/fontkit"); } catch { /* optional */ }

// Liberation Sans is metric-compatible with Helvetica but supports macrons
// (e.g. "Tāmaki") and other extended Latin characters.
function readFont(file) {
  try { return fs.readFileSync(path.join(process.cwd(), "public", "fonts", file)); }
  catch { return null; }
}

/**
 * The logo mark for the PO header — the monochrome blue treatment, so it sits
 * with the document's headings rather than fighting them.
 *
 * PNG rather than SVG because pdf-lib embeds raster images only; this is the
 * "where vectors aren't supported" case the brand guide allows. 512px is far
 * above the ~54pt it prints at, so it stays crisp.
 *
 * Returns null if the file is missing; the header then renders exactly as it
 * did before. A missing logo must never stop a purchase order going out.
 */
function readLogo() {
  try { return fs.readFileSync(path.join(process.cwd(), "public", "logo-mark-blue-512.png")); }
  catch { return null; }
}

/** Strips characters a standard WinAnsi font cannot encode (fallback path only). */
function toWinAnsi(s) {
  return String(s ?? "")
    .replace(/[āăą]/g, "a").replace(/[ĀĂĄ]/g, "A")
    .replace(/[ēĕėęě]/g, "e").replace(/[ĒĔĖĘĚ]/g, "E")
    .replace(/[īĭįı]/g, "i").replace(/[ĪĬĮİ]/g, "I")
    .replace(/[ōŏő]/g, "o").replace(/[ŌŎŐ]/g, "O")
    .replace(/[ūŭůűų]/g, "u").replace(/[ŪŬŮŰŲ]/g, "U")
    .replace(/[ŚŜŞŠ]/g, "S").replace(/[śŝşš]/g, "s")
    .replace(/[ŹŻŽ]/g, "Z").replace(/[źżž]/g, "z")
    .replace(/[ĆĈĊČ]/g, "C").replace(/[ćĉċč]/g, "c")
    .replace(/[ŃŅŇ]/g, "N").replace(/[ńņňŉ]/g, "n")
    .replace(/[ĢĞĠ]/g, "G").replace(/[ģğġ]/g, "g")
    .replace(/[^\x00-\xFF]/g, "");
}

const COLORS = {
  blue: rgb(0.23, 0.45, 0.78),
  black: rgb(0, 0, 0),
  line: rgb(0, 0, 0),
};

// A4 in points
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 40;              // outer margin
const BOX_W = PAGE_W - M * 2;
const MID = M + BOX_W * 0.5; // vertical divider for the 2-column info rows

function wrap(text, font, size, maxWidth) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines = [];
  let cur = words[0];
  for (let i = 1; i < words.length; i++) {
    const test = cur + " " + words[i];
    if (font.widthOfTextAtSize(test, size) <= maxWidth) cur = test;
    else { lines.push(cur); cur = words[i]; }
  }
  lines.push(cur);
  return lines;
}

/**
 * @param {object} po      { number, date, vendorName, vendorAddress, vendorPhone, vendorEmail,
 *                           lines: [{description, quantity, price, pricing}],
 *                           paymentTerms, comments, minimumWeight }
 * @param {object} company { name, legalName, address, gstNo, importExportNo, phone, email }
 * @returns {Promise<Uint8Array>}
 */
async function buildPoPdf(po, company) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_W, PAGE_H]);

  const regBytes = readFont("Sans-Regular.ttf");
  const boldBytes = readFont("Sans-Bold.ttf");
  let bold, reg, unicodeOk = false;
  if (fontkit && regBytes && boldBytes) {
    doc.registerFontkit(fontkit);
    reg = await doc.embedFont(regBytes, { subset: true });
    bold = await doc.embedFont(boldBytes, { subset: true });
    unicodeOk = true;
  } else {
    bold = await doc.embedFont(StandardFonts.HelveticaBold);
    reg = await doc.embedFont(StandardFonts.Helvetica);
  }
  const S = (v) => (unicodeOk ? String(v ?? "") : toWinAnsi(v));

  let y = PAGE_H - M; // current top edge, moving downward
  const boxTop = y;

  const text = (s, x, yy, { font = reg, size = 9, color = COLORS.black } = {}) =>
    page.drawText(S(s), { x, y: yy, size, font, color });

  const hLine = (yy, x1 = M, x2 = M + BOX_W) =>
    page.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, thickness: 1, color: COLORS.line });

  const vLine = (x, y1, y2) =>
    page.drawLine({ start: { x, y: y1 }, end: { x, y: y2 }, thickness: 1, color: COLORS.line });

  // ---------- Company header ----------
  const nameSize = 26;
  const legalSize = 13;
  const addrSize = 8.5;

  // Baselines are worked out up front so the logo can be centred against the
  // real height of the text block instead of nudged into place by eye.
  const nameBaseline = boxTop - 30;
  const legalBaseline = nameBaseline - 20;
  const addrBaseline = legalBaseline - 15;

  const spacedName = S(company.name || "SOURCEONE").split("").join(" ");
  const nameW = bold.widthOfTextAtSize(spacedName, nameSize);
  text(spacedName, M + (BOX_W - nameW) / 2, nameBaseline,
       { font: bold, size: nameSize, color: COLORS.blue });

  const spacedLegal = S(company.legalName || "").split("").join(" ");
  const legalW = bold.widthOfTextAtSize(spacedLegal, legalSize);
  text(spacedLegal, M + (BOX_W - legalW) / 2, legalBaseline,
       { font: bold, size: legalSize, color: COLORS.blue });

  const addrW = reg.widthOfTextAtSize(S(company.address || ""), addrSize);
  text(company.address, M + (BOX_W - addrW) / 2, addrBaseline,
       { size: addrSize, color: COLORS.blue });

  y = addrBaseline;

  // The mark goes on the right, in the document's blue, optically centred on
  // the three lines of the header. The name stays centred on the page so the
  // layout suppliers already recognise doesn't shift.
  const logoBytes = readLogo();
  if (logoBytes) {
    let logo = null;
    try { logo = await doc.embedPng(logoBytes); } catch { logo = null; }

    if (logo) {
      const size = 54;
      // Cap height for the top, descender for the bottom — the visible extent
      // of the block rather than the baselines, which sit inside it.
      const blockTop = nameBaseline + nameSize * 0.72;
      const blockBottom = addrBaseline - addrSize * 0.25;
      const blockMid = (blockTop + blockBottom) / 2;

      const x = M + BOX_W - size - 12;
      // Only draw if it clears the centred name; otherwise the header would
      // collide on a long company name and look worse than having no logo.
      const nameRight = M + (BOX_W + nameW) / 2;
      if (x > nameRight + 8) {
        page.drawImage(logo, { x, y: blockMid - size / 2, width: size, height: size });
      }
    }
  }

  y -= 10;
  hLine(y);

  // ---------- Two-column info rows ----------
  const ROW_H = 18;
  const LBL_X = M + 6;
  const COL_X = M + 108;       // colon column (left)
  const VAL_X = M + 118;
  const RLBL_X = MID + 6;
  const RCOL_X = MID + 100;
  const RVAL_X = MID + 110;

  function infoRow(l1, v1, l2, v2, height = ROW_H) {
    const top = y;
    y -= height;
    const ty = y + height / 2 - 3;
    text(l1, LBL_X, ty, { font: bold, size: 8.5 });
    text(":", COL_X, ty, { font: bold, size: 8.5 });
    text(v1, VAL_X, ty, { size: 8.5 });
    if (l2 !== null) {
      text(l2, RLBL_X, ty, { font: bold, size: 8.5 });
      text(":", RCOL_X, ty, { font: bold, size: 8.5 });
      if (Array.isArray(v2)) {
        let vy = top - 11;
        for (const ln of v2) { text(ln, RVAL_X, vy, { size: 8.5 }); vy -= 11; }
      } else {
        text(v2, RVAL_X, ty, { size: 8.5 });
      }
    }
    hLine(y);
    vLine(MID, y, top);
  }

  infoRow("GST / HST No.", company.gstNo, "Phone No.", company.phone);
  infoRow("Import / Export No.", company.importExportNo, "E-mail ID", company.email);

  // ---------- Title ----------
  const titleTop = y;
  y -= 24;
  const title = "PURCHASE ORDER";
  const tW = bold.widthOfTextAtSize(title, 14);
  text(title, M + (BOX_W - tW) / 2, y + 7, { font: bold, size: 14, color: COLORS.blue });
  hLine(y);

  // ---------- PO + vendor block ----------
  infoRow("P.O. No.", po.number, "Date", po.date);

  const addrLines = wrap(S(po.vendorAddress || ""), reg, 8.5, BOX_W * 0.5 - 120);
  const vendorRowH = Math.max(ROW_H, addrLines.length * 11 + 10);
  infoRow("Vendor Name", po.vendorName, "Address", addrLines, vendorRowH);

  infoRow("Phone No.", po.vendorPhone, "E-mail ID", po.vendorEmail);

  // ---------- Line items table ----------
  y -= 14; // gap
  const tableTop = y;
  const cols = [
    { w: BOX_W * 0.076, label: "Sr. No." },
    { w: BOX_W * 0.427, label: "Description" },
    { w: BOX_W * 0.177, label: "Quantity" },
    { w: BOX_W * 0.157, label: "Price" },
    { w: BOX_W * 0.163, label: "Pricing" },
  ];
  const xs = [];
  let cx = M;
  for (const c of cols) { xs.push(cx); cx += c.w; }

  const HEAD_H = 20;
  hLine(tableTop);
  y -= HEAD_H;
  cols.forEach((c, i) => {
    const w = bold.widthOfTextAtSize(c.label, 8.5);
    text(c.label, xs[i] + (c.w - w) / 2, y + 6, { font: bold, size: 8.5 });
  });
  hLine(y);

  const rows = (po.lines || []).length ? po.lines : [{}];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const descLines = wrap(S(r.description || ""), reg, 8.5, cols[1].w - 10);
    const rowH = Math.max(20, descLines.length * 11 + 8);
    const rowTop = y;
    y -= rowH;
    const cells = [
      String(i + 1),
      null, // description drawn separately (may wrap)
      r.quantity || "",
      r.price || "",
      r.pricing || "",
    ];
    cells.forEach((v, ci) => {
      if (v === null) return;
      const w = reg.widthOfTextAtSize(S(v), 8.5);
      text(v, xs[ci] + (cols[ci].w - w) / 2, y + rowH / 2 - 3, { size: 8.5 });
    });
    let dy = rowTop - (rowH - descLines.length * 11) / 2 - 8;
    for (const ln of descLines) {
      const w = reg.widthOfTextAtSize(ln, 8.5);
      text(ln, xs[1] + (cols[1].w - w) / 2, dy, { size: 8.5 });
      dy -= 11;
    }
    hLine(y);
  }
  // table vertical rules
  const tableBottom = y;
  for (let i = 1; i < cols.length; i++) vLine(xs[i], tableBottom, tableTop);
  vLine(M, tableBottom, tableTop);
  vLine(M + BOX_W, tableBottom, tableTop);

  // ---------- Terms ----------
  y -= 14;
  hLine(y);

  function termRow(labelBold, value, height = 20) {
    const top = y;
    y -= height;
    const ty = y + height / 2 - 3;
    text(labelBold, LBL_X, ty, { font: bold, size: 8.5 });
    const lw = bold.widthOfTextAtSize(labelBold, 8.5);
    if (value) text(value, LBL_X + lw + 4, ty, { size: 8.5 });
    hLine(y);
  }

  termRow("Payment Terms (From the date of Invoice) :", po.paymentTerms || "");
  termRow("Comments :", po.comments || "");

  // Terms & conditions block
  const tcTop = y;
  y -= 20;
  text("TERMS & CONDITIONS :", LBL_X, y + 6, { font: bold, size: 8.5 });
  y -= 20;
  text("- Minimum Weight :", LBL_X, y + 6, { size: 8.5 });
  text(po.minimumWeight || "20 MT.", LBL_X + 100, y + 6, { font: bold, size: 8.5 });

  // signature space
  y -= 110;

  // ---------- Outer border ----------
  const boxBottom = y;
  page.drawRectangle({
    x: M, y: boxBottom, width: BOX_W, height: boxTop - boxBottom,
    borderColor: COLORS.black, borderWidth: 1.5,
  });

  return doc.save();
}

module.exports = { buildPoPdf };
