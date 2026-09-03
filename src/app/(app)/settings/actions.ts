"use server";

import { revalidatePath } from "next/cache";

import { getDb } from "@/db/client";
import { settings } from "@/db/schema";
import { canManageSchedule } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import type { SettingsMap } from "@/lib/settings";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !canManageSchedule(user)) throw new Error("You're not authorized to change settings.");
}

export async function updateSettings(values: Partial<SettingsMap>): Promise<void> {
  await requireAdmin();
  const db = getDb();

  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue;
    await db
      .insert(settings)
      .values({ key, value: String(value) })
      .onConflictDoUpdate({ target: settings.key, set: { value: String(value) } });
  }

  revalidatePath("/settings");
}
