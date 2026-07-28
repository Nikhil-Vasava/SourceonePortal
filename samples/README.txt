SAMPLE BOOKING CONFIRMATIONS
============================

12 generated test bookings — 4 each in the Maersk, MSC and ONE layouts,
with randomised booking numbers, vessels, voyages, ports, dates and
container counts. Use them to exercise Booking -> Import Booking.

Every file here has been round-trip tested: it was generated from known
values, then read back through the parser and checked field by field.

To generate a fresh batch (from the sourceone-erp folder):

    npm run samples              12 files (4 per carrier) into .\samples
    npm run samples -- 10        30 files (10 per carrier)
    npm run samples -- 5 test    15 files into .\test

Re-running overwrites nothing — each file is named after its randomly
generated booking number, so you always get new bookings to import.

Note: these are for testing the importer only. They are not real carrier
documents and must not be used as shipping paperwork.
