"use client";
import { useState } from "react";
import { IconPlus, IconX } from "@/components/icons";

const QTY_UNITS = ["Loads", "MT", "Containers", "KG"];
const PRICE_UNITS = ["/ MT", "/ KG", "/ Load", "/ Cont.", ""];

/** Normalises a stored unit ("MT") back to the option value the select uses ("/ MT"). */
function toPriceOption(v) {
  if (v == null || v === "") return "";
  const s = String(v).trim();
  const withSlash = s.startsWith("/") ? s : `/ ${s}`;
  return PRICE_UNITS.includes(withSlash) ? withSlash : "";
}

/**
 * @param {Array} products
 * @param {Array} lines existing PO lines when editing; blank row when creating
 */
export default function PoLinesEditor({ products, lines = [] }) {
  const [rows, setRows] = useState(() =>
    lines.length
      ? lines.map((l, i) => ({ key: `e${i}`, ...l }))
      : [{ key: "n1" }]
  );

  const add = () => setRows(r => [...r, { key: `n${Date.now()}` }]);
  const del = (key) => setRows(r => (r.length > 1 ? r.filter(x => x.key !== key) : r));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="label mb-0">Products *</span>
        <button type="button" onClick={add} className="btn-secondary btn-sm"><IconPlus size={13} /> Add product</button>
      </div>

      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={r.key} className="grid grid-cols-2 items-end gap-2 rounded-lg border border-ink-200 bg-ink-100 p-2.5 sm:grid-cols-6 lg:grid-cols-12">
            <div className="col-span-4">
              {i === 0 && <span className="label">Product</span>}
              <select name="productId" required={i === 0} defaultValue={r.productId ?? ""} className="input">
                <option value="">Select…</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}{p.grade ? ` (${p.grade})` : ""}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              {i === 0 && <span className="label">Qty</span>}
              <input name="qty" type="number" step="0.01" placeholder="3" defaultValue={r.qty ?? ""} className="input" />
            </div>
            <div className="col-span-2">
              {i === 0 && <span className="label">Unit</span>}
              <select name="qtyUnit" defaultValue={r.uom ?? "Loads"} className="input">
                {QTY_UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              {i === 0 && <span className="label">Price</span>}
              <input name="price" type="number" step="0.01" placeholder="260" defaultValue={r.price ?? ""} className="input" />
            </div>
            <div className="col-span-1">
              {i === 0 && <span className="label">Per</span>}
              <select name="priceUnit" defaultValue={toPriceOption(r.priceUnit)} className="input">
                {PRICE_UNITS.map(u => <option key={u} value={u}>{u || "—"}</option>)}
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
