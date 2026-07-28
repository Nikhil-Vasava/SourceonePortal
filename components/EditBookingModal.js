"use client";
import { useState } from "react";
import { IconPencil } from "@/components/icons";

const d = (v) => (v ? String(v).slice(0, 10) : "");

export default function EditBookingModal({ booking, action }) {
  const [open, setOpen] = useState(false);
  const b = booking;
  return (
    <>
      <button onClick={() => setOpen(true)} className="icon-btn" title="Edit booking" aria-label="Edit booking">
        <IconPencil size={16} />
      </button>

      {open && (
        <div className="overlay" onClick={() => setOpen(false)}>
          <div className="modal max-w-3xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold tracking-tight text-ink-900">Edit booking {b.number}</h3>
            <p className="mb-5 mt-1 text-sm text-ink-500">Fill in the columns carriers don't provide, or correct anything the reader got wrong.</p>

            <form action={action} className="grid grid-cols-4 gap-3">
              <input type="hidden" name="id" value={b.id} />

              <div><span className="label">Freight Forwarder</span><input name="freightForwarder" defaultValue={b.freightForwarder || ""} className="input" /></div>
              <div><span className="label">Booking No.</span><input name="number" defaultValue={b.number} className="input" /></div>
              <div className="col-span-2"><span className="label">Vessel Name</span><input name="vessel" defaultValue={b.vessel || ""} className="input" /></div>

              <div><span className="label">Voyage No.</span><input name="voyage" defaultValue={b.voyage || ""} className="input" /></div>
              <div><span className="label">Port of Loading</span><input name="pol" defaultValue={b.pol || ""} className="input" /></div>
              <div><span className="label">Port of Destination</span><input name="pod" defaultValue={b.pod || ""} className="input" /></div>
              <div><span className="label">Place of Delivery</span><input name="placeOfDelivery" defaultValue={b.placeOfDelivery || ""} className="input" /></div>

              <div className="col-span-4 mt-2 border-t border-ink-200 pt-4 text-2xs font-semibold uppercase tracking-wider text-brand-600">Commercial — not in carrier documents</div>

              <div><span className="label">Price / Cont. (USD)</span><input name="pricePerContainer" type="number" step="0.01" defaultValue={b.pricePerContainer ?? ""} className="input" /></div>
              <div><span className="label">Booked Cont.</span><input name="bookedContainers" type="number" defaultValue={b.bookedContainers ?? ""} className="input" /></div>
              <div><span className="label">Loaded Cont.</span><input name="loadedContainers" type="number" defaultValue={b.loadedContainers ?? ""} className="input" /></div>
              <div><span className="label">SI Sent Date</span><input name="siSentDate" type="date" defaultValue={d(b.siSentDate)} className="input" /></div>

              <div className="col-span-4">
                <span className="label">Other Cont. (if cancelled, note WO/Charge or W/Charge)</span>
                <input name="otherContainers" defaultValue={b.otherContainers || ""} placeholder="e.g. 1 cancelled — W/Charge USD 150" className="input" />
              </div>

              <div className="col-span-4 mt-2 border-t border-ink-200 pt-4 text-2xs font-semibold uppercase tracking-wider text-brand-600">Dates</div>

              <div><span className="label">ERD</span><input name="erd" type="date" defaultValue={d(b.erd)} className="input" /></div>
              <div><span className="label">Docs Cut Off</span><input name="docsCutOff" type="date" defaultValue={d(b.docsCutOff)} className="input" /></div>
              <div><span className="label">Cargo Cut-Off</span><input name="cargoCutOff" type="date" defaultValue={d(b.cargoCutOff)} className="input" /></div>
              <div><span className="label">Container Type</span><input name="containerType" defaultValue={b.containerType || ""} className="input" /></div>

              <div><span className="label">ETD</span><input name="etd" type="date" defaultValue={d(b.etd)} className="input" /></div>
              <div><span className="label">ETA</span><input name="eta" type="date" defaultValue={d(b.eta)} className="input" /></div>
              <div className="col-span-2"><span className="label">Commodity</span><input name="commodity" defaultValue={b.commodity || ""} className="input" /></div>

              <div><span className="label">Status</span>
                <select name="status" defaultValue={b.status} className="input">
                  {["DRAFT","CONFIRMED","SHIPPED","DELIVERED","CLOSED","CANCELLED"].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>

              <div className="col-span-4 mt-4 flex justify-end gap-2 border-t border-ink-200 pt-4">
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
                <button className="btn">Save Booking</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
