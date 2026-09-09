// Filters for the audit trail.
//
// A plain GET form, so every view is a real URL: an admin can bookmark
// "everything Nikhil deleted in August" or paste it to someone else, and the
// back button walks back through what they looked at. No client state at all.

import Link from "next/link";

export default function AuditFilters({ people, areas, actions, current, shown, matched, total }) {
  const filtering = Boolean(current.who || current.area || current.action || current.q || current.from || current.to);

  return (
    <div className="card mb-5">
      <form method="get" action="/audit" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-2">
          <span className="label">Search</span>
          <input name="q" defaultValue={current.q || ""} className="input"
                 placeholder="PO number, booking, name…" />
        </div>

        <div>
          <span className="label">Who</span>
          <select name="who" defaultValue={current.who ?? ""} className="input">
            <option value="">Anyone</option>
            {people.map(p => (
              <option key={p.userId} value={p.userId}>{p.userName}</option>
            ))}
          </select>
        </div>

        <div>
          <span className="label">Area</span>
          <select name="area" defaultValue={current.area ?? ""} className="input">
            <option value="">Everything</option>
            {Object.entries(areas).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <span className="label">Did what</span>
          <select name="action" defaultValue={current.action ?? ""} className="input">
            <option value="">Anything</option>
            {actions.map(a => (
              <option key={a} value={a}>{a.charAt(0) + a.slice(1).toLowerCase()}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="label">From</span>
            <input type="date" name="from" defaultValue={current.from || ""} className="input" />
          </div>
          <div>
            <span className="label">To</span>
            <input type="date" name="to" defaultValue={current.to || ""} className="input" />
          </div>
        </div>

        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-6">
          <button className="btn">Apply</button>
          {filtering && <Link href="/audit" className="btn-secondary">Clear</Link>}
          <span className="ml-auto text-2xs text-ink-400">
            {filtering
              ? `${matched} of ${total} entries match — showing ${shown}`
              : `${total} entries`}
          </span>
        </div>
      </form>
    </div>
  );
}
