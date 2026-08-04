// Deterministic booking-confirmation parsers. No AI, no API keys, no quotas.
// Supported: Maersk, MSC, ONE (Ocean Network Express), plus a generic fallback.

// ---------------------------------------------------------------- helpers

const MONTHS = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };

const pad = (n) => String(n).padStart(2, "0");
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

/** Normalises the date shapes these carriers use into YYYY-MM-DD. */
export function normDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);                       // 2026-07-12
  if (m) return ymd(m[1], +m[2], +m[3]);

  m = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})/);                     // 28/04/2026 (day first)
  if (m) return ymd(m[3], +m[2], +m[1]);

  m = s.match(/^(\d{1,2})([A-Za-z]{3})(\d{2,4})/);                       // 13May26
  if (m) {
    const mo = MONTHS[m[2].toLowerCase()];
    if (!mo) return null;
    let y = +m[3];
    if (y < 100) y += y < 80 ? 2000 : 1900;
    return ymd(y, mo, +m[1]);
  }

  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{2,4})/);                // 15 MAY 26
  if (m) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (!mo) return null;
    let y = +m[3];
    if (y < 100) y += y < 80 ? 2000 : 1900;
    return ymd(y, mo, +m[1]);
  }
  return null;
}

/** Date plus optional time, kept as "YYYY-MM-DD HH:mm". */
function normDateTime(raw) {
  if (!raw) return null;
  const d = normDate(raw);
  if (!d) return null;
  const t = String(raw).match(/(\d{1,2}):(\d{2})/);
  return t ? `${d} ${pad(t[1])}:${t[2]}` : d;
}

const clean = (v) => {
  if (v == null) return null;
  const s = String(v).replace(/\s+/g, " ").trim().replace(/[:,]$/, "").trim();
  return s || null;
};

/** Value that follows "Label :" on the same line. */
function after(text, label, { stop } = {}) {
  const re = new RegExp(
    label + String.raw`[ \t]*:?[ \t]*([^\n]*)`,
    "i"
  );
  const m = text.match(re);
  if (!m) return null;
  let v = m[1];
  // The field is empty when the neighbouring column's label follows immediately.
  const ownLabel = v.match(/^[A-Z][A-Za-z'/.()\s-]{1,30}\s*:/);
  if (ownLabel) v = "";
  // Otherwise cut the value where the next "Label :" column begins.
  const nextLabel = v.match(/\s{2,}[A-Z][A-Za-z'/.()\s]{2,30}\s*:/);
  if (nextLabel) v = v.slice(0, nextLabel.index);
  if (stop) {
    const s = v.search(stop);
    if (s > 0) v = v.slice(0, s);
  }
  return clean(v);
}

const titleCity = (v) => {
  const s = clean(v);
  if (!s) return null;
  return s.split(",")[0].replace(/\s+(CONTAINER\s+)?TERMINAL\b.*$/i, "").trim() || null;
};

// ---------------------------------------------------------------- Maersk

function parseMaersk(text) {
  const d = { shippingLine: "Maersk" };

  // "Booking No.:" is a long digit run, on the same line or the one below it
  d.bookingNumber =
    (text.match(/Booking No\.?[ \t]*:[ \t]*(\d{6,})\b/i) || [])[1] ||
    (text.match(/Booking No\.?[^\n]*\n[ \t]*(\d{6,})[ \t]*$/im) || [])[1] ||
    after(text, String.raw`Booking No\.?`) || null;

  d.freightForwarder = after(text, "Booked by Party");
  d.serviceContract = after(text, "Service Contract");
  d.commodity = after(text, "Commodity Description");
  d.portOfLoading = titleCity(after(text, String.raw`\bFrom`));
  d.portOfDestination = titleCity(after(text, String.raw`\bTo\b`));
  d.placeOfDelivery = clean(after(text, String.raw`\bTo\b`));
  d.bookingDate = normDate(after(text, "Print Date"));

  // Equipment row: "2   40 DRY 9 6   44000.000 KGS   2 Piece(s)"
  const eq = text.match(/^\s*(\d{1,3})\s+(\d{2}\s*[A-Z][A-Z]+(?:\s+\d+)*)\s+([\d.,]+)\s*KGS/mi);
  if (eq) {
    d.bookedContainers = parseInt(eq[1], 10);
    // "40 DRY 9 6" -> "40 DRY 9'6"
    d.containerType = clean(eq[2]).replace(/^(\d{2}\s*[A-Z]+)\s+(\d)\s+(\d)$/, "$1 $2'$3");
    d.grossWeightKg = Number(String(eq[3]).replace(/,/g, ""));
  }

  // Empty pick-up = ERD
  const erd = text.match(/Empty Container[^\n]*?(\d{4}-\d{2}-\d{2})/i);
  if (erd) d.erd = erd[1];

  // First ocean leg of the transport plan gives vessel / voyage / ETD
  const leg = text.match(/^[^\n]*?\bMVS\b\s+([A-Z][A-Z0-9 .'-]{3,40}?)\s+([0-9]{2,4}[A-Z]{0,2})\s+(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2})/m);
  if (leg) {
    d.vesselName = clean(leg[1]);
    d.voyageNumber = clean(leg[2]);
    d.etd = leg[3];
  }
  // Final arrival = last ETA in the plan
  const etas = [...text.matchAll(/(\d{4}-\d{2}-\d{2})\s*$/gm)].map(m => m[1]);
  if (etas.length) d.eta = etas[etas.length - 1];

  return d;
}

// ---------------------------------------------------------------- MSC

function parseMsc(text) {
  const d = { shippingLine: "MSC Mediterranean Shipping Company" };

  // The reference sits on the line below the "BOOKING REFERENCE" header
  d.bookingNumber =
    (text.match(/BOOKING REFERENCE[^\n]*\n\s*([A-Z]{2,}\d{6,})/i) || [])[1] ||
    (text.match(/\b(EBKG\d{6,})\b/i) || [])[1] || null;

  d.bookingDate = normDate((text.match(/BOOKING DATE[^\n]*\n[^\n]*?(\d{1,2}\/\d{1,2}\/\d{4})/i) || [])[1]);
  const clientBlock = text.match(/([^\n]*)\n([^\n]*)\n[^\n]*BOOKING CLIENT/i);
  if (clientBlock) {
    const cand = clean(clientBlock[1]);
    if (cand && /[A-Za-z]{3}/.test(cand) && !/^\(|pick-up-reference/i.test(cand)) d.freightForwarder = cand;
  }
  if (!d.freightForwarder) d.freightForwarder = after(text, "BOOKING CLIENT");
  d.serviceContract = after(text, String.raw`SERVICE CONTRACT/RATE REF\. N\*?`);

  d.portOfLoading = titleCity(after(text, "PORT OF LOADING", { stop: /EST\./i }));
  d.portOfDestination = titleCity(after(text, "PORT OF DISCHARGE", { stop: /EST\./i }));
  d.placeOfDelivery = clean(
    String(after(text, "FINAL DESTINATION") || "")
      .replace(/CARRIER'?S\s+HAULAGE\s+BY.*$/i, "")
      .replace(/\s*,\s*$/, "")
  );

  let v = after(text, "VESSEL NAME", { stop: /VOYAGE/i });
  if (v) d.vesselName = clean(v.replace(/\(LLOYDS[^)]*\)/i, "").replace(/\/\s*[A-Z]{1,3}\s*$/, ""));
  d.voyageNumber = after(text, "VOYAGE NUMBER");

  // "EST. TIME OF ARRIVAL/DEPARTURE  13/05/2026 19:00  14/05/2026 19:00" -> ETD is the second
  const dep = text.match(/EST\.\s*TIME OF ARRIVAL\/DEPARTURE[^\n]*?(\d{1,2}\/\d{1,2}\/\d{4})[^\n]*?(\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (dep) d.etd = normDate(dep[2]);
  const arr = text.match(/PORT OF DISCHARGE[^\n]*?EST\.\s*TIME OF ARRIVAL\s+(\d{1,2}\/\d{1,2}\/\d{4})/i)
           || text.match(/EST\.\s*TIME OF ARRIVAL\s+(\d{1,2}\/\d{1,2}\/\d{4})(?![^\n]*DEPARTURE)/i);
  if (arr) d.eta = normDate(arr[1]);

  const tot = text.match(/TOTAL CONTAINER\s*\(?S?\)?\s+(\d+)/i);
  if (tot) d.bookedContainers = parseInt(tot[1], 10);

  // "DRY   06/05/2026 00:01   12/05/2026 10:00" -> first receiving, then cut-off
  const cut = text.match(/^\s*(DRY|REEFER)\s+(\d{1,2}\/\d{1,2}\/\d{4}[^\n]*?\d{2}:\d{2})\s+(\d{1,2}\/\d{1,2}\/\d{4}[^\n]*?\d{2}:\d{2})/mi);
  if (cut) {
    d.erd = normDate(cut[2]);
    d.cargoCutOff = normDateTime(cut[3]);
    d.containerType = cut[1].toUpperCase() === "DRY" ? "DRY" : cut[1];
  }
  const si = text.match(/SHIPPING INSTRUCTIONS CUT-?OFF[^\n]*?(\d{1,2}\/\d{1,2}\/\d{4}[^\n]*?\d{2}:\d{2})/i)
          || text.match(/(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{2}:\d{2})\s*\n\s*SHIPPING INSTRUCTIONS CUT-?OFF/i);
  if (si) d.docsCutOff = normDateTime(si[1]);

  return d;
}

// ---------------------------------------------------------------- ONE

function parseOne(text) {
  const d = { shippingLine: "Ocean Network Express (ONE)" };

  d.bookingNumber = after(text, "Booking No");
  d.bookingDate = normDate(after(text, "Booking Date"));
  d.freightForwarder = after(text, "Forwarder");
  d.serviceContract = after(text, String.raw`Rate Agreement No\.?`);

  d.portOfLoading = titleCity(after(text, "Port of Loading", { stop: /Terminal/i }));
  d.portOfDestination = titleCity(after(text, "Port of Discharging", { stop: /Terminal/i }));
  d.placeOfDelivery = clean(after(text, "Place of Delivery", { stop: /Terminal/i }));
  d.commodity = after(text, "Commodity", { stop: /Estimated Weight/i });

  // "Trunk Vessel : MAERSK RIO DELTA 625N(NZ1)"
  const tv = after(text, "Trunk Vessel", { stop: /Latest/i });
  if (tv) {
    const m = tv.match(/^(.*?)\s+(\d{2,4}[A-Z]?)\s*(?:\([^)]*\))?\s*$/);
    if (m) { d.vesselName = clean(m[1]); d.voyageNumber = clean(m[2]); }
    else d.vesselName = clean(tv);
  }

  // "Equipment Type/Q'ty : 40'DRY HC.-5"
  const eq = after(text, String.raw`Equipment Type/Q['’]ty`);
  if (eq) {
    const m = eq.match(/^(.*?)[.\-\s]*-\s*(\d+)\s*$/);
    if (m) { d.containerType = clean(m[1]); d.bookedContainers = parseInt(m[2], 10); }
    else d.containerType = clean(eq);
  }

  const w = after(text, "Estimated Weight");
  if (w) {
    const n = Number(String(w).replace(/[^\d.]/g, ""));
    if (!isNaN(n) && n > 0) d.grossWeightKg = n;
  }

  d.erd = normDate(after(text, "Empty Pick Up Date")) || normDate(after(text, "Rail Receiving Date"));
  d.docsCutOff = normDateTime(after(text, "Doc Cut-?off"));
  d.cargoCutOff = normDateTime(after(text, "Port Cargo Cut-?off")) || normDateTime(after(text, "VGM Cut-?off"));

  d.etd = normDate(after(text, "Proforma 1st vessel ETD"));
  if (!d.etd) {
    const l = after(text, "Trunk Vessel[^\\n]*Latest ETA/ETD");
    const m = String(l || "").match(/\/\s*(\d{1,2}[A-Za-z]{3}\d{2})/);
    if (m) d.etd = normDate(m[1]);
  }
  // "POD / DEL ETA : 07Aug26 / 07Aug26"
  const pod = after(text, "POD / DEL ETA");
  if (pod) d.eta = normDate(pod.split("/")[0]);

  return d;
}

// ---------------------------------------------------------------- generic

function parseGeneric(text) {
  const d = {};
  d.bookingNumber = after(text, String.raw`Booking (?:No|Number|Reference)\.?`);
  d.bookingDate = normDate(after(text, "Booking Date"));
  d.vesselName = after(text, String.raw`Vessel(?: Name)?`, { stop: /voyage/i });
  d.voyageNumber = after(text, String.raw`Voy(?:age)?\.? ?(?:No|Number)?\.?`);
  d.portOfLoading = titleCity(after(text, String.raw`Port of Loading`, { stop: /terminal|est\./i }));
  d.portOfDestination = titleCity(after(text, String.raw`Port of Disch(?:arge|arging)`, { stop: /terminal|est\./i }));
  d.placeOfDelivery = clean(after(text, String.raw`(?:Place of Delivery|Final Destination)`, { stop: /terminal/i }));
  d.freightForwarder = after(text, String.raw`(?:Freight )?Forwarder`);
  d.commodity = after(text, "Commodity");
  d.erd = normDate(after(text, String.raw`(?:ERD|Empty Pick ?Up Date|First Receiving)`));
  d.docsCutOff = normDateTime(after(text, String.raw`(?:Doc(?:ument)?s? Cut-?off|SI Cut-?off)`));
  d.cargoCutOff = normDateTime(after(text, String.raw`(?:Cargo Cut-?off|Port Cargo Cut-?off|Cut-?off)`));
  d.etd = normDate(after(text, "ETD"));
  d.eta = normDate(after(text, "ETA"));
  const tot = text.match(/(?:Total Container\s*\(?s?\)?|No\.? of Containers)\s*:?\s*(\d+)/i);
  if (tot) d.bookedContainers = parseInt(tot[1], 10);
  return d;
}


// Words that turn up in table headers and must never be mistaken for a vessel.
const NOT_A_VESSEL = /^(?:VESSEL|VOYAGE|NAME|MODE|FROM|TO|ETD|ETA|PORT|TERMINAL|DEPARTURE|ARRIVAL|TRANSPORT|PLAN|SERVICE|LOAD|DISCHARGE|N\/A|TBN|TBA)\b/i;

/**
 * Last-resort vessel / voyage lookup.
 *
 * Each carrier's transport-plan table is matched by a tight pattern above, but
 * those tables change between document versions and the tight pattern then
 * silently yields nothing. This fills the gap from labelled fields, then from a
 * looser scan of the plan, so a layout tweak degrades instead of losing the
 * vessel entirely.
 *
 * Only fills what's still missing — it never overrides a carrier-specific match.
 */
function fillVesselVoyage(text, d) {
  if (!d.vesselName) {
    const m = text.match(/\bVessel(?:\s*Name)?\s*(?:\/\s*Voyage)?\s*[:\-]?[ \t]*([A-Z][A-Z0-9 .'\/-]{3,40}?)(?=\s{2,}|\n|$)/i);
    const v = m && clean(m[1]);
    if (v && !NOT_A_VESSEL.test(v)) d.vesselName = v;
  }

  if (!d.voyageNumber) {
    const m = text.match(/\bVoy(?:age)?\.?\s*(?:No\.?|Number)?\s*[:\-]?[ \t]*([0-9]{2,4}[A-Z]{0,2}|[A-Z]{2}[0-9]{2,4}[A-Z]?)\b/i);
    if (m) d.voyageNumber = clean(m[1]);
  }

  // Transport-plan row without relying on the mode code: NAME  VOYAGE  YYYY-MM-DD
  //
  // Separators are [ \t] rather than \s: \s matches newlines, which let this
  // swallow the heading on the line above and report
  // "INTENDED TRANSPORT PLAN MAERSK ESSEX" as the vessel.
  if (!d.vesselName || !d.voyageNumber) {
    const m = text.match(
      /^[^\n]*?\b([A-Z][A-Z0-9.'-]{2,}(?:[ \t]+[A-Z0-9.'-]+){0,3})[ \t]+([0-9]{2,4}[A-Z]{0,2})[ \t]+(\d{4}-\d{2}-\d{2})/m
    );
    if (m) {
      // Drop a leading mode code (MVS = motor vessel, TRK = truck, RAI = rail,
      // BAR = barge, FEE = feeder) if the row starts with one.
      const name = clean(m[1]).replace(/^(?:MVS|TRK|RAI|BAR|FEE|VSL)\b[ \t]*/i, "");
      if (name && !NOT_A_VESSEL.test(name)) {
        if (!d.vesselName) d.vesselName = name;
        if (!d.voyageNumber) d.voyageNumber = clean(m[2]);
      }
    }
  }

  return d;
}

// ---------------------------------------------------------------- entry point

export function detectCarrier(text) {
  const t = text.toUpperCase();
  if (/\bMAERSK\b/.test(t) && /BOOKING CONFIRMATION/.test(t) && /INTENDED TRANSPORT PLAN|BOOKED BY PARTY/.test(t)) return "MAERSK";
  if (/MEDITERRANEAN SHIPPING|(^|\W)MSC(\W|$)/.test(t) && /BOOKING REFERENCE/.test(t)) return "MSC";
  if (/OCEAN NETWORK EXPRESS|BOOKING RECEIPT NOTICE|\bONE LINE\b/.test(t)) return "ONE";
  return "GENERIC";
}

/**
 * Parses booking-confirmation text into the fields the tracking sheet needs.
 * @returns {{carrier: string, data: object, missing: string[]}}
 */
export function parseBookingText(text) {
  const carrier = detectCarrier(text);
  const data =
    carrier === "MAERSK" ? parseMaersk(text) :
    carrier === "MSC" ? parseMsc(text) :
    carrier === "ONE" ? parseOne(text) :
    parseGeneric(text);

  // Fill vessel / voyage from labelled fields if the carrier pattern missed them.
  fillVesselVoyage(text, data);

  // Normalise every field the app reads, not just the ones this parser set —
  // a key the parser never touched used to come back `undefined` rather than null.
  const FIELDS = [
    "bookingNumber", "bookingDate", "shippingLine", "freightForwarder",
    "vesselName", "voyageNumber", "portOfLoading", "portOfDestination",
    "placeOfDelivery", "bookedContainers", "containerType", "commodity",
    "serviceContract", "grossWeightKg", "erd", "docsCutOff", "cargoCutOff",
    "etd", "eta",
  ];
  for (const k of FIELDS) {
    if (data[k] === "" || data[k] === undefined) data[k] = null;
  }

  const wanted = ["bookingNumber", "vesselName", "voyageNumber", "portOfLoading", "portOfDestination", "bookedContainers"];
  const missing = wanted.filter(k => data[k] == null);

  data.containers = [];
  return { carrier, data, missing };
}
