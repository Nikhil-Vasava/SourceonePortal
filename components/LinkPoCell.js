"use client";
import { useFormStatus } from "react-dom";
import { IconX, IconDoc } from "@/components/icons";

function SaveBtn() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="btn btn-sm">{pending ? "…" : "Save"}</button>;
}

export default function LinkPoCell({ booking, allPos, linkAction, unlinkAction }) {
  const linked = booking.purchaseOrders || [];
  const linkedIds = new Set(linked.map(p => p.id));
  // A PO can be attached to this booking if it isn't already on another one.
  const available = allPos.filter(p => !linkedIds.has(p.id) && (!p.fromBookingId || p.fromBookingId === booking.id));

  return (
    {/* The 230px floor keeps the desktop column from collapsing, but it would
        overflow a 390px phone once padding is counted — so only apply it from sm. */}
    <div className="w-full space-y-1 sm:min-w-[230px]">
      {linked.map(p => (
        <div key={p.id} className="flex items-center gap-1.5 rounded-md bg-brand-50/70 px-2 py-1">
          <IconDoc size={13} className="shrink-0 text-brand-500" />
          <a href={`/api/po/${p.id}`} target="_blank" rel="noreferrer"
             className="whitespace-nowrap text-2xs font-semibold text-brand-700 hover:underline">
            {p.number}
          </a>
          <span className="min-w-0 flex-1 truncate text-2xs text-ink-500" title={p.partnerName}>{p.partnerName}</span>
          <form action={unlinkAction}>
            <input type="hidden" name="bookingId" value={booking.id} />
            <input type="hidden" name="poId" value={p.id} />
            <button className="text-ink-300 transition-colors hover:text-red-600" title="Unlink this PO" aria-label="Unlink">
              <IconX size={12} />
            </button>
          </form>
        </div>
      ))}

      <form action={linkAction} className="flex items-center gap-1">
        <input type="hidden" name="bookingId" value={booking.id} />
        <select name="poId" required defaultValue="" className="input input-sm w-full">
          <option value="" disabled>
            {available.length ? "Select a PO…" : "No unlinked POs"}
          </option>
          {available.map(p => (
            <option key={p.id} value={p.id}>
              {p.number} — {p.partnerName}{p.summary ? ` (${p.summary})` : ""}
            </option>
          ))}
        </select>
        <SaveBtn />
      </form>
    </div>
  );
}
