import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fdate, fmt } from "@/lib/util";
import { PageHeader, Empty, Badge } from "@/components/ui";
import { deletePoAction } from "@/lib/actions-po";
import TableToolbar from "@/components/TableToolbar";
import SortHeader from "@/components/SortHeader";
import { readTableQuery, sortRows, searchWhere, dateRangeWhere } from "@/lib/table-query";

// `key` sorts the row; `dir` is the direction the first click uses.
const COLS = [
  { label: "P.O. No.", key: "number", dir: "asc" },
  { label: "Date", key: "date", dir: "desc" },
  { label: "Supplier", key: "supplier", dir: "asc" },
  { label: "Products", key: "products", dir: "asc" },
  { label: "Qty", key: "qty", dir: "desc" },
  { label: "Value", key: "value", dir: "desc" },
  { label: "Pricing", key: "pricing", dir: "asc" },
  { label: "Linked Booking", key: "booking", dir: "asc" },
  { label: "Source", key: "source", dir: "asc" },
  { label: "Status", key: "status", dir: "asc" },
];

const lineTotal = (po) => po.lines.reduce((s, l) => s + l.qty * l.price, 0);

const SORT_ACCESSORS = {
  number:   po => po.number,
  date:     po => po.orderDate,
  supplier: po => po.partner?.name,
  products: po => po.lines.map(l => l.product?.name).filter(Boolean).join(", "),
  qty:      po => po.lines.reduce((s, l) => s + (l.qty || 0), 0),
  value:    po => lineTotal(po),
  pricing:  po => po.shippingTerms,
  booking:  po => po.fromBooking?.number,
  source:   po => (po.sourceFile ? "imported" : "manual"),
  status:   po => po.status,
};

export const dynamic = "force-dynamic";

export default async function Purchase({ searchParams }) {
  requireUser();

  const query = readTableQuery(searchParams, { defaultSort: "date", defaultDir: "desc" });

  const where = {
    ...searchWhere(query.q, ["number", "shippingTerms", "partner.name"]),
    ...dateRangeWhere("orderDate", query.from, query.to),
  };

  const [posRaw, count] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      include: { partner: true, lines: { include: { product: true } }, fromBooking: true },
      orderBy: { id: "desc" },
    }),
    prisma.purchaseOrder.count(),
  ]);

  const pos = sortRows(posRaw, SORT_ACCESSORS[query.sort] || SORT_ACCESSORS.date, query.dir);
  const total = lineTotal;

  return (
    <div>
      <PageHeader title="Purchase Orders" subtitle="Create purchase orders here, then attach them to a booking on the Booking tab"
        action={<div className="flex gap-2">
          <Link href="/purchase/import" className="btn">⬆ Import PO</Link>
          <Link href="/purchase/new" className="btn-secondary">+ Generate PO</Link>
        </div>} />

      {(searchParams?.created || searchParams?.imported) && (
        <div className="alert-success mb-5">
          ✓ {searchParams.imported ? `Imported ${searchParams.imported} purchase order${searchParams.imported === "1" ? "" : "s"}.` : "Purchase order created."}
          {searchParams.created && (
            <> <a href={`/api/po/${searchParams.created}`} target="_blank" rel="noreferrer" className="font-medium underline">Open the PDF</a></>
          )}
          {" "}Link it to a booking from the <Link href="/bookings" className="font-medium underline">Booking tab</Link>.
          {searchParams.newSuppliers && (
            <div className="mt-1 text-xs">New supplier added to Info: <b>{decodeURIComponent(searchParams.newSuppliers)}</b></div>
          )}
          {searchParams.newProducts && (
            <div className="mt-1 text-xs">New products added to Info: <b>{decodeURIComponent(searchParams.newProducts)}</b></div>
          )}
        </div>
      )}

      {count > 0 && (
        <TableToolbar
          action="/purchase"
          query={query}
          searchPlaceholder="PO number, supplier, pricing…"
          dateLabel="PO date"
          total={count}
          shown={pos.length}
        />
      )}

      {pos.length === 0 ? (
        <Empty text={count === 0
          ? "No purchase orders yet — import an existing PO or click Generate PO to create one"
          : "No purchase orders match those filters."} />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="min-w-full divide-y divide-ink-200">
            <thead className="bg-sticky"><tr>
              {COLS.map(c => (
                <SortHeader key={c.key} column={c.key} label={c.label} query={query}
                            basePath="/purchase" naturalDir={c.dir} className="th" />
              ))}
              {["PDF", ""].map(h => <th key={h} className="th">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-ink-100">
              {pos.map(po => (
                <tr key={po.id} className="row">
                  <td className="td whitespace-nowrap font-semibold">{po.number}</td>
                  <td className="td whitespace-nowrap">{fdate(po.orderDate)}</td>
                  <td className="td">{po.partner.name}</td>
                  <td className="td">
                    {po.lines.map(l => <div key={l.id}>{l.product?.name}</div>)}
                  </td>
                  <td className="td whitespace-nowrap">
                    {po.lines.map(l => <div key={l.id}>{l.qty} {l.uom}</div>)}
                  </td>
                  <td className="td whitespace-nowrap font-medium">{fmt(total(po), po.currency)}</td>
                  <td className="td">{po.shippingTerms || "—"}</td>
                  <td className="td">
                    {po.fromBooking
                      ? <Link className="text-brand-700 underline" href={`/bookings/${po.fromBookingId}`}>{po.fromBooking.number}</Link>
                      : <span className="text-ink-300">not linked</span>}
                  </td>
                  <td className="td text-xs">
                    {po.sourceFile
                      ? <span className="badge bg-brand-50 text-brand-700" title={po.sourceFile}>imported</span>
                      : <span className="text-ink-400">manual</span>}
                  </td>
                  <td className="td"><Badge value={po.status} /></td>
                  <td className="td">
                    <a href={`/api/po/${po.id}`} target="_blank" rel="noreferrer" className="btn-secondary whitespace-nowrap">📄 Open</a>
                  </td>
                  <td className="td">
                    <form action={deletePoAction}>
                      <input type="hidden" name="id" value={po.id} />
                      <button className="text-xs text-red-500" title="Delete PO">✕</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
