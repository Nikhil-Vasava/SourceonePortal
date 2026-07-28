import { prisma } from "@/lib/db";

const DEFAULTS = {
  name: "SOURCEONE",
  legalName: "VENTURES NZ LTD",
  address: "Greenvalley Rise, Glenfield, Auckland - 0629, New Zealand.",
  gstNo: "143-154-076",
  importExportNo: "40735917J",
  phone: "+64 (027) 350 1499",
  email: "Info@sourceoneventures.nz",
  poPrefix: "NZP",
  minimumWeight: "20 MT.",
  defaultComments: "Currency mentioned is in USD",
};

export async function getCompany() {
  const existing = await prisma.companySetting.findFirst();
  if (existing) return existing;
  return prisma.companySetting.create({ data: DEFAULTS });
}
