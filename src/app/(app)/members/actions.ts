"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import { periodAssignments, users } from "@/db/schema";
import { canManageRoster } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { isValidEmail, normalizeEmail } from "@/lib/auth/validation";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !canManageRoster(user)) throw new Error("You're not authorized to manage members.");
  return user;
}

export type MemberInput = {
  name: string;
  email: string;
  lineNumber: string;
  rosterStatus: "active" | "officer" | "50yr" | "inactive" | "retired";
  remarks: string;
  rosterActive: boolean;
};

// A roster member doesn't need a real email to exist in the system (a
// handful of historical entries never had one) — but every user row still
// needs *some* unique, valid-looking email for the schema's constraint, so
// one with no real address gets a placeholder that can never receive an
// OTP. If they're ever given a real email, editing it in here replaces it.
function placeholderEmail(): string {
  return `roster-${crypto.randomUUID()}@placeholder.invalid`;
}

export async function addMember(input: MemberInput): Promise<{ id: string }> {
  await requireAdmin();
  const name = input.name.trim();
  if (!name) throw new Error("Name is required.");

  const rawEmail = input.email.trim();
  const email = rawEmail ? normalizeEmail(rawEmail) : placeholderEmail();
  if (rawEmail && !isValidEmail(email)) throw new Error("Enter a valid email address.");

  const db = getDb();
  if (rawEmail) {
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) throw new Error("A member with that email already exists.");
  }

  const [{ maxPos }] = await db
    .select({ maxPos: sql<number>`coalesce(max(${users.rotationPosition}), 0)` })
    .from(users);

  const id = crypto.randomUUID();
  await db.insert(users).values({
    id,
    email,
    name,
    lineNumber: input.lineNumber.trim() || null,
    rosterStatus: input.rosterStatus,
    remarks: input.remarks.trim() || null,
    rosterActive: input.rosterActive,
    rotationPosition: maxPos + 1,
    // Admin-added members are the trusted roster, same as the seeded one —
    // active immediately, placeholder until they actually sign in.
    isActive: true,
    isPlaceholder: true,
  });

  revalidatePath("/members");
  revalidatePath("/");
  return { id };
}

export async function updateMember(userId: string, input: MemberInput): Promise<void> {
  await requireAdmin();
  const name = input.name.trim();
  if (!name) throw new Error("Name is required.");

  const db = getDb();
  const [current] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!current) throw new Error("Member not found.");

  const rawEmail = input.email.trim();
  let email = current.email;
  if (rawEmail) {
    const normalized = normalizeEmail(rawEmail);
    if (!isValidEmail(normalized)) throw new Error("Enter a valid email address.");
    if (normalized !== current.email) {
      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, normalized)).limit(1);
      if (existing && existing.id !== userId) throw new Error("A member with that email already exists.");
    }
    email = normalized;
  }

  await db
    .update(users)
    .set({
      name,
      email,
      lineNumber: input.lineNumber.trim() || null,
      rosterStatus: input.rosterStatus,
      remarks: input.remarks.trim() || null,
      rosterActive: input.rosterActive,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  revalidatePath("/members");
  revalidatePath("/members/[id]", "page");
  revalidatePath("/");
}

export async function deleteMember(userId: string): Promise<void> {
  await requireAdmin();
  const db = getDb();

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(periodAssignments)
    .where(eq(periodAssignments.memberId, userId));
  if (count > 0) {
    throw new Error("Member is assigned to one or more periods. Remove those assignments first.");
  }

  await db.delete(users).where(eq(users.id, userId));
  revalidatePath("/members");
}
