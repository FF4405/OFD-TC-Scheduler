"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import { assignmentSlots, periodAssignments, periods, users, weeklyCompletions } from "@/db/schema";
import { canManageSchedule } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { getPeriodWeeks, upcomingSecondMondays } from "@/lib/dates";
import { getAutoScheduleMonths, getRepeatSettings } from "@/lib/settings";

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

export type AutoGenerateResult = { created: number; message?: string };

// Ports the rotation/repeat/graduate logic from the pre-Cloudflare app's
// POST /api/periods/auto-generate: fills in upcoming 2nd-Monday periods out
// to the configured horizon, carrying a poor-attendance member's slot
// forward (isRepeat) and pushing good-attendance members to the back of
// the rotation queue, then filling everything else round-robin. Runs as
// plain sequential queries rather than one big SQL statement — the roster
// this operates on is small (a few dozen members, a handful of periods),
// so there's no need to fight D1's query builder for this.
export async function autoGeneratePeriods(): Promise<AutoGenerateResult> {
  await requireAdmin();
  const db = getDb();

  const months = await getAutoScheduleMonths(db);
  const { missNum, missDen } = await getRepeatSettings(db);
  const missThreshold = missNum / missDen;

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() + months);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  const candidates = upcomingSecondMondays(months * 2).filter((d) => d <= cutoffStr);

  const existingPeriods = await db.select().from(periods);
  const existingDates = new Set(existingPeriods.map((p) => p.startDate));
  const toCreate = candidates.filter((d) => !existingDates.has(d));
  if (toCreate.length === 0) return { created: 0, message: "All periods already exist" };

  const allSlots = await db.select().from(assignmentSlots).orderBy(assignmentSlots.sortOrder);

  // Most recent period with any completion data, else just the most
  // recent period overall — that's the source for repeat/graduate logic.
  const sortedByDateDesc = existingPeriods.slice().sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
  let source: (typeof existingPeriods)[number] | undefined;
  for (const p of sortedByDateDesc) {
    const [hasCompletion] = await db
      .select({ id: weeklyCompletions.id })
      .from(weeklyCompletions)
      .innerJoin(periodAssignments, eq(periodAssignments.id, weeklyCompletions.assignmentId))
      .where(eq(periodAssignments.periodId, p.id))
      .limit(1);
    if (hasCompletion) {
      source = p;
      break;
    }
  }
  if (!source) source = sortedByDateDesc[0];

  const repeatSlotToMember = new Map<string, string>();

  if (source) {
    const srcAssignments = await db.select().from(periodAssignments).where(eq(periodAssignments.periodId, source.id));
    const srcWeekCount = getPeriodWeeks(source.startDate).length;
    const graduatingIds: string[] = [];

    for (const a of srcAssignments) {
      if (!a.memberId) continue;
      const completions = await db.select().from(weeklyCompletions).where(eq(weeklyCompletions.assignmentId, a.id));
      const completedCount = completions.length;
      const missRate = srcWeekCount > 0 ? (srcWeekCount - completedCount) / srcWeekCount : 0;
      if (missRate >= missThreshold) {
        repeatSlotToMember.set(a.slotId, a.memberId);
      } else if (completedCount > 0) {
        graduatingIds.push(a.memberId);
      }
    }

    if (graduatingIds.length > 0) {
      const [{ maxPos }] = await db
        .select({ maxPos: sql<number>`coalesce(max(${users.rotationPosition}), 0)` })
        .from(users);
      const allMembersForGrad = await db.select().from(users);
      const grads = graduatingIds
        .map((id) => allMembersForGrad.find((m) => m.id === id))
        .filter((m): m is (typeof allMembersForGrad)[number] => Boolean(m))
        .sort((a, b) => (a.rotationPosition ?? 999999) - (b.rotationPosition ?? 999999));
      let pos = maxPos;
      for (const m of grads) {
        pos++;
        await db.update(users).set({ rotationPosition: pos }).where(eq(users.id, m.id));
      }
    }
  }

  const allMembersNow = await db.select().from(users);
  const rotationIds = allMembersNow
    .filter((m) => m.rosterActive && m.rosterStatus !== "retired")
    .sort((a, b) => (a.rotationPosition ?? 999999) - (b.rotationPosition ?? 999999) || a.id.localeCompare(b.id))
    .map((m) => m.id);

  let rotationIndex = 0;
  let createdCount = 0;

  for (let pi = 0; pi < toCreate.length; pi++) {
    const startDate = toCreate[pi];
    const weekCount = getPeriodWeeks(startDate).length;
    const name = new Date(startDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const periodId = crypto.randomUUID();

    await db.insert(periods).values({ id: periodId, name, startDate, weekCount, isCurrent: false });

    const assignedInPeriod = new Set<string>();

    if (pi === 0) {
      for (const slot of allSlots) {
        const memberId = repeatSlotToMember.get(slot.id);
        if (memberId) {
          assignedInPeriod.add(memberId);
          await db.insert(periodAssignments).values({
            id: crypto.randomUUID(),
            periodId,
            slotId: slot.id,
            memberId,
            isRepeat: true,
          });
        }
      }
    }

    for (const slot of allSlots) {
      if (pi === 0 && repeatSlotToMember.has(slot.id)) continue;

      let tries = 0;
      while (
        rotationIds.length > 0 &&
        tries < rotationIds.length &&
        assignedInPeriod.has(rotationIds[rotationIndex % rotationIds.length])
      ) {
        rotationIndex++;
        tries++;
      }

      const memberId = rotationIds.length > 0 ? rotationIds[rotationIndex % rotationIds.length] : null;
      if (memberId) {
        assignedInPeriod.add(memberId);
        rotationIndex++;
      }
      await db.insert(periodAssignments).values({ id: crypto.randomUUID(), periodId, slotId: slot.id, memberId });
    }

    createdCount++;
  }

  revalidatePath("/periods");
  revalidatePath("/settings");
  revalidatePath("/");
  return { created: createdCount };
}
