import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Field, Info } from "@/components/ui";
import RecordModal from "@/components/RecordModal";
import { DeleteRecord } from "@/components/RowActions";
import {
  saveContactAction, deleteContactAction,
  saveBankAction, deleteBankAction,
} from "@/lib/actions-master";

export const dynamic = "force-dynamic";

// Field specs shared by the add and edit modals for each panel below.
const CONTACT_FIELDS = [
  { name: "name", label: "Name", required: true },
  { name: "role", label: "Role", placeholder: "e.g. Operations" },
  { name: "email", label: "Email", type: "email" },
  { name: "phone", label: "Phone" },
];

const BANK_FIELDS = [
  { name: "bankName", label: "Bank name", required: true },
  { name: "accountNo", label: "Account no.", required: true },
  { name: "swift", label: "SWIFT / BIC" },
  { name: "currency", label: "Currency", type: "select",
    options: ["USD", "NZD", "EUR", "INR", "AED", "GBP", "CNY"], defaultValue: "USD" },
];

async function updatePartner(formData) {
  "use server";
  const id = Number(formData.get("id"));
  await prisma.partner.update({ where: { id }, data: {
    name: formData.get("name"),
    email: formData.get("email") || null,
    phone: formData.get("phone") || null,
    taxId: formData.get("taxId") || null,
    currency: formData.get("currency"),
    country: formData.get("country") || null,
    region: formData.get("region") || null,
    paymentTerms: formData.get("paymentTerms") || null,
    incoterm: formData.get("incoterm") || null,
  }});
  revalidatePath(`/info/partner/${id}`);
}

async function saveAddress(formData) {
  "use server";
  const partnerId = Number(formData.get("partnerId"));
  const addrId = formData.get("addrId") ? Number(formData.get("addrId")) : null;
  const data = {
    partnerId, type: formData.get("type"),
    line1: formData.get("line1"), line2: formData.get("line2") || null,
    city: formData.get("city") || null, state: formData.get("state") || null,
    country: formData.get("country") || null, zip: formData.get("zip") || null,
  };
  if (addrId) await prisma.address.update({ where: { id: addrId }, data });
  else await prisma.address.create({ data });
  revalidatePath(`/info/partner/${partnerId}`);
}

export default async function PartnerDetail({ params }) {
  requireUser();
  const p = await prisma.partner.findUnique({
    where: { id: Number(params.id) },
    include: { addresses: true, banks: true, contacts: true },
  });
  if (!p) notFound();
  const plain = (o) => JSON.parse(JSON.stringify(o));
  const billing = p.addresses.find(a => a.type === "BILLING");
  const backTab = p.type === "VENDOR" ? "suppliers" : ["CUSTOMER", "BUYER"].includes(p.type) ? "buyers" : "logistics";

  return (
    <div className="max-w-4xl">
      <PageHeader title={p.name} subtitle={p.type.replace("_", " ")}
        action={<Link href={`/info?tab=${backTab}`} className="btn-secondary">← Back to Info</Link>} />

      <form action={updatePartner} className="card mb-4">
        <h3 className="mb-3 text-sm font-semibold">Details</h3>
        <input type="hidden" name="id" value={p.id} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Name"><input name="name" defaultValue={p.name} className="input" /></Field>
          <Field label="Email"><input name="email" defaultValue={p.email || ""} className="input" /></Field>
          <Field label="Phone"><input name="phone" defaultValue={p.phone || ""} className="input" /></Field>
          <Field label="Tax / GST No."><input name="taxId" defaultValue={p.taxId || ""} className="input" /></Field>
          <Field label="Currency"><select name="currency" defaultValue={p.currency} className="input">{["USD","NZD","EUR","INR","AED","GBP","CNY"].map(c => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Country"><input name="country" defaultValue={p.country || ""} className="input" /></Field>
          <Field label="Region"><input name="region" defaultValue={p.region || ""} className="input" /></Field>
          <Field label="Payment Terms">
            <select name="paymentTerms" defaultValue={p.paymentTerms || ""} className="input"><option value="">—</option>{["ADVANCE","NET15","NET30","NET60","LC","DP","DA"].map(t => <option key={t}>{t}</option>)}</select>
          </Field>
          <Field label="Incoterm">
            <select name="incoterm" defaultValue={p.incoterm || ""} className="input"><option value="">—</option>{["EXW","FAS","FOB","CFR","CIF","DAP","DDP"].map(i => <option key={i}>{i}</option>)}</select>
          </Field>
        </div>
        <div className="mt-3"><button className="btn">Save</button></div>
      </form>

      <form action={saveAddress} className="card mb-4">
        <h3 className="mb-1 text-sm font-semibold">Billing Address</h3>
        <p className="mb-3 text-xs text-ink-500">This address prints on the purchase order.</p>
        <input type="hidden" name="partnerId" value={p.id} />
        <input type="hidden" name="type" value="BILLING" />
        {billing && <input type="hidden" name="addrId" value={billing.id} />}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="col-span-3"><Field label="Address Line 1"><input name="line1" required defaultValue={billing?.line1 || ""} className="input" /></Field></div>
          <Field label="Line 2"><input name="line2" defaultValue={billing?.line2 || ""} className="input" /></Field>
          <Field label="City"><input name="city" defaultValue={billing?.city || ""} className="input" /></Field>
          <Field label="State"><input name="state" defaultValue={billing?.state || ""} className="input" /></Field>
          <Field label="Country"><input name="country" defaultValue={billing?.country || ""} className="input" /></Field>
          <Field label="Zip"><input name="zip" defaultValue={billing?.zip || ""} className="input" /></Field>
        </div>
        <div className="mt-3"><button className="btn-secondary">Save Address</button></div>
      </form>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Contact persons</h3>
            <RecordModal
              fields={CONTACT_FIELDS}
              fixed={{ partnerId: p.id }}
              action={saveContactAction}
              title="Add contact"
              triggerLabel="Add"
            />
          </div>

          {p.contacts.length === 0 ? (
            <p className="text-xs text-ink-400">No contacts yet.</p>
          ) : (
            <div className="space-y-1">
              {p.contacts.map(c => (
                <div key={c.id} className="flex items-start justify-between gap-2 rounded-lg bg-ink-100 p-2.5">
                  <div className="min-w-0 text-sm">
                    <b>{c.name}</b>{c.role && <span className="text-ink-500"> ({c.role})</span>}
                    <div className="truncate text-xs text-ink-500">
                      {[c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <RecordModal
                      fields={CONTACT_FIELDS}
                      record={plain(c)}
                      fixed={{ partnerId: p.id }}
                      action={saveContactAction}
                      title="Contact"
                      trigger="icon"
                    />
                    <DeleteRecord id={c.id} name={c.name} action={deleteContactAction} label="contact" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Bank accounts</h3>
            <RecordModal
              fields={BANK_FIELDS}
              fixed={{ partnerId: p.id }}
              action={saveBankAction}
              title="Add bank account"
              triggerLabel="Add"
            />
          </div>

          {p.banks.length === 0 ? (
            <p className="text-xs text-ink-400">No bank accounts yet.</p>
          ) : (
            <div className="space-y-1">
              {p.banks.map(b => (
                <div key={b.id} className="flex items-start justify-between gap-2 rounded-lg bg-ink-100 p-2.5">
                  <div className="min-w-0 text-sm">
                    <b>{b.bankName}</b>
                    <div className="truncate text-xs text-ink-500">
                      {[b.accountNo, b.swift, b.currency].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <RecordModal
                      fields={BANK_FIELDS}
                      record={plain(b)}
                      fixed={{ partnerId: p.id }}
                      action={saveBankAction}
                      title="Bank account"
                      trigger="icon"
                    />
                    <DeleteRecord id={b.id} name={b.bankName} action={deleteBankAction} label="bank account" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
