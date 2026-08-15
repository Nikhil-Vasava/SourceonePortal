// What a purchase order line is actually worth.
//
// A line has two independent units: how much was ordered (`uom` — usually
// containers or loads) and what the price is per (`priceUnit` — usually MT).
// Those are routinely different, because you buy a container of material but
// agree a price per tonne. Multiplying 2 containers by USD 266/MT produces
// "USD 532", which is not a price, a rate, or anything else real.
//
// So a total is only computed when the two units describe the same thing.
// Otherwise the line reports its rate and says so, because the tonnage isn't
// known until the containers are packed and weighed.

/** "/ MT" and "MT" and "mt" are the same unit. */
export function normaliseUnit(u) {
  if (!u) return null;
  const s = String(u).replace(/^\s*\/\s*/, "").trim().toLowerCase().replace(/\.$/, "");
  if (!s) return null;
  const map = {
    mt: "MT", t: "MT", tonne: "MT", tonnes: "MT", ton: "MT", tons: "MT",
    kg: "KG", kgs: "KG", kilogram: "KG", kilograms: "KG",
    load: "Load", loads: "Load",
    cont: "Cont", container: "Cont", containers: "Cont",
  };
  return map[s] || u.toString().replace(/^\s*\/\s*/, "").trim();
}

/**
 * Can `qty` in `uom` be multiplied by a price per `priceUnit`?
 *
 * Only when they measure the same thing. MT and KG both measure weight, but a
 * quantity in MT against a price per KG still needs converting, so that's
 * handled explicitly rather than waved through.
 */
export function unitsMultiply(uom, priceUnit) {
  const q = normaliseUnit(uom);
  const p = normaliseUnit(priceUnit);
  if (!q || !p) return null;
  if (q === p) return 1;
  if (q === "MT" && p === "KG") return 1000;   // 20 MT at 0.30/KG = 6,000
  if (q === "KG" && p === "MT") return 0.001;
  return null;                                  // containers vs MT — not knowable here
}

/**
 * One line's value.
 *
 * @returns {{kind: "total"|"rate"|"unknown", amount: number|null, unit: string|null}}
 *   `total` — qty and price agree, `amount` is the line value.
 *   `rate`  — they don't, `amount` is the unit price and `unit` what it's per.
 *   `unknown` — no price at all.
 */
export function lineValue(line) {
  const price = Number(line?.price);
  if (!Number.isFinite(price) || price === 0) {
    return { kind: "unknown", amount: null, unit: null };
  }

  const factor = unitsMultiply(line.uom, line.priceUnit);
  if (factor === null) {
    return { kind: "rate", amount: price, unit: normaliseUnit(line.priceUnit) };
  }

  // A missing quantity is not a quantity of zero. Number(null) and Number("")
  // are both 0, which would sail through a plain isFinite check and report the
  // line as worth USD 0.00 — the same kind of invented figure this module
  // exists to prevent. Check for absence before converting.
  const missingQty = line.qty === null || line.qty === undefined || line.qty === "";
  const qty = Number(line.qty);
  if (missingQty || !Number.isFinite(qty)) {
    return { kind: "rate", amount: price, unit: normaliseUnit(line.priceUnit) };
  }

  const tax = 1 + (Number(line.taxRate) || 0) / 100;
  return { kind: "total", amount: qty * factor * price * tax, unit: null };
}

/**
 * A whole order's value.
 *
 * Mixed orders are the awkward case: if some lines total and others only have a
 * rate, the sum of the totalling lines alone would understate the order and
 * read as if it were the full figure. So a partial total is reported as such
 * and the caller decides how to say so.
 *
 * @returns {{kind: "total"|"rate"|"mixed"|"unknown", amount, unit, rates}}
 */
export function orderValue(lines) {
  const values = (lines || []).map(lineValue).filter(v => v.kind !== "unknown");
  if (!values.length) return { kind: "unknown", amount: null, unit: null, rates: [] };

  const totals = values.filter(v => v.kind === "total");
  const rates = values.filter(v => v.kind === "rate");

  if (rates.length === 0) {
    return { kind: "total", amount: totals.reduce((s, v) => s + v.amount, 0), unit: null, rates: [] };
  }

  if (totals.length === 0) {
    // Every line is a rate. One distinct rate reads cleanly; several don't.
    const distinct = [...new Set(rates.map(r => `${r.amount}|${r.unit || ""}`))];
    if (distinct.length === 1) {
      return { kind: "rate", amount: rates[0].amount, unit: rates[0].unit, rates };
    }
    return { kind: "mixed", amount: null, unit: null, rates };
  }

  return {
    kind: "mixed",
    amount: totals.reduce((s, v) => s + v.amount, 0),
    unit: null,
    rates,
  };
}

/**
 * Sort key for a value column.
 *
 * Rates and totals aren't the same kind of number and can't be ordered against
 * each other honestly, but a column still has to sort. Totals sort by amount;
 * rate-only orders sort below them by their rate, so at least like sits with
 * like instead of a per-tonne figure landing among order values.
 */
export function valueSortKey(lines) {
  const v = orderValue(lines);
  if (v.kind === "total" || (v.kind === "mixed" && v.amount != null)) return v.amount;
  if (v.kind === "rate") return -1 / (v.amount || 1);   // below every total, ordered among themselves
  return null;                                          // blanks sink, per sortRows
}
