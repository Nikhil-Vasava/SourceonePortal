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

/** How far before departure the empty containers are collected. */
export const ERD_DAYS_BEFORE_ETD = 14;

/**
 * ERD, calculated rather than read.
 *
 * The carriers do print an empty release date, but not dependably — ONE prints
 * "Empty Pick Up Date :" and routinely leaves it blank, and the three carriers
 * label and place it differently enough that a miss looks identical to a
 * genuinely empty field. A booking with no ERD gets no empty-pickup clock and
 * no notice to operations, silently, which is the worst of both.
 *
 * So it comes off the vessel's departure instead: fourteen days before ETD.
 * ETD is on every booking, in a field the parsers already read reliably.
 *
 * Deliberately NOT derived from ETA. ETA is arrival at the destination — on a
 * New Zealand to India run that is three to five weeks after loading, so
 * counting back from it would place the pickup date mid-voyage, after the
 * containers had already sailed.
 *
 * Anyone can still correct it by hand: the value is written to the booking on
 * import, and Edit overwrites it like any other field.
 *
 * @param etd "YYYY-MM-DD", as the parsers produce it
 * @returns   "YYYY-MM-DD", or null when there is no ETD to count back from
 */
export function deriveErd(etd, days = ERD_DAYS_BEFORE_ETD) {
  const iso = normDate(etd);
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  // Midday UTC, matching how the app stores dates everywhere else — it keeps
  // the day from shifting either side of the dateline.
  const t = new Date(Date.UTC(y, m - 1, d, 12));
  t.setUTCDate(t.getUTCDate() - days);
  return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

const titleCity = (v) => {
  const s = clean(v);
  if (!s) return null;
  return s.split(",")[0].replace(/\s+(CONTAINER\s+)?TERMINAL\b.*$/i, "").trim() || null;
};

/**
 * The empty-container depot — where a driver collects the empty box.
 *
 * Unlike the other fields this is an ADDRESS, so it runs over several lines and
 * has to be gathered as a block rather than read off one labelled line. All
 * three carriers print it, in three different shapes:
 *
 *   Maersk  a Type/Location table row, the label itself wrapped over two lines,
 *           the depot name repeated, and a container count in a third column
 *   ONE     "Empty Pick UP CY : <name>" followed by "Address : <street>"
 *   MSC     buried in REMARKS, after "PICK UP DEPOT ADDRESS:"
 *
 * Everything here is defensive: a pattern that doesn't match returns null and
 * the field stays blank for someone to type in, exactly as it does today. A
 * wrong depot address would send a truck to the wrong yard, so a miss is much
 * cheaper than a guess.
 */
function depotBlock(text, startRe, { stop, stripLabel, max = 4 } = {}) {
  const m = text.match(startRe);
  if (!m) return null;

  const rest = text.slice(m.index + m[0].length);
  const stopAt = stop ? rest.search(stop) : -1;
  const block = stopAt > 0 ? rest.slice(0, stopAt) : rest;

  const lines = [];
  for (const raw of block.split("\n")) {
    // The label's own second line, where a narrow column wrapped it.
    let s = stripLabel ? raw.replace(stripLabel, "") : raw;

    // Take the FIRST COLUMN only.
    //
    // These pages are laid out in columns, and the extracted text keeps the
    // gaps as runs of spaces. Whatever sits to the right of the address is a
    // different field — Maersk puts the pick-up date/time there, ONE puts the
    // next column's label. Both were ending up inside the address:
    //
    //   "CC Woolston Container Park (WCP)    2026-08-11 00:00"
    //   "METROBOX SAVILL DRIVE               Empty Pick Up Date"
    //
    // Two or more spaces means a new column; inside an address the words are
    // separated by one. This has to run on the RAW line, before clean()
    // collapses the gap that distinguishes them.
    const body = clean(firstColumn(s));
    if (body === null) {
      // A blank line ends the address — unless nothing has been collected yet,
      // because the value may simply start on the line below the label.
      if (lines.length) break;
      continue;
    }

    // A PO Box is a postal address; nobody collects a container from one.
    if (/^P\.?O\.?\s*BOX\b/i.test(body)) continue;
    // The next labelled field has started.
    if (/^[A-Z][A-Za-z ()'/-]{2,30}\s*:/.test(body) && lines.length) break;
    // Free text has started. MSC's depot sits in REMARKS with the carrier's
    // standard notices after it, and there's no blank line between them.
    //
    // The length half of the test is skipped for the first line, which is the
    // value by construction: a depot that extracts onto one line runs to about
    // 59 characters already, and a cap that close to real data would eventually
    // throw away a genuine address.
    if (isProse(body, { checkLength: lines.length > 0 })) break;

    // Carriers repeat the depot name on the line below it.
    if (lines[lines.length - 1]?.toLowerCase() === body.toLowerCase()) continue;

    lines.push(body);
    if (lines.length >= max) break;
  }

  return lines.length ? lines.join(", ") : null;
}

/** The leftmost column of a line laid out with whitespace gaps. */
function firstColumn(s) {
  return String(s ?? "").trim().split(/\s{2,}/)[0];
}

/**
 * A sentence rather than a line of an address.
 *
 * Two independent signals. The words are ones that turn up in carrier
 * boilerplate and never in a New Zealand depot address, and are safe to test
 * anywhere. Length is the weaker signal and is only applied once at least one
 * line has been taken — a depot that extracts onto a single line already runs
 * to 59 characters, so a cap tight enough to be useful sits uncomfortably close
 * to real data.
 */
function isProse(s, { checkLength = true } = {}) {
  if (/\b(if|please|must|will|shall|should|shipment|cargo|countries|effective|notice|subject)\b/i.test(s)) {
    return true;
  }
  return checkLength && s.length > 60;
}

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

  // ERD is not read from the document — see deriveErd() at the foot of this file.

  // Empty depot, from the Type / Location table.
  //
  // The Type column is narrow, so the label wraps: "Empty Container" on one
  // line and "Depot" on the next — with the first line of the ADDRESS sitting
  // beside each of them. The label is therefore not contiguous in the text and
  // can't be matched as one string.
  //
  // Two anchors, in order of preference:
  //   "Empty Container Depot" on one line, or
  //   "Empty Container" whose next line begins with "Depot".
  // The lookahead in the second is what keeps this off Maersk's OTHER "Empty
  // Container …" line, the one carrying a pick-up date. That line is no longer
  // read for anything, but it still sits in the text waiting to be mistaken
  // for this one.
  d.emptyDepot = depotBlock(
    text,
    /^[ \t]*Empty[ \t]+Container[ \t]+Depot\b[ \t]*:?|^[ \t]*Empty[ \t]+Container\b(?=[^\n]*\n[ \t]*Depot\b)/im,
    {
      // The row below is the RETURN depot — a different yard entirely.
      stop: /Return\s+Equip|Return\s+Container|Terminal\s+Cut|^\s*Type\b/im,
      // Drop the wrapped half of the label off the start of the second line.
      stripLabel: /^[ \t]*Depot\b[ \t]*:?[ \t]*/i,
    }
  );

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
    // cut[2] is first receiving. It is NOT taken as ERD — see deriveErd().
    d.cargoCutOff = normDateTime(cut[3]);
    d.containerType = cut[1].toUpperCase() === "DRY" ? "DRY" : cut[1];
  }
  const si = text.match(/SHIPPING INSTRUCTIONS CUT-?OFF[^\n]*?(\d{1,2}\/\d{1,2}\/\d{4}[^\n]*?\d{2}:\d{2})/i)
          || text.match(/(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{2}:\d{2})\s*\n\s*SHIPPING INSTRUCTIONS CUT-?OFF/i);
  if (si) d.docsCutOff = normDateTime(si[1]);

  // MSC hides the depot in the free-text REMARKS block, marked with an
  // asterisk: "(*) PICK UP DEPOT ADDRESS:MIRRIELEES RD / SULPHER POINT /
  // TAURANGA". Note there is often no space after the colon.
  d.emptyDepot = depotBlock(text, /PICK[ \t]*UP[ \t]*DEPOT[ \t]*ADDRESS[ \t]*:/i, {
    stop: /\(\*\)|^\s*REMARKS\b|^\s*[A-Z ]{6,}:/m,
  });

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

  // ERD is not read here — see deriveErd(). ONE prints "Empty Pick Up Date :"
  // and routinely leaves it blank, which is what prompted the change.

  // ONE names the yard and its street address on two consecutive lines:
  //   Empty Pick UP CY : METROBOX SAVILL DRIVE
  //   Address          : 12-18 Savill Drive, Favona, Auckland
  // The yard name alone won't get a driver there, and the street alone loses
  // which operator to quote at the gate, so both are kept.
  //
  // Anchored to the line that follows the CY, not to "Address" on its own —
  // the document carries several other addresses.
  const cy = text.match(
    /Empty[ \t]*Pick[ \t]*UP[ \t]*CY[ \t]*:?[ \t]*([^\n]*)(?:\n[ \t]*Address[ \t]*:?[ \t]*([^\n]*))?/i
  );
  if (cy) {
    // First column only. ONE prints the next field's label in the same row —
    // the raw line reads "METROBOX SAVILL DRIVE        Empty Pick Up Date" —
    // and without this cut that label ends up inside the depot name.
    const parts = [clean(firstColumn(cy[1])), clean(firstColumn(cy[2]))].filter(Boolean);
    // The yard name is often the first words of the address as well.
    if (parts.length === 2 && parts[1].toLowerCase().includes(parts[0].toLowerCase())) {
      parts.shift();
    }
    d.emptyDepot = parts.length ? parts.join(", ") : null;
  }

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
  // ERD is not read here either — see deriveErd().
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

  // ERD is calculated, never read.
  data.erd = deriveErd(data.etd);

  // Normalise every field the app reads, not just the ones this parser set —
  // a key the parser never touched used to come back `undefined` rather than null.
  const FIELDS = [
    "bookingNumber", "bookingDate", "shippingLine", "freightForwarder",
    "vesselName", "voyageNumber", "portOfLoading", "portOfDestination",
    "placeOfDelivery", "bookedContainers", "containerType", "commodity",
    "serviceContract", "grossWeightKg", "erd", "docsCutOff", "cargoCutOff",
    "etd", "eta", "emptyDepot",
  ];
  for (const k of FIELDS) {
    if (data[k] === "" || data[k] === undefined) data[k] = null;
  }

  const wanted = ["bookingNumber", "vesselName", "voyageNumber", "portOfLoading", "portOfDestination", "bookedContainers"];
  const missing = wanted.filter(k => data[k] == null);

  data.containers = [];
  return { carrier, data, missing };
}
