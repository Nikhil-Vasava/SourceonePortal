// What each uploader accepts — one definition, used by both the file picker
// and the server.
//
// The picker's `accept` list is a convenience, not a guarantee: it can be
// worked around by renaming a file, choosing "All files" in the dialog, or
// dragging one in. So the server has to check too, and the two lists have to
// agree — which is why they come from the same place.
//
// The point of checking early is the message. Without it an unsupported file
// travels all the way to Gemini and comes back as "Unsupported MIME type
// application/octet-stream", which tells the person nothing about what to do.

/** Gemini reads these directly. */
const IMAGES = ["png", "jpg", "jpeg", "webp", "heic"];

export const UPLOAD_KINDS = {
  // Suppliers send slips as anything — scans, phone photos, Word tables.
  packingSlip: {
    label: "packing slip",
    extensions: ["pdf", ...IMAGES, "docx"],
    advice: "Upload a PDF, a photo (JPG, PNG or HEIC), or a Word .docx.",
  },
  // Carriers send PDFs; a photo of one still works through Gemini.
  booking: {
    label: "booking confirmation",
    extensions: ["pdf", ...IMAGES],
    advice: "Upload the carrier's PDF, or a clear photo of it.",
  },
  // Our own POs, read by the built-in parser.
  purchaseOrder: {
    label: "purchase order",
    extensions: ["pdf"],
    advice: "Upload the PO as a PDF.",
  },
};

/** The `accept` attribute for a file input. */
export function acceptFor(kind) {
  return UPLOAD_KINDS[kind].extensions.map(e => `.${e}`).join(",");
}

export function extensionOf(fileName = "") {
  const name = String(fileName).trim();
  if (!name.includes(".")) return "";
  return name.split(".").pop().toLowerCase();
}

// Formats people genuinely try, each with the specific way out. A generic
// "unsupported file" would leave someone stuck with a .doc and no idea that
// Save As fixes it.
const KNOWN_PROBLEMS = {
  doc: "Old-style Word files (.doc) can't be read. Open it in Word and use " +
       "File → Save As to save a .docx or a PDF, then upload that.",
  xls: "Spreadsheets can't be read automatically. Save it as a PDF and upload that, " +
       "or type the values in by hand.",
  xlsx: "Spreadsheets can't be read automatically. Save it as a PDF and upload that, " +
        "or type the values in by hand.",
  csv: "CSV files can't be read automatically. Save it as a PDF and upload that, " +
       "or type the values in by hand.",
  msg: "Email files (.msg) can't be read. Open the email and upload the attachment itself.",
  eml: "Email files (.eml) can't be read. Open the email and upload the attachment itself.",
  zip: "Archives can't be read. Unzip it and upload the document inside.",
  rar: "Archives can't be read. Unzip it and upload the document inside.",
  tif: "TIFF images aren't supported. Save it as a PDF, JPG or PNG and upload that.",
  tiff: "TIFF images aren't supported. Save it as a PDF, JPG or PNG and upload that.",
  gif: "GIF images aren't supported. Upload a PDF, JPG, PNG or HEIC instead.",
  bmp: "BMP images aren't supported. Upload a PDF, JPG, PNG or HEIC instead.",
  pages: "Apple Pages files can't be read. Export it as a PDF or Word .docx and upload that.",
  numbers: "Apple Numbers files can't be read. Export it as a PDF and upload that.",
};

/**
 * Throws with a message worth reading if this file can't be handled.
 * Call it before doing any work — conversion, upload or API call.
 *
 * @param {string} fileName
 * @param {"packingSlip"|"booking"|"purchaseOrder"} kind
 */
export function assertUploadType(fileName, kind) {
  const spec = UPLOAD_KINDS[kind];
  const ext = extensionOf(fileName);

  if (spec.extensions.includes(ext)) return ext;

  if (!ext) {
    throw new Error(
      `"${fileName}" has no file extension, so its type can't be worked out. ${spec.advice}`
    );
  }

  // A format we know about but can't take here — say why and what to do.
  const known = KNOWN_PROBLEMS[ext];
  if (known) throw new Error(known);

  // A .docx sent to an uploader that only takes PDFs and images. Name the
  // screen that DOES take Word, not the one being used — saying "only the
  // booking upload takes them" while rejecting a booking upload is nonsense.
  if (ext === "docx") {
    const takesWord = Object.values(UPLOAD_KINDS)
      .filter(k => k !== spec && k.extensions.includes("docx"))
      .map(k => k.label);
    const where = takesWord.length
      ? ` Word files are only read on the ${takesWord.join(" and ")} upload.`
      : "";
    throw new Error(`Word files can't be read as a ${spec.label}. ${spec.advice}${where}`);
  }

  throw new Error(`.${ext} files can't be read as a ${spec.label}. ${spec.advice}`);
}
