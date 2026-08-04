import { prisma } from "@/lib/db";
import { nextBookingNumber } from "@/lib/numbering";
import { pdfToText } from "@/lib/pdf-text";
import { parseBookingText } from "@/lib/booking-parsers";
import { extractBookingWithGemini } from "@/lib/extract";
import { hasGeminiKey } from "@/lib/gemini";

/** Fuzzy-match an extracted company name against existing partners of a type. */
export async function findPartner(name, types) {
  if (!name) return null;
  // Deliberately not filtered to active records. This matches names read out of a
  // PDF against partners we already know; an inactive supplier is still that same
  // company, and skipping it would silently create a duplicate instead.
  const list = await prisma.partner.findMany({ where: { type: { in: [].concat(types) } } });
  const norm = (s) => String(s).toLowerCase().replace(/\b(ltd|limited|llc|inc|co|company|sa|s\.a|pte|as|a\/s|nz|line|lines)\b/g, "").replace(/[^a-z0-9]/g, "");
  const t = norm(name);
  if (!t) return null;
  return list.find(p => norm(p.name) === t)
      || list.find(p => norm(p.name) && (norm(p.name).includes(t) || t.includes(norm(p.name))))
      || null;
}

/**
 * Parses a date safely for NZ (UTC+12/13): a bare calendar date is anchored at
 * UTC noon, so converting to/from local time can never shift it to the day before.
 */
export function toDate(v) {
  if (!v) return null;
  const s = String(v).trim();

  // YYYY-MM-DD (optionally followed by a time)
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (m) {
    const [, y, mo, d, hh, mi] = m;
    return new Date(Date.UTC(+y, +mo - 1, +d, hh ? +hh : 12, mi ? +mi : 0));
  }

  // MM-DD-YYYY or MM/DD/YYYY (US style, as printed on our own purchase orders)
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) {
    let [, a, b, y] = m;
    a = +a; b = +b;
    // if the first part can't be a month it must be day-first
    const [mo, d] = a > 12 ? [b, a] : [a, b];
    return new Date(Date.UTC(+y, mo - 1, d, 12));
  }

  const dt = new Date(s.replace(" ", "T"));
  return isNaN(dt) ? null : dt;
}

export function toNum(v) {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : n;
}

/** Turns extracted JSON into a Booking + one container line per booked container. */
export async function createBookingFromExtract(data, fileName) {
  const [carrier, forwarder] = await Promise.all([
    findPartner(data.shippingLine, "SHIPPING_LINE"),
    findPartner(data.freightForwarder, ["FORWARDER", "CHA"]),
  ]);

  const booked = toNum(data.bookedContainers);
  const containers = Array.isArray(data.containers) ? data.containers : [];
  const lineCount = Math.max(containers.length, booked ? Math.round(booked) : 0, 1);

  return prisma.booking.create({
    data: {
      number: data.bookingNumber?.trim() || (await nextBookingNumber()),
      bookingDate: toDate(data.bookingDate) || new Date(),
      shippingLineId: carrier?.id ?? null,
      forwarderId: forwarder?.id ?? null,
      freightForwarder: data.freightForwarder || null,
      vessel: data.vesselName || null,
      voyage: data.voyageNumber || null,
      pol: data.portOfLoading || null,
      pod: data.portOfDestination || null,
      placeOfDelivery: data.placeOfDelivery || data.portOfDestination || null,
      bookedContainers: booked != null ? Math.round(booked) : null,
      containerType: data.containerType || null,
      erd: toDate(data.erd),
      docsCutOff: toDate(data.docsCutOff),
      cargoCutOff: toDate(data.cargoCutOff),
      cutoffDate: toDate(data.cargoCutOff),
      etd: toDate(data.etd),
      eta: toDate(data.eta),
      commodity: data.commodity || null,
      serviceContract: data.serviceContract || null,
      totalWeightKg: toNum(data.grossWeightKg) ?? 0,
      status: "CONFIRMED",
      sourceFile: fileName,
      extractedJson: JSON.stringify(data, null, 2),
      lines: {
        create: Array.from({ length: lineCount }, (_, i) => ({
          lineNo: i + 1,
          containerNo: containers[i]?.containerNo || null,
          containerType: containers[i]?.containerType || data.containerType || null,
          description: data.commodity || null,
        })),
      },
    },
  });
}

/* ------------------------------------------------------------------------- */
/* Reader chain: deterministic parsers first, Gemini as the fallback          */
/* ------------------------------------------------------------------------- */

/**
 * Fields a booking row is not much use without.
 *
 * voyageNumber is in here deliberately: a vessel without its voyage can't be
 * tracked or quoted against, and a parser that found one but not the other has
 * clearly misread the transport plan. Missing any of these sends the document
 * to Gemini for a second opinion — one API call is cheaper than a booking row
 * someone has to correct by hand.
 */
const REQUIRED = ["bookingNumber", "vesselName", "voyageNumber", "portOfLoading", "portOfDestination"];

/** Values the parser found win over the model's — they're exact, not inferred. */
function mergePreferringParser(parsed, ai) {
  const out = { ...ai };
  for (const [k, v] of Object.entries(parsed || {})) {
    if (v !== null && v !== undefined && v !== "") out[k] = v;
  }
  // The parser always returns an empty containers array; keep the model's list
  // if it actually found container numbers.
  if ((!parsed?.containers || !parsed.containers.length) && ai?.containers?.length) {
    out.containers = ai.containers;
  }
  return out;
}

/**
 * Reads one booking confirmation.
 *
 * Order matters and is deliberate:
 *
 *   1. Extract the text layer and run the built-in parsers. For Maersk, MSC and
 *      ONE this is exact, instant, free and uses no quota — the overwhelmingly
 *      common case, so it must stay the default.
 *   2. Fall back to Gemini only when that isn't good enough: an unrecognised
 *      carrier layout, or a scanned PDF with no text layer at all. Gemini reads
 *      the PDF as an image, so scans now work where before they simply couldn't.
 *   3. Merge, preferring parser values — a regex that matched a labelled field
 *      is more trustworthy than a model inferring one.
 *
 * @returns {Promise<{data: object, carrier: string, provider: string, missing: string[]}>}
 */
export async function readBookingDocument(buffer, fileName) {
  const base64 = buffer.toString("base64");

  let parsed = null;
  let carrier = "UNKNOWN";
  let textFailed = null;

  try {
    const text = await pdfToText(buffer);
    if (text && text.trim().length > 40) {
      const r = parseBookingText(text);
      parsed = r.data;
      carrier = r.carrier;

      const missing = REQUIRED.filter(k => !parsed[k]);
      if (!missing.length) {
        // Recognised layout, everything important present — done, no AI needed.
        return { data: parsed, carrier, provider: "Built-in parser", missing: [] };
      }
    } else {
      textFailed = "no text layer (scanned or image-only PDF)";
    }
  } catch (e) {
    // pdfToText's own message tells the user to enter the booking manually,
    // which is no longer true now that Gemini can read a scan. Reduce it to the
    // bare reason and let the code below decide what advice to give.
    textFailed = /no text found/i.test(e.message)
      ? "no text layer (scanned or image-only PDF)"
      : e.message;
  }

  // ---- fallback ----------------------------------------------------------
  if (!hasGeminiKey()) {
    if (parsed?.bookingNumber) {
      // Partial read is better than nothing; the user fills the gaps.
      return {
        data: parsed, carrier, provider: "Built-in parser",
        missing: REQUIRED.filter(k => !parsed[k]),
      };
    }
    throw new Error(
      textFailed
        ? `couldn't be read — ${textFailed}, and no GEMINI_API_KEY is set to read it as an image.`
        : "this layout isn't recognised and no GEMINI_API_KEY is set. Add the booking manually."
    );
  }

  let ai;
  try {
    ai = await extractBookingWithGemini(base64, fileName);
  } catch (e) {
    if (parsed?.bookingNumber) {
      return {
        data: parsed, carrier, provider: "Built-in parser",
        missing: REQUIRED.filter(k => !parsed[k]),
      };
    }
    throw new Error(`couldn't be read. ${e.message}`);
  }

  const data = mergePreferringParser(parsed, ai.data);
  if (!data.bookingNumber) {
    throw new Error("no booking number could be found in this document.");
  }

  return {
    data,
    carrier: carrier === "GENERIC" || carrier === "UNKNOWN"
      ? (data.shippingLine || "Unknown carrier")
      : carrier,
    provider: parsed?.bookingNumber ? "Parser + Gemini" : "Gemini",
    missing: REQUIRED.filter(k => !data[k]),
  };
}
