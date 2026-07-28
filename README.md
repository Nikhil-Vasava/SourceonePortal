# SourceOne ERP — Import/Export Trading Platform

Workflow: **Dashboard → Purchase → Booking → Supplier → Buyer**, with **Info** as the master address book.

## Run it

Requires [Node.js 18.18+](https://nodejs.org) and a PostgreSQL database
(free options: [Neon](https://neon.tech), [Supabase](https://supabase.com), or Vercel Postgres).

```
copy .env.example .env      # then fill in DATABASE_URL and SESSION_SECRET
npm install
npm run db:setup            # creates the tables and demo data
npm run dev
```

Open http://localhost:3000 · login `admin@sourceone.com` / `admin123` (or `ops@sourceone.com` / `ops123`).

Generate a `SESSION_SECRET` with:

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Deploying to GitHub + Vercel?** See [DEPLOYMENT.md](DEPLOYMENT.md).

| Command | Does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run db:push` | Apply schema changes to the database |
| `npm run db:seed` | Load demo data |
| `npm run db:studio` | Browse the database in a GUI |
| `npm run samples` | Generate test booking PDFs |

## The five tabs

### 📊 Dashboard
Pipeline status: active bookings, container lines, and counts of lines still awaiting a PO, a packing slip, or a buyer. Each card links to where the work is.

### 🧾 Purchase
Where purchase orders are created and live. Two ways in:

**⬆ Import PO** — upload an existing purchase order PDF and a **built-in parser** reads it instantly (no AI, no limits): P.O. number, date, the vendor block (name, address, phone, email), every line item split into quantity/unit and price/per-unit, plus payment terms and comments. Anything new is added to your master data automatically — an unrecognised supplier is created with its address and contact details, and unknown products are added to the catalogue — so the Info tab fills itself in as you import. The document's own P.O. number is kept; if it's missing or already used, a fresh one is assigned. Imported POs are tagged **imported** in the Source column with the raw extraction stored for auditing.

**+ Generate PO** takes a **supplier**, payment terms, a pricing term, and **as many products as you need** (each with qty, unit, price and per-unit). It auto-numbers as `NZP` + `YYMM` + `_seq` (e.g. `NZP2607_001`, resetting monthly) and produces the **PDF in your approved layout** — one table row per product.

The list shows every PO with its products, value, pricing term, which booking it's attached to (if any), an **Open** button for the PDF, and delete. You can optionally link a booking right at creation time, or leave it unlinked and attach it later from the Booking tab.

### 🚢 Booking
The grid is your tracking sheet, column for column:

| Col | Column | Source |
|---|---|---|
| A | Freight Forwarder | extracted |
| B | Booking No. | extracted |
| C | Shipping Line | extracted |
| D | Vessel Name | extracted |
| E | Voyage No. | extracted |
| F | Port of Loading | extracted |
| G | Port of Destination | extracted |
| H | Place of Delivery | extracted |
| I | Price / Cont. (In USD) | **you enter** |
| J | Booked Cont. | extracted |
| K | Loaded Cont. | **you enter** |
| L | Other Cont. (WO/Charge or W/Charge) | **you enter** |
| M | ERD | extracted |
| N | Docs Cut Off | extracted |
| O | Cargo Cut-Off | extracted |
| P | SI Sent Date | **you enter** |

Two ways in:

- **Import Booking (PDF)** — upload one or several booking confirmations. A **built-in parser** reads them instantly with no AI service, no API key and no usage limits. It's tuned for **Maersk, MSC and ONE** and normalises their different labels (Maersk "Empty Container Release Date", MSC "First Receiving", ONE "Empty Pick Up Date" all become **ERD**). It strips noise from vessel names — `MAERSK RIO DELTA 625N(NZ1)` becomes vessel `MAERSK RIO DELTA` + voyage `625N` — and reads container counts from any of the three equipment-table styles. One container line is created per booked container. The parsed values are kept on each booking for auditing.
- **Add Booking** — manual entry with dropdowns fed from the Info tab.

Every row ends with:

- **Purchase Order column** — a dropdown listing every PO that isn't already attached elsewhere. Pick one, hit **Save**, and it's linked to that booking. Linked POs appear above the dropdown as clickable PDF links with an **✕** to unlink. Add several one at a time if a booking involves more than one supplier. Linking also pushes the supplier and product onto that booking's container lines, so the Supplier tab is ready to go.
- **✏️ Edit** — fill the four columns carriers don't provide, or correct anything the AI misread.

### 🏭 Supplier
Container lines grouped by booking. Suppliers send **one packing slip covering the whole booking**, so there's a single upload button per booking group — not per container.

Upload a PDF, Word file or phone photo and every container it lists is filled in at once: container number, seal, packages, net and gross weight (all converted to kg).

Matching rules, in order:

1. Rows that already carry a container number are matched to the slip **by that number** — so a slip listing containers out of order still lands correctly. Formatting differences (`MSKU 721-1058` vs `msku7211058`) are ignored.
2. Whatever's left fills the remaining rows in the order the slip lists them.

The banner afterwards tells you how many rows were filled, how many the slip didn't cover, and whether the slip contained containers with no matching row — so a partial or oversized slip is obvious rather than silent.

Each booking header also has a **supplier + Apply to all** control, since a booking's containers usually come from one supplier. Individual rows can still be overridden.

### 🤝 Buyer
Allocate a buyer per shipment (with "apply to all lines") or per individual container line, including sale price and terms.

### 📇 Info — your address book
Six sub-tabs. Everything here populates the dropdowns everywhere else:

| Sub-tab | Contents |
|---|---|
| Suppliers | Name, address, contacts, banks, tax no, currency, payment terms, incoterm |
| Buyers | Same fields for customers |
| Shipping / Forwarder / CHA | Logistics partners |
| Products | SKU, name, category, grade, UoM, tax, cost/sale price |
| Ports | UN/LOCODE + name (e.g. NZAKL — Auckland) |
| Company | Your letterhead: name, GST/HST no, import/export no, phone, email, PO prefix, T&C minimum weight, default comments — **this is what prints on every PO** |

Click any supplier or buyer name to open a detail page for addresses, contact persons, and bank accounts. The billing address there is what appears on the PO.

## How documents are read

| Where | Document | Method |
|---|---|---|
| Booking → Import Booking | Carrier booking confirmation | **Built-in parser** — instant, offline, no limits |
| Purchase → Import PO | Purchase order PDF | **Built-in parser** — instant, offline, no limits |
| Supplier → Packing Slip | Packing list (often a photo) | Gemini AI |

### Built-in parsers (bookings and POs)

PDF text is extracted with `pdfjs-dist` running inside the app — nothing is uploaded anywhere, there are no API keys, no quotas and no per-file cost. Reading is effectively instant.

Booking layouts recognised out of the box:

| Carrier | Detected by | Notes |
|---|---|---|
| **Maersk** | "BOOKING CONFIRMATION" + transport plan | Vessel/voyage taken from the first ocean leg; ERD from the empty-container release date |
| **MSC** | "BOOKING REFERENCE" | Lloyds number stripped from the vessel name; ERD from "First Receiving", cut-off from the DRY row |
| **ONE** | "Booking Receipt Notice" | `MAERSK RIO DELTA 625N(NZ1)` split into vessel + voyage; `40'DRY HC.-5` read as 5 containers |
| Anything else | generic reader | Finds common labels; expect to fill some fields in by hand |

If a layout isn't recognised the import tells you so and points you at manual entry — it never invents values. Scanned or photographed bookings have no text layer and can't be read; those need manual entry.

To add another carrier, the parsers live in `lib/booking-parsers.js` — one function per carrier plus a `detectCarrier` check.

### Test sample bookings

`samples/` holds 12 generated bookings (4 each of Maersk, MSC and ONE) with randomised booking numbers, vessels, ports, dates and container counts — enough to exercise the importer without real carrier documents.

```
npm run samples              12 files (4 per carrier)
npm run samples -- 10        30 files (10 per carrier)
npm run samples -- 5 test    15 files into .\test
```

Each file is named after its randomly generated booking number, so repeat runs always produce importable bookings rather than duplicates. Generation and parsing are round-trip tested: files are produced from known values, then read back and compared field by field.

### AI (packing slips only)

Packing slips still need AI — supplier slips vary wildly and are often phone photos. **Gemini** is the reader. On a rate limit it waits and retries, then works through `GEMINI_FALLBACK_MODELS`, each of which carries its own quota.

The reader is named in the green confirmation banner and recorded as `_readBy` inside the stored extraction. If it fails, the error repeats what Gemini said and reminds you the fields can simply be typed in.

The Supplier tab shows the reader under the heading — struck through when no key is set.

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Primary reader |
| `GEMINI_FALLBACK_MODELS` | Models tried when the main one is limited |

Without a key the Supplier tab still works — the values just have to be typed in.

Quota errors (429) therefore only ever affect packing slips now — booking and PO imports are unaffected. If you don't want AI at all, the Supplier tab's fields can be typed in directly and the upload skipped.

`.env` is gitignored, so the key won't be committed. Rotate it if it's been shared anywhere.

## Demo data

Three bookings matching your sample documents:

- **272570395** (Maersk) — Lyttelton → Laem Chabang, 2 × 40 DRY 96. Fully worked: PO `NZP2607_001` with **two products** (LDPE 98/2 and HDPE Blow Grade) from WM - Auckland is linked, and a packing slip is extracted on container MSKU7211058 (21,400 kg net, 24 packages).
- PO `NZP2607_002` (PP Raffia Bales) is left **unlinked** so you can try the Booking dropdown straight away.
- **EBKG16673916** (MSC) — Auckland → Laem Chabang, delivery Lat Krabang/Bangkok, 2 × 40 DRY.
- **AKLG09308900** (ONE) — Tauranga → Tuticorin, 5 × 40'DRY HC, waste paper & scrap.

Also pre-loaded: 2 suppliers, 2 buyers, Maersk/MSC/ONE + forwarder + CHA, 3 products, 8 ports.

## Tech

Next.js 14 (App Router, server actions) · Prisma 6 with a Rust-free client and the `pg` driver adapter (no engine downloads, proxy-safe) · PostgreSQL · Tailwind · pdf-lib for PO generation · pdfjs-dist for reading them · Gemini REST for packing slips.

PO PDFs embed Liberation Sans from `public/fonts` so Māori macrons and other extended Latin characters render correctly (e.g. "East Tāmaki").
