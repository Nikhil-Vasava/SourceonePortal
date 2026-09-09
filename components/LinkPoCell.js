"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconX, IconDoc } from "@/components/icons";

export default function LinkPoCell({ booking, allPos, linkAction, unlinkAction }) {
  const router = useRouter();
  const formRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  // Linking can legitimately refuse — the booking may be full, or the order
  // already fully placed. `<form action={fn}>` gives the client no way to hear
  // that, so the button would just do nothing and look broken. Calling the
  // action directly gets the answer back.
  async function link(e) {
    e.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const res = await linkAction(new FormData(formRef.current));
      if (res?.error) setError(res.error);
      else { formRef.current?.reset(); router.refresh(); }
    } catch (err) {
      setError(err?.message || "Couldn't attach that order.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const linked = booking.purchaseOrders || [];
  const linkedIds = new Set(linked.map(p => p.id));
  // A PO can go on several bookings — 40 loads might sail as 10 + 7 + 15 + 8.
  // The only one excluded is a PO already on THIS booking.
  const available = allPos.filter(p => !linkedIds.has(p.id));

  // The 230px floor keeps the desktop column from collapsing, but it would
  // overflow a 390px phone once padding is counted — so only apply it from sm.
  return (
    <div className="w-full space-y-1 sm:min-w-[230px]">
      {linked.map(p => (
        <div key={p.id} className="flex items-center gap-1.5 rounded-md bg-brand-50/70 px-2 py-1">
          <IconDoc size={13} className="shrink-0 text-brand-500" />
          <a href={`/api/po/${p.id}`} target="_blank" rel="noreferrer"
             className="whitespace-nowrap text-2xs font-semibold text-brand-700 hover:underline">
            {p.number}
          </a>
          <span className="min-w-0 flex-1 truncate text-2xs text-ink-500" title={p.partnerName}>
            {p.partnerName}
            {p.allocated != null && (
              <span className="ml-1 text-ink-400">· {p.allocated}{p.unit ? ` ${p.unit}` : ""}</span>
            )}
          </span>
          <form action={unlinkAction}>
            <input type="hidden" name="bookingId" value={booking.id} />
            <input type="hidden" name="poId" value={p.id} />
            <button className="text-ink-300 transition-colors hover:text-red-600" title="Unlink this PO" aria-label="Unlink">
              <IconX size={12} />
            </button>
          </form>
        </div>
      ))}

      <form ref={formRef} onSubmit={link} className="flex items-center gap-1">
        <input type="hidden" name="bookingId" value={booking.id} />
        <select name="poId" required defaultValue="" className="input input-sm w-full">
          <option value="" disabled>
            {available.length ? "Select a PO…" : "No unlinked POs"}
          </option>
          {available.map(p => (
            <option key={p.id} value={p.id}>
              {p.number} — {p.partnerName}
              {p.balance ? ` · ${p.balance}` : (p.summary ? ` (${p.summary})` : "")}
            </option>
          ))}
        </select>
        <button disabled={busy} className="btn btn-sm">{busy ? "…" : "Save"}</button>
      </form>

      {error && (
        <p className="text-2xs leading-snug text-red-600" role="alert">{error}</p>
      )}
    </div>
  );
}
