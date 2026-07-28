import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionTitle } from "@/components/ui";
import { IconAlert, IconCheck, IconTrash } from "@/components/icons";
import {
  getResetCounts,
  clearPackingSlipsAction,
  clearBuyerAllocationsAction,
  deleteAllBookingsAction,
} from "@/lib/actions-reset";
import ResetButton from "@/components/ResetButton";
import SettingsPinGate, { LockOnLeave } from "@/components/SettingsPinGate";
import LockButton from "@/components/LockButton";
import { settingsUnlocked, hasSettingsPin, UNLOCK_MINUTES } from "@/lib/settings-lock";

export const dynamic = "force-dynamic";

export default async function Settings({ searchParams }) {
  requireRole("ADMIN");

  // Locked view renders inside the normal layout, so the sidebar stays visible
  // and this looks like one locked section rather than a takeover.
  if (!settingsUnlocked()) {
    return (
      <div>
        <PageHeader title="Settings" subtitle="Admin only · locked" />
        <SettingsPinGate configured={hasSettingsPin()} minutes={UNLOCK_MINUTES} />
      </div>
    );
  }

  const c = await getResetCounts();

  const resets = [
    {
      id: "slips",
      title: "Clear packing slip data",
      action: clearPackingSlipsAction,
      affects: `${c.withSlip} of ${c.lines} container lines have slip data`,
      body:
        "Removes the uploaded slip, the extracted values, and the weights, packages and " +
        "packing date on every container line. Container and seal numbers stay, so " +
        "re-uploading a slip still matches rows the same way.",
      keeps: "Bookings, purchase orders and buyer allocations are kept.",
      confirm: "CLEAR SLIPS",
    },
    {
      id: "buyers",
      title: "Clear buyer allocations",
      action: clearBuyerAllocationsAction,
      affects: `${c.withBuyer} of ${c.lines} container lines are allocated to a buyer`,
      body:
        "Removes the buyer, sale price, sale terms and allocation date from every " +
        "container line, so the Buyer tab starts empty again.",
      keeps: "Bookings, purchase orders and packing slip data are kept.",
      confirm: "CLEAR BUYERS",
    },
    {
      id: "bookings",
      title: "Delete all bookings and purchase orders",
      action: deleteAllBookingsAction,
      affects: `${c.bookings} booking${c.bookings === 1 ? "" : "s"} · ${c.lines} container line${c.lines === 1 ? "" : "s"} · ${c.pos} purchase order${c.pos === 1 ? "" : "s"}`,
      body:
        "Deletes every booking, container line and purchase order, including any " +
        "packing slip and buyer data attached to them. Start again by importing a " +
        "booking PDF.",
      keeps: "Suppliers, buyers, products, ports, company settings and users are kept.",
      confirm: "DELETE ALL",
      severe: true,
    },
  ];

  return (
    <div>
      <LockOnLeave />
      <PageHeader
        title="Settings"
        subtitle={`Admin only · unlocked for ${UNLOCK_MINUTES} minutes`}
        action={<LockButton />}
      />

      {searchParams?.done && (
        <div className="alert-success mb-5">
          <IconCheck size={18} className="mt-0.5 shrink-0 text-emerald-600" />
          <div>{decodeURIComponent(searchParams.done)}</div>
        </div>
      )}

      {searchParams?.error && (
        <div className="alert-error mb-5">
          <IconAlert size={18} className="mt-0.5 shrink-0" />
          <div><b>Reset failed.</b> {decodeURIComponent(searchParams.error)}</div>
        </div>
      )}

      <SectionTitle>Reset test data</SectionTitle>
      <p className="mb-5 max-w-2xl text-sm text-ink-500">
        For re-running the booking → purchase order → packing slip → buyer flow while
        testing. Each action clears only the stage it names. Master data on the{" "}
        <Link href="/info" className="text-brand-600 hover:underline">Info</Link> tab is
        never touched.
      </p>

      <div className="mb-8 rounded-xl border border-red-200 bg-red-50/40 p-1">
        <div className="flex items-center gap-2 px-4 py-3">
          <IconAlert size={16} className="text-red-600" />
          <span className="text-sm font-semibold text-red-900">Danger zone</span>
          <span className="text-2xs text-red-700/70">These cannot be undone</span>
        </div>

        <div className="space-y-px overflow-hidden rounded-lg">
          {resets.map(r => (
            <div key={r.id} className="bg-white p-5">
              <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
                <div className="max-w-xl">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                    {r.severe && <IconTrash size={15} className="text-red-600" />}
                    {r.title}
                  </h3>
                  <p className="mt-1 text-sm text-ink-600">{r.body}</p>
                  <p className="mt-1.5 text-2xs text-emerald-700">{r.keeps}</p>
                  <p className="mt-2 text-2xs font-medium text-ink-500">{r.affects}</p>
                </div>

                <ResetButton
                  action={r.action}
                  label={r.title}
                  confirmWord={r.confirm}
                  severe={r.severe}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <SectionTitle>Rebuild the demo data</SectionTitle>
      <p className="max-w-2xl text-sm text-ink-500">
        To get back the three sample bookings and the seeded purchase order, run{" "}
        <code className="rounded bg-ink-100 px-1.5 py-0.5 text-2xs">npm run db:seed</code>{" "}
        from the project folder. It isn&apos;t offered here because it writes fixed demo
        rows, which is rarely what you want against a live database.
      </p>
    </div>
  );
}
