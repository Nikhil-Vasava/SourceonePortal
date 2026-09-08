import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole, ROLES, ROLE_NOTES } from "@/lib/auth";
import { PageHeader, Table, Field } from "@/components/ui";
import UserRow from "@/components/UserRow";
import {
  createUserAction, updateUserAction, setUserPasswordAction, toggleUserActiveAction,
} from "@/lib/actions-users";

export const dynamic = "force-dynamic";

export default async function Users({ searchParams }) {
  const me = requireRole("ADMIN");
  const users = await prisma.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });

  const activeAdmins = users.filter(u => u.role === "ADMIN" && u.active).length;

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Who can sign in, and what they can see"
      />

      {activeAdmins === 1 && (
        <div className="alert-warn mb-5">
          <div>
            <b>There's only one admin account.</b> If it's ever disabled or forgotten, nobody can
            reach Settings, Users or approve a purchase order. Consider adding a second admin.
          </div>
        </div>
      )}

      <div className="card mb-5 p-0">
        <Table headers={["Name", "Email", "Role", "Region", "Status", ""]}>
          {users.map(u => (
            <UserRow
              key={u.id}
              user={{
                id: u.id, name: u.name, email: u.email,
                role: u.role, region: u.region, active: u.active,
              }}
              isMe={u.id === me.id}
              roles={ROLES}
              roleNotes={ROLE_NOTES}
              onUpdate={updateUserAction}
              onSetPassword={setUserPasswordAction}
              onToggle={toggleUserActiveAction}
            />
          ))}
        </Table>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <form action={createUserAction} className="card lg:col-span-2">
          <h3 className="mb-1 text-sm font-semibold text-ink-900">Add a user</h3>
          <p className="mb-4 text-xs text-ink-500">
            The email address is the login. Give them the password in person — this screen
            won't send it.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Name"><input name="name" required className="input" /></Field>
            <Field label="Email"><input name="email" type="email" required className="input" /></Field>
            <Field label="Password">
              <input name="password" type="password" required minLength={8}
                     autoComplete="new-password" className="input" />
            </Field>
            <Field label="Role">
              <select name="role" defaultValue="USER" className="input">
                {ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Region (optional)"><input name="region" className="input" /></Field>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button className="btn">Create user</button>
            <span className="text-2xs text-ink-400">Password must be at least 8 characters.</span>
          </div>
        </form>

        <div className="card">
          <h3 className="mb-3 text-sm font-semibold text-ink-900">What each role can do</h3>
          <dl className="space-y-3">
            {ROLES.map(r => (
              <div key={r}>
                <dt className="text-2xs font-semibold uppercase tracking-wider text-brand-500">{r}</dt>
                <dd className="mt-0.5 text-xs leading-relaxed text-ink-500">{ROLE_NOTES[r]}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 border-t border-ink-200 pt-3 text-2xs text-ink-400">
            Changing your own password? Use{" "}
            <Link href="/account" className="text-brand-600 hover:underline">your account page</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
