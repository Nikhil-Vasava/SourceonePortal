"use client";
import { useState } from "react";
import { IconPlus, IconX } from "@/components/icons";

export default function PoLinesEditor({ products }) {
  const [rows, setRows] = useState([{ key: 1 }]);
  const add = () => setRows(r => [...r, { key: Date.now() }]);
  const del = (key) => setRows(r => (r.length > 1 ? r.filter(x => x.key !== key) : r));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="label mb-0">Products *</span>
        <button type="button" onClick={add} className="btn-secondary btn-sm"><IconPlus size={13} /> Add product</button>
      </div>

      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={r.key} className="grid grid-cols-12 items-end gap-2 rounded-lg border border-ink-200 bg-ink-50/40 p-2.5">
            <div className="col-span-4">
              {i === 0 && <span className="label">Product</span>}
              <select name="productId" required={i === 0} className="input">
                <option value="">Select…</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}{p.grade ? ` (${p.grade})` : ""}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              {i === 0 && <span className="label">Qty</span>}
              <input name="qty" type="number" step="0.01" placeholder="3" className="input" />
            </div>
            <div className="col-span-2">
              {i === 0 && <span className="label">Unit</span>}
              <select name="qtyUnit" className="input">
                {["Loads", "MT", "Containers", "KG"].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              {i === 0 && <span className="label">Price</span>}
              <input name="price" type="number" step="0.01" placeholder="260" className="input" />
            </div>
            <div className="col-span-1">
              {i === 0 && <span className="label">Per</span>}
              <select name="priceUnit" className="input">
                {["/ MT", "/ KG", "/ Load", "/ Cont.", ""].map(u => <option key={u} value={u}>{u || "—"}</option>)}
              </select>
            </div>
            <div className="col-span-1 pb-1 text-right">
              <button type="button" onClick={() => del(r.key)} className="icon-btn-danger" title="Remove product"><IconX size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
