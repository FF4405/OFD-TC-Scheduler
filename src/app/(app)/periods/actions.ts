"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { assignmentSlots, periodAssignments, periods, settings as settingsTable, users, weeklyCompletions } from "@/db/schema";
import { canManageSchedule } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { getPeriodWeeks, upcomingSecondMondays } from "@/lib/dates";
import { sortByLineNumber } from "@/lib/members-sort";
import { getAutoScheduleMonths, getRepeatSettings, getSettings } from "@/lib/settings";

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

// Fills in upcoming 2nd-Monday periods out to the configured horizon. The
// base fill order is always the active roster's line-number order — no
// separately-tracked queue position that can drift out of sync with it.
// A single settings row (rotation_cursor_member_id) remembers only where
// in that fixed cycle the last run left off, so the next run resumes
// right after them, wrapping around at the end of the roster.
//
// A poor-attendance member's slot from the immediately preceding period
// is *replaced* into the same slot for the next new period (isRepeat) —
// carried in ahead of, and instead of, whoever the line-number cycle
// would otherwise have placed there. There's no separate "graduate"
// step: since the cycle always wraps back through everyone in the same
// fixed order, good attendance just means no override, not an explicit
// push to the back.
//
// Runs as plain sequential queries rather than one big SQL statement —
// the roster this operates on is small (a few dozen members, a handful
// of periods), so there's no need to fight D1's query builder for this.
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
  // recent period overall — that's the source for the repeat overlay.
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

  // slotId -> memberId to repeat into the very next new period, for
  // anyone whose attendance on that slot fell below the threshold.
  const repeatSlotToMember = new Map<string, string>();

  if (source) {
    const srcAssignments = await db.select().from(periodAssignments).where(eq(periodAssignments.periodId, source.id));
    const srcWeekCount = getPeriodWeeks(source.startDate).length;

    for (const a of srcAssignments) {
      if (!a.memberId) continue;
      const completions = await db.select().from(weeklyCompletions).where(eq(weeklyCompletions.assignmentId, a.id));
      const missRate = srcWeekCount > 0 ? (srcWeekCount - completions.length) / srcWeekCount : 0;
      if (missRate >= missThreshold) repeatSlotToMember.set(a.slotId, a.memberId);
    }
  }

  const eligibleMembers = sortByLineNumber(
    (await db.select().from(users)).filter((m) => m.rosterActive && m.rosterStatus !== "retired"),
  );

  const s = await getSettings(db);
  let cursorIndex = s.rotation_cursor_member_id
    ? eligibleMembers.findIndex((m) => m.id === s.rotation_cursor_member_id)
    : -1;

  let createdCount = 0;

  for (let pi = 0; pi < toCreate.length; pi++) {
    const startDate = toCreate[pi];
    const weekCount = getPeriodWeeks(startDate).length;
    const name = new Date(startDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const periodId = crypto.randomUUID();

    await db.insert(periods).values({ id: periodId, name, startDate, weekCount, isCurrent: false });

    const assignedInPeriod = new Set<string>();

    // First: repeats replace whoever the line-number cycle would
    // otherwise have picked for that slot — only for the very next period.
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

    // Then: fill every other slot by advancing through the fixed
    // line-number cycle, skipping anyone already placed this period
    // (by a repeat above, or an earlier slot in this same pass).
    for (const slot of allSlots) {
      if (pi === 0 && repeatSlotToMember.has(slot.id)) continue;

      let memberId: string | null = null;
      let tries = 0;
      while (eligibleMembers.length > 0 && tries < eligibleMembers.length) {
        cursorIndex = (cursorIndex + 1) % eligibleMembers.length;
        tries++;
        const candidate = eligibleMembers[cursorIndex];
        if (!assignedInPeriod.has(candidate.id)) {
          memberId = candidate.id;
          break;
        }
      }
      if (memberId) assignedInPeriod.add(memberId);
      await db.insert(periodAssignments).values({ id: crypto.randomUUID(), periodId, slotId: slot.id, memberId });
    }

    createdCount++;
  }

  if (cursorIndex >= 0) {
    const cursorMemberId = eligibleMembers[cursorIndex].id;
    await db
      .insert(settingsTable)
      .values({ key: "rotation_cursor_member_id", value: cursorMemberId })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value: cursorMemberId } });
  }

  revalidatePath("/periods");
  revalidatePath("/settings");
  revalidatePath("/members");
  revalidatePath("/");
  return { created: createdCount };
}
