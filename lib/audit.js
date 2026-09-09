import { prisma } from "@/lib/db";
import { getUser } from "@/lib/auth";

/**
 * Recording who changed what.
 *
 * Two rules shape everything here.
 *
 * ONE: a failed audit write must never fail the thing it was recording. If the
 * log table is missing or the insert times out, the purchase order still saves.
 * The alternative — an approval that fails because its audit row failed — turns
 * a record-keeping feature into an outage, so every call swallows its error and
 * complains to the server console instead.
 *
 * TWO: only what changed. Storing the whole record before and after makes the
 * page unreadable at exactly the moment it matters, because "what did Nikhil
 * actually change?" becomes a spot-the-difference puzzle over forty columns.
 */

/** Fields nobody needs to see moved, or must never be written down. */
const IGNORED = new Set([
  "id", "createdAt", "updatedAt",
  "password",          // never, in any form — not even "changed"
  "extractedJson",     // a wall of raw OCR; the file name is the useful part
]);

const isDate = (v) => v instanceof Date;

/** Comparable, readable form of a stored value. */
function show(v) {
  if (v === null || v === undefined || v === "") return null;
  if (isDate(v)) return v.toISOString().slice(0, 10);
  if (typeof v === "boolean") return v ? "yes" : "no";
  return String(v);
}

/**
 * What actually moved between two versions of a record.
 *
 * Compares on the rendered value, so a Date and its own ISO string, or 10 and
 * "10", don't show up as edits. A form round-trip changes the type of nearly
 * every field; without this the log would claim everything changed every time.
 */
export function diff(before, after, ignore = []) {
  const skip = new Set([...IGNORED, ...ignore]);
  const changes = [];
  for (const key of Object.keys(after || {})) {
    if (skip.has(key)) continue;
    const from = show(before?.[key]);
    const to = show(after[key]);
    if (from === to) continue;
    changes.push({ field: key, from, to });
  }
  return changes;
}

/**
 * Write one entry.
 *
 * @param action  CREATE | UPDATE | DELETE | APPROVE | UNAPPROVE | EMAIL | LINK |
 *                UNLINK | IMPORT | RESET
 * @param entity  the model name, e.g. "PurchaseOrder"
 * @param label   what a person calls it: "NZ2609_004"
 * @param summary one plain sentence — this is what the screen shows
 * @param changes from diff(), or omitted
 */
export async function record({ action, entity, entityId = null, label = "", summary, changes = null }) {
  try {
    const user = getUser();
    await prisma.auditLog.create({
      data: {
        userId: user?.id ?? null,
        // Copied flat so the entry still names someone after the account goes.
        userName: user?.name || "Unknown",
        userRole: user?.role || "—",
        action, entity, entityId,
        label: String(label || ""),
        summary,
        changes: changes && changes.length ? changes : null,
      },
    });
  } catch (err) {
    // Deliberately swallowed — see rule ONE above.
    console.error("[audit] could not record:", action, entity, entityId, err?.message);
  }
}

/**
 * The common case: something was edited. Writes nothing when nothing moved,
 * because "Nikhil edited booking 276694268" with no changes under it is noise
 * that pushes the real entries off the first page.
 */
export async function recordUpdate({ entity, entityId, label, before, after, ignore = [], noun }) {
  const changes = diff(before, after, ignore);
  if (!changes.length) return;
  const what = noun || entity.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  await record({
    action: "UPDATE",
    entity, entityId, label,
    summary: `Edited ${what} ${label} — ${changes.map(c => FIELD_LABELS[c.field] || c.field).join(", ")}`,
    changes,
  });
}

/** Column names as people say them, so the page doesn't read like a schema. */
export const FIELD_LABELS = {
  number: "number", partnerId: "supplier", orderDate: "PO date",
  currency: "currency", paymentTerms: "payment terms", shippingTerms: "pricing",
  terms: "terms & conditions", notes: "notes", status: "status",
  qty: "quantity", uom: "unit", price: "price", priceUnit: "price unit",
  shippingLineId: "shipping line", freightForwarder: "freight forwarder",
  vessel: "vessel", voyage: "voyage", pol: "port of loading",
  pod: "port of destination", placeOfDelivery: "place of delivery",
  pricePerContainer: "price per container", bookedContainers: "booked containers",
  loadedContainers: "loaded containers", otherContainers: "other containers",
  erd: "ERD", docsCutOff: "docs cut-off", cargoCutOff: "cargo cut-off",
  siSentDate: "SI sent", containerType: "container type", emptyDepot: "empty depot",
  commodity: "commodity", etd: "ETD", eta: "ETA",
  name: "name", email: "email", phone: "phone", role: "role", active: "active",
  type: "type", country: "country", incoterm: "incoterm", address: "address",
  buyerId: "buyer", supplierId: "supplier", productId: "product",
  salePrice: "sale price", approvedAt: "approval",
};

/** Areas, for the filter on the audit page. */
export const AUDIT_AREAS = {
  PurchaseOrder: "Purchase orders",
  PoAllocation:  "PO ↔ shipment links",
  Booking:       "Bookings",
  BookingLine:   "Container lines",
  Partner:       "Suppliers & buyers",
  Product:       "Products",
  User:          "Users",
  Setting:       "Settings",
};

export const AUDIT_ACTIONS = [
  "CREATE", "UPDATE", "DELETE", "APPROVE", "UNAPPROVE",
  "EMAIL", "LINK", "UNLINK", "IMPORT", "RESET",
];

/** Colour per action, so the eye can skim the column. */
export const ACTION_TONE = {
  CREATE:    "bg-emerald-50 text-emerald-700",
  IMPORT:    "bg-emerald-50 text-emerald-700",
  UPDATE:    "bg-brand-50 text-brand-700",
  LINK:      "bg-brand-50 text-brand-700",
  UNLINK:    "bg-amber-50 text-amber-700",
  UNAPPROVE: "bg-amber-50 text-amber-700",
  APPROVE:   "bg-emerald-50 text-emerald-700",
  EMAIL:     "bg-brand-50 text-brand-700",
  DELETE:    "bg-red-50 text-red-700",
  RESET:     "bg-red-50 text-red-700",
};
