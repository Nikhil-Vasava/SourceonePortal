import Link from "next/link";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { fmt } from "@/lib/util";
import { PageHeader, Table, Empty, Field } from "@/components/ui";
import RecordModal from "@/components/RecordModal";
import { DeleteRecord, ToggleActive, ActiveDot } from "@/components/RowActions";
import {
  savePartnerAction, deletePartnerAction, togglePartnerActiveAction,
  saveProductAction, deleteProductAction, toggleProductActiveAction,
  savePortAction, deletePortAction,
} from "@/lib/actions-master";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "suppliers", label: "Suppliers" },
  { key: "buyers", label: "Buyers" },
  { key: "logistics", label: "Shipping / Forwarder / CHA" },
  { key: "products", label: "Products" },
  { key: "ports", label: "Ports" },
  { key: "company", label: "Company" },
];

/* --------------------------------------------------------------- field specs */
// Shared by the add and edit modals, so a new column only has to be listed once.

const CURRENCIES = ["USD", "NZD", "EUR", "INR", "AED", "GBP", "CNY"];
const TERMS = ["ADVANCE", "NET15", "NET30", "NET60", "LC", "DP", "DA"];
const INCOTERMS = ["EXW", "FAS", "FOB", "CFR", "CIF", "DAP", "DDP"];

const PARTNER_FIELDS = [
  { name: "name", label: "Name", required: true },
  { name: "email", label: "Email", type: "email" },
  { name: "phone", label: "Phone" },
  { name: "taxId", label: "Tax / GST No." },
  { name: "country", label: "Country" },
  { name: "region", label: "Region", placeholder: "e.g. APAC" },
  { name: "currency", label: "Currency", type: "select", options: CURRENCIES, defaultValue: "USD" },
  { name: "paymentTerms", label: "Payment terms", type: "select", options: TERMS },
  { name: "incoterm", label: "Incoterm", type: "select", options: INCOTERMS },
  { name: "addrLine1", label: "Address", placeholder: "Street address", full: true },
  { name: "addrCity", label: "City" },
  { name: "addrState", label: "State / Region" },
  { name: "addrZip", label: "Zip" },
  { name: "notes", label: "Notes", full: true },
];

const LOGISTICS_FIELDS = [
  {
    name: "type", label: "Type", type: "select", required: true,
    options: [
      { value: "SHIPPING_LINE", label: "Shipping Line" },
      { value: "FORWARDER", label: "Forwarder" },
      { value: "CHA", label: "CHA" },
    ],
  },
  ...PARTNER_FIELDS,
];

const PRODUCT_FIELDS = [
  { name: "sku", label: "SKU", required: true },
  { name: "name", label: "Name", required: true, placeholder: "e.g. LDPE 98/2" },
  { name: "category", label: "Category" },
  { name: "grade", label: "Grade" },
  { name: "uom", label: "Unit", type: "select", options: ["MT", "KG", "Loads", "PCS", "CBM"], defaultValue: "MT" },
  { name: "taxRate", label: "Tax %", type: "number" },
  { name: "costPrice", label: "Cost price", type: "number" },
  { name: "salePrice", label: "Sale price", type: "number" },
];

const PORT_FIELDS = [
  { name: "code", label: "UN/LOCODE", required: true, placeholder: "e.g. NZAKL" },
  { name: "name", label: "Port name", required: true, placeholder: "e.g. Auckland" },
  { name: "country", label: "Country" },
];

/* ------------------------------------------------------------------- company */

async function saveCompany(formData) {
  "use server";
  requireUser();
  const company = await getCompany();
  await prisma.companySetting.update({
    where: { id: company.id },
    data: {
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
    },
  });
  revalidatePath("/info");
}

/* ---------------------------------------------------------------------- page */

export default async function Info({ searchParams }) {
  requireUser();
  const tab = searchParams?.tab || "suppliers";

  const [vendors, customers, logistics, products, ports, company] = await Promise.all([
    prisma.partner.findMany({ where: { type: "VENDOR" }, include: { addresses: true }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.partner.findMany({ where: { type: { in: ["CUSTOMER", "BUYER"] } }, include: { addresses: true }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.partner.findMany({ where: { type: { in: ["SHIPPING_LINE", "FORWARDER", "CHA"] } }, include: { addresses: true }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.product.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.port.findMany({ orderBy: { code: "asc" } }),
    getCompany(),
  ]);

  const plain = (o) => JSON.parse(JSON.stringify(o));

  // The address lives on a separate table; flatten it so the modal can edit it
  // with the rest of the partner in one form.
  const withAddress = (p) => {
    const a = p.addresses?.[0] || {};
    return plain({
      ...p,
      addrLine1: a.line1 || "", addrCity: a.city || "",
      addrState: a.state || "", addrZip: a.zip || "",
    });
  };

  /* ------------------------------------------------------------- partner list */

  function PartnerList({ list, fields, fixed, label }) {
    if (list.length === 0) {
      return (
        <Empty
          text={`No ${label.toLowerCase()}s yet`}
          action={<RecordModal fields={fields} fixed={fixed} action={savePartnerAction} title={`Add ${label}`} />}
        />
      );
    }

    return (
      <>
        {/* Phone: cards */}
        <div className="space-y-3 lg:hidden">
          {list.map(p => (
            <div key={p.id} className={`rec-card ${p.active ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/info/partner/${p.id}`} className="font-semibold text-brand-700 hover:underline">
                    {p.name}
                  </Link>
                  <div className="mt-0.5 text-2xs uppercase tracking-wide text-ink-400">
                    {p.type.replace("_", " ")}
                  </div>
                </div>
                <ActiveDot active={p.active} />
              </div>

              <div className="mt-2 space-y-0.5">
                <div className="rec-row"><span className="rec-key">Email</span><span className="rec-val">{p.email || "—"}</span></div>
                <div className="rec-row"><span className="rec-key">Phone</span><span className="rec-val">{p.phone || "—"}</span></div>
                <div className="rec-row"><span className="rec-key">Country</span><span className="rec-val">{p.country || "—"}</span></div>
                <div className="rec-row"><span className="rec-key">Terms</span><span className="rec-val">{p.paymentTerms || "—"} · {p.incoterm || "—"}</span></div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-2">
                <ToggleActive id={p.id} active={p.active} action={togglePartnerActiveAction} />
                <div className="flex items-center gap-1">
                  <RecordModal fields={fields} record={withAddress(p)} fixed={fixed} action={savePartnerAction} title={label} trigger="icon" />
                  <DeleteRecord id={p.id} name={p.name} action={deletePartnerAction} label={label.toLowerCase()} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: table */}
        <div className="hidden lg:block">
          <Table headers={["Name", "Type", "Email", "Phone", "Country", "Currency", "Terms", "Incoterm", "Status", ""]}>
            {list.map(p => (
              <tr key={p.id} className={`row ${p.active ? "" : "bg-ink-50/50 text-ink-400"}`}>
                <td className="td font-medium">
                  <Link className="text-brand-700 hover:underline" href={`/info/partner/${p.id}`}>{p.name}</Link>
                </td>
                <td className="td text-xs">{p.type.replace("_", " ")}</td>
                <td className="td">{p.email || "—"}</td>
                <td className="td">{p.phone || "—"}</td>
                <td className="td">{p.country || "—"}</td>
                <td className="td">{p.currency}</td>
                <td className="td">{p.paymentTerms || "—"}</td>
                <td className="td">{p.incoterm || "—"}</td>
                <td className="td"><ActiveDot active={p.active} /></td>
                <td className="td">
                  <div className="flex items-center justify-end gap-2">
                    <ToggleActive id={p.id} active={p.active} action={togglePartnerActiveAction} />
                    <RecordModal fields={fields} record={withAddress(p)} fixed={fixed} action={savePartnerAction} title={label} trigger="icon" />
                    <DeleteRecord id={p.id} name={p.name} action={deletePartnerAction} label={label.toLowerCase()} />
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        </div>
      </>
    );
  }

  const tabLabel = TABS.find(t => t.key === tab)?.label || "";

  /* Add button for the current tab, shown in the page header. */
  const addButton = {
    suppliers: <RecordModal fields={PARTNER_FIELDS} fixed={{ type: "VENDOR" }} action={savePartnerAction} title="Add supplier" />,
    buyers: <RecordModal fields={PARTNER_FIELDS} fixed={{ type: "CUSTOMER" }} action={savePartnerAction} title="Add buyer" />,
    logistics: <RecordModal fields={LOGISTICS_FIELDS} action={savePartnerAction} title="Add shipping line / forwarder / CHA" triggerLabel="Add partner" />,
    products: <RecordModal fields={PRODUCT_FIELDS} action={saveProductAction} title="Add product" />,
    ports: <RecordModal fields={PORT_FIELDS} action={savePortAction} title="Add port" />,
    company: null,
  }[tab];

  return (
    <div>
      <PageHeader
        title="Info"
        subtitle="Master data — everything here feeds the dropdowns across the app"
        action={addButton}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map(t => (
          <Link key={t.key} href={`/info?tab=${t.key}`}
            className={`chip px-3 py-1.5 ${tab === t.key ? "chip-active" : ""}`}>
            {t.label}
          </Link>
        ))}
      </div>

      {tab !== "company" && (
        <p className="mb-4 text-2xs text-ink-400">
          Deactivating hides a record from the dropdowns but keeps it on every booking and
          purchase order that already uses it. Deleting is only possible when nothing
          references it.
        </p>
      )}

      {tab === "suppliers" && (
        <PartnerList list={vendors} fields={PARTNER_FIELDS} fixed={{ type: "VENDOR" }} label="Supplier" />
      )}

      {tab === "buyers" && (
        <PartnerList list={customers} fields={PARTNER_FIELDS} fixed={{ type: "CUSTOMER" }} label="Buyer" />
      )}

      {tab === "logistics" && (
        <PartnerList list={logistics} fields={LOGISTICS_FIELDS} label="Partner" />
      )}

      {tab === "products" && (
        products.length === 0 ? (
          <Empty text="No products yet"
                 action={<RecordModal fields={PRODUCT_FIELDS} action={saveProductAction} title="Add product" />} />
        ) : (
          <>
            {/* Phone: cards */}
            <div className="space-y-3 lg:hidden">
              {products.map(p => (
                <div key={p.id} className={`rec-card ${p.active ? "" : "opacity-60"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-ink-900">{p.name}</div>
                      <div className="mt-0.5 font-mono text-2xs text-ink-400">{p.sku}</div>
                    </div>
                    <ActiveDot active={p.active} />
                  </div>
                  <div className="mt-2 space-y-0.5">
                    <div className="rec-row"><span className="rec-key">Category</span><span className="rec-val">{p.category || "—"}{p.grade ? ` · ${p.grade}` : ""}</span></div>
                    <div className="rec-row"><span className="rec-key">Unit</span><span className="rec-val">{p.uom}</span></div>
                    <div className="rec-row"><span className="rec-key">Cost / Sale</span><span className="rec-val">{fmt(p.costPrice)} / {fmt(p.salePrice)}</span></div>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-2">
                    <ToggleActive id={p.id} active={p.active} action={toggleProductActiveAction} />
                    <div className="flex items-center gap-1">
                      <RecordModal fields={PRODUCT_FIELDS} record={plain(p)} action={saveProductAction} title="Product" trigger="icon" />
                      <DeleteRecord id={p.id} name={p.name} action={deleteProductAction} label="product" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden lg:block">
              <Table headers={["SKU", "Name", "Category", "Grade", "Unit", "Tax %", "Cost", "Sale", "Status", ""]}>
                {products.map(p => (
                  <tr key={p.id} className={`row ${p.active ? "" : "bg-ink-50/50 text-ink-400"}`}>
                    <td className="td font-mono text-xs">{p.sku}</td>
                    <td className="td font-medium">{p.name}</td>
                    <td className="td">{p.category || "—"}</td>
                    <td className="td">{p.grade || "—"}</td>
                    <td className="td">{p.uom}</td>
                    <td className="td tnum">{p.taxRate}%</td>
                    <td className="td tnum">{fmt(p.costPrice)}</td>
                    <td className="td tnum">{fmt(p.salePrice)}</td>
                    <td className="td"><ActiveDot active={p.active} /></td>
                    <td className="td">
                      <div className="flex items-center justify-end gap-2">
                        <ToggleActive id={p.id} active={p.active} action={toggleProductActiveAction} />
                        <RecordModal fields={PRODUCT_FIELDS} record={plain(p)} action={saveProductAction} title="Product" trigger="icon" />
                        <DeleteRecord id={p.id} name={p.name} action={deleteProductAction} label="product" />
                      </div>
                    </td>
                  </tr>
                ))}
              </Table>
            </div>
          </>
        )
      )}

      {tab === "ports" && (
        ports.length === 0 ? (
          <Empty text="No ports yet"
                 action={<RecordModal fields={PORT_FIELDS} action={savePortAction} title="Add port" />} />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
              {ports.map(p => (
                <div key={p.id} className="rec-card flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono font-semibold text-ink-900">{p.code}</div>
                    <div className="truncate text-sm text-ink-600">{p.name}</div>
                    <div className="text-2xs text-ink-400">{p.country || "—"}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <RecordModal fields={PORT_FIELDS} record={plain(p)} action={savePortAction} title="Port" trigger="icon" />
                    <DeleteRecord id={p.id} name={`${p.code} — ${p.name}`} action={deletePortAction} label="port" />
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden lg:block">
              <Table headers={["Code", "Name", "Country", ""]}>
                {ports.map(p => (
                  <tr key={p.id} className="row">
                    <td className="td font-mono font-medium">{p.code}</td>
                    <td className="td">{p.name}</td>
                    <td className="td">{p.country || "—"}</td>
                    <td className="td">
                      <div className="flex items-center justify-end gap-2">
                        <RecordModal fields={PORT_FIELDS} record={plain(p)} action={savePortAction} title="Port" trigger="icon" />
                        <DeleteRecord id={p.id} name={`${p.code} — ${p.name}`} action={deletePortAction} label="port" />
                      </div>
                    </td>
                  </tr>
                ))}
              </Table>
            </div>
          </>
        )
      )}

      {tab === "company" && (
        <form action={saveCompany} className="card max-w-3xl">
          <h3 className="mb-1 text-sm font-semibold">Company details</h3>
          <p className="mb-4 text-xs text-ink-500">These appear in the header of every generated purchase order.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Company Name"><input name="name" defaultValue={company.name} className="input" /></Field>
            <Field label="Legal Name"><input name="legalName" defaultValue={company.legalName} className="input" /></Field>
            <div className="sm:col-span-2"><Field label="Address"><input name="address" defaultValue={company.address} className="input" /></Field></div>
            <Field label="GST / HST No."><input name="gstNo" defaultValue={company.gstNo} className="input" /></Field>
            <Field label="Import / Export No."><input name="importExportNo" defaultValue={company.importExportNo} className="input" /></Field>
            <Field label="Phone"><input name="phone" defaultValue={company.phone} className="input" /></Field>
            <Field label="E-mail"><input name="email" defaultValue={company.email} className="input" /></Field>
            <Field label="PO Number Prefix"><input name="poPrefix" defaultValue={company.poPrefix} className="input" /></Field>
            <Field label="Minimum Weight (T&C)"><input name="minimumWeight" defaultValue={company.minimumWeight} className="input" /></Field>
            <div className="sm:col-span-2"><Field label="Default PO Comments"><input name="defaultComments" defaultValue={company.defaultComments} className="input" /></Field></div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button className="btn">Save company</button>
            <span className="text-xs text-ink-500">
              Next PO will be numbered{" "}
              <b>{company.poPrefix}{String(new Date().getFullYear()).slice(-2)}{String(new Date().getMonth() + 1).padStart(2, "0")}_00X</b>
            </span>
          </div>
        </form>
      )}
    </div>
  );
}
