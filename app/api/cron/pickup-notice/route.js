// Daily: tell operations which shipments have entered their 14-day
// empty-container pickup window.
//
// Runs from a Vercel cron (see vercel.json). Nobody clicks anything, so the
// safety properties all have to be structural:
//
//   · Idempotent — a booking is stamped once notified, so a second run today,
//     or a retry after a timeout, sends nothing further.
//   · No backfill — only windows that opened recently qualify. Without this,
//     the first deployment would email every historic booking at once.
//   · Authenticated — the URL is public, so it checks a secret before doing
//     anything. An open endpoint that sends mail is an open relay for spam.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fdate } from "@/lib/util";
import { getCompany } from "@/lib/company";
import { sendMail, mailConfigured, mailIdentity } from "@/lib/mailer";
import { pickupWindowOpens, PICKUP } from "@/lib/sla";
import { ACTIVE_BOOKING } from "@/lib/booking-scope";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Where the notice goes. Falls back to the sending mailbox rather than nowhere. */
function opsInbox() {
  const raw = process.env.OPS_NOTIFY_EMAIL || mailIdentity("OPS").user || "";
  return raw.split(/[,;]/).map(s => s.trim()).filter(Boolean);
}

function authorised(request) {
  const secret = process.env.CRON_SECRET;
  // Vercel signs its own cron invocations with this header.
  const header = request.headers.get("authorization") || "";
  if (secret && header === `Bearer ${secret}`) return true;
  // Allow a manual run only when no secret has been configured yet, so the
  // feature is testable before it's locked down — and say so in the response.
  return !secret;
}

export async function GET(request) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  if (!mailConfigured("OPS")) {
    return NextResponse.json({ skipped: "email isn't configured" }, { status: 200 });
  }
  const to = opsInbox();
  if (!to.length) {
    return NextResponse.json({ skipped: "no OPS_NOTIFY_EMAIL set" }, { status: 200 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // The window opens at ERD − 14 and we care until ERD itself. Anything whose
  // ERD is already past is left alone: it's too late to be a useful prompt,
  // and it stops an old booking triggering mail the first time this runs.
  const from = new Date(today);
  const until = new Date(today);
  until.setDate(until.getDate() + PICKUP.days);
  // End of that day, not its midnight. ERD values carry a time, so a plain
  // midnight bound drops a booking whose window opens exactly today — it would
  // still be caught tomorrow, but the notice is meant to arrive on day one.
  until.setHours(23, 59, 59, 999);

  const due = await prisma.booking.findMany({
    where: {
      ...ACTIVE_BOOKING,
      pickupNoticeAt: null,
      deliveredAt: null,
      erd: { gte: from, lte: until },
    },
    include: { lines: true, shippingLine: true },
    orderBy: { erd: "asc" },
  });

  // A booking whose containers are already packed needs no prompt.
  const worth = due.filter(b => !b.lines.some(l => l.packingSlipFile));

  if (!worth.length) {
    return NextResponse.json({ checked: due.length, notified: 0 });
  }

  const company = await getCompany();
  const sent = [];
  const failed = [];

  for (const b of worth) {
    const opens = pickupWindowOpens(b.erd);
    const daysLeft = Math.max(0, Math.round((new Date(b.erd) - today) / 86_400_000));

    const lines = [
      `The empty-container pickup window is open for booking ${b.number}.`,
      "",
      `  Empty collection date (ERD): ${fdate(b.erd)}  —  ${daysLeft} day${daysLeft === 1 ? "" : "s"} away`,
      `  Window opened:               ${fdate(opens)}`,
      `  Route:                       ${b.pol || "?"} → ${b.pod || "?"}`,
      b.shippingLine?.name ? `  Shipping line:               ${b.shippingLine.name}` : null,
      b.vessel ? `  Vessel:                      ${b.vessel}${b.voyage ? ` / ${b.voyage}` : ""}` : null,
      b.bookedContainers != null ? `  Containers:                  ${b.bookedContainers}` : null,
      b.emptyDepot ? `  Empty depot:                 ${b.emptyDepot}` : "  Empty depot:                 not recorded",
      "",
      "Please arrange collection of the empties.",
      "",
      `— ${company?.name || "SourceOne"} portal`,
    ].filter(l => l !== null);

    try {
      await sendMail({
        to,
        subject: `Empty pickup due ${fdate(b.erd)} — booking ${b.number}`,
        text: lines.join("\n"),
      }, "OPS");
      // Stamped only after the send succeeds, so a failure is retried tomorrow
      // rather than silently swallowed.
      await prisma.booking.update({
        where: { id: b.id },
        data: { pickupNoticeAt: new Date() },
      });
      sent.push(b.number);
    } catch (e) {
      failed.push({ booking: b.number, reason: e.message });
    }
  }

  return NextResponse.json({
    checked: due.length,
    notified: sent.length,
    bookings: sent,
    ...(failed.length && { failed }),
    ...(!process.env.CRON_SECRET && { warning: "CRON_SECRET is not set — this endpoint is publicly runnable" }),
  });
}
