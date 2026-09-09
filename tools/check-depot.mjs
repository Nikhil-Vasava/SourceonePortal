/**
 * Does the depot come out of these booking PDFs?
 *
 *   npm run depot -- samples/whatever.pdf other.pdf ...
 *   npm run depot -- --text samples/whatever.pdf     also dump the raw text
 *
 * Why this exists: the depot is an ADDRESS spread over several lines, and the
 * parsers match on labels in the PDF's extracted text — which is not always
 * laid out the way the page looks. A pattern that reads perfectly against the
 * printed page can still match nothing against the text. This runs the real
 * parser over a real file and prints what came back, so a miss is visible in
 * seconds instead of turning up as a blank field weeks later.
 *
 * --text prints the extracted text around the depot label, which is what to
 * paste back if a pattern needs correcting.
 */
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const showText = args.includes("--text");
const files = args.filter(a => !a.startsWith("--"));

if (!files.length) {
  console.log("Usage: npm run depot -- <booking.pdf> [more.pdf ...] [--text]");
  console.log("Run it from the sourceone-erp folder. Quote any path containing spaces.");
  process.exit(1);
}

// pathToFileURL, not the bare path. On Windows `import("C:\\...\\lib\\x.js")`
// fails with ERR_UNSUPPORTED_ESM_URL_SCHEME, because "C:" is read as a URL
// protocol. A file:// URL is the only form that works on every platform.
const load = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);

let pdfToText, parseBookingText;
try {
  ({ pdfToText } = await load("lib/pdf-text.js"));
  ({ parseBookingText } = await load("lib/booking-parsers.js"));
} catch (err) {
  if (/Unexpected token 'export'|Cannot use import statement/.test(err.message)) {
    console.error(
      "This script needs Node 22.7 or newer — earlier versions can't load the app's\n" +
      "library files directly from a plain script. You're on " + process.version + ".\n" +
      "Everything else in the app is unaffected; this is only the checker."
    );
  } else if (/Cannot find module/.test(err.message)) {
    console.error("Run this from the sourceone-erp folder, after npm install.\n" + err.message);
  } else {
    console.error(err.message);
  }
  process.exit(1);
}

// Every label any carrier uses, so --text can show the right part of the file.
const LABELS = /Empty\s+Container\s*\n?\s*Depot|Empty[ \t]*Pick[ \t]*UP[ \t]*CY|PICK[ \t]*UP[ \t]*DEPOT[ \t]*ADDRESS|Empty[ \t]*Depot/i;

let found = 0, missed = 0;

for (const f of files) {
  const abs = path.isAbsolute(f) ? f : path.join(ROOT, f);
  if (!fs.existsSync(abs)) { console.log(`\n${f}\n  file not found`); missed++; continue; }

  const text = await pdfToText(fs.readFileSync(abs));
  const { carrier, data } = parseBookingText(text);

  console.log(`\n${path.basename(f)}`);
  console.log(`  carrier      ${carrier}`);
  console.log(`  booking      ${data.bookingNumber ?? "—"}`);
  console.log(`  ERD          ${data.erd ?? "—"}`);
  console.log(`  empty depot  ${data.emptyDepot ?? "*** not found ***"}`);

  if (data.emptyDepot) found++; else missed++;

  // Show the label's neighbourhood whether or not it matched — on a miss it's
  // the evidence needed to fix the pattern; on a hit it confirms the right
  // block was picked up rather than a lucky match somewhere else.
  if (showText || !data.emptyDepot) {
    const m = text.match(LABELS);
    if (!m) {
      console.log("  (no depot label anywhere in the extracted text — this carrier may not print one)");
    } else {
      const from = Math.max(0, m.index - 120);
      console.log("\n  --- extracted text around the label ---");
      for (const line of text.slice(from, m.index + 420).split("\n")) {
        console.log(`  | ${line}`);
      }
      console.log("  ---------------------------------------");
    }
  }
}

console.log(`\n${found} found, ${missed} missing, of ${files.length} file${files.length === 1 ? "" : "s"}.`);
