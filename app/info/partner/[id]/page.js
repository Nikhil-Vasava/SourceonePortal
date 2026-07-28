import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Field, Info } from "@/components/ui";

export const dynamic = "force-dynamic";

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

async function addContact(formData) {
  "use server";
  const partnerId = Number(formData.get("partnerId"));
  await prisma.contactPerson.create({ data: {
    partnerId, name: formData.get("name"), role: formData.get("role") || null,
    email: formData.get("email") || null, phone: formData.get("phone") || null,
  }});
  revalidatePath(`/info/partner/${partnerId}`);
}

async function addBank(formData) {
  "use server";
  const partnerId = Number(formData.get("partnerId"));
  await prisma.bankAccount.create({ data: {
    partnerId, bankName: formData.get("bankName"), accountNo: formData.get("accountNo"),
    swift: formData.get("swift") || null, currency: formData.get("currency") || "USD",
  }});
  revalidatePath(`/info/partner/${partnerId}`);
}

export default async function PartnerDetail({ params }) {
  requireUser();
  const p = await prisma.partner.findUnique({
    where: { id: Number(params.id) },
    include: { addresses: true, banks: true, contacts: true },
  });
  if (!p) notFound();
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
          <h3 className="mb-2 text-sm font-semibold">Contact Persons</h3>
          {p.contacts.map(c => (
            <div key={c.id} className="mb-1 rounded bg-ink-50 p-2 text-sm">
              <b>{c.name}</b> {c.role && <span className="text-ink-500">({c.role})</span>}<br />
              <span className="text-xs text-ink-500">{[c.email, c.phone].filter(Boolean).join(" · ")}</span>
            </div>
          ))}
          <form action={addContact} className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input type="hidden" name="partnerId" value={p.id} />
            <input name="name" required placeholder="Name" className="input" />
            <input name="role" placeholder="Role" className="input" />
            <input name="email" placeholder="Email" className="input" />
            <input name="phone" placeholder="Phone" className="input" />
            <div className="col-span-2"><button className="btn-secondary">+ Add Contact</button></div>
          </form>
        </div>

        <div className="card">
          <h3 className="mb-2 text-sm font-semibold">Bank Accounts</h3>
          {p.banks.map(b => (
            <div key={b.id} className="mb-1 rounded bg-ink-50 p-2 text-sm">
              <b>{b.bankName}</b> · {b.accountNo} {b.swift && `· ${b.swift}`} · {b.currency}
            </div>
          ))}
          <form action={addBank} className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input type="hidden" name="partnerId" value={p.id} />
            <input name="bankName" required placeholder="Bank name" className="input" />
            <input name="accountNo" required placeholder="Account no" className="input" />
            <input name="swift" placeholder="SWIFT" className="input" />
            <select name="currency" className="input">{["USD","NZD","EUR","INR","AED"].map(c => <option key={c}>{c}</option>)}</select>
            <div className="col-span-2"><button className="btn-secondary">+ Add Bank</button></div>
          </form>
        </div>
      </div>
    </div>
  );
}
