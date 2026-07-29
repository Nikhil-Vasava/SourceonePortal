import { prisma } from "@/lib/db";
import { nextBookingNumber } from "@/lib/numbering";

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
