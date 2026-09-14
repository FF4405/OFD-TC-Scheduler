"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { periodAssignments, periods } from "@/db/schema";
import { canManageSchedule } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { recalculatePeriodAssignments, runAutoGeneratePeriods, type AutoGenerateResult } from "@/lib/rotation";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !canManageSchedule(user)) throw new Error("You're not authorized to manage periods.");
  return user;
}

export type AssignmentInput = { slotId: string; memberId: string | null };

export async function createPeriod(input: {
  name: string;
  startDate: string;
  weekCount: number;
  assignments: AssignmentInput[];
}): Promise<{ id: string }> {
  await requireAdmin();
  const name = input.name.trim();
  if (!name || !input.startDate) throw new Error("Name and start date are required.");

  const db = getDb();
  const id = crypto.randomUUID();

  await db.update(periods).set({ isCurrent: false });
  await db.insert(periods).values({
    id,
    name,
    startDate: input.startDate,
    weekCount: input.weekCount || 4,
    isCurrent: true,
  });
  for (const a of input.assignments) {
    await db.insert(periodAssignments).values({
      id: crypto.randomUUID(),
      periodId: id,
      slotId: a.slotId,
      memberId: a.memberId,
    });
  }

  revalidatePath("/periods");
  revalidatePath("/");
  return { id };
}

export async function updatePeriodAssignments(
  periodId: string,
  input: { name: string; isCurrent: boolean; assignments: AssignmentInput[] },
): Promise<void> {
  await requireAdmin();
  const db = getDb();

  if (input.isCurrent) await db.update(periods).set({ isCurrent: false });
  await db.update(periods).set({ name: input.name, isCurrent: input.isCurrent }).where(eq(periods.id, periodId));

  for (const a of input.assignments) {
    await db
      .insert(periodAssignments)
      .values({ id: crypto.randomUUID(), periodId, slotId: a.slotId, memberId: a.memberId })
      .onConflictDoUpdate({
        target: [periodAssignments.periodId, periodAssignments.slotId],
        set: { memberId: a.memberId },
      });
  }

  revalidatePath("/periods");
  revalidatePath("/periods/[id]", "page");
  revalidatePath("/");
}

export type { AutoGenerateResult };

// Kept for admins who want to force a regeneration immediately (e.g. right
// after fixing the roster) rather than waiting for the daily cron — see
// src/app/api/cron/auto-generate-periods/route.ts for the automatic path
// that normally keeps the horizon topped up without anyone clicking this.
export async function autoGeneratePeriods(): Promise<AutoGenerateResult> {
  await requireAdmin();
  return runAutoGeneratePeriods();
}

// Re-fills one existing period's assignments from the rotation cycle,
// for when the roster changed after the period was generated. Refuses
// (via recalculatePeriodAssignments) if the period already has logged
// completions.
//
// Returns a plain result instead of throwing: Next.js redacts a thrown
// Server Action error's message in production the same way it redacts a
// Server Component render error, so a thrown "already has completions"
// message would reach the client as an opaque digest-only error instead
// of the actual reason.
export async function recalculatePeriod(periodId: string): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    await recalculatePeriodAssignments(periodId);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to recalculate." };
  }
}
