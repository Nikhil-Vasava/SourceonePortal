// Turns an Excel (.xlsx) packing slip into text Gemini can read.
//
// Gemini's API accepts PDFs and images only — an .xlsx posted straight to it
// comes back as "Unsupported MIME type". Suppliers sometimes send slips as
// spreadsheets, so we convert on the server and hand Gemini the text instead
// of the file, the same way docx-text.js handles Word files.
//
// The conversion keeps rows/columns as an HTML table rather than flattening
// to plain text, so the row a weight sits in stays tied to its container
// number. Only the modern .xlsx (OOXML) format is handled here — legacy .xls
// (BIFF binary) needs a different library and is rejected upstream.

/** True for a filename we can convert here. */
export function isSpreadsheet(fileName = "") {
  return /\.xlsx$/i.test(fileName.trim());
}

function escapeHtml(v) {
  return String(v ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

/** exceljs cell values can be a Date, a formula/result object or rich text, not just a string. */
function cellText(v) {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join("");
    if ("result" in v) return cellText(v.result);
    if ("text" in v) return String(v.text);
    return "";
  }
  return String(v);
}

/**
 * Converts an .xlsx buffer to an HTML string — one table per non-empty sheet.
 * @param {Buffer} buffer raw file contents
 * @returns {Promise<string>}
 */
export async function xlsxToHtml(buffer) {
  // Imported lazily so this fairly large library only loads when a
  // spreadsheet actually turns up.
  const ExcelJS = (await import("exceljs")).default || (await import("exceljs"));

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch (e) {
    throw new Error(
      `This Excel file couldn't be opened (${e.message}). ` +
      "If it's the old .xls format, re-save it as .xlsx or PDF."
    );
  }

  const tables = [];
  workbook.eachSheet((sheet) => {
    const rows = [];
    sheet.eachRow((row) => {
      const cells = row.values.slice(1) // exceljs pads index 0 with undefined
        .map((v) => `<td>${escapeHtml(cellText(v))}</td>`)
        .join("");
      if (cells) rows.push(`<tr>${cells}</tr>`);
    });
    if (rows.length) tables.push(`<table>${rows.join("")}</table>`);
  });

  const html = tables.join("\n");
  if (!html) {
    throw new Error(
      "This Excel file has no readable rows. Save it as a PDF and upload that instead."
    );
  }
  return html;
}

/**
 * Reads an .xlsx and returns it in the shape callGemini expects: base64 text
 * rather than base64 of the original file.
 * @param {Buffer} buffer raw .xlsx contents
 * @returns {Promise<{base64: string, mimeType: string}>}
 */
export async function xlsxAsTextPart(buffer) {
  const html = await xlsxToHtml(buffer);
  return {
    base64: Buffer.from(html, "utf8").toString("base64"),
    mimeType: "text/plain",
  };
}
