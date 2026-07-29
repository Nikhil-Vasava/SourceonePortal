import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fdate, fmt } from "@/lib/util";
import { fileToBase64 } from "@/lib/gemini";
import { extractPackingSlip, distributeContainers, hasAnyExtractionKey, extractionProviders } from "@/lib/extract";
import { PageHeader, Empty } from "@/components/ui";
import PackingSlipUpload from "@/components/PackingSlipUpload";
import { IconCheck, IconAlert } from "@/components/icons";

export const dynamic = "force-dynamic";

/** One slip per booking — spread across every container line it covers. */
async function uploadPackingSlip(formData) {
  "use server";
  const bookingId = Number(formData.get("bookingId"));
  const file = formData.get("file");
  if (!file || !file.size) redirect("/suppliers?error=" + encodeURIComponent("Please choose a file."));

  let data, provider;
  try {
    const r = await extractPackingSlip(await fileToBase64(file), file.name);
    data = r.data;
    provider = r.provider;
  } catch (e) {
    redirect("/suppliers?error=" + encodeURIComponent(e.message));
  }

  if (!data.containers.length) {
    redirect("/suppliers?error=" + encodeURIComponent(
      `${file.name}: no container details found. Check the slip lists container numbers or weights.`));
  }

  const lines = await prisma.bookingLine.findMany({
    where: { bookingId }, orderBy: { lineNo: "asc" },
  });
  const { updates, matched, unmatched, spare } = distributeContainers(lines, data.containers);

  const packedOn = data.packingDate ? new Date(data.packingDate + "T12:00:00Z") : null;
  for (const u of updates) {
    const line = lines.find(l => l.id === u.id);
    await prisma.bookingLine.update({
      where: { id: u.id },
      data: {
        packingSlipFile: file.name,
        packingSlipJson: JSON.stringify({ _readBy: provider, ...u.data }, null, 2),
        containerNo: u.data.containerNo || line.containerNo,
        sealNo: u.data.sealNo || line.sealNo,
        description: line.description || u.data.description || null,
        packages: u.data.packages ?? line.packages,
        netWeightKg: u.data.netWeightKg ?? line.netWeightKg,
        grossWeightKg: u.data.grossWeightKg ?? line.grossWeightKg,
        packingDate: packedOn && !isNaN(packedOn) ? packedOn : line.packingDate,
      },
    });
  }

  const q = new URLSearchParams({ read: provider, filled: String(matched) });
  if (unmatched.length) q.set("extra", String(unmatched.length));
  if (spare) q.set("spare", String(spare));
  revalidatePath("/suppliers");
  redirect(`/suppliers?${q.toString()}`);
}

async function reassignLine(formData) {
  "use server";
  const lineId = Number(formData.get("lineId"));
  const supplierId = formData.get("supplierId") ? Number(formData.get("supplierId")) : null;
  await prisma.bookingLine.update({ where: { id: lineId }, data: { supplierId } });
  revalidatePath("/suppliers");
}

/** Applies one supplier to every line in a booking. */
async function reassignBooking(formData) {
  "use server";
  const bookingId = Number(formData.get("bookingId"));
  const supplierId = formData.get("supplierId") ? Number(formData.get("supplierId")) : null;
  await prisma.bookingLine.updateMany({ where: { bookingId }, data: { supplierId } });
  revalidatePath("/suppliers");
}

const dash = <span className="text-ink-300">—</span>;

export default async function Suppliers({ searchParams }) {
  requireUser();
  const [bookings, suppliers] = await Promise.all([
    prisma.booking.findMany({
      include: {
        lines: { orderBy: { lineNo: "asc" }, include: { supplier: true, product: true, po: true } },
      },
      orderBy: { id: "desc" },
    }),
    prisma.partner.findMany({ where: { type: { in: ["VENDOR", "BUYER"] }, active: true }, orderBy: { name: "asc" } }),
  ]);

  const withLines = bookings.filter(b => b.lines.length);
  const allLines = withLines.flatMap(b => b.lines);
  const withSlip = allLines.filter(l => l.packingSlipFile).length;

  return (
    <div>
      <PageHeader
        title="Supplier"
        subtitle="One packing slip per booking fills in every container it covers"
      />

      {!hasAnyExtractionKey() && (
        <div className="alert-warn mb-5">
          <IconAlert size={18} className="mt-0.5 shrink-0" />
          <div>
            <b>No extraction key set.</b> Add <code className="rounded bg-white px-1">GEMINI_API_KEY</code> to{" "}
            <code className="rounded bg-white px-1">.env</code>, or type the values straight into each row.
          </div>
        </div>
      )}

      {searchParams?.read && (
        <div className="alert-success mb-5">
          <IconCheck size={18} className="mt-0.5 shrink-0 text-emerald-600" />
          <div>
            Slip read by <b>{decodeURIComponent(searchParams.read)}</b> — filled{" "}
            <b>{searchParams.filled}</b> container{searchParams.filled === "1" ? "" : "s"}.
            {searchParams.spare && <> {searchParams.spare} row{searchParams.spare === "1" ? "" : "s"} left blank — the slip didn't cover them.</>}
            {searchParams.extra && <> {searchParams.extra} container{searchParams.extra === "1" ? "" : "s"} in the slip had no matching row.</>}
          </div>
        </div>
      )}

      {searchParams?.error && (
        <div className="alert-error mb-5">
          <IconAlert size={18} className="mt-0.5 shrink-0" />
          <div><b>Extraction failed.</b> {decodeURIComponent(searchParams.error)}</div>
        </div>
      )}

      {withLines.length === 0 ? (
        <Empty text="No container lines yet — create a booking first"
               action={<Link href="/bookings/import" className="btn">Import a booking</Link>} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-500">
            <span>{withSlip} of {allLines.length} containers have packing slip details</span>
            <span className="text-2xs text-ink-400">
              Reader:{" "}
              {extractionProviders().map(p => (
                <span key={p.name} className={p.ready ? "font-medium text-ink-600" : "line-through"}>
                  {p.name}
                </span>
              ))}
            </span>
          </div>

          <div className="space-y-5">
            {withLines.map(b => {
              const filled = b.lines.filter(l => l.packingSlipFile).length;
              const slipFile = b.lines.find(l => l.packingSlipFile)?.packingSlipFile || null;
              const supplierIds = [...new Set(b.lines.map(l => l.supplierId).filter(Boolean))];
              const commonSupplier = supplierIds.length === 1 ? supplierIds[0] : "";

              return (
                <div key={b.id} className="card-flush overflow-hidden">
                  {/* booking header — the slip belongs to the whole booking */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200/70 bg-ink-50/60 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Link href={`/bookings/${b.id}`} className="font-semibold text-brand-700 hover:underline">
                        {b.number}
                      </Link>
                      <span className="text-xs text-ink-500">
                        {b.pol || "?"} → {b.pod || "?"} · {b.lines.length} container{b.lines.length === 1 ? "" : "s"}
                      </span>
                      <span className={`badge ${filled === b.lines.length ? "bg-emerald-50 text-emerald-700" : "bg-ink-100 text-ink-600"}`}>
                        {filled}/{b.lines.length} filled
                      </span>
                      {slipFile && (
                        <span className="max-w-full truncate text-2xs text-ink-400 sm:max-w-[16rem]" title={slipFile}>{slipFile}</span>
                      )}
                    </div>

                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                      <form action={reassignBooking} className="flex items-center gap-1.5">
                        <input type="hidden" name="bookingId" value={b.id} />
                        <span className="shrink-0 text-2xs text-ink-400">Supplier</span>
                        <select name="supplierId" defaultValue={commonSupplier} className="input input-sm w-full min-w-0 sm:w-44">
                          <option value="">— not allocated —</option>
                          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <button className="btn-secondary btn-sm shrink-0">Apply to all</button>
                      </form>

                      <PackingSlipUpload
                        booking={{ id: b.id, number: b.number, lineCount: b.lines.length, filled, slipFile }}
                        action={uploadPackingSlip}
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="border-b border-ink-200/70">
                        <tr>{["#", "Supplier", "Product", "Container", "Seal", "Packages", "Net (kg)", "Gross (kg)", "Packed", "PO"]
                          .map(h => <th key={h} className="th">{h}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y divide-ink-100">
                        {b.lines.map(l => (
                          <tr key={l.id} className="row">
                            <td className="td tnum text-ink-400">{l.lineNo}</td>
                            <td className="td">
                              <form action={reassignLine} className="flex items-center gap-1">
                                <input type="hidden" name="lineId" value={l.id} />
                                <select name="supplierId" defaultValue={l.supplierId || ""} className="input input-sm w-36">
                                  <option value="">—</option>
                                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                                <button className="text-2xs text-brand-600 hover:underline">set</button>
                              </form>
                            </td>
                            <td className="td">{l.product?.name || l.description || dash}</td>
                            <td className="td font-mono text-xs">{l.containerNo || dash}</td>
                            <td className="td font-mono text-xs">{l.sealNo || dash}</td>
                            <td className="td tnum">{l.packages ?? dash}</td>
                            <td className="td tnum">{l.netWeightKg != null ? fmt(l.netWeightKg) : dash}</td>
                            <td className="td tnum">{l.grossWeightKg != null ? fmt(l.grossWeightKg) : dash}</td>
                            <td className="td whitespace-nowrap">{l.packingDate ? fdate(l.packingDate) : dash}</td>
                            <td className="td">
                              {l.po
                                ? <a href={`/api/po/${l.poId}`} target="_blank" rel="noreferrer"
                                     className="text-brand-700 hover:underline">{l.po.number}</a>
                                : dash}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
