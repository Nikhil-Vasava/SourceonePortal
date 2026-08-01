# Carrier API integration — plan

How Maersk (and later ONE and MSC) plug into SourceOne for **rates, booking,
tracking, and keeping our booking rows current**.

---

## 1. The finding that shapes everything

Maersk, ONE and MSC all publish APIs built on **DCSA** standards (Digital
Container Shipping Association — founded by these same carriers plus CMA CGM,
Hapag-Lloyd, Evergreen, HMM, Yang Ming and ZIM).

That means we should build to **DCSA, not to Maersk**. One integration, three
configurations — instead of three separate integrations.

### What each of your three carriers has actually implemented

| Capability | Maersk | ONE | MSC | Standard |
|---|---|---|---|---|
| **Track & trace** | 2.2 | 2.2 | 2.2 (+1.2) | DCSA T&T 2.2 |
| **Booking** create / amend / cancel | 2.0 Beta | 2.0 Beta | **not implemented** | DCSA Booking 2.0 |
| **Vessel schedules** | OVS 3.0 Beta | OVS 3.0 | OVS 3.0 | DCSA OVS |
| **Commercial schedules** | — | 1.0 | 1.0 | DCSA CS 1.0 |
| **Bill of lading** | 2.0 | 3.0 | — | DCSA BoL |
| **Rates / pricing** | proprietary | proprietary | proprietary | **no DCSA standard** |

Three consequences worth planning around:

1. **Tracking standardises beautifully.** One adapter, all three carriers, near-identical code. Highest value, lowest risk — do it first.
2. **Booking standardises partly.** Maersk and ONE support DCSA Booking 2.0 (both still Beta). **MSC does not** — MSC bookings stay manual/PDF for the foreseeable future.
3. **Rates don't standardise at all.** There is no DCSA pricing standard. Maersk's Offers API is proprietary and each carrier will differ. This is the most bespoke work and the least reusable.

> **This is why the PDF import stays.** It's not a stopgap to delete once the
> APIs land — it's the permanent path for MSC bookings, for any carrier outside
> the three, and the fallback whenever an API is down or a booking was made
> outside the system.

---

## 2. The repeated booking data — what it is and where it comes from

Most of a booking request is the same every single time. The API will reject a
booking if any of it is missing or malformed, so this needs to be right *before*
we write a line of integration code.

| What the carrier needs | Where it comes from today | Status |
|---|---|---|
| Shipper / booking party name, address | `CompanySetting` | have it |
| Shipper tax / IEC number | `CompanySetting.gstNo`, `.importExportNo` | have it |
| Booking contact name, email, phone | `CompanySetting.phone`, `.email` | partial — no named contact |
| Consignee / notify party | `Partner` (buyer) + `Address` | have it |
| Port of loading / discharge as **UN/LOCODE** | `Port.code` (NZAKL, INMUN…) | have it |
| Payment terms, incoterm | `Partner.paymentTerms`, `.incoterm` | have it |
| Commodity description | `Product.name`, `Booking.commodity` | have it |
| **HS code** (customs tariff) | — | **missing** |
| **Container ISO size/type code** (22G1, 42G1, 45G1) | `Booking.containerType` is free text ("40 DRY HC") | **needs mapping** |
| **Service contract number** per carrier | `Booking.serviceContract` is per-booking free text | **should be per-carrier** |
| **Carrier SCAC code** (MAEU, ONEY, MSCU) | — | **missing** |
| API credentials per carrier | — | **missing** (env vars, never the database) |

**Four gaps to close, all small:**

- `Product.hsCode` — a string per product. Customs needs it, the booking API needs it.
- `Partner.scac` — on shipping-line partners only. Identifies the carrier in DCSA payloads.
- A `CarrierAccount` table — one row per carrier: enabled flag, service contract number, default container type, last sync time. Credentials stay in environment variables.
- A container-type lookup — "40 DRY HC" → `45G1`. Small fixed table; the app already stores free text, so this maps rather than replaces.

Everything else we already collect. The Info tab was built for exactly this.

---

## 3. Architecture

```
lib/carriers/
  index.js            registry — pick an adapter by SCAC, report what it supports
  types.js            the shape every adapter returns (our vocabulary, not theirs)
  dcsa/
    tracking.js       DCSA T&T 2.2      → works for Maersk, ONE, MSC
    booking.js        DCSA Booking 2.0  → works for Maersk, ONE
    schedules.js      DCSA OVS / CS
  maersk.js           auth + base URL + Offers (rates) + any quirks
  one.js              auth + base URL  (mostly inherits the DCSA modules)
  msc.js              auth + base URL  (tracking + schedules only)
```

The rule: **adapters translate carrier vocabulary into ours and never leak
carrier-shaped data upward.** The rest of the app keeps talking about bookings,
containers and dates. Adding a fourth carrier should touch only this folder.

Every adapter declares what it can do:

```js
{ scac: "MSCU", tracking: true, booking: false, rates: false, schedules: true }
```

The UI reads that and hides what a carrier can't do, rather than offering a
button that fails.

### Authentication

Maersk uses OAuth2 client-credentials **plus** a `Consumer-Key` header on every
request — both the token call and the calls that follow. Tokens are cached in
memory per carrier and refreshed on expiry. Credentials live in environment
variables (`MAERSK_CLIENT_ID`, `MAERSK_CLIENT_SECRET`, `MAERSK_CONSUMER_KEY`),
never in the database, never in the repo.

---

## 4. Where each feature lives in the app

### Rates — new screen: **Booking → Check rates**

Enter origin, destination, date and container type; get offers back with the
full price breakdown (base ocean freight, bunker, terminal handling, surcharges).
Pick one and it pre-fills a booking.

Maersk only at first. The screen says so plainly rather than showing an empty
result for the others.

### Booking — extend **Booking → Add booking**

Three routes to a booking row, all landing in the same place:

1. **Book with carrier** (new) — Maersk and ONE. Submits via API, stores the carrier's booking reference.
2. **Import PDF** (existing, unchanged) — MSC and everything else.
3. **Add manually** (existing, unchanged).

### Tracking — extend the existing **Tracking** tab

The SLA clocks are already there. Add:

- A **Sync now** button per shipment
- A **carrier event timeline** — gate in, loaded, vessel departed, transshipped, discharged, gate out
- Automatic sync via a scheduled job

This is where the API earns its keep: `actualDeparture` and `deliveredAt`
currently have to be typed in by hand, and they're what the whole 45-day clock
depends on. **The carrier can fill both in for us.**

### Booking confirmation — webhook endpoint

`app/api/carriers/[scac]/webhook/route.js`

DCSA Booking 2.0 defines asynchronous status callbacks, and Maersk supports
booking status webhooks. When a booking is confirmed the carrier calls us, and
we update the booking: status → `CONFIRMED`, plus vessel, voyage, ETD, ETA and
the cut-off dates.

Webhooks get missed, so a scheduled reconciliation job polls anything still
`DRAFT` or `PENDING` after a few hours. Belt and braces — a missed confirmation
is a container that doesn't get loaded.

### Settings — new **Carriers** section

Per carrier: enabled toggle, credential status (configured / missing — never
showing the secret), service contract number, SCAC, default container type, last
successful sync, recent errors.

---

## 5. Suggested order of work

**Phase 0 — master data (small, unblocks everything)**
Add `Product.hsCode`, `Partner.scac`, the `CarrierAccount` table, the container
type mapping, and a `CarrierEvent` table for the tracking timeline. Surface the
new fields on the Info tab.

**Phase 1 — tracking, all three carriers**
One DCSA T&T 2.2 adapter. Sync events, auto-fill `actualDeparture` and
`deliveredAt`, show the timeline, schedule a daily job. *Biggest operational win
and it works for every carrier immediately.*

**Phase 2 — booking, Maersk then ONE**
DCSA Booking 2.0 create/amend/cancel, the webhook endpoint, the reconciliation
job. ONE should be close to free once Maersk works.

**Phase 3 — rates, Maersk**
Proprietary Offers API. Rate check screen, offer → booking hand-off.

**Phase 4 — as ONE and MSC credentials arrive**
Add their config. Tracking should need no new code. Booking for ONE should need
very little. MSC booking stays on PDF import.

---

## 6. Risks and open questions

**Booking 2.0 is Beta at both Maersk and ONE.** Beta APIs change. Expect
breakage and keep the PDF path healthy.

**DCSA warns implementations vary.** Their own conformance page says adopters
"should expect some variation and configuration effort when connecting with
multiple parties." Same standard version does not guarantee identical behaviour —
budget for per-carrier quirks even inside the shared adapter.

**Test in the sandbox first.** A booking API creates real commercial commitments.
Nothing points at production until the whole flow has been exercised end to end
against a test environment.

**I could not read Maersk's actual API documentation.** The developer portal
renders client-side and the detailed specs sit behind a login. Endpoint paths,
exact payload shapes and rate limits all need confirming against the real docs
before Phase 2 starts. The architecture above holds regardless — it's driven by
which DCSA standards each carrier has adopted, which is published openly.

**Questions worth answering before Phase 2:**

- Does your Maersk agreement cover booking, or only tracking and rates?
- Do you have sandbox credentials as well as production?
- One Maersk service contract or several by trade lane?
- Should an API booking be auto-confirmed, or reviewed by a person first?

---

## Sources

- [DCSA standard conformance — who has implemented what](https://dcsa.org/standard-conformance)
- [Maersk Developer Portal](https://developer.maersk.com/)
- [ONE Developer Portal](https://developers.one-line.com/)
- [MSC direct integrations](https://www.msc.com/en/solutions/digital-solutions/direct-integrations)
- [Maersk Offers API — security and tokens](https://api.productmanagement.maersk.com/offers/docs/overview/apisecurity.html)
- [Maersk Offers API — endpoints](https://api.productmanagement.maersk.com/offers/docs/endpoints/index.html)
- [DCSA developer portal](https://developer.dcsa.org/)
