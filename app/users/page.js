import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { PageHeader, Table } from "@/components/ui";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

async function createUser(formData) {
  "use server";
  await prisma.user.create({ data: {
    email: formData.get("email"), name: formData.get("name"),
    password: bcrypt.hashSync(formData.get("password"), 10),
    role: formData.get("role"), region: formData.get("region") || null,
  }});
  revalidatePath("/users");
}
async function toggleActive(formData) {
  "use server";
  const id = Number(formData.get("id"));
  const u = await prisma.user.findUnique({ where: { id } });
  await prisma.user.update({ where: { id }, data: { active: !u.active } });
  revalidatePath("/users");
}

export default async function Users() {
  requireRole("ADMIN");
  const users = await prisma.user.findMany({ orderBy: { id: "asc" } });
  return (
    <div>
      <PageHeader title="Users" subtitle="Role-based access: ADMIN · MANAGER · USER" />
      <Table headers={["Name", "Email", "Role", "Region", "Status", ""]}>
        {users.map(u => (
          <tr key={u.id} className="hover:bg-ink-50">
            <td className="td font-medium">{u.name}</td>
            <td className="td">{u.email}</td>
            <td className="td"><span className="badge bg-brand-50 text-brand-700">{u.role}</span></td>
            <td className="td">{u.region || "—"}</td>
            <td className="td">{u.active ? "Active" : "Disabled"}</td>
            <td className="td">
              <form action={toggleActive}><input type="hidden" name="id" value={u.id} />
                <button className="text-xs text-brand-700 underline">{u.active ? "Disable" : "Enable"}</button></form>
            </td>
          </tr>
        ))}
      </Table>
      <div className="card mt-4">
        <h3 className="mb-2 font-semibold text-sm">Add User</h3>
        <form action={createUser} className="flex flex-wrap gap-2">
          <input name="name" required placeholder="Name" className="input w-40" />
          <input name="email" type="email" required placeholder="Email" className="input w-56" />
          <input name="password" required placeholder="Password" className="input w-36" />
          <select name="role" className="input w-32"><option>USER</option><option>MANAGER</option><option>ADMIN</option></select>
          <input name="region" placeholder="Region" className="input w-28" />
          <button className="btn">Create</button>
        </form>
      </div>
    </div>
  );
}
