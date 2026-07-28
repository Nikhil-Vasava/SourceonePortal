import Link from "next/link";
import { IconInbox, IconArrowRight } from "@/components/icons";

/* ------------------------------------------------------------------ header */

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3 sm:mb-6 sm:gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-ink-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ status */

// Semantic colours: grey = not started, blue = in motion, green = done, red = stopped.
const STATUS_STYLES = {
  DRAFT:      "bg-ink-100 text-ink-600",
  PLANNED:    "bg-ink-100 text-ink-600",
  CONFIRMED:  "bg-brand-50 text-brand-700",
  POSTED:     "bg-brand-50 text-brand-700",
  LOADED:     "bg-brand-50 text-brand-700",
  SHIPPED:    "bg-teal-50 text-teal-700",
  IN_TRANSIT: "bg-teal-50 text-teal-700",
  DELIVERED:  "bg-emerald-50 text-emerald-700",
  RECEIVED:   "bg-emerald-50 text-emerald-700",
  ARRIVED:    "bg-emerald-50 text-emerald-700",
  PAID:       "bg-emerald-50 text-emerald-700",
  BILLED:     "bg-violet-50 text-violet-700",
  INVOICED:   "bg-violet-50 text-violet-700",
  CLOSED:     "bg-ink-100 text-ink-500",
  CANCELLED:  "bg-red-50 text-red-700",
};

export function Badge({ value, className = "" }) {
  if (value == null) return null;
  return (
    <span className={`badge badge-dot ${STATUS_STYLES[value] || "bg-ink-100 text-ink-600"} ${className}`}>
      {String(value).replace(/_/g, " ")}
    </span>
  );
}

export function Tag({ children, tone = "brand" }) {
  const tones = {
    brand: "bg-brand-50 text-brand-700",
    teal: "bg-teal-50 text-teal-700",
    ink: "bg-ink-100 text-ink-600",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
  };
  return <span className={`badge ${tones[tone] || tones.brand}`}>{children}</span>;
}

/* ------------------------------------------------------------------ tables */

export function Table({ headers, children, dense = false }) {
  return (
    <div className="card-flush overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="border-b border-ink-200/70 bg-ink-50/60">
            <tr>{headers.map((h, i) => <th key={i} className={`th ${dense ? "py-2" : ""}`}>{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-ink-100">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ states */

export function Empty({ text, action }) {
  return (
    <div className="card flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-ink-100 text-ink-400">
        <IconInbox size={22} />
      </div>
      <p className="max-w-sm text-sm text-ink-500">{text || "Nothing here yet"}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ stats */

export function Stat({ label, value, href, hint, tone = "default", progress }) {
  const tones = {
    default: "text-ink-900",
    warn: "text-amber-600",
    good: "text-emerald-600",
  };
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-ink-500">{label}</span>
        {href && <IconArrowRight size={14} className="text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-500" />}
      </div>
      <div className={`mt-2 text-2xl font-semibold tracking-tight tnum ${tones[tone] || tones.default}`}>
        {value}
      </div>
      {progress != null && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-100">
          <div className={`h-full rounded-full transition-all ${tone === "warn" ? "bg-amber-400" : "bg-brand-500"}`}
               style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
      )}
      {hint && <div className="mt-2 text-2xs text-ink-400">{hint}</div>}
    </>
  );
  return href
    ? <Link href={href} className="card card-interactive group block">{body}</Link>
    : <div className="card">{body}</div>;
}

/* ------------------------------------------------------------------ layout bits */

export function Field({ label, children, hint }) {
  return (
    <div>
      <span className="label">{label}</span>
      {children}
      {hint && <p className="mt-1 text-2xs text-ink-400">{hint}</p>}
    </div>
  );
}

export function Info({ label, value }) {
  return (
    <div className="min-w-0">
      <div className="text-2xs font-medium uppercase tracking-wide text-ink-400">{label}</div>
      <div className="mt-0.5 truncate text-sm font-medium text-ink-800">
        {value ?? <span className="text-ink-300">—</span>}
      </div>
    </div>
  );
}

export function SmartButton({ href, label, count }) {
  return (
    <Link href={href} className="btn-secondary">
      {label}
      <span className="ml-1 rounded bg-brand-50 px-1.5 py-0.5 text-2xs font-semibold text-brand-700 tnum">{count}</span>
    </Link>
  );
}

export function SectionTitle({ children, right }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold text-ink-800">{children}</h2>
      {right}
    </div>
  );
}
