import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, inArray } from "drizzle-orm";

import { Button } from "@/components/ui/button";
import { getDb } from "@/db/client";
import { assignmentSlots, periodAssignments, periods, users, weeklyCompletions } from "@/db/schema";
import { canMarkCompletion, isAdmin } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { getPeriodWeeks } from "@/lib/dates";

import { PeriodSelect } from "./period-select";
import { ScheduleGrid, type OicGroup, type ScheduleRow } from "./schedule-grid";

export const dynamic = "force-dynamic";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { period: periodParam } = await searchParams;
  const db = getDb();
  const allPeriods = await db.select().from(periods).orderBy(desc(periods.startDate));

  const period = periodParam
    ? allPeriods.find((p) => p.id === periodParam)
    : (allPeriods.find((p) => p.isCurrent) ?? allPeriods[0]);

  if (!period) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-muted-foreground">No scheduling periods yet.</p>
        {isAdmin(user) ? (
          <Button asChild>
            <Link href="/periods/new">Create the first period</Link>
          </Button>
        ) : null}
      </div>
    );
  }

  const weeks = getPeriodWeeks(period.startDate);

  const assignments = await db
    .select({
      id: periodAssignments.id,
      memberId: periodAssignments.memberId,
      memberName: users.name,
      apparatusName: assignmentSlots.apparatusName,
      slotType: assignmentSlots.slotType,
      rotationNote: assignmentSlots.rotationNote,
      rotationLabels: assignmentSlots.rotationLabels,
      oicName: assignmentSlots.oicName,
      sortOrder: assignmentSlots.sortOrder,
    })
    .from(periodAssignments)
    .innerJoin(assignmentSlots, eq(assignmentSlots.id, periodAssignments.slotId))
    .leftJoin(users, eq(users.id, periodAssignments.memberId))
    .where(eq(periodAssignments.periodId, period.id))
    .orderBy(assignmentSlots.sortOrder);

  const assignmentIds = assignments.map((a) => a.id);
  const completions =
    assignmentIds.length > 0
      ? await db.select().from(weeklyCompletions).where(inArray(weeklyCompletions.assignmentId, assignmentIds))
      : [];
  const completionMap = new Map(completions.map((c) => [`${c.assignmentId}:${c.weekDate}`, c]));

  const today = new Date().toISOString().split("T")[0];

  const rows: ScheduleRow[] = assignments.map((a) => {
    const labels = a.rotationLabels ? (JSON.parse(a.rotationLabels) as string[]) : null;
    const weekData = weeks.map((weekDate, i) => {
      const label = labels ? labels[i % labels.length] : null;
      const completion = completionMap.get(`${a.id}:${weekDate}`) ?? null;
      return {
        weekDate,
        label,
        done: Boolean(completion),
        completedBy: completion?.completedBy ?? null,
        isFuture: weekDate > today,
      };
    });
    return {
      id: a.id,
      memberId: a.memberId,
      memberName: a.memberName,
      apparatusName: a.apparatusName,
      slotType: a.slotType,
      rotationNote: a.rotationNote,
      oicName: a.oicName,
      weekData,
    };
  });

  const oicGroups: OicGroup[] = [];
  for (const row of rows) {
    const oic = row.oicName || "";
    const last = oicGroups[oicGroups.length - 1];
    if (last && last.oic === oic) last.rows.push(row);
    else oicGroups.push({ oic, rows: [row] });
  }

  const currentWeek = weeks.find((w, i) => w <= today && (weeks[i + 1] ? weeks[i + 1] > today : true)) ?? null;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Schedule</h1>
          <p className="text-muted-foreground text-sm">{period.name}</p>
        </div>
        <PeriodSelect periods={allPeriods} selectedId={period.id} />
      </div>
      <ScheduleGrid
        periodId={period.id}
        weeks={weeks}
        oicGroups={oicGroups}
        currentWeek={currentWeek}
        canEdit={canMarkCompletion(user)}
      />
    </div>
  );
}
