"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";

import { getDb } from "@/db/client";
import { sessions, users } from "@/db/schema";
import { isAdmin as checkIsAdmin } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !checkIsAdmin(user)) {
    throw new Error("You're not authorized to manage users.");
  }
  return user;
}

// Deactivating someone should cut off their access immediately rather than
// waiting out their session's 30-day expiry — delete their sessions so
// their next request bounces to /login.
export async function setUserActive(userId: string, isActive: boolean): Promise<void> {
  await requireAdmin();
  const db = getDb();
  await db.update(users).set({ isActive, updatedAt: new Date() }).where(eq(users.id, userId));
  if (!isActive) {
    await db.delete(sessions).where(eq(sessions.userId, userId));
  }
  revalidatePath("/admin/users");
  revalidatePath("/members");
}

export async function setUserAdmin(userId: string, isAdminValue: boolean): Promise<void> {
  await requireAdmin();
  const db = getDb();

  if (!isAdminValue) {
    const otherAdmins = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.isAdmin, true), ne(users.id, userId)))
      .limit(1);
    if (otherAdmins.length === 0) {
      throw new Error("Can't remove admin from the last remaining admin — promote someone else first.");
    }
  }

  await db.update(users).set({ isAdmin: isAdminValue, updatedAt: new Date() }).where(eq(users.id, userId));
  revalidatePath("/admin/users");
}
