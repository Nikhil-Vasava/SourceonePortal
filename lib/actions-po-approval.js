"use server";

// Purchase order approval.
//
// Staff raise orders; an admin approves them. Approval does two things that
// matter outside this file: it puts the company stamp on the PDF, and it lets
// non-admin staff email the order to a supplier.
//
// Both are checked server-side. Hiding a button is a courtesy to the user, not
// a permission — the action has to refuse on its own.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

/** Only an admin holds the stamp. */
function requireApprover() {
  const user = requireUser();
  if (user.role !== "ADMIN") return null;
  return user;
}

export async function approvePoAction(formData) {
  const user = requireApprover();
  if (!user) return { error: "Only an admin can approve a purchase order." };

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return { error: "Missing purchase order." };

  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    select: { id: true, number: true, approvedAt: true, lines: { select: { id: true } } },
  });
  if (!po) return { error: "That purchase order no longer exists." };
  if (po.approvedAt) return { error: `${po.number} is already approved.` };

  // An order with no lines would be stamped as approved while saying nothing.
  if (!po.lines.length) {
    return { error: `${po.number} has no products on it yet.` };
  }

  await prisma.purchaseOrder.update({
    where: { id },
    data: { approvedAt: new Date(), approvedById: user.id, approvedName: user.name || user.email },
  });

  revalidatePath("/purchase");
  return { ok: true, number: po.number, approvedBy: user.name || user.email };
}

export async function unapprovePoAction(formData) {
  const user = requireApprover();
  if (!user) return { error: "Only an admin can withdraw an approval." };

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return { error: "Missing purchase order." };

  const po = await prisma.purchaseOrder.findUnique({ where: { id }, select: { number: true, approvedAt: true } });
  if (!po) return { error: "That purchase order no longer exists." };
  if (!po.approvedAt) return { error: `${po.number} isn't approved.` };

  await prisma.purchaseOrder.update({
    where: { id },
    data: { approvedAt: null, approvedById: null, approvedName: null },
  });

  revalidatePath("/purchase");
  return { ok: true, number: po.number, withdrawn: true };
}
