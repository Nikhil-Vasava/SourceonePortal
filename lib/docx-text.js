// Turns a Word (.docx) packing slip into text Gemini can read.
//
// Gemini's API accepts PDFs and images only — a .docx posted straight to it
// comes back as "Unsupported MIME type". Suppliers do send Word slips, so we
// convert on the server and hand Gemini the text instead of the file.
//
// The conversion keeps tables as HTML rather than flattening to plain text.
// Packing slips are nearly always a table of containers, and the row/column
// structure is what tells the model which weight belongs to which container.
// extractRawText would run those cells together and invite mismatches.
//
// .doc (the pre-2007 binary format) is not handled — it isn't a zip archive
// and needs a different toolchain entirely. Callers should reject it.

/** True for a filename we can convert here. */
export function isWordDoc(fileName = "") {
  return /\.docx$/i.test(fileName.trim());
}

/** True for the old binary format, which we deliberately don't support. */
export function isLegacyDoc(fileName = "") {
  return /\.doc$/i.test(fileName.trim());
}

/**
 * Converts a .docx buffer to an HTML string.
 * @param {Buffer} buffer raw file contents
 * @returns {Promise<string>}
 */
export async function docxToHtml(buffer) {
  // Imported lazily so the (fairly large) library only loads when a Word file
  // actually turns up, keeping cold starts down for the common PDF path.
  const mammoth = (await import("mammoth")).default || (await import("mammoth"));

  let result;
  try {
    result = await mammoth.convertToHtml({ buffer });
  } catch (e) {
    throw new Error(
      `This Word file couldn't be opened (${e.message}). ` +
      "If it was renamed from .doc, re-save it as .docx or PDF."
    );
  }

  const html = (result?.value || "").trim();
  if (!html) {
    throw new Error(
      "This Word file has no readable text — it may hold only a scanned image. " +
      "Save it as a PDF and upload that instead."
    );
  }
  return html;
}

/**
 * Reads a .docx and returns it in the shape callGemini expects: base64 text
 * rather than base64 of the original file.
 * @param {Buffer} buffer raw .docx contents
 * @returns {Promise<{base64: string, mimeType: string}>}
 */
export async function docxAsTextPart(buffer) {
  const html = await docxToHtml(buffer);
  return {
    base64: Buffer.from(html, "utf8").toString("base64"),
    mimeType: "text/plain",
  };
}
