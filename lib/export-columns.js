// The shipment export — one definition, used by both the spreadsheet and the PDF.
//
// Columns and their order match the sheet SourceOne already sends out, so the
// exported file drops straight into the existing workflow. Keeping it in one
// place means the two formats can't drift apart when a column changes.

const fdate = (d) => {
  if (!d) return "";
  const x = new Date(d);
  if (isNaN(x)) return "";
  // "3 August" — how the existing sheet writes dates.
  return x.toLocaleDateString("en-NZ", { day: "numeric", month: "long" });
};

/**
 * `width` is in characters and drives the spreadsheet column width; the PDF
 * divides the page proportionally by the same numbers, so the two line up.
 */
const SHIPMENT_COLUMNS = [
  { key: "shippingLine",  header: "Shipping Line",        width: 20, get: b => b.shippingLine?.name || b.freightForwarder || "" },
  // Booking and voyage references must never wrap — a broken reference number
  // is worse than useless when someone reads it back to a carrier.
  { key: "bookingNumber", header: "Booking Number",       width: 19, get: b => b.number || "" },
  { key: "vessel",        header: "Vessel Name",          width: 21, get: b => b.vessel || "" },
  { key: "voyage",        header: "Voyage Number",        width: 12, get: b => b.voyage || "" },
  { key: "containers",    header: "No Of Containers",     width: 11, align: "center", get: b => b.bookedContainers ?? "" },
  { key: "pol",           header: "Point Of Loading",     width: 15, get: b => b.pol || "" },
  { key: "pod",           header: "Port of Discharge (POD)", width: 16, get: b => b.pod || "" },
  { key: "depot",         header: "Empty Depot",          width: 28, get: b => b.emptyDepot || "" },
  { key: "po",            header: "Purchase Order",       width: 16,
    get: b => (b.purchaseOrders || []).map(p => p.number).join(", ") },
  { key: "erd",           header: "Empty Collection Date", width: 15, align: "center", get: b => fdate(b.erd) },
  { key: "cargoCutOff",   header: "Cargo Cutoff",         width: 13, align: "center", get: b => fdate(b.cargoCutOff) },
  { key: "comments",      header: "Comments",             width: 24, get: b => b.notes || "" },
];

/** Everything an export needs from the database, in one include. */
const SHIPMENT_INCLUDE = {
  shippingLine: true,
  forwarder: true,
  purchaseOrders: { select: { number: true } },
};

/** One booking as a flat array of cell values, in column order. */
function toRow(booking) {
  return SHIPMENT_COLUMNS.map(c => {
    const v = c.get(booking);
    return v === null || v === undefined ? "" : v;
  });
}

const HEADERS = SHIPMENT_COLUMNS.map(c => c.header);

/** Brand colours, as the export documents use them (no "#" — exceljs wants ARGB). */
const EXPORT_COLORS = {
  headerFill: "FF1E4C8F",   // deep brand navy behind the column headings
  headerText: "FFFFFFFF",
  titleText:  "FF1E4C8F",
  bandFill:   "FFF2F6FC",   // zebra striping
  border:     "FFB9C6DA",
};

module.exports = { SHIPMENT_COLUMNS, SHIPMENT_INCLUDE, toRow, HEADERS, EXPORT_COLORS };
