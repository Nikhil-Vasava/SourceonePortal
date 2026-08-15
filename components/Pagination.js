import Link from "next/link";
import { pageHref } from "@/lib/table-query";

// Page links for a table.
//
// Plain links rather than buttons, so the page stays a server component, each
// page is a real URL someone can bookmark or send, and the back button walks
// back through pages the way people expect.

/** 1 … 4 5 [6] 7 8 … 20 — never more than a handful of numbers. */
function windowed(page, pages, span = 2) {
  const out = [];
  const push = (v) => { if (out[out.length - 1] !== v) out.push(v); };
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= span) push(i);
    else push("…");
  }
  return out;
}

export default function Pagination({ basePath, query, page, pages, from, to, total, unit = "row" }) {
  if (pages <= 1) return null;

  const link = "rounded-md border border-ink-200 px-2.5 py-1 text-xs transition hover:border-brand-500 hover:text-brand-500";
  const muted = "rounded-md border border-transparent px-2.5 py-1 text-xs text-ink-300";

  return (
    <nav className="mt-3 flex flex-wrap items-center justify-between gap-3" aria-label="Pagination">
      <p className="text-2xs text-ink-400">
        Showing <b className="text-ink-600">{from}–{to}</b> of {total} {unit}{total === 1 ? "" : "s"}
      </p>

      <div className="flex items-center gap-1">
        {page > 1
          ? <Link href={pageHref(basePath, query, page - 1)} className={link} rel="prev">Prev</Link>
          : <span className={muted} aria-hidden="true">Prev</span>}

        {windowed(page, pages).map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="px-1 text-2xs text-ink-400">…</span>
          ) : p === page ? (
            <span key={p} aria-current="page"
                  className="rounded-md border border-brand-500 bg-brand-500/10 px-2.5 py-1 text-xs font-semibold text-brand-400">
              {p}
            </span>
          ) : (
            <Link key={p} href={pageHref(basePath, query, p)} className={link}>{p}</Link>
          )
        )}

        {page < pages
          ? <Link href={pageHref(basePath, query, page + 1)} className={link} rel="next">Next</Link>
          : <span className={muted} aria-hidden="true">Next</span>}
      </div>
    </nav>
  );
}
