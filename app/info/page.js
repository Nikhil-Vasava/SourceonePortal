import Link from "next/link";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { fmt } from "@/lib/util";
import { PageHeader, Table, Empty, Field } from "@/components/ui";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "suppliers", label: "Suppliers", type: "VENDOR" },
  { key: "buyers", label: "Buyers", type: "CUSTOMER" },
  { key: "logistics", label: "Shipping / Forwarder / CHA" },
  { key: "products", label: "Products" },
  { key: "ports", label: "Ports" },
  { key: "company", label: "Company" },
];

async function savePartner(formData) {
  "use server";
  const id = formData.get("id") ? Number(formData.get("id")) : null;
  const data = {
    name: formData.get("name"),
    type: formData.get("type"),
    email: formData.get("email") || null,
    phone: formData.get("phone") || null,
    taxId: formData.get("taxId") || null,
    fiscalPosition: formData.get("fiscalPosition") || null,
    currency: formData.get("currency") || "USD",
    country: formData.get("country") || null,
    region: formData.get("region") || null,
    paymentTerms: formData.get("paymentTerms") || null,
    incoterm: formData.get("incoterm") || null,
  };
  const partner = id
    ? await prisma.partner.update({ where: { id }, data })
    : await prisma.partner.create({ data });

  const line1 = formData.get("addrLine1");
  if (line1) {
    const existing = await prisma.address.findFirst({ where: { partnerId: partner.id, type: "BILLING" } });
    const addr = {
      partnerId: partner.id, type: "BILLING", line1,
      city: formData.get("addrCity") || null,
      state: formData.get("addrState") || null,
      country: formData.get("addrCountry") || formData.get("country") || null,
      zip: formData.get("addrZip") || null,
    };
    if (existing) await prisma.address.update({ where: { id: existing.id }, data: addr });
    else await prisma.address.create({ data: addr });
  }
  revalidatePath("/info");
}

async function saveProduct(formData) {
  "use server";
  const id = formData.get("id") ? Number(formData.get("id")) : null;
  const data = {
    sku: formData.get("sku"),
    name: formData.get("name"),
    category: formData.get("category") || null,
    grade: formData.get("grade") || null,
    uom: formData.get("uom") || "MT",
    taxRate: Number(formData.get("taxRate") || 0),
    costPrice: Number(formData.get("costPrice") || 0),
    salePrice: Number(formData.get("salePrice") || 0),
  };
  if (id) await prisma.product.update({ where: { id }, data });
  else await prisma.product.create({ data });
  revalidatePath("/info");
}

async function savePort(formData) {
  "use server";
  await prisma.port.create({ data: {
    code: formData.get("code").toUpperCase(),
    name: formData.get("name"),
    country: formData.get("country") || null,
  }});
  revalidatePath("/info");
}

async function deletePort(formData) {
  "use server";
  await prisma.port.delete({ where: { id: Number(formData.get("id")) } });
  revalidatePath("/info");
}

async function saveCompany(formData) {
  "use server";
  const company = await getCompany();
  await prisma.companySetting.update({ where: { id: company.id }, data: {
    name: formData.get("name"),
    legalName: formData.get("legalName"),
    address: formData.get("address"),
    gstNo: formData.get("gstNo"),
    importExportNo: formData.get("importExportNo"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    poPrefix: formData.get("poPrefix"),
    minimumWeight: formData.get("minimumWeight"),
    defaultComments: formData.get("defaultComments"),
  }});
  revalidatePath("/info");
}

function PartnerForm({ type, label }) {
  return (
    <form action={savePartner} className="card">
      <h3 className="mb-3 text-sm font-semibold">Add {label}</h3>
      <input type="hidden" name="type" value={type} />
      <div className="grid grid-cols-4 gap-3">
        <Field label="Name *"><input name="name" required className="input" /></Field>
        <Field label="Email"><input name="email" type="email" className="input" /></Field>
        <Field label="Phone"><input name="phone" className="input" /></Field>
        <Field label="Tax / GST No."><input name="taxId" className="input" /></Field>
        <Field label="Address"><input name="addrLine1" className="input" placeholder="Street address" /></Field>
        <Field label="City"><input name="addrCity" className="input" /></Field>
        <Field label="Country"><input name="country" className="input" /></Field>
        <Field label="Zip"><input name="addrZip" className="input" /></Field>
        <Field label="Currency">
          <select name="currency" className="input">{["USD","NZD","EUR","INR","AED","GBP","CNY"].map(c => <option key={c}>{c}</option>)}</select>
        </Field>
        <Field label="Payment Terms">
          <select name="paymentTerms" className="input"><option value="">—</option>{["ADVANCE","NET15","NET30","NET60","LC","DP","DA"].map(t => <option key={t}>{t}</option>)}</select>
        </Field>
        <Field label="Incoterm">
          <select name="incoterm" className="input"><option value="">—</option>{["EXW","FAS","FOB","CFR","CIF","DAP","DDP"].map(i => <option key={i}>{i}</option>)}</select>
        </Field>
        <Field label="Region"><input name="region" className="input" placeholder="e.g. APAC" /></Field>
      </div>
      <div className="mt-3"><button className="btn">Save {label}</button></div>
    </form>
  );
}

export default async function Info({ searchParams }) {
  requireUser();
  const tab = searchParams?.tab || "suppliers";

  const [vendors, customers, logistics, products, ports, company] = await Promise.all([
    prisma.partner.findMany({ where: { type: "VENDOR" }, include: { addresses: true }, orderBy: { name: "asc" } }),
    prisma.partner.findMany({ where: { type: { in: ["CUSTOMER", "BUYER"] } }, include: { addresses: true }, orderBy: { name: "asc" } }),
    prisma.partner.findMany({ where: { type: { in: ["SHIPPING_LINE", "FORWARDER", "CHA"] } }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    prisma.port.findMany({ orderBy: { code: "asc" } }),
    getCompany(),
  ]);

  const partnerRows = (list) => (
    list.length === 0 ? <Empty text="Nothing here yet" /> : (
      <Table headers={["Name", "Type", "Email", "Phone", "Country", "Currency", "Terms", "Incoterm", "Address"]}>
        {list.map(p => (
          <tr key={p.id} className="row">
            <td className="td font-medium"><Link className="text-brand-700" href={`/info/partner/${p.id}`}>{p.name}</Link></td>
            <td className="td text-xs">{p.type.replace("_", " ")}</td>
            <td className="td">{p.email || "—"}</td>
            <td className="td">{p.phone || "—"}</td>
            <td className="td">{p.country || "—"}</td>
            <td className="td">{p.currency}</td>
            <td className="td">{p.paymentTerms || "—"}</td>
            <td className="td">{p.incoterm || "—"}</td>
            <td className="td text-xs text-ink-500">
              {p.addresses?.[0] ? [p.addresses[0].line1, p.addresses[0].city, p.addresses[0].country].filter(Boolean).join(", ") : "—"}
            </td>
          </tr>
        ))}
      </Table>
    )
  );

  return (
    <div>
      <PageHeader title="Info" subtitle="Master data — everything here feeds the dropdowns across the app" />

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map(t => (
          <Link key={t.key} href={`/info?tab=${t.key}`}
            className={`chip px-3 py-1.5 ${tab === t.key ? "chip-active" : ""}`}>
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "suppliers" && <div className="space-y-4">{partnerRows(vendors)}<PartnerForm type="VENDOR" label="Supplier" /></div>}
      {tab === "buyers" && <div className="space-y-4">{partnerRows(customers)}<PartnerForm type="CUSTOMER" label="Buyer" /></div>}

      {tab === "logistics" && (
        <div className="space-y-4">
          {partnerRows(logistics)}
          <form action={savePartner} className="card">
            <h3 className="mb-3 text-sm font-semibold">Add Shipping Line / Forwarder / CHA</h3>
            <div className="grid grid-cols-4 gap-3">
              <Field label="Type *">
                <select name="type" className="input"><option value="SHIPPING_LINE">Shipping Line</option><option value="FORWARDER">Forwarder</option><option value="CHA">CHA</option></select>
              </Field>
              <Field label="Name *"><input name="name" required className="input" /></Field>
              <Field label="Email"><input name="email" type="email" className="input" /></Field>
              <Field label="Phone"><input name="phone" className="input" /></Field>
              <Field label="Country"><input name="country" className="input" /></Field>
              <Field label="Currency"><select name="currency" className="input">{["USD","NZD","EUR","INR","AED"].map(c => <option key={c}>{c}</option>)}</select></Field>
            </div>
            <div className="mt-3"><button className="btn">Save</button></div>
          </form>
        </div>
      )}

      {tab === "products" && (
        <div className="space-y-4">
          {products.length === 0 ? <Empty text="No products yet" /> : (
            <Table headers={["SKU", "Name", "Category", "Grade", "UoM", "Tax %", "Cost", "Sale"]}>
              {products.map(p => (
                <tr key={p.id} className="row">
                  <td className="td font-mono text-xs">{p.sku}</td>
                  <td className="td font-medium">{p.name}</td>
                  <td className="td">{p.category || "—"}</td>
                  <td className="td">{p.grade || "—"}</td>
                  <td className="td">{p.uom}</td>
                  <td className="td">{p.taxRate}%</td>
                  <td className="td">{fmt(p.costPrice)}</td>
                  <td className="td">{fmt(p.salePrice)}</td>
                </tr>
              ))}
            </Table>
          )}
          <form action={saveProduct} className="card">
            <h3 className="mb-3 text-sm font-semibold">Add Product</h3>
            <div className="grid grid-cols-4 gap-3">
              <Field label="SKU *"><input name="sku" required className="input" /></Field>
              <Field label="Name *"><input name="name" required className="input" placeholder="e.g. LDPE 98/2" /></Field>
              <Field label="Category"><input name="category" className="input" /></Field>
              <Field label="Grade"><input name="grade" className="input" /></Field>
              <Field label="UoM"><select name="uom" className="input">{["MT","KG","Loads","PCS","CBM"].map(u => <option key={u}>{u}</option>)}</select></Field>
              <Field label="Tax %"><input name="taxRate" type="number" step="0.01" className="input" /></Field>
              <Field label="Cost Price"><input name="costPrice" type="number" step="0.01" className="input" /></Field>
              <Field label="Sale Price"><input name="salePrice" type="number" step="0.01" className="input" /></Field>
            </div>
            <div className="mt-3"><button className="btn">Save Product</button></div>
          </form>
        </div>
      )}

      {tab === "ports" && (
        <div className="space-y-4">
          {ports.length === 0 ? <Empty text="No ports yet" /> : (
            <Table headers={["Code", "Name", "Country", ""]}>
              {ports.map(p => (
                <tr key={p.id} className="row">
                  <td className="td font-mono font-medium">{p.code}</td>
                  <td className="td">{p.name}</td>
                  <td className="td">{p.country || "—"}</td>
                  <td className="td">
                    <form action={deletePort}><input type="hidden" name="id" value={p.id} /><button className="text-xs text-red-500">✕</button></form>
                  </td>
                </tr>
              ))}
            </Table>
          )}
          <form action={savePort} className="card">
            <h3 className="mb-3 text-sm font-semibold">Add Port</h3>
            <div className="flex flex-wrap gap-3">
              <input name="code" required placeholder="UN/LOCODE e.g. NZAKL" className="input w-48" />
              <input name="name" required placeholder="Port name e.g. Auckland" className="input w-56" />
              <input name="country" placeholder="Country" className="input w-40" />
              <button className="btn">Add Port</button>
            </div>
          </form>
        </div>
      )}

      {tab === "company" && (
        <form action={saveCompany} className="card max-w-3xl">
          <h3 className="mb-1 text-sm font-semibold">Company details</h3>
          <p className="mb-4 text-xs text-ink-500">These appear in the header of every generated purchase order.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Company Name"><input name="name" defaultValue={company.name} className="input" /></Field>
            <Field label="Legal Name"><input name="legalName" defaultValue={company.legalName} className="input" /></Field>
            <div className="col-span-2"><Field label="Address"><input name="address" defaultValue={company.address} className="input" /></Field></div>
            <Field label="GST / HST No."><input name="gstNo" defaultValue={company.gstNo} className="input" /></Field>
            <Field label="Import / Export No."><input name="importExportNo" defaultValue={company.importExportNo} className="input" /></Field>
            <Field label="Phone"><input name="phone" defaultValue={company.phone} className="input" /></Field>
            <Field label="E-mail"><input name="email" defaultValue={company.email} className="input" /></Field>
            <Field label="PO Number Prefix"><input name="poPrefix" defaultValue={company.poPrefix} className="input" /></Field>
            <Field label="Minimum Weight (T&C)"><input name="minimumWeight" defaultValue={company.minimumWeight} className="input" /></Field>
            <div className="col-span-2"><Field label="Default PO Comments"><input name="defaultComments" defaultValue={company.defaultComments} className="input" /></Field></div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button className="btn">Save Company</button>
            <span className="text-xs text-ink-500">Next PO will be numbered <b>{company.poPrefix}{String(new Date().getFullYear()).slice(-2)}{String(new Date().getMonth() + 1).padStart(2, "0")}_00X</b></span>
          </div>
        </form>
      )}
    </div>
  );
}
