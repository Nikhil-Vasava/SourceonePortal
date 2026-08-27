// Adds the 288 export buyers from the three sales sheets to a live database.
//
// Deliberately NOT modelled on import-partners.mjs. That script treats its
// sheet as the whole truth and deactivates or deletes any partner missing from
// it — correct there, catastrophic here, because these three sheets say nothing
// about the 19 NZ suppliers or the 7 original buyers. This one only ever adds.
//
//   node tools/import-buyers.mjs            # dry run — prints what it would do
//   node tools/import-buyers.mjs --apply    # writes
//
// Re-runnable: matching names are skipped, not duplicated, so a half-finished
// run can simply be run again.

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Next.js reads .env for us; a plain node script doesn't, so do it here before
// anything touches process.env. Without this the script dies on a missing
// DATABASE_URL that is sitting right there in the file.
if (!process.env.DATABASE_URL) {
  const envFile = path.join(ROOT, ".env");
  if (fs.existsSync(envFile) && typeof process.loadEnvFile === "function") {
    process.loadEnvFile(envFile);
  }
}
if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL is not set and could not be read from .env.\n" +
    "Run this from the project root with a .env present, or set the variable first."
  );
  process.exit(1);
}

// Use the app's own client, not `new PrismaClient()`. The schema sets
// engineType = "client", so queries run through the WASM compiler and a driver
// adapter is mandatory — constructing a bare client fails with P2038,
// "Missing configured driver adapter".
const { prisma } = require("../lib/db.js");
const { seaBuyerRecords } = require("../prisma/buyers-sea.js");

const APPLY = process.argv.includes("--apply");
const say = (...a) => console.log(...a);

/** Names differ in punctuation and case between sheets; compare on the letters. */
const key = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

async function main() {
  const incoming = seaBuyerRecords();

  const existing = await prisma.partner.findMany({
    select: { id: true, name: true, type: true },
  });
  const byKey = new Map(existing.map(p => [key(p.name), p]));

  const toCreate = [];
  const clashes = [];
  for (const rec of incoming) {
    const hit = byKey.get(key(rec.name));
    if (hit) clashes.push({ rec, hit });
    else toCreate.push(rec);
  }

  // The sheets themselves list one company twice — same name bar punctuation,
  // different materials and a different rep. Both are kept, because merging
  // them would silently discard one set of details, but it's worth saying so:
  // they'll sit next to each other in the buyer list until someone decides.
  const withinBatch = new Map();
  const twins = [];
  for (const rec of incoming) {
    const k = key(rec.name);
    if (withinBatch.has(k)) twins.push([withinBatch.get(k), rec.name]);
    else withinBatch.set(k, rec.name);
  }

  say(`Sheets            : ${incoming.length} buyers`);
  say(`Already in the DB : ${existing.length} partners`);
  say(`  would create    : ${toCreate.length}`);
  say(`  already present : ${clashes.length}`);

  if (clashes.length) {
    say("\nSkipped — a partner with this name already exists:");
    for (const { rec, hit } of clashes.slice(0, 20)) {
      say(`  · ${rec.name}  →  #${hit.id} ${hit.name} (${hit.type})`);
    }
    if (clashes.length > 20) say(`  … and ${clashes.length - 20} more`);
  }

  if (twins.length) {
    say(`\nListed twice in the sheets themselves (${twins.length}) — both kept:`);
    for (const [a, b] of twins) say(`  · "${a}" and "${b}"`);
    say("  Merge them from Info → Buyers if you'd rather have one record.");
  }

  // Nothing outside the incoming set is touched. Stated explicitly because the
  // sibling script's habit of pruning is exactly what must not happen here.
  say("\nUntouched: every partner already in the database — no updates, no deletions.");

  if (!APPLY) {
    say("\nDry run. Re-run with --apply to write these.");
    return;
  }

  let made = 0;
  for (const rec of toCreate) {
    // One at a time rather than createMany: nested contact rows need it, and a
    // single bad row shouldn't cost the whole import.
    try {
      await prisma.partner.create({ data: rec });
      made++;
    } catch (e) {
      say(`  ! ${rec.name}: ${e.message.split("\n")[0]}`);
    }
  }

  const after = await prisma.partner.count({ where: { type: { in: ["CUSTOMER", "BUYER"] } } });
  say(`\nCreated ${made} buyers. Buyers/customers in the database now: ${after}.`);
  say("They appear on the Buyer tab and under Info → Buyers.");
}

main()
  .catch(e => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
