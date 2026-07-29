// Real suppliers and buyers, transcribed from:
//   · NZ Suppliers Sheet.pdf   (19 New Zealand suppliers)
//   · Buyer Details.pdf        (7 export buyers)
//
// Shared by prisma/seed.js and tools/import-partners.mjs so the two can never
// disagree about what the master data is.
//
// Notes on the mapping:
//  · The supplier sheet has no currency column. SourceOne's company default is
//    "Currency mentioned is in USD" and the generated POs are in USD, so
//    suppliers are USD. Buyers carry the currency their row states.
//  · `region` holds the town/city from the sheet, which is how the sheet groups
//    them; `country` is the actual country.
//  · Material lists, segment/type, nearest port and website have no dedicated
//    columns in the schema, so they live in `notes` where they stay searchable
//    and print nowhere unintended.
//  · Blank cells in the sheet are left null rather than guessed at.

const SUPPLIERS = [
  {
    name: "Timg Highbrook (Auckland)",
    email: "ben.mcIvor@timg.co.nz",
    phone: "6492505100",
    city: "East Tāmaki", state: "Auckland", zip: "2013",
    line1: "11 Cryers Road, East Tāmaki",
    notes: "TM (Highbrook) · Auckland port · W.F. & S.L. · MRF (C & R) · Materials: SOP Grade 1, SOP Coloured (Groundwood), SOP Rubbish, Cardboard · https://www.timg.co.nz/",
    contacts: [
      { name: "Ron", role: "Regional Manager", email: "ben.mcIvor@timg.co.nz", phone: "6421703759" },
    ],
  },
  {
    name: "Timg Christchurch",
    email: "CHCinfo@timg.co.nz",
    phone: "6433388668",
    city: "Wigram Park", state: "Christchurch", zip: "8042",
    line1: "57 Pilkington Way, Wigram",
    notes: "TM (Christchurch) · Lyttelton port · Waste Fibre · SOP Shredding Service · https://www.timg.co.nz/",
  },
  {
    name: "Timg Wellington",
    email: "HAMinfo@timg.co.nz",
    phone: "6478507660",
    city: "Te Rapa", state: "Hamilton", zip: "3200",
    line1: "378 Wairere Drive, Te Rapa",
    notes: "TM (Wellington) · Wellington port · Waste Fibre · SOP Shredding Service · https://www.timg.co.nz/ · Sheet lists a Hamilton address against the Wellington branch — confirm before use",
  },
  {
    name: "Timg Dunedin",
    city: "Kenmure", state: "Dunedin", zip: "9016",
    line1: "580 Kaikorai Valley Road, Kenmure",
    notes: "TM (Dunhedin) · Port Chalmers · Waste Fibre · SOP Shredding Service · https://www.timg.co.nz/",
  },
  {
    name: "Abilities Group",
    email: "peterf@abilities.co.nz",
    phone: "6494440611",
    city: "Glenfield", state: "Auckland", zip: "0627",
    line1: "91 Hillside Road, Glenfield",
    notes: "AG (Glenfield) · Auckland port · W.F. & S.L. · MRF (C & R) · Materials: LDPE Film, OCC, EPS, SWL, Colour paper, Sac kraft bag, e-waste · http://www.abilities.co.nz/",
    contacts: [
      { name: "Peter", role: "Owner", email: "peterf@abilities.co.nz", phone: "64272292250" },
    ],
  },
  {
    name: "WM - Auckland",
    email: "amorgan@wm.nz",
    phone: "6494379586",
    city: "East Tāmaki", state: "Auckland", zip: "2013",
    line1: "318 East Tamaki Road, East Tāmaki",
    notes: "WM (Auckland) · Auckland port · W.F. & S.L. · Town/city on the sheet reads Pinehill · Materials: OCC, Tissue, LDPE Clear, LDPE Colour, HD milk jugs, HDPE Clear, PET Clear, PET Colour, HDPE Janitorial, 20 litre Container, Glass bottle, UBC, Core, SOP, ONP, Softmix, Hardmix, Tetrapack, PP Super sack bags, Grade 5 PP containers, EPS logs, EPS Hotmelt, Mixed strapping, HDPE mix",
    contacts: [{ name: "A. Morgan", role: "Sales", email: "amorgan@wm.nz" }],
  },
  {
    name: "WM - Christchurch",
    email: "amorgan@wm.nz",
    phone: "64800101010",
    city: "Hornby South", state: "Christchurch", zip: "7676",
    line1: "301 Marshs Road, Hornby South",
    notes: "WM (Christchurch) · Lyttelton port · W.F. & S.L. · MRF (C & R) · Materials: OCC, Softmix, Hardmix, ONP, PET clear bottle, HDPE janitorial, HDPE milk jugs, PP ice cream container and tray, HDPE Mix, LDPE Clear, EPS Logs, Cores, PVC pipe · https://www.wastemanagement.co.nz/",
    contacts: [{ name: "A. Morgan", role: "Sales", email: "amorgan@wm.nz" }],
  },
  {
    name: "WM - Napier",
    email: "amorgan@wm.nz",
    phone: "64800101010",
    city: "Onekawa", state: "Napier", zip: "4110",
    line1: "52 Austin Street, Onekawa",
    notes: "WM (Napier) · Bales from satellite view · W.F. & S.L. · MRF (C & R) · Materials: OCC, Softmix, Hardmix, LDPE Film, HDPE Bottles · https://www.wastemanagement.co.nz/",
    contacts: [{ name: "A. Morgan", role: "Sales", email: "amorgan@wm.nz" }],
  },
  {
    name: "WM - Tauranga",
    city: "Tauranga", state: "Tauranga", zip: "3175",
    line1: "55 Truman Lane, Te Maunga",
    notes: "WM (Tauranga) · Tauranga port · W.F. & S.L. · MRF (R) · Materials: OCC, Softmix residential, Hardmix, HDPE Milk jugs, Glass · https://www.wastemanagement.co.nz/",
  },
  {
    name: "WM - Lyttleton",
    notes: "WM (Lyttleton) · Row present on the sheet with no details filled in — complete before using",
  },
  {
    name: "Tina",
    email: "cdl@ts.co.nz",
    phone: "64225485702",
    state: "Wellington",
    notes: "Wellington port · Waste Fibre · Trader · Materials: OCC, Hardmix, Softmix · No company name or address given on the sheet",
  },
  {
    name: "Enviro NZ - Christchurch",
    email: "steve.Redmond@environz.co.nz",
    phone: "94789882",
    city: "Bromley", state: "Christchurch", zip: "8062",
    line1: "21 Francella Street, Bromley",
    notes: "EV (Christchurch) · Lyttelton port · Waste Fibre · MRF (C & R) · Materials: OCC11, Mixed paper commercial, Residential mixed paper, ONP8, LDPE 80/20, HDPE Milk bottle, PET, Kraft bag, UBC · https://environz.co.nz/facilities/",
    contacts: [{ name: "Steve Redmond", role: "Contact", email: "steve.Redmond@environz.co.nz" }],
  },
  {
    name: "Enviro NZ - Hamilton (Lincoln Street)",
    email: "barry.Arenhold@environz.co.nz",
    phone: "78482517",
    city: "Frankton", state: "Hamilton", zip: "3204",
    line1: "60 Lincoln Street, Frankton",
    notes: "EV (Hamilton) · Tauranga port · W.F. & S.L. · MRF (C & R) · Materials: OCC, Hardmix, Softmix residential, UBC, PP Ice cream container and tray · https://environz.co.nz/facilities/",
    contacts: [{ name: "Barry Arenhold", role: "Contact", email: "barry.Arenhold@environz.co.nz" }],
  },
  {
    name: "Northland Waste - Fullcircle (Penrose Head Office MRF)",
    email: "tom.Gleeson@ojifs.com",
    phone: "64800732925",
    city: "Penrose", state: "Auckland", zip: "1061",
    line1: "37 Hugo Johnston Drive, Penrose",
    notes: "OFS (Penrose) · Paper Mill · MRF (C & R) · https://ojifs.com/recycling",
    contacts: [
      { name: "Tom Gleeson", role: "Contact", email: "tom.Gleeson@ojifs.com", phone: "027 228 3946" },
      { name: "Essie", role: "Sales", phone: "027 440 2919" },
    ],
  },
  {
    name: "Northland Waste - Fullcircle (Christchurch)",
    city: "Barrington", state: "Christchurch", zip: "8042",
    line1: "81 Buchanans Road, Hei Hei",
    notes: "OFS (Barrington) · Paper Mill · MRF (C & R) · https://ojifs.com/recycling",
  },
  {
    name: "EcoSort / EcoCentral",
    email: "brandon.craine@ecocentral.co.nz",
    phone: "6439417513",
    city: "Bromley", state: "Christchurch", zip: "8062",
    line1: "40 Metro Place, Bromley",
    notes: "EC (Bromley) · Lyttelton port · W.F. & S.L. · MRF (C & R) · Materials: OCC, Softmix, Hardmix, UBC, HDPE Milk Jugs, PET Bottles · https://ecocentral.co.nz/ecosort/recycled-products",
    contacts: [{ name: "Brandon Craine", role: "Contact", email: "brandon.craine@ecocentral.co.nz" }],
  },
  {
    name: "JJ Recycling",
    phone: "6494278964",
    city: "Onehunga", state: "Auckland", zip: "1061",
    line1: "33 Miami Parade, Onehunga",
    notes: "JJR (Onehunga) · Auckland port · Waste Fibre · Trader · Materials: LDPE films, PP Jumbo Bag, Tetra pack, PET bottle",
  },
  {
    name: "New Zealand Document Destruction Services (Rotorua)",
    city: "Rotorua", state: "Waikato",
    notes: "NZDDS (Rotorua) · Resource Recovery Centre · Waste Fibre · MRF (C) & Shredding · Materials: HDPE milk jugs, HDPE colour jugs, PET Clear Bottle, SOP Grade A, Shredded colour paper",
    contacts: [{ name: "Stephen", role: "Contact" }],
  },
  {
    name: "Reclaim",
    email: "bronwynt@reclaim.co.nz",
    city: "Penrose", state: "Auckland", zip: "1061",
    line1: "218/222 Station Road, Penrose",
    notes: "RC (Penrose) · Auckland port · Waste Fibre and Stocklot · MRF (C & R) · Materials: OCC, SWL, SOP, LDPE film",
    contacts: [{ name: "Bronwyn", role: "Bid Manager", email: "bronwynt@reclaim.co.nz" }],
  },
];

const BUYERS = [
  {
    name: "B Chintamani Dyes Pvt Ltd",
    email: "info@ajaycargo.com",
    phone: "+91 85111 67116",
    country: "India", region: "Surat",
    currency: "CAD",
    paymentTerms: "100%",
    line1: "Plot No. 56, Satyam Textile Park, Opp. Tulsi Hotel, Hathoda, Mangrol",
    city: "Surat", state: "Gujarat", zip: "394 405",
    notes: "CNF · Pro-forma SPO: No · Mail to info@ajaycargo.com, cc bchintamani25@gmail.com · Documents and invoice both on B. Chintamani · Check the draft BL against the SI and sheet, and the order confirmation for the address",
    contacts: [{ name: "Mr. Rajan", role: "Contact", email: "bchintamani25@gmail.com", phone: "+91 85111 67116" }],
  },
  {
    name: "Brothers Plastic Industries",
    email: "somoresh84@gmail.com",
    phone: "01728-315522",
    country: "Bangladesh", region: "Ishwardi",
    currency: "USD",
    paymentTerms: "D.P. basis (Delivery against Payment)",
    line1: "Ishwardi Export Processing Zone, Pakshey, Ishwardi",
    city: "Ishwardi", zip: "6620",
    notes: "CNF · Pro-forma SPO: No · Documents in Brothers Plastic; invoice made in Brothers Plastic but on custom rate + freight (e.g. 400+50) · Remove all tax-related headings from the invoice, use Sejada, and enter in the quality/quantity breakdown · Check the draft BL against the SI and sheet, and the order confirmation for address and BL description",
    contacts: [{ name: "Mr. Somoresh", role: "Contact", email: "somoresh84@gmail.com", phone: "01728-315522" }],
  },
  {
    name: "Renew Plastics",
    email: "renewplastic@gmail.com",
    phone: "02836-252822",
    country: "India", region: "Gandhidham",
    currency: "USD",
    paymentTerms: "D.P. basis (Seaway B/L against payment)",
    line1: "Shed No. 310-311, Marshalling Yard, Kandla Special Economic Zone, Gandhidham",
    city: "Gandhidham", state: "Kutch", zip: "370230",
    notes: "CNF · Pro-forma SPO: No · Documents and invoice both on Renew Plastic · Check the draft BL against the SI and sheet, and the order confirmation for address and BL description",
    contacts: [{ name: "Mr. Raman", role: "Contact", email: "renewplastic@gmail.com", phone: "02836-252822" }],
  },
  {
    name: "Renew Plastics (Unit-II)",
    email: "renewplastic@gmail.com",
    country: "India", region: "Gandhidham",
    currency: "USD",
    paymentTerms: "100%",
    line1: "Plot No. 411, Sector - 3, Kandla SEZ, Gandhidham",
    city: "Gandhidham", state: "Gujarat", zip: "370 230",
    notes: "CNF · Pro-forma SPO: No",
  },
  {
    name: "Middle South Techzone (HK) Co., Ltd",
    email: "Kevin@ms-recycle.com",
    phone: "852-6858 9712 / 8226 2130",
    country: "Hong Kong", region: "Kowloon",
    currency: "USD",
    paymentTerms: "25% advance, 75% before 7-10 days of ETA, payment against Seaway BL",
    line1: "RM 803, Chevalier House, 45-51 Chatham Road South, Tsim Sha Tsui, Kowloon",
    city: "Hong Kong",
    notes:
      "CNF · Pro-forma SPO: Yes · Mail to Kevin@ms-recycle.com, icey@ms-recycle.com · Fax 852-3585 3129 · " +
      "Shipper: Middle South Techzone (HK) Co., Ltd C/O USCA Trading Inc., 2-40 Orchid Place Drive, Toronto, Ontario - M1B 2W1, Canada · " +
      "Consignee & notify party: Cong ty TNHH MTV San Xuat Minh Dang, Ap Phuoc Thanh, Xa An Phuoc, Chau Thanh, Ben Tre, " +
      "email import-export@minhdang.com.vn, tel 0938818696 · BL description: WOVEN JUMBO BAGS · HS code 63053390 · " +
      "02 containers said to contain _ packages",
    contacts: [{ name: "Mr. Kevin Qiu", role: "Contact", email: "Kevin@ms-recycle.com", phone: "852-6858 9712" }],
  },
  {
    name: "PT Rejeki Adigraha",
    phone: "+62 855-1029-887",
    country: "Indonesia", region: "Bekasi",
    currency: "USD",
    paymentTerms: "30/70 — 30% advance, 70% upon Seaway BL release (release the Seaway first)",
    line1: "Jl. Jababeka III No.C-19, Pasirgombong, Kec. Cikarang Utara, Kabupaten Bekasi",
    city: "Bekasi", state: "Jawa Barat", zip: "17530",
    notes: "CNF · Pro-forma SPO: Yes · Do not make or send a country of origin",
    contacts: [{ name: "Mr. Dede", role: "Contact", phone: "+62 855-1029-887" }],
  },
  {
    name: "PT. Hong Sheng Plastic Industry",
    email: "cs.hongsheng@gmail.com",
    country: "Indonesia", region: "Batam",
    currency: "USD",
    paymentTerms: "30/70 — 30% advance, 70% upon Seaway BL release (release the Seaway first)",
    line1: "Komplek Puri Industrial Park 2000 Blok E No. 2-5, Kel. Baloi Permai, Kec. Batam Kota",
    city: "Kota Batam", state: "Kepulauan Riau", zip: "29464",
    notes: "CNF · Pro-forma SPO: Yes · Mail to cs.hongsheng@gmail.com, cc jasonzheng888@hotmail.com, lxxin0926@outlook.com, youngruiyang@outlook.com",
  },
];

/** Expands a row above into the shape prisma.partner.create expects. */
function toPartner(row, type, defaults = {}) {
  const country = row.country || defaults.country || null;

  // Address.line1 is required in the schema, so a row with only a town gets no
  // Address record at all. Writing one with line1 null fails, and the error
  // Prisma reports for it ("Argument `partner` is missing") points nowhere near
  // the real cause.
  const hasAddress = Boolean(row.line1);

  // Nothing is dropped when there's no address: the town falls back into region
  // alongside the state, which is the only other place it would be visible.
  const region = row.region
    || (hasAddress ? row.state : [row.city, row.state].filter(Boolean).join(", "))
    || null;

  return {
    name: row.name,
    type,
    email: row.email || null,
    phone: row.phone || null,
    country,
    region,
    currency: row.currency || defaults.currency || "USD",
    paymentTerms: row.paymentTerms || defaults.paymentTerms || null,
    incoterm: row.incoterm || defaults.incoterm || null,
    notes: row.notes || null,
    active: true,
    ...(hasAddress && {
      addresses: {
        create: [{
          type: "BILLING",
          line1: row.line1,
          city: row.city || null,
          state: row.state || null,
          country,
          zip: row.zip || null,
        }],
      },
    }),
    ...(row.contacts?.length && {
      contacts: {
        create: row.contacts.map(c => ({
          name: c.name,
          role: c.role || null,
          email: c.email || null,
          phone: c.phone || null,
        })),
      },
    }),
  };
}

/** Suppliers, ready to create. NZ / FAS / USD unless the row says otherwise. */
function supplierRecords() {
  return SUPPLIERS.map(r => toPartner(r, "VENDOR", {
    country: "New Zealand", currency: "USD", incoterm: "FAS",
  }));
}

/** Buyers, ready to create. CNF on every row of the sheet, so CFR is the incoterm. */
function buyerRecords() {
  return BUYERS.map(r => toPartner(r, "CUSTOMER", { incoterm: "CFR" }));
}

module.exports = { SUPPLIERS, BUYERS, supplierRecords, buyerRecords };
