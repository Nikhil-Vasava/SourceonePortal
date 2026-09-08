"use server";

// User administration.
//
// Every action re-checks the admin role. The Users page is already gated, but
// a server action is a public endpoint with a generated URL — gating the page
// that renders the button stops a click, not a request. Creating an admin
// account is the single most valuable thing an attacker could do here, and the
// old createUser had no check of its own at all.
//
// The other theme is not locking yourself out. With one admin account, a
// mis-click on "Disable" would leave nobody able to reach Settings, Users or
// PO approval, and no way back except editing the database by hand. So the
// last active admin can't be disabled, demoted, or have their own role changed.

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireUser, ROLES } from "@/lib/auth";

const MIN_PASSWORD = 8;

function admin() {
  const user = requireUser();
  return user.role === "ADMIN" ? user : null;
}

const clean = (v) => String(v ?? "").trim();
const email = (v) => clean(v).toLowerCase();

function validRole(v) {
  return ROLES.includes(clean(v)) ? clean(v) : null;
}

/** How many admins could still sign in if this one were removed. */
async function otherActiveAdmins(exceptId) {
  return prisma.user.count({
    where: { role: "ADMIN", active: true, id: { not: exceptId } },
  });
}

export async function createUserAction(formData) {
  if (!admin()) return { error: "Only an admin can add users." };

  const name = clean(formData.get("name"));
  const addr = email(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  const role = validRole(formData.get("role"));

  if (!name) return { error: "Name is required." };
  if (!addr.includes("@")) return { error: "That doesn't look like an email address." };
  if (password.length < MIN_PASSWORD) {
    return { error: `The password needs at least ${MIN_PASSWORD} characters.` };
  }
  if (!role) return { error: "Pick a role." };

  const taken = await prisma.user.findUnique({ where: { email: addr }, select: { id: true } });
  if (taken) return { error: `${addr} already has an account.` };

  await prisma.user.create({
    data: {
      name, email: addr, role,
      password: bcrypt.hashSync(password, 10),
      region: clean(formData.get("region")) || null,
    },
  });

  revalidatePath("/users");
  return { ok: true, message: `${name} can now sign in as ${role}.` };
}

export async function updateUserAction(formData) {
  const me = admin();
  if (!me) return { error: "Only an admin can change users." };

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return { error: "Missing user." };

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return { error: "That user no longer exists." };

  const name = clean(formData.get("name"));
  const addr = email(formData.get("email"));
  const role = validRole(formData.get("role"));
  if (!name) return { error: "Name is required." };
  if (!addr.includes("@")) return { error: "That doesn't look like an email address." };
  if (!role) return { error: "Pick a role." };

  if (addr !== target.email) {
    const taken = await prisma.user.findUnique({ where: { email: addr }, select: { id: true } });
    if (taken) return { error: `${addr} already has an account.` };
  }

  // Demoting the last admin would leave nobody able to administer anything.
  if (target.role === "ADMIN" && role !== "ADMIN" && target.active) {
    if (await otherActiveAdmins(id) === 0) {
      return { error: "This is the only active admin — make someone else an admin first." };
    }
  }
  // Changing your own role is how people accidentally lock themselves out of
  // the screen they're standing on.
  if (target.id === me.id && role !== me.role) {
    return { error: "You can't change your own role. Ask another admin." };
  }

  await prisma.user.update({
    where: { id },
    data: { name, email: addr, role, region: clean(formData.get("region")) || null },
  });

  revalidatePath("/users");
  return { ok: true, message: `${name} updated.` };
}

export async function setUserPasswordAction(formData) {
  if (!admin()) return { error: "Only an admin can reset passwords." };

  const id = Number(formData.get("id"));
  const password = String(formData.get("password") ?? "");
  if (!Number.isFinite(id)) return { error: "Missing user." };
  if (password.length < MIN_PASSWORD) {
    return { error: `The password needs at least ${MIN_PASSWORD} characters.` };
  }

  const target = await prisma.user.findUnique({ where: { id }, select: { name: true } });
  if (!target) return { error: "That user no longer exists." };

  await prisma.user.update({
    where: { id },
    data: { password: bcrypt.hashSync(password, 10) },
  });

  revalidatePath("/users");
  // Deliberately does not echo the password back — it would end up in a
  // screenshot, a log, or a support thread.
  return { ok: true, message: `Password reset for ${target.name}. Tell them in person, not by email.` };
}

export async function toggleUserActiveAction(formData) {
  const me = admin();
  if (!me) return { error: "Only an admin can enable or disable users." };

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return { error: "Missing user." };

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return { error: "That user no longer exists." };

  if (target.active) {
    if (target.id === me.id) return { error: "You can't disable your own account." };
    if (target.role === "ADMIN" && await otherActiveAdmins(id) === 0) {
      return { error: "This is the only active admin — you'd lock everyone out." };
    }
  }

  await prisma.user.update({ where: { id }, data: { active: !target.active } });
  revalidatePath("/users");
  return { ok: true, message: `${target.name} ${target.active ? "disabled" : "enabled"}.` };
}

/**
 * Change your own password.
 *
 * Open to every role — needing an admin to rotate your own password is how
 * people end up not rotating it. The current password is required so a walk-up
 * on an unlocked screen can't silently take the account over.
 */
export async function changeMyPasswordAction(formData) {
  const me = requireUser();

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next.length < MIN_PASSWORD) {
    return { error: `The new password needs at least ${MIN_PASSWORD} characters.` };
  }
  if (next !== confirm) return { error: "The two new passwords don't match." };
  if (next === current) return { error: "The new password is the same as the old one." };

  // Read the hash from the database — the session cookie doesn't carry it.
  const row = await prisma.user.findUnique({ where: { id: me.id }, select: { password: true } });
  if (!row || !bcrypt.compareSync(current, row.password)) {
    return { error: "That current password isn't right." };
  }

  await prisma.user.update({
    where: { id: me.id },
    data: { password: bcrypt.hashSync(next, 10) },
  });

  return { ok: true, message: "Password changed." };
}
