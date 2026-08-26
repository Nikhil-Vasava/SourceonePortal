import { prisma } from "@/lib/db";

/** Starting terms for a new PO, copied onto each order as it's created. */
export const DEFAULT_TERMS = [
  "- Weight loss of more than 2% is claimable.",
  "- Moisture above 10% is claimable.",
  "- Minimum Weight 22 MT.",
  "- Quality: Material must match specifications mentioned in the ISRI Scrap Specifications Circular and photos shared before booking.",
  "- Loading pictures and seal numbers must be provided within 24 hours of loading.",
].join("\n");

const DEFAULTS = {
  name: "SOURCEONE",
  legalName: "VENTURES NZ LTD",
  address: "Greenvalley Rise, Glenfield, Auckland - 0629, New Zealand.",
  gstNo: "143-154-076",
  importExportNo: "40735917J",
  phone: "+64 (027) 350 1499",
  email: "Info@sourceoneventures.nz",
  // Base prefix — plastics POs get a "P" appended (NZP), others don't (NZ).
  poPrefix: "NZ",
  minimumWeight: "20 MT.",
  defaultComments: "Currency mentioned is in USD",
  defaultTerms: DEFAULT_TERMS,
};

export async function getCompany() {
  const existing = await prisma.companySetting.findFirst();
  if (existing) return existing;
  return prisma.companySetting.create({ data: DEFAULTS });
}
