// Shipment schedule as a branded spreadsheet.
//
// Laid out like a company document rather than a raw data dump: logo and
// company block at the top left, document title and date on the right, then the
// table. Anyone receiving it should be able to print it without editing it.

const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const {
  SHIPMENT_COLUMNS, HEADERS, toRow, EXPORT_COLORS,
} = require("./export-columns");

const TITLE_ROW = 2;
const META_ROW = 6;      // "generated" line
const HEADER_ROW = 8;    // column headings
const FIRST_DATA_ROW = HEADER_ROW + 1;

function readLogo() {
  try { return fs.readFileSync(path.join(process.cwd(), "public", "logo-mark-blue-512.png")); }
  catch { return null; }
}

/**
 * @param {Array}  bookings  rows to export, already ordered
 * @param {object} company   CompanySetting
 * @param {object} meta      { filterNote } shown under the title
 * @returns {Promise<Buffer>}
 */
async function buildShipmentXlsx(bookings, company, meta = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = company?.legalName || "SourceOne Ventures NZ Ltd";
  wb.created = new Date();

  const ws = wb.addWorksheet("Shipment Schedule", {
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    },
    views: [{ state: "frozen", ySplit: HEADER_ROW }],   // headings stay put when scrolling
  });

  ws.columns = SHIPMENT_COLUMNS.map(c => ({ key: c.key, width: c.width }));

  const lastCol = SHIPMENT_COLUMNS.length;
  const colLetter = (n) => ws.getColumn(n).letter;
  const span = (row) => `A${row}:${colLetter(lastCol)}${row}`;

  // ---- letterhead ---------------------------------------------------------
  // Rows 1-6 are the header block. The first two columns are left clear of text
  // so the logo has somewhere to sit.
  ws.getRow(1).height = 22;
  ws.mergeCells(span(TITLE_ROW));
  const title = ws.getCell(`A${TITLE_ROW}`);
  title.value = `${company?.name || "SOURCEONE"}  ·  ${company?.legalName || ""}`.trim();
  title.font = { name: "Calibri", size: 16, bold: true, color: { argb: EXPORT_COLORS.titleText } };
  title.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(TITLE_ROW).height = 24;

  ws.mergeCells(span(TITLE_ROW + 1));
  const addr = ws.getCell(`A${TITLE_ROW + 1}`);
  addr.value = [company?.address, company?.phone, company?.email].filter(Boolean).join("   ·   ");
  addr.font = { name: "Calibri", size: 9, color: { argb: "FF5A6B84" } };
  addr.alignment = { horizontal: "center" };

  ws.mergeCells(span(TITLE_ROW + 3));
  const docTitle = ws.getCell(`A${TITLE_ROW + 3}`);
  docTitle.value = "SHIPMENT SCHEDULE";
  docTitle.font = { name: "Calibri", size: 12, bold: true, color: { argb: EXPORT_COLORS.titleText } };
  docTitle.alignment = { horizontal: "center" };

  ws.mergeCells(span(META_ROW));
  const metaCell = ws.getCell(`A${META_ROW}`);
  metaCell.value = [
    `${bookings.length} shipment${bookings.length === 1 ? "" : "s"}`,
    meta.filterNote,
    `Generated ${new Date().toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" })}`,
  ].filter(Boolean).join("   ·   ");
  metaCell.font = { name: "Calibri", size: 9, italic: true, color: { argb: "FF7A879C" } };
  metaCell.alignment = { horizontal: "center" };

  const logo = readLogo();
  if (logo) {
    const id = wb.addImage({ buffer: logo, extension: "png" });
    // Anchored rather than sized to a cell, so column widths don't distort it.
    ws.addImage(id, { tl: { col: 0.15, row: 0.3 }, ext: { width: 62, height: 62 } });
  }

  // ---- column headings ----------------------------------------------------
  const head = ws.getRow(HEADER_ROW);
  HEADERS.forEach((h, i) => {
    const cell = head.getCell(i + 1);
    cell.value = h;
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: EXPORT_COLORS.headerText } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXPORT_COLORS.headerFill } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top:    { style: "thin", color: { argb: EXPORT_COLORS.border } },
      left:   { style: "thin", color: { argb: EXPORT_COLORS.border } },
      bottom: { style: "thin", color: { argb: EXPORT_COLORS.border } },
      right:  { style: "thin", color: { argb: EXPORT_COLORS.border } },
    };
  });
  head.height = 30;

  // ---- data ---------------------------------------------------------------
  bookings.forEach((b, i) => {
    const row = ws.getRow(FIRST_DATA_ROW + i);
    toRow(b).forEach((v, j) => {
      const cell = row.getCell(j + 1);
      cell.value = v;
      cell.font = { name: "Calibri", size: 10 };
      cell.alignment = {
        horizontal: SHIPMENT_COLUMNS[j].align || "left",
        vertical: "middle",
        wrapText: true,
      };
      cell.border = {
        top:    { style: "hair", color: { argb: EXPORT_COLORS.border } },
        left:   { style: "hair", color: { argb: EXPORT_COLORS.border } },
        bottom: { style: "hair", color: { argb: EXPORT_COLORS.border } },
        right:  { style: "hair", color: { argb: EXPORT_COLORS.border } },
      };
      if (i % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXPORT_COLORS.bandFill } };
      }
    });
    row.height = 26;
  });

  // Filter dropdowns on the headings, so the recipient can slice it too.
  if (bookings.length) {
    ws.autoFilter = {
      from: { row: HEADER_ROW, column: 1 },
      to: { row: FIRST_DATA_ROW + bookings.length - 1, column: lastCol },
    };
  }

  // Repeat the letterhead and headings on every printed page.
  ws.pageSetup.printTitlesRow = `1:${HEADER_ROW}`;

  return Buffer.from(await wb.xlsx.writeBuffer());
}

module.exports = { buildShipmentXlsx };
