/**
 * Bring existing bookings onto the ERD rule.
 *
 *   npm run erd            dry run — shows every change it would make
 *   npm run erd:apply      writes them
 *   npm run erd:apply -- --force   include ones a person has edited by hand
 *
 * ERD used to be read from the carrier's PDF. It is now calculated as ETD minus
 * fourteen days (see deriveErd in lib/booking-parsers.js). New imports already
 * follow the new rule; bookings imported before the change still carry whatever
 * their document said, so the two rules coexist in the register until this runs.
 *
 * HAND-EDITED ROWS ARE SKIPPED. If someone corrected an ERD because the carrier
 * gave them a firm date, that is better information than a calculation and this
 * must not quietly throw it away. The audit trail is what makes that knowable:
 * an ERD a person changed leaves an entry naming the field. Note the limit —
 * the trail only covers edits made since it was added, so for older bookings it
 * cannot tell, and the dry run is the real safeguard. Read the list.
 */
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Must happen before lib/db is loaded — a plain script gets no .env from Next.
if (!process.env.DATABASE_URL) {
  const envFile = path.join(ROOT, ".env");
  if (fs.existsSync(envFile) && typeof process.loadEnvFile === "function") {
    process.loadEnvFile(envFile);
  }
}

const { prisma } = require("../lib/db.js");
// file:// URL, or Windows reads the drive letter as a protocol.
const { deriveErd, ERD_DAYS_BEFORE_ETD } =
  await import(pathToFileURL(path.join(ROOT, "lib/booking-parsers.js")).href);

const apply = process.argv.includes("--apply");
const force = process.argv.includes("--force");

const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
/** Stored at midday UTC, matching the rest of the app. */
const toDate = (s) => (s ? new Date(`${s}T12:00:00.000Z`) : null);

const bookings = await prisma.booking.findMany({
  select: { id: true, number: true, etd: true, erd: true, vessel: true },
  orderBy: { id: "asc" },
});

// Which bookings has someone edited the ERD on? One query rather than one per
// booking — there is no index that would make 19 round trips worthwhile.
const erdEdits = new Set();
try {
  const entries = await prisma.auditLog.findMany({
    where: { entity: "Booking", action: "UPDATE" },
    select: { entityId: true, changes: true, userName: true, at: true },
  });
  for (const e of entries) {
    const touched = Array.isArray(e.changes) && e.changes.some(c => c?.field === "erd");
    if (touched && e.entityId) erdEdits.add(e.entityId);
  }
} catch {
  // No audit table yet (db:push not run). Not fatal — it only means we can't
  // spot hand edits, and the dry run still shows everything.
  console.log("(no audit trail available — hand-edited rows can't be detected)\n");
}

const changes = [], skipped = [], noEtd = [];

for (const b of bookings) {
  const etd = iso(b.etd);
  if (!etd) { noEtd.push(b); continue; }

  const want = deriveErd(etd);
  const have = iso(b.erd);
  if (want === have) continue;

  if (erdEdits.has(b.id) && !force) { skipped.push({ b, have, want }); continue; }
  changes.push({ b, have, want });
}

const pad = (s, n) => String(s ?? "").padEnd(n);

if (changes.length) {
  console.log(`ERD = ETD − ${ERD_DAYS_BEFORE_ETD} days\n`);
  console.log(`  ${pad("booking", 16)}${pad("ETD", 12)}${pad("now", 12)}${pad("becomes", 12)}shift`);
  console.log("  " + "-".repeat(62));
  for (const c of changes) {
    const days = c.have
      ? Math.round((new Date(`${c.want}T12:00:00Z`) - new Date(`${c.have}T12:00:00Z`)) / 86400000)
      : null;
    const shift = days === null ? "was blank" : `${days > 0 ? "+" : ""}${days} day${Math.abs(days) === 1 ? "" : "s"}`;
    console.log(`${apply ? "~" : " "} ${pad(c.b.number, 16)}${pad(iso(c.b.etd), 12)}${pad(c.have || "—", 12)}${pad(c.want, 12)}${shift}`);
  }
} else {
  console.log("Every booking with an ETD already matches the rule.");
}

if (skipped.length) {
  console.log(`\nSkipped — someone set these by hand (use --force to overwrite):`);
  for (const s of skipped) {
    console.log(`  ${pad(s.b.number, 16)}keeping ${s.have || "—"}, would have been ${s.want}`);
  }
}

if (noEtd.length) {
  console.log(`\nNo ETD, so nothing to calculate from — these keep whatever ERD they have:`);
  for (const b of noEtd) console.log(`  ${pad(b.number, 16)}ERD ${iso(b.erd) || "not set"}`);
  console.log("  Add an ETD with Edit and re-run, or set the ERD directly.");
}

if (apply && changes.length) {
  for (const c of changes) {
    await prisma.booking.update({ where: { id: c.b.id }, data: { erd: toDate(c.want) } });
  }
  console.log(`\nUpdated ${changes.length} booking${changes.length === 1 ? "" : "s"}.`);
} else if (changes.length) {
  console.log(`\n${changes.length} to change. Nothing was written — re-run with --apply.`);
}

await prisma.$disconnect();
