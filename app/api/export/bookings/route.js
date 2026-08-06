// Shipment schedule export — spreadsheet or PDF.
//
// POST rather than GET: a selection can be dozens of ids, and a URL long enough
// to hold them all is fragile. The form posts the ticked rows plus the filters
// that were on screen, so "export" always means "what I am looking at".

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getCompany } from "@/lib/company";
const { SHIPMENT_INCLUDE } = require("@/lib/export-columns");
import { readTableQuery, sortRows, searchWhere, dateRangeWhere } from "@/lib/table-query";
const { buildShipmentXlsx } = require("@/lib/export-xlsx");
const { buildShipmentPdf } = require("@/lib/export-pdf");

// Same accessors the Bookings grid sorts by, so the export comes out in the
// order that was on screen.
const SORT = {
  forwarder: b => b.freightForwarder || b.forwarder?.name,
  number: b => b.number,
  line: b => b.shippingLine?.name,
  vessel: b => b.vessel,
  voyage: b => b.voyage,
  pol: b => b.pol,
  pod: b => b.pod,
  delivery: b => b.placeOfDelivery,
  price: b => b.pricePerContainer,
  booked: b => b.bookedContainers,
  loaded: b => b.loadedContainers,
  other: b => b.otherContainers,
  erd: b => b.erd,
  docsCutOff: b => b.docsCutOff,
  cargoCutOff: b => b.cargoCutOff,
  siSentDate: b => b.siSentDate,
  status: b => b.status,
};

export async function POST(request) {
  requireUser();

  const form = await request.formData();
  const format = form.get("format") === "pdf" ? "pdf" : "xlsx";
  const ids = form.getAll("id").map(Number).filter(Number.isFinite);

  const query = readTableQuery({
    q: form.get("q") || undefined,
    from: form.get("from") || undefined,
    to: form.get("to") || undefined,
    sort: form.get("sort") || undefined,
    dir: form.get("dir") || undefined,
  }, { defaultSort: "erd", defaultDir: "desc" });

  // Ticked rows win. With nothing ticked, export the whole filtered view —
  // which is what someone means when they filter and then hit export.
  //
  // Note this deliberately does NOT exclude cancelled bookings. The register
  // shows them, so an export of "everything on screen" that quietly dropped
  // them would not match what the person was looking at.
  const where = ids.length
    ? { id: { in: ids } }
    : {
        ...searchWhere(query.q, [
          "number", "vessel", "voyage", "pol", "pod", "placeOfDelivery",
          "freightForwarder", "commodity",
        ]),
        ...dateRangeWhere("erd", query.from, query.to),
      };

  const [found, company] = await Promise.all([
    prisma.booking.findMany({ where, include: SHIPMENT_INCLUDE }),
    getCompany(),
  ]);

  // The form submit is a real navigation, so a JSON error body would leave the
  // user staring at raw text. Send them back to the register with a message.
  if (!found.length) {
    const back = new URL("/bookings", request.url);
    back.searchParams.set("error", "Nothing to export — no bookings matched.");
    return NextResponse.redirect(back, 303);
  }

  const bookings = sortRows(found, SORT[query.sort] || SORT.erd, query.dir);

  const filterNote = ids.length
    ? `${ids.length} selected`
    : [
        query.q ? `matching "${query.q}"` : null,
        query.from || query.to
          ? `ERD ${query.from || "any"} to ${query.to || "any"}`
          : null,
      ].filter(Boolean).join(", ") || null;

  const stamp = new Date().toISOString().slice(0, 10);
  const base = `SourceOne-Shipment-Schedule-${stamp}`;

  if (format === "pdf") {
    const pdf = await buildShipmentPdf(bookings, company, { filterNote });
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${base}.pdf"`,
        "Content-Length": String(pdf.length),
      },
    });
  }

  const xlsx = await buildShipmentXlsx(bookings, company, { filterNote });
  return new NextResponse(xlsx, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${base}.xlsx"`,
      "Content-Length": String(xlsx.length),
    },
  });
}
