"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import { assignmentSlots } from "@/db/schema";
import { canManageSchedule } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !canManageSchedule(user)) throw new Error("You're not authorized to manage slots.");
}

export type SlotInput = {
  apparatusName: string;
  slotType: string;
  rotationNote: string;
  rotationLabels: string; // comma-separated, parsed here
  oicName: string;
};

function parseLabels(raw: string): string[] | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const labels = trimmed.split(",").map((l) => l.trim()).filter(Boolean);
  return labels.length > 0 ? labels : null;
}

export async function addSlot(input: SlotInput): Promise<void> {
  await requireAdmin();
  const apparatusName = input.apparatusName.trim();
  const slotType = input.slotType.trim();
  if (!apparatusName || !slotType) throw new Error("Apparatus and check type are required.");

  const db = getDb();
  const [{ maxOrder }] = await db
    .select({ maxOrder: sql<number>`coalesce(max(${assignmentSlots.sortOrder}), 0)` })
    .from(assignmentSlots);

  await db.insert(assignmentSlots).values({
    id: crypto.randomUUID(),
    apparatusName,
    slotType,
    rotationNote: input.rotationNote.trim() || null,
    rotationLabels: parseLabels(input.rotationLabels) ? JSON.stringify(parseLabels(input.rotationLabels)) : null,
    oicName: input.oicName.trim() || null,
    sortOrder: maxOrder + 1,
  });

  revalidatePath("/slots");
  revalidatePath("/");
}

export async function updateSlot(slotId: string, input: SlotInput): Promise<void> {
  await requireAdmin();
  const apparatusName = input.apparatusName.trim();
  const slotType = input.slotType.trim();
  if (!apparatusName || !slotType) throw new Error("Apparatus and check type are required.");

  const db = getDb();
  const labels = parseLabels(input.rotationLabels);
  await db
    .update(assignmentSlots)
    .set({
      apparatusName,
      slotType,
      rotationNote: input.rotationNote.trim() || null,
      rotationLabels: labels ? JSON.stringify(labels) : null,
      oicName: input.oicName.trim() || null,
    })
    .where(eq(assignmentSlots.id, slotId));

  revalidatePath("/slots");
  revalidatePath("/");
}

export async function deleteSlot(slotId: string): Promise<void> {
  await requireAdmin();
  const db = getDb();
  await db.delete(assignmentSlots).where(eq(assignmentSlots.id, slotId));
  revalidatePath("/slots");
  revalidatePath("/");
}
