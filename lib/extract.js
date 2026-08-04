// Packing-slip extraction. Gemini is the only reader.
//
// If the primary model is rate-limited, gemini.js retries against the models in
// GEMINI_FALLBACK_MODELS, each of which carries its own quota.
//
// A supplier sends ONE packing slip covering every container in a booking, so the
// extractor returns an array and the caller spreads it across that booking's lines.
//
// Bookings and purchase orders don't come through here — they use the built-in
// parsers in booking-parsers.js / po-parser.js, which need no AI at all.

import { hasGeminiKey, mimeFor, extractDocumentRaw } from "@/lib/gemini";
import { isWordDoc, isLegacyDoc, docxAsTextPart } from "@/lib/docx-text";

const PACKING_SCHEMA = `{
  "supplierName": "string or null",
  "packingDate": "YYYY-MM-DD or null",
  "containers": [
    {
      "containerNo": "string or null",
      "sealNo": "string or null",
      "description": "goods description or null",
      "packages": number or null,
      "netWeightKg": number or null,
      "grossWeightKg": number or null
    }
  ]
}`;

const PACKING_PROMPT =
  "You are reading a packing slip / packing list for an ocean freight booking. " +
  "One slip usually covers SEVERAL containers — return one entry in 'containers' for EVERY " +
  "container listed, in the order they appear. A table with 5 rows means 5 entries. " +
  "For each container extract its number, seal number, number of packages (bales/bags/cartons), " +
  "net weight and gross weight. " +
  "Convert all weights to KILOGRAMS (1 MT = 1000 kg, 1 lb = 0.453592 kg) and return plain " +
  "numbers with no units, commas or spaces. " +
  "If the slip shows only a grand total rather than per-container weights, still create one entry " +
  "per container and divide the total evenly between them. " +
  "Use null for anything not present. Never invent container numbers.";

export function extractionProviders() {
  return [{ name: "Gemini", ready: hasGeminiKey() }];
}

export function hasAnyExtractionKey() {
  return hasGeminiKey();
}

const num = (v) => {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) || n <= 0 ? null : n;
};

/** Accepts either the multi-container shape or a single-container slip. */
function normalise(raw) {
  const list = Array.isArray(raw?.containers) && raw.containers.length
    ? raw.containers
    : [raw || {}];                       // a one-container slip

  const containers = list
    .map(c => ({
      containerNo: c.containerNo ? String(c.containerNo).replace(/\s+/g, "").toUpperCase() : null,
      sealNo: c.sealNo ? String(c.sealNo).trim() : null,
      description: c.description || raw?.description || null,
      packages: num(c.packages) != null ? Math.round(num(c.packages)) : null,
      netWeightKg: num(c.netWeightKg),
      grossWeightKg: num(c.grossWeightKg),
    }))
    // drop rows the model returned with nothing usable in them
    .filter(c => c.containerNo || c.netWeightKg || c.grossWeightKg || c.packages);

  return {
    supplierName: raw?.supplierName || null,
    packingDate: raw?.packingDate || null,
    containers,
  };
}

/**
 * Reads a packing slip with Gemini.
 * @returns {Promise<{data: {supplierName, packingDate, containers: []}, provider: string, notes: string[]}>}
 */
export async function extractPackingSlip(base64, fileName) {
  if (!hasGeminiKey()) {
    throw new Error(
      "No GEMINI_API_KEY is set, so packing slips can't be read automatically. " +
      "You can type the values into each row instead."
    );
  }

  // The old binary Word format isn't a zip archive and can't be converted here.
  if (isLegacyDoc(fileName)) {
    throw new Error(
      "Old-style Word files (.doc) can't be read. Open it in Word and use " +
      "File → Save As to save a .docx or PDF, then upload that."
    );
  }

  // Gemini takes PDFs and images only, so a .docx becomes text first. Conversion
  // errors are thrown as-is — they already explain what to do and aren't Gemini's doing.
  let part = { base64, mimeType: mimeFor(fileName) };
  if (isWordDoc(fileName)) {
    part = await docxAsTextPart(Buffer.from(base64, "base64"));
  }

  try {
    const raw = await extractDocumentRaw({
      prompt: PACKING_PROMPT, schemaHint: PACKING_SCHEMA, ...part,
    });
    return { data: normalise(raw), provider: "Gemini", notes: [] };
  } catch (e) {
    throw new Error(
      `Could not read this packing slip. Gemini: ${e.message}. ` +
      "You can type the values into each row instead."
    );
  }
}

/**
 * Spreads extracted containers across a booking's lines.
 * Lines that already carry a container number are matched by it; whatever is left
 * is filled in document order.
 *
 * @param {Array} lines    booking lines, ordered by lineNo
 * @param {Array} parsed   containers from the slip
 * @returns {{updates: Array<{id:number, data:object}>, matched:number, unmatched:Array, spare:number}}
 */
export function distributeContainers(lines, parsed) {
  const remainingLines = [...lines];
  const updates = [];
  const leftovers = [];

  const key = (s) => String(s || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();

  // 1. exact container-number matches win, wherever they sit in the list
  for (const c of parsed) {
    if (!c.containerNo) { leftovers.push(c); continue; }
    const i = remainingLines.findIndex(l => l.containerNo && key(l.containerNo) === key(c.containerNo));
    if (i >= 0) {
      updates.push({ id: remainingLines[i].id, data: c });
      remainingLines.splice(i, 1);
    } else {
      leftovers.push(c);
    }
  }

  // 2. everything else fills the remaining lines in order
  const unmatched = [];
  for (const c of leftovers) {
    const line = remainingLines.shift();
    if (line) updates.push({ id: line.id, data: c });
    else unmatched.push(c);      // slip listed more containers than the booking has
  }

  return {
    updates,
    matched: updates.length,
    unmatched,                    // extra containers with nowhere to go
    spare: remainingLines.length, // booking lines the slip didn't cover
  };
}

/* ========================================================================= */
/* Booking confirmations                                                     */
/* ========================================================================= */
//
// Unlike packing slips, bookings have deterministic parsers for Maersk, MSC and
// ONE (see booking-parsers.js) — exact, instant and free. Gemini is the
// fallback for layouts those parsers don't know, and for scanned PDFs that have
// no text layer at all. See readBookingDocument in booking-import.js for the
// ordering.

const BOOKING_SCHEMA = `{
  "bookingNumber": "string or null",
  "bookingDate": "YYYY-MM-DD or null",
  "shippingLine": "carrier name, e.g. Maersk / MSC / ONE, or null",
  "freightForwarder": "string or null",
  "vesselName": "string or null",
  "voyageNumber": "string or null",
  "portOfLoading": "city name only, no country or terminal, or null",
  "portOfDestination": "city name only, or null",
  "placeOfDelivery": "string or null",
  "bookedContainers": number or null,
  "containerType": "e.g. 40 DRY HC / 20 GP, or null",
  "commodity": "goods description or null",
  "serviceContract": "string or null",
  "grossWeightKg": number or null,
  "erd": "YYYY-MM-DD or null",
  "docsCutOff": "YYYY-MM-DD or null",
  "cargoCutOff": "YYYY-MM-DD or null",
  "etd": "YYYY-MM-DD or null",
  "eta": "YYYY-MM-DD or null",
  "containers": [
    { "containerNo": "string or null", "containerType": "string or null" }
  ]
}`;

const BOOKING_PROMPT =
  "You are reading an ocean freight BOOKING CONFIRMATION from a shipping line " +
  "(Maersk, MSC, ONE, CMA CGM, Hapag-Lloyd or similar). Extract the shipment details. " +
  "The booking number is the carrier's own reference — not a container number, not a " +
  "bill of lading number, not a customer reference. " +
  "For ports give the city only: 'Tauranga', not 'Tauranga, New Zealand' or " +
  "'Tauranga Container Terminal'. " +
  "ERD is the earliest receiving date or empty pick-up date. Cut-offs are deadlines: " +
  "docs/SI cut-off and cargo/port cut-off are different dates — don't confuse them. " +
  "Convert every date to YYYY-MM-DD. Beware of ambiguous formats: carrier documents are " +
  "usually DD/MM/YYYY, so 03/07/2026 is 3 July, not 7 March. " +
  "If container numbers are listed, return one entry per container in 'containers'. " +
  "bookedContainers is the total number of containers booked. " +
  "Give weights in kilograms as plain numbers with no units or separators. " +
  "Use null for anything not present. Never invent a booking number.";

/**
 * Reads a booking confirmation with Gemini.
 *
 * Accepts the original PDF bytes rather than extracted text, so a scanned
 * document with no text layer still works — Gemini reads it as an image.
 *
 * @returns {Promise<{data: object, provider: string}>}
 */
export async function extractBookingWithGemini(base64, fileName) {
  if (!hasGeminiKey()) {
    throw new Error(
      "No GEMINI_API_KEY is set, so unrecognised booking layouts can't be read " +
      "automatically. Add the booking manually instead."
    );
  }

  let part = { base64, mimeType: mimeFor(fileName) };
  if (isLegacyDoc(fileName)) {
    throw new Error("Old-style Word files (.doc) can't be read. Save as PDF and try again.");
  }
  if (isWordDoc(fileName)) {
    part = await docxAsTextPart(Buffer.from(base64, "base64"));
  }

  const raw = await extractDocumentRaw({
    prompt: BOOKING_PROMPT, schemaHint: BOOKING_SCHEMA, ...part,
  });

  return { data: normaliseBooking(raw), provider: "Gemini" };
}

/** Coerces Gemini's output into the exact shape createBookingFromExtract expects. */
function normaliseBooking(raw) {
  const s = (v) => {
    const t = (v ?? "").toString().trim();
    return t === "" || t.toLowerCase() === "null" ? null : t;
  };

  const containers = (Array.isArray(raw?.containers) ? raw.containers : [])
    .map(c => ({
      containerNo: c?.containerNo
        ? String(c.containerNo).replace(/\s+/g, "").toUpperCase()
        : null,
      containerType: s(c?.containerType),
    }))
    .filter(c => c.containerNo || c.containerType);

  return {
    bookingNumber: s(raw?.bookingNumber),
    bookingDate: s(raw?.bookingDate),
    shippingLine: s(raw?.shippingLine),
    freightForwarder: s(raw?.freightForwarder),
    vesselName: s(raw?.vesselName),
    voyageNumber: s(raw?.voyageNumber),
    portOfLoading: s(raw?.portOfLoading),
    portOfDestination: s(raw?.portOfDestination),
    placeOfDelivery: s(raw?.placeOfDelivery),
    bookedContainers: num(raw?.bookedContainers) != null
      ? Math.round(num(raw.bookedContainers)) : null,
    containerType: s(raw?.containerType),
    commodity: s(raw?.commodity),
    serviceContract: s(raw?.serviceContract),
    grossWeightKg: num(raw?.grossWeightKg),
    erd: s(raw?.erd),
    docsCutOff: s(raw?.docsCutOff),
    cargoCutOff: s(raw?.cargoCutOff),
    etd: s(raw?.etd),
    eta: s(raw?.eta),
    containers,
  };
}
