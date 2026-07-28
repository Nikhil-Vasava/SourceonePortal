/**
 * Generates test booking confirmations in the Maersk, MSC and ONE layouts
 * with randomised data, so the Booking import can be exercised without
 * needing real carrier documents.
 *
 *   npm run samples            -> 3 per carrier into ./samples
 *   npm run samples -- 5       -> 5 per carrier
 *   npm run samples -- 3 out   -> 3 per carrier into ./out
 */
import fs from "fs";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const PER_CARRIER = Number(process.argv[2]) || 3;
const OUT_DIR = path.resolve(process.argv[3] || "samples");

// ------------------------------------------------------------------ random data

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const int = (lo, hi) => Math.floor(Math.random() * (hi - lo + 1)) + lo;

const VESSELS = [
  "MAERSK RIO BRAVO", "MAERSK RIO DELTA", "MSC DURBAN IV", "MSC SARISKA V",
  "ONE APUS", "CAPE FORBY", "SEASPAN HAMBURG", "NORTHERN JUVENILE",
  "BREMEN BELLE", "TIGER SUN", "CONTI CORDOBA", "KOTA NAGA",
];

const PORTS = [
  { city: "Auckland", country: "New Zealand", terminal: "FERGUSSON CONTAINER TERMINAL" },
  { city: "Tauranga", country: "New Zealand", terminal: "PORT OF TAURANGA" },
  { city: "Lyttelton", country: "New Zealand", terminal: "LYTTELTON CONTAINER TERMINAL" },
  { city: "Napier", country: "New Zealand", terminal: "NAPIER PORT" },
  { city: "Nelson", country: "New Zealand", terminal: "PORT NELSON" },
];

const DEST_PORTS = [
  { city: "Laem Chabang", country: "Thailand", delivery: "Lat Krabang, Bangkok, Thailand" },
  { city: "Tuticorin", country: "India", delivery: "Tuticorin" },
  { city: "Nhava Sheva", country: "India", delivery: "Nhava Sheva" },
  { city: "Port Klang", country: "Malaysia", delivery: "Port Klang" },
  { city: "Jakarta", country: "Indonesia", delivery: "Jakarta" },
  { city: "Shanghai", country: "China", delivery: "Shanghai" },
];

const COMMODITIES = [
  "Plastic, plastic articles, used", "WASTE PAPER & SCRAP, OF",
  "LDPE film scrap, baled", "HDPE regrind, bulk",
  "PP raffia bales", "Mixed paper, sorted office",
  "PET flake, washed clear", "Aluminium UBC scrap, baled",
];

const TRANSHIP = ["Pelabuhan Tanjung Pelepas", "Singapore", "Port Klang", "Colombo", "Melbourne"];

const pad = (n) => String(n).padStart(2, "0");
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const dmy = (d) => `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
const ddMonYY = (d) => `${pad(d.getUTCDate())}${MON[d.getUTCMonth()]}${String(d.getUTCFullYear()).slice(-2)}`;

/** One randomised shipment, shared by all three layout writers. */
function makeShipment() {
  const pol = pick(PORTS);
  const pod = pick(DEST_PORTS);
  const base = new Date(Date.UTC(2026, int(0, 11), int(1, 25), 12));

  const erd = addDays(base, int(3, 8));
  const cargoCutOff = addDays(erd, int(4, 7));
  const docsCutOff = addDays(cargoCutOff, -int(1, 3));
  const etd = addDays(cargoCutOff, int(1, 4));
  const eta = addDays(etd, int(18, 45));

  return {
    pol, pod,
    bookingDate: base,
    erd, cargoCutOff, docsCutOff, etd, eta,
    vessel: pick(VESSELS),
    voyage: `${int(600, 799)}${pick(["N", "W", "E", "S"])}`,
    tranship: pick(TRANSHIP),
    containers: int(1, 8),
    commodity: pick(COMMODITIES),
    weightKg: int(18, 28) * 1000,
    forwarder: "SOURCEONE VENTURES NZ LIMITED",
  };
}

// ------------------------------------------------------------------ pdf helpers

const W = 842, H = 595;   // landscape suits these wide carrier forms
const CH = 4.6;           // must match lib/pdf-text.js so columns line up

async function newDoc() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([W, H]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  return { doc, page, font, bold };
}

/** Writes text at a character column, so extraction rebuilds the same layout. */
function makeWriter(page, font, bold) {
  let y = H - 40;
  const at = (col, text, { b = false, size = 8 } = {}) => {
    if (text == null || text === "") return;
    page.drawText(String(text), {
      x: col * CH, y, size, font: b ? bold : font, color: rgb(0, 0, 0),
    });
  };
  return {
    at,
    row(items) { for (const [col, text, o] of items) at(col, text, o); this.down(); },
    down(n = 1) { y -= 13 * n; },
  };
}

// ------------------------------------------------------------------ Maersk

async function maersk(s) {
  const { doc, page, font, bold } = await newDoc();
  const w = makeWriter(page, font, bold);
  const bookingNo = String(int(200000000, 299999999));

  w.at(70, "BOOKING CONFIRMATION", { b: true, size: 11 }); w.down(2);
  w.row([[8, "Booking No.:", { b: true }], [90, "Print Date:", { b: true }], [110, `${iso(s.bookingDate)} 09:${pad(int(10, 59))} UTC`]]);
  w.row([[8, bookingNo]]);
  w.row([[8, "Booked by Party:", { b: true }], [40, s.forwarder], [90, "Service Mode:", { b: true }], [110, "CY/CY"]]);
  w.row([[8, "Contact Name:", { b: true }], [40, "NISANTH KUMAR"], [90, "From:", { b: true }], [110, `${s.pol.city},${s.pol.country}`]]);
  w.row([[8, "Booked by Ref. No:", { b: true }], [90, "To:", { b: true }], [110, `${s.pod.city},${s.pod.country}`]]);
  w.row([[8, "Service Contract:", { b: true }], [40, String(int(300000000, 399999999))], [90, "Cargo Detail:", { b: true }]]);
  w.row([[8, "Price Owner:", { b: true }], [40, s.forwarder], [90, "Business Unit:", { b: true }], [110, "Maersk New Zealand (Auckland)"]]);
  w.row([[8, "Named Account Customer:", { b: true }], [90, "Commodity Description:", { b: true }], [118, s.commodity]]);
  w.down();
  w.at(8, "We request you to review the specific parameters, viz. Service Contract, Price Owner, Named account customer and Commodity", { size: 7 });
  w.down(2);

  w.at(80, "Equipment", { b: true }); w.down();
  w.row([[8, "Quantity", { b: true }], [24, "Size/Type/Height", { b: true }], [48, "(ft.in) Collapsible", { b: true }],
         [70, "Sub. Equip", { b: true }], [86, "Gross Weight", { b: true }], [108, "Pack. Qty/Kind", { b: true }], [128, "Cargo Volume", { b: true }]]);
  w.row([[9, String(s.containers)], [24, "40 DRY 9 6"], [86, `${s.weightKg * s.containers}.000 KGS`], [108, `${s.containers} Piece(s)`]]);
  w.down();

  w.at(78, "Intended Transport Plan", { b: true }); w.down();
  w.at(84, "Load Itinerary", { b: true }); w.down();
  w.row([[8, "Type", { b: true }], [30, "Location", { b: true }], [62, "Release Date", { b: true }], [80, "From", { b: true }],
         [90, "To", { b: true }], [100, "Return Date", { b: true }], [120, "Time", { b: true }]]);
  w.row([[8, "Empty Container"], [30, `${s.pol.city} Depot`], [62, iso(s.erd)], [120, "13:00"]]);
  w.row([[8, "Depot"], [30, `${s.pol.city} Depot`]]);
  w.row([[8, "Return Equip"], [30, s.pol.terminal]]);
  w.row([[8, "Delivery Terminal"], [30, s.pol.terminal]]);
  w.down();

  w.row([[8, "From", { b: true }], [30, "To", { b: true }], [56, "Mode", { b: true }], [66, "Vessel", { b: true }],
         [100, "Voy No.", { b: true }], [112, "ETD", { b: true }], [132, "ETA", { b: true }]]);
  const midEta = addDays(s.etd, int(10, 20));
  w.row([[8, `${s.pol.city} Container`], [30, s.tranship], [56, "MVS"], [66, s.vessel],
         [100, s.voyage], [112, iso(s.etd)], [132, iso(midEta)]]);
  w.row([[8, "Terminal"], [30, "Terminal"]]);
  const feeder = pick(VESSELS.filter(v => v !== s.vessel));
  w.row([[8, s.tranship], [30, `${s.pod.city.toUpperCase()} PORT`], [56, "MVS"], [66, feeder],
         [100, `${int(600, 799)}W`], [112, iso(addDays(midEta, 2))], [132, iso(s.eta)]]);

  const bytes = await doc.save();
  return {
    bytes, bookingNo, carrier: "MAERSK",
    expect: {
      bookingNumber: bookingNo, vesselName: s.vessel, voyageNumber: s.voyage,
      portOfLoading: s.pol.city, portOfDestination: s.pod.city,
      bookedContainers: s.containers, erd: iso(s.erd), etd: iso(s.etd), eta: iso(s.eta),
    },
  };
}

// ------------------------------------------------------------------ MSC

async function msc(s) {
  const { doc, page, font, bold } = await newDoc();
  const w = makeWriter(page, font, bold);
  const bookingNo = `EBKG${int(10000000, 99999999)}`;

  w.at(6, "BOOKING CONFIRMATION", { b: true, size: 10 });
  w.at(120, s.forwarder, { size: 7 }); w.down();
  w.at(120, "1/14 GREENVALLEY ROSE, GLENFIELD", { size: 7 }); w.down();
  w.at(120, "Auckland, 0629", { size: 7 }); w.down(2);
  w.at(6, "MSC MEDITERRANEAN SHIPPING COMPANY S.A. (MSC) is herewith pleased to confirm your booking based on the information you communicated to us", { size: 6.5 });
  w.down(2);

  w.row([[8, "BOOKING REFERENCE", { b: true }], [72, "ORIGINAL/SEA WAYBILL(**)", { b: true }], [110, `MEDUWM${int(100000, 999999)}`], [132, "BOOKING DATE", { b: true }]]);
  w.row([[26, bookingNo]]);
  w.row([[8, "VALID FOR GATE-IN(*)", { b: true }], [72, "NUMBER", { b: true }], [132, dmy(s.bookingDate)]]);
  w.down();
  w.at(40, s.forwarder, { size: 7.5 }); w.down();
  w.at(40, "1/14 GREENVALLEY ROSE, GLENFIELD", { size: 7.5 }); w.down();
  w.row([[8, "BOOKING CLIENT", { b: true }], [40, "AUCKLAND, 0629, PHONE:+64273501499"]]);
  w.row([[8, "SHIPPER", { b: true }]]);
  w.down();
  w.row([[8, "SERVICE CONTRACT/RATE REF. N*", { b: true }], [56, `FRT${int(100, 999)}RR${int(1, 9)}XX`], [104, "EDI TRANSACTION N*", { b: true }], [136, bookingNo]]);
  w.row([[8, "FREIGHT PAYMENT TERMS", { b: true }], [56, "PREPAID"], [104, "FREIGHT PAYABLE AT", { b: true }]]);
  w.row([[8, "GATE IN AT TERMINAL/DEPOT", { b: true }], [56, s.pol.terminal]]);
  w.down();
  w.row([[8, "PORT OF LOADING", { b: true }], [56, s.pol.city.toUpperCase()], [104, "EST. TIME OF ARRIVAL/DEPARTURE", { b: true }],
         [140, `${dmy(addDays(s.etd, -1))} 19:00`], [156, `${dmy(s.etd)} 19:00`]]);
  w.row([[8, "VESSEL NAME", { b: true }], [56, `${s.vessel} (LLOYDS NO. ${int(9000000, 9999999)}) / LR`], [104, "VOYAGE NUMBER", { b: true }], [140, s.voyage]]);
  w.down();
  w.row([[8, "TRANSHIPMENT PORTS", { b: true }], [56, s.tranship.toUpperCase()]]);
  w.down();
  w.row([[8, "PORT OF DISCHARGE", { b: true }], [56, s.pod.city.toUpperCase()], [104, "EST. TIME OF ARRIVAL", { b: true }], [140, `${dmy(s.eta)} 22:00`]]);
  w.row([[8, "TERMINAL OF DISCHARGE", { b: true }]]);
  w.row([[8, "FINAL DESTINATION", { b: true }], [56, s.pod.delivery.toUpperCase()]]);
  w.row([[104, "CARRIER'S HAULAGE BY", { b: true }], [140, "RAL"]]);
  w.down();
  w.row([[8, "TOTAL CONTAINER (S)", { b: true }], [56, String(s.containers)], [64, "TEUS", { b: true }], [74, String(s.containers * 2)],
         [82, "OUT OF WHICH IMO/HAZ", { b: true }], [116, "0"], [124, "REEFER", { b: true }], [136, "0"]]);
  w.down(2);
  w.row([[40, "GATE-IN AT TERMINAL/DEPOT", { b: true }], [86, "First Receiving(Date/Time)", { b: true }], [124, "CUT-OFF(Date/Time)", { b: true }]]);
  w.row([[8, "DRY"], [86, `${dmy(s.erd)} 00:01`], [124, `${dmy(s.cargoCutOff)} 10:00`]]);
  w.row([[8, "REEFER"], [86, `${dmy(s.erd)} 00:01`], [124, `${dmy(s.cargoCutOff)} 10:00`]]);
  w.down();
  w.row([[8, "SHIPPING INSTRUCTIONS CUT-OFF", { b: true }], [86, `${dmy(s.docsCutOff)} 10:00`]]);
  w.row([[8, "VERIFIED GROSS MASS CONFIRMATION(SOLAS) CUT-OFF", { b: true }], [86, `${dmy(s.cargoCutOff)} 10:00`]]);

  const bytes = await doc.save();
  return {
    bytes, bookingNo, carrier: "MSC",
    expect: {
      bookingNumber: bookingNo, vesselName: s.vessel, voyageNumber: s.voyage,
      portOfLoading: s.pol.city.toUpperCase(), portOfDestination: s.pod.city.toUpperCase(),
      bookedContainers: s.containers, erd: iso(s.erd), etd: iso(s.etd), eta: iso(s.eta),
      docsCutOff: `${iso(s.docsCutOff)} 10:00`, cargoCutOff: `${iso(s.cargoCutOff)} 10:00`,
    },
  };
}

// ------------------------------------------------------------------ ONE

async function one(s) {
  const { doc, page, font, bold } = await newDoc();
  const w = makeWriter(page, font, bold);
  const bookingNo = `AKLG${int(10000000, 99999999)}`;

  w.at(110, bookingNo, { size: 8 }); w.down();
  w.at(40, "Booking Receipt Notice", { b: true, size: 11 }); w.down();
  w.at(100, `${pad(s.bookingDate.getUTCDate())} ${MON[s.bookingDate.getUTCMonth()].toUpperCase()} ${String(s.bookingDate.getUTCFullYear()).slice(-2)} 14:15   Page : 1/2`, { size: 7 });
  w.down(2);
  w.at(6, "To    :", { size: 7.5 });
  w.at(20, "Nikhilkumar, Vasava / SOURCEONE VENTURES NZ LTD", { size: 7.5 }); w.down();
  w.at(6, "From :", { size: 7.5 });
  w.at(20, "OCEAN NETWORK EXPRESS (NEW ZEALAND) LIMITED / ONE NZBOOKING", { size: 7.5 }); w.down(2);

  w.row([[6, "Booking No", { b: true }], [22, `: ${bookingNo}`], [48, "Booking Ref. No.", { b: true }], [70, `: ${bookingNo}`],
         [100, "Booking Date", { b: true }], [120, `: ${ddMonYY(s.bookingDate)}`]]);
  w.row([[6, "Booking Staff", { b: true }], [28, ": WEB_SAS"], [72, "Export Ref.NO", { b: true }], [100, ":"]]);
  w.row([[6, "Sales Rep", { b: true }], [28, ": DAMON WYLLIE"], [72, "B/L No.", { b: true }], [100, `: ONEY${bookingNo}`]]);
  w.row([[6, "Shipper", { b: true }], [28, ": SOURCEONE VENTURES NZ LTD"]]);
  w.row([[6, "Forwarder", { b: true }], [28, ": SOURCEONE VENTURES NZ LTD"], [72, "Rate Agreement No.", { b: true }], [100, `: TAKL${int(100000, 999999)}A`]]);
  w.row([[6, "Pre Carrier", { b: true }], [28, ":"], [76, "Latest ETA/ETD", { b: true }], [96, ":"]]);
  w.row([[6, "Trunk Vessel", { b: true }], [28, `: ${s.vessel} ${s.voyage}(NZ1)`], [76, "Latest ETA/ETD", { b: true }],
         [96, `: ${ddMonYY(addDays(s.etd, -2))}/${ddMonYY(s.etd)}`]]);
  w.row([[6, "IMO/Flag/Call Sign", { b: true }], [28, `: ${int(9000000, 9999999)}/SINGAPORE/9V${int(1000, 9999)}`], [76, "NRT", { b: true }], [96, `: ${int(10000, 49999)}`]]);
  w.row([[6, "Place of Receipt", { b: true }], [28, `: ${s.pol.city.toUpperCase()}`], [76, "Proforma 1st vessel ETD", { b: true }], [102, `: ${ddMonYY(s.etd)}`]]);
  w.row([[6, "Port of Loading", { b: true }], [28, `: ${s.pol.city.toUpperCase()}`], [76, "Terminal", { b: true }], [90, `: ${s.pol.terminal}`]]);
  w.row([[6, "Port of Discharging", { b: true }], [28, `: ${s.pod.city.toUpperCase()}`], [76, "Terminal", { b: true }], [90, ": GATEWAY TERMINAL"]]);
  w.row([[6, "Place of Delivery", { b: true }], [28, `: ${s.pod.delivery.toUpperCase()}`], [76, "Terminal", { b: true }], [90, ":"]]);
  w.row([[6, "T/S Port", { b: true }], [28, `: ${s.tranship.toUpperCase()}`], [76, "POD / DEL ETA", { b: true }], [96, `: ${ddMonYY(s.eta)}   / ${ddMonYY(s.eta)}`]]);
  w.row([[6, "Ocean Route Type", { b: true }], [28, ": Non-direct"], [76, "Rcv/Del Term", { b: true }], [96, ": CY/CY"]]);
  w.row([[6, "Equipment Type/Q'ty", { b: true }], [28, `: 40'DRY HC.-${s.containers}`]]);
  w.row([[6, "Commodity", { b: true }], [28, `: ${s.commodity}`], [72, "Estimated Weight", { b: true }], [98, `: ${(s.weightKg * s.containers).toLocaleString("en-US")}.000 KGS`]]);
  w.row([[6, "Empty Pick UP CY", { b: true }], [28, ": METROBOX SAVILL DRIVE"], [72, "Empty Pick Up Date", { b: true }], [98, `: ${ddMonYY(s.erd)}`]]);
  w.row([[6, "Full Return CY", { b: true }], [28, ": METROPORT"], [72, "Full Return Date", { b: true }], [98, ":"]]);
  w.row([[6, "Doc Cut-off", { b: true }], [28, `: ${ddMonYY(s.docsCutOff)} 12:00`], [72, "Customs Cut-off", { b: true }], [98, ":"]]);
  w.row([[6, "VGM Cut-off", { b: true }], [28, `: ${ddMonYY(s.cargoCutOff)} 17:00`]]);
  w.row([[6, "Port Cargo Cut-off", { b: true }], [28, `: ${ddMonYY(s.cargoCutOff)} 16:00`], [72, "Rail Receiving Date", { b: true }], [98, ": ~"]]);

  const bytes = await doc.save();
  return {
    bytes, bookingNo, carrier: "ONE",
    expect: {
      bookingNumber: bookingNo, vesselName: s.vessel, voyageNumber: s.voyage,
      portOfLoading: s.pol.city.toUpperCase(), portOfDestination: s.pod.city.toUpperCase(),
      bookedContainers: s.containers, erd: iso(s.erd), etd: iso(s.etd), eta: iso(s.eta),
      docsCutOff: `${iso(s.docsCutOff)} 12:00`, cargoCutOff: `${iso(s.cargoCutOff)} 16:00`,
    },
  };
}

// ------------------------------------------------------------------ main

export async function generate(perCarrier = 3, outDir = OUT_DIR) {
  fs.mkdirSync(outDir, { recursive: true });
  const made = [];
  const writers = [["maersk", maersk], ["msc", msc], ["one", one]];

  for (const [name, fn] of writers) {
    for (let i = 0; i < perCarrier; i++) {
      const r = await fn(makeShipment());
      const file = path.join(outDir, `${name}-${r.bookingNo}.pdf`);
      fs.writeFileSync(file, r.bytes);
      made.push({ file, ...r });
    }
  }
  return made;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const made = await generate(PER_CARRIER, OUT_DIR);
  console.log(`Created ${made.length} sample bookings in ${OUT_DIR}`);
  for (const m of made) console.log("  " + path.basename(m.file));
}
