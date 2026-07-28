// Pure-JavaScript PDF text extraction — no external tools, works the same on Windows.
// Rebuilds each page as fixed-width text so "Label : value" pairs stay on one line.

let pdfjs = null;
async function loadPdfjs() {
  if (!pdfjs) {
    pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    // Run in-process: no web worker exists on the server.
    try {
      const worker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
      if (pdfjs.GlobalWorkerOptions) {
        pdfjs.GlobalWorkerOptions.workerPort = null;
        pdfjs.GlobalWorkerOptions.workerSrc = "";
      }
      globalThis.pdfjsWorker = worker;
    } catch {
      /* falls back to the built-in fake worker */
    }
  }
  return pdfjs;
}

const CHAR_WIDTH = 4.6; // approximate width of one character column, in points

/**
 * @param {Buffer|Uint8Array} buffer
 * @returns {Promise<string>} layout-preserving plain text
 */
export async function pdfToText(buffer) {
  const { getDocument } = await loadPdfjs();
  // pdf.js rejects Node Buffers, so always hand it a plain Uint8Array
  const data = new Uint8Array(
    buffer.buffer && buffer.byteLength != null
      ? buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
      : buffer
  );

  let doc;
  try {
    doc = await getDocument({ data, useSystemFonts: true, verbosity: 0, isEvalSupported: false }).promise;
  } catch (e) {
    throw new Error(`Could not open the PDF: ${e.message}`);
  }

  const out = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();

    const items = [];
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue;
      items.push({
        x: it.transform[4],
        y: it.transform[5],
        w: it.width || 0,
        h: it.height || 10,
        s: it.str,
      });
    }
    if (!items.length) continue;

    // Group items into visual rows.
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    const rows = [];
    for (const it of items) {
      const row = rows.find(r => Math.abs(r.y - it.y) <= Math.max(3, it.h * 0.55));
      if (row) { row.items.push(it); row.y = (row.y + it.y) / 2; }
      else rows.push({ y: it.y, items: [it] });
    }

    for (const row of rows) {
      row.items.sort((a, b) => a.x - b.x);
      let line = "";
      let prev = null;
      for (const it of row.items) {
        const col = Math.round(it.x / CHAR_WIDTH);
        if (prev) {
          const gap = it.x - (prev.x + prev.w);
          if (col > line.length) line = line.padEnd(col, " ");
          // some PDFs letter-space every glyph; only a real gap becomes a space
          else if (gap > Math.max(1.2, prev.h * 0.22)) line += " ";
        } else if (col > 0) {
          line = "".padEnd(col, " ");
        }
        line += it.s;
        prev = it;
      }
      const trimmed = line.replace(/\s+$/, "");
      if (trimmed.trim()) out.push(trimmed);
    }
    out.push("");
  }

  const text = out.join("\n");
  if (!text.trim()) {
    throw new Error(
      "No text found in this PDF — it looks like a scan or photo. " +
      "Enter the booking manually, or ask the carrier for a text PDF."
    );
  }
  return text;
}
