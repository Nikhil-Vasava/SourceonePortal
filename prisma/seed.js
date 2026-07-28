const bcrypt = require("bcryptjs");
const { prisma } = require("../lib/db");

async function main() {
  if (await prisma.user.count() > 0) { console.log("Already seeded, skipping."); return; }

  // --- Users ---
  await prisma.user.create({ data: { email: "admin@sourceone.com", name: "Keyur (Admin)", password: bcrypt.hashSync("admin123", 10), role: "ADMIN" } });
  await prisma.user.create({ data: { email: "ops@sourceone.com", name: "Ops Manager", password: bcrypt.hashSync("ops123", 10), role: "MANAGER" } });

  // --- Company (PO header) ---
  await prisma.companySetting.deleteMany();
  await prisma.companySetting.create({ data: {
    name: "SOURCEONE", legalName: "VENTURES NZ LTD",
    address: "Greenvalley Rise, Glenfield, Auckland - 0629, New Zealand.",
    gstNo: "143-154-076", importExportNo: "40735917J",
    phone: "+64 (027) 350 1499", email: "Info@sourceoneventures.nz",
    poPrefix: "NZP", minimumWeight: "20 MT.", defaultComments: "Currency mentioned is in USD",
  }});

  // --- Ports ---
  await prisma.port.createMany({ data: [
    { code: "NZAKL", name: "Auckland", country: "New Zealand" },
    { code: "NZTRG", name: "Tauranga", country: "New Zealand" },
    { code: "NZLYT", name: "Lyttelton", country: "New Zealand" },
    { code: "AEJEA", name: "Jebel Ali", country: "UAE" },
    { code: "INMUN", name: "Mundra", country: "India" },
    { code: "INNSA", name: "Nhava Sheva", country: "India" },
    { code: "CNSHA", name: "Shanghai", country: "China" },
    { code: "VNSGN", name: "Ho Chi Minh", country: "Vietnam" },
  ]});

  // --- Suppliers ---
  const wm = await prisma.partner.create({ data: {
    name: "WM - Auckland", type: "VENDOR", country: "New Zealand", region: "APAC",
    currency: "USD", paymentTerms: "NET30", incoterm: "FAS",
    email: "amorgan@wm.nz", phone: "+64 (027) 801 4091", taxId: "108-442-901",
    addresses: { create: [{ type: "BILLING", line1: "318 East Tamaki Road", city: "East Tāmaki", state: "Auckland", country: "New Zealand", zip: "2013" }] },
    contacts: { create: [{ name: "A. Morgan", role: "Sales Manager", email: "amorgan@wm.nz", phone: "+64 (027) 801 4091" }] },
  }});
  const green = await prisma.partner.create({ data: {
    name: "Greencycle Recyclers Ltd", type: "VENDOR", country: "New Zealand", region: "APAC",
    currency: "NZD", paymentTerms: "ADVANCE", incoterm: "FOB",
    email: "sales@greencycle.co.nz", phone: "+64 (09) 555 2210",
    addresses: { create: [{ type: "BILLING", line1: "12 Rothwell Avenue", city: "Albany", state: "Auckland", country: "New Zealand", zip: "0632" }] },
    contacts: { create: [{ name: "Sarah Lin", role: "Operations", email: "sarah@greencycle.co.nz" }] },
  }});

  // --- Buyers ---
  await prisma.partner.create({ data: {
    name: "Dubai Trading House LLC", type: "CUSTOMER", country: "UAE", region: "MEA",
    currency: "USD", paymentTerms: "LC", incoterm: "CIF", email: "purchase@dubaitrading.ae",
    addresses: { create: [{ type: "BILLING", line1: "Warehouse 12, Jebel Ali Free Zone", city: "Dubai", country: "UAE" }] },
    contacts: { create: [{ name: "Ahmed Al Rashid", role: "Procurement Head", email: "ahmed@dubaitrading.ae" }] },
  }});
  await prisma.partner.create({ data: {
    name: "Shanghai Polymer Imports Co.", type: "CUSTOMER", country: "China", region: "APAC",
    currency: "USD", paymentTerms: "NET30", incoterm: "CFR", email: "buy@shpolymer.cn",
    addresses: { create: [{ type: "BILLING", line1: "888 Pudong Avenue", city: "Shanghai", country: "China" }] },
  }});

  // --- Logistics partners ---
  const maersk = await prisma.partner.create({ data: { name: "Maersk Line", type: "SHIPPING_LINE", country: "Denmark", currency: "USD" } });
  const fwd = await prisma.partner.create({ data: { name: "Speedway Logistics", type: "FORWARDER", country: "New Zealand", currency: "USD" } });
  const cha = await prisma.partner.create({ data: { name: "Auckland Customs Services", type: "CHA", country: "New Zealand", currency: "NZD" } });

  // --- Products ---
  const ldpe = await prisma.product.create({ data: { sku: "LDPE-98-2", name: "LDPE 98/2", category: "Plastics", grade: "98/2", uom: "MT", weightKg: 1000, taxRate: 0, costPrice: 260, salePrice: 320 } });
  const hdpe = await prisma.product.create({ data: { sku: "HDPE-BLOW", name: "HDPE Blow Grade", category: "Plastics", grade: "A", uom: "MT", weightKg: 1000, taxRate: 0, costPrice: 340, salePrice: 415 } });
  await prisma.product.create({ data: { sku: "PP-RAFFIA", name: "PP Raffia Bales", category: "Plastics", grade: "B", uom: "MT", weightKg: 1000, taxRate: 0, costPrice: 295, salePrice: 360 } });

  await prisma.pricelistItem.createMany({ data: [
    { partnerId: wm.id, productId: ldpe.id, price: 260, currency: "USD", minQty: 20 },
    { partnerId: green.id, productId: hdpe.id, price: 340, currency: "USD", minQty: 20 },
  ]});

  // --- Carriers seen in the sample documents ---
  const msc = await prisma.partner.create({ data: { name: "MSC Mediterranean Shipping Company", type: "SHIPPING_LINE", country: "Switzerland", currency: "USD" } });
  const one = await prisma.partner.create({ data: { name: "Ocean Network Express (ONE)", type: "SHIPPING_LINE", country: "Singapore", currency: "USD" } });

  // === Booking 1 — Maersk (Lyttelton -> Laem Chabang) ===
  const b1 = await prisma.booking.create({ data: {
    number: "272570395", status: "CONFIRMED",
    shippingLineId: maersk.id, freightForwarder: "SOURCEONE VENTURES NZ LIMITED",
    vessel: "MAERSK RIO BRAVO", voyage: "627N",
    pol: "Lyttelton", pod: "Laem Chabang", placeOfDelivery: "Laem Chabang, Thailand",
    bookedContainers: 2, loadedContainers: 2, containerType: "40 DRY 96",
    pricePerContainer: 1850,
    erd: new Date("2026-07-03"), cargoCutOff: new Date("2026-07-09"), docsCutOff: new Date("2026-07-08"),
    siSentDate: new Date("2026-07-07"),
    etd: new Date("2026-07-12"), eta: new Date("2026-08-11"),
    commodity: "Plastic, plastic articles, used", serviceContract: "300312459",
    totalWeightKg: 44000, sourceFile: "DB_aabhicdihhgc0x0147.pdf", containerType: "40 DRY 9'6",
    lines: { create: [
      { lineNo: 1, containerType: "40 DRY 96", description: "Plastic, plastic articles, used" },
      { lineNo: 2, containerType: "40 DRY 96", description: "Plastic, plastic articles, used" },
    ]},
  }, include: { lines: true }});

  // Booking 1 already has a PO with two products from WM - Auckland
  const po1 = await prisma.purchaseOrder.create({ data: {
    number: "NZP2607_001", partnerId: wm.id, fromBookingId: b1.id, status: "CONFIRMED",
    currency: "USD", incoterm: "FAS", shippingTerms: "FAS (Lyttelton)",
    notes: "Booking 272570395",
    lines: { create: [
      { productId: ldpe.id, qty: 22, uom: "MT", price: 260, taxRate: 0 },
      { productId: hdpe.id, qty: 22, uom: "MT", price: 340, taxRate: 0 },
    ]},
  }});
  await prisma.bookingLine.update({ where: { id: b1.lines[0].id }, data: {
    supplierId: wm.id, productId: ldpe.id, poId: po1.id, quantity: 22, qtyUnit: "MT",
    price: 260, priceUnit: "/ MT", pricingTerm: "FAS (Lyttelton)",
    containerNo: "MSKU7211058", sealNo: "NZ4482190",
    packingSlipFile: "WM-packing-slip-7211058.pdf",
    netWeightKg: 21400, grossWeightKg: 21750, packages: 24, packingDate: new Date("2026-07-08"),
  }});
  await prisma.bookingLine.update({ where: { id: b1.lines[1].id }, data: {
    supplierId: wm.id, productId: hdpe.id, poId: po1.id, quantity: 22, qtyUnit: "MT",
    price: 340, priceUnit: "/ MT", pricingTerm: "FAS (Lyttelton)", containerNo: "MSKU7211123",
  }});

  // === Booking 2 — MSC (Auckland -> Laem Chabang / Bangkok) ===
  await prisma.booking.create({ data: {
    number: "EBKG16673916", status: "CONFIRMED",
    shippingLineId: msc.id, freightForwarder: "SOURCEONE VENTURES NZ LIMITED",
    vessel: "MSC DURBAN IV", voyage: "FE615R",
    pol: "Auckland", pod: "Laem Chabang",
    placeOfDelivery: "Lat Krabang, Bangkok, Thailand",
    bookedContainers: 2, containerType: "40 DRY", serviceContract: "FRT3RR7XX",
    erd: new Date("2026-05-06"), cargoCutOff: new Date("2026-05-12"),
    etd: new Date("2026-05-14"), eta: new Date("2026-06-16"),
    bookingDate: new Date("2026-04-28"), sourceFile: "EBKG16673916.pdf",
    lines: { create: [
      { lineNo: 1, containerType: "40 DRY" },
      { lineNo: 2, containerType: "40 DRY" },
    ]},
  }});

  // === Booking 3 — ONE (Tauranga -> Tuticorin) ===
  await prisma.booking.create({ data: {
    number: "AKLG09308900", status: "CONFIRMED",
    shippingLineId: one.id, freightForwarder: "SOURCEONE VENTURES NZ LTD",
    vessel: "MAERSK RIO DELTA", voyage: "625N",
    pol: "Tauranga", pod: "Tuticorin", placeOfDelivery: "Tuticorin",
    bookedContainers: 5, containerType: "40'DRY HC",
    cargoCutOff: new Date("2026-06-19"),
    etd: new Date("2026-06-22"), eta: new Date("2026-08-07"),
    bookingDate: new Date("2026-05-13"),
    commodity: "WASTE PAPER & SCRAP", serviceContract: "TAKLB00630A",
    totalWeightKg: 110000, sourceFile: "ONEYAKLG09308900.pdf",
    lines: { create: Array.from({ length: 5 }, (_, i) => ({
      lineNo: i + 1, containerType: "40'DRY HC", description: "WASTE PAPER & SCRAP",
    }))},
  }});

  console.log("Seed complete: 3 bookings (Maersk / MSC / ONE), 9 container lines, 1 PO with 2 products.");
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
