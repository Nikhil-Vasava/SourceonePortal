import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser, canSeePrices } from "@/lib/auth";
import { fdate } from "@/lib/util";
import { PageHeader, Empty, Badge } from "@/components/ui";
import { deletePoAction } from "@/lib/actions-po";
import TableToolbar from "@/components/TableToolbar";
import SortHeader from "@/components/SortHeader";
import PoValue from "@/components/PoValue";
import EmailPoModal from "@/components/EmailPoModal";
import ApprovePoButton from "@/components/ApprovePoButton";
import { poDraftAction, sendPoEmailAction } from "@/lib/actions-po-email";
import { approvePoAction, unapprovePoAction } from "@/lib/actions-po-approval";
import { IconPencil } from "@/components/icons";
import { readTableQuery, sortRows, searchWhere, dateRangeWhere } from "@/lib/table-query";
import { valueSortKey } from "@/lib/po-value";
import { poBalance, describeBalance } from "@/lib/po-allocation";

// `key` sorts the row; `dir` is the direction the first click uses.
// `priced` marks the columns only purchase staff and admins may see.
const COLS = [
  { label: "P.O. No.", key: "number", dir: "asc" },
  { label: "Date", key: "date", dir: "desc" },
  { label: "Supplier", key: "supplier", dir: "asc" },
  { label: "Products", key: "products", dir: "asc" },
  { label: "Qty", key: "qty", dir: "desc" },
  { label: "Value", key: "value", dir: "desc", priced: true },
  { label: "Pricing", key: "pricing", dir: "asc" },
  { label: "Shipments", key: "booking", dir: "asc" },
  { label: "Source", key: "source", dir: "asc" },
  { label: "Status", key: "status", dir: "asc" },
];

const SORT_ACCESSORS = {
  number:   po => po.number,
  date:     po => po.orderDate,
  supplier: po => po.partner?.name,
  products: po => po.lines.map(l => l.product?.name).filter(Boolean).join(", "),
  qty:      po => po.lines.reduce((s, l) => s + (l.qty || 0), 0),
  value:    po => valueSortKey(po.lines),
  pricing:  po => po.shippingTerms,
  booking:  po => po.allocations?.[0]?.booking?.number || po.fromBooking?.number,
  source:   po => (po.sourceFile ? "imported" : "manual"),
  status:   po => po.status,
};

export const dynamic = "force-dynamic";

export default async function Purchase({ searchParams }) {
  // Everyone can see WHICH orders exist, for what product, in what quantity and
  // on which vessels — operations need that to do their job. What they can't
  // see is what any of it cost.
  //
  // `seePrices` hides the VALUE column and the PDF button. The PDF is not an
  // afterthought here: it prints the rate, so leaving that button visible would
  // hand back everything the column hides. The write actions are hidden too,
  // and each one re-checks the role server-side — a hidden button is not a
  // permission check.
  const user = requireUser();
  const seePrices = canSeePrices(user);
  const isAdmin = user.role === "ADMIN";

  const query = readTableQuery(searchParams, { defaultSort: "date", defaultDir: "desc" });

  const where = {
    ...searchWhere(query.q, ["number", "shippingTerms", "partner.name"]),
    ...dateRangeWhere("orderDate", query.from, query.to),
  };

  const [posRaw, count] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      include: {
        partner: true, lines: { include: { product: true } }, fromBooking: true,
        allocations: { include: { booking: { select: { id: true, number: true, vessel: true } } }, orderBy: { id: "asc" } },
      },
      orderBy: { id: "desc" },
    }),
    prisma.purchaseOrder.count(),
  ]);

  // Sorting by a column you can't see still tells you what's in it: order the
  // list by value and the most expensive order is at the top. The header is
  // hidden, but ?sort=value in the address bar isn't, so refuse it here.
  const sortKey = (!seePrices && query.sort === "value") ? "date" : query.sort;
  const pos = sortRows(posRaw, SORT_ACCESSORS[sortKey] || SORT_ACCESSORS.date, query.dir);

  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        subtitle={seePrices
          ? "Create purchase orders here, then attach them to a booking on the Booking tab"
          : "Orders raised by the purchase team. Values are not shown on your account."}
        action={seePrices ? (
          <div className="flex gap-2">
            <Link href="/purchase/import" className="btn">⬆ Import PO</Link>
            <Link href="/purchase/new" className="btn-secondary">+ Generate PO</Link>
          </div>
        ) : null} />

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
              {COLS.filter(c => seePrices || !c.priced).map(c => (
                <SortHeader key={c.key} column={c.key} label={c.label} query={query}
                            basePath="/purchase" naturalDir={c.dir} className="th" />
              ))}
              {seePrices && ["PDF", ""].map(h => <th key={h} className="th">{h}</th>)}
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
                  {seePrices && (
                    <td className="td whitespace-nowrap">
                      <PoValue po={po} />
                    </td>
                  )}
                  <td className="td">{po.shippingTerms || "—"}</td>
                  <td className="td">
                    {/* A PO can sail on several vessels — show every one, plus
                        what's still unplaced. */}
                    {po.allocations.length === 0 ? (
                      // Orders linked before allocations existed still have the
                      // old single pointer — show it rather than "not linked".
                      po.fromBooking ? (
                        <Link className="whitespace-nowrap text-2xs text-brand-500 hover:underline"
                              href={`/bookings/${po.fromBookingId}`}>
                          {po.fromBooking.number}
                        </Link>
                      ) : <span className="text-ink-300">not linked</span>
                    ) : (
                      <div className="space-y-0.5">
                        {po.allocations.map(a => (
                          <div key={a.id} className="whitespace-nowrap text-2xs">
                            <Link className="text-brand-500 hover:underline" href={`/bookings/${a.bookingId}`}>
                              {a.booking.number}
                            </Link>
                            <span className="ml-1 text-ink-400">
                              {a.qty}{a.unit ? ` ${a.unit}` : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {(() => {
                      const bal = poBalance(po);
                      if (!bal.meaningful) return null;
                      const text = describeBalance(bal);
                      const tone = bal.over ? "text-red-400"
                        : bal.fullyPlaced ? "text-emerald-500" : "text-amber-400";
                      return <div className={`mt-1 text-2xs ${tone}`}>{text}</div>;
                    })()}
                  </td>
                  <td className="td text-xs">
                    {po.sourceFile
                      ? <span className="badge bg-brand-50 text-brand-700" title={po.sourceFile}>imported</span>
                      : <span className="text-ink-400">manual</span>}
                  </td>
                  <td className="td"><Badge value={po.status} /></td>
                  {seePrices && (
                  <td className="td">
                    <div className="flex items-center gap-1.5">
                      <a href={`/api/po/${po.id}`} target="_blank" rel="noreferrer" className="btn-secondary whitespace-nowrap">📄 Open</a>
                      <Link href={`/purchase/${po.id}/edit`} className="icon-btn" title={`Edit ${po.number}`} aria-label={`Edit ${po.number}`}>
                        <IconPencil size={14} />
                      </Link>

                      {isAdmin && (
                        <ApprovePoButton
                          poId={po.id}
                          poNumber={po.number}
                          supplier={po.partner.name}
                          approvedAt={po.approvedAt ? po.approvedAt.toISOString() : null}
                          approvedName={po.approvedName}
                          approve={approvePoAction}
                          unapprove={unapprovePoAction}
                        />
                      )}

                      {/* Nothing unapproved is emailed, by anyone. An
                          unapproved PO has no stamp on its PDF, and a supplier
                          can't tell that from the real thing. */}
                      {po.approvedAt ? (
                        <EmailPoModal
                          poId={po.id}
                          poNumber={po.number}
                          supplier={po.partner.name}
                          emailedAt={po.emailedAt ? po.emailedAt.toISOString() : null}
                          getDraft={poDraftAction}
                          sendAction={sendPoEmailAction}
                        />
                      ) : (
                        <span
                          className="px-1 text-2xs text-ink-400"
                          title={isAdmin
                            ? "Approve this first — its PDF has no stamp yet"
                            : "An admin has to approve this before it can be emailed"}
                        >
                          awaiting approval
                        </span>
                      )}
                    </div>
                  </td>
                  )}
                  {seePrices && (
                  <td className="td">
                    <form action={deletePoAction}>
                      <input type="hidden" name="id" value={po.id} />
                      <button className="text-xs text-red-500" title="Delete PO">✕</button>
                    </form>
                  </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
