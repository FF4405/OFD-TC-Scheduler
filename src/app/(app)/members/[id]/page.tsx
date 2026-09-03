import { notFound, redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/db/client";
import { assignmentSlots, notificationLog, periodAssignments, periods, users, weeklyCompletions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { getPeriodWeeks } from "@/lib/dates";
import { fmtDateTime, fmtShortDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  officer: "Officer",
  "50yr": "50-Year",
  inactive: "Inactive",
  retired: "Retired",
};

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login");

  const { id } = await params;
  const db = getDb();
  const [member] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!member) notFound();

  const assignments = await db
    .select({
      assignmentId: periodAssignments.id,
      periodId: periods.id,
      periodName: periods.name,
      startDate: periods.startDate,
      weekCount: periods.weekCount,
      apparatusName: assignmentSlots.apparatusName,
      slotType: assignmentSlots.slotType,
      oicName: assignmentSlots.oicName,
    })
    .from(periodAssignments)
    .innerJoin(periods, eq(periods.id, periodAssignments.periodId))
    .innerJoin(assignmentSlots, eq(assignmentSlots.id, periodAssignments.slotId))
    .where(eq(periodAssignments.memberId, id))
    .orderBy(desc(periods.startDate));

  const today = new Date().toISOString().split("T")[0];

  const periodsData = await Promise.all(
    assignments.map(async (a) => {
      const weeks = getPeriodWeeks(a.startDate);
      const completions = await db
        .select()
        .from(weeklyCompletions)
        .where(eq(weeklyCompletions.assignmentId, a.assignmentId))
        .orderBy(weeklyCompletions.weekDate);
      const completedSet = new Set(completions.map((c) => c.weekDate));
      const dots = weeks.map((weekDate) => ({
        date: weekDate,
        done: completedSet.has(weekDate),
        future: weekDate > today,
      }));
      return { assignment: a, weekCount: weeks.length, completedCount: completions.length, dots };
    }),
  );

  const notifications = await db
    .select()
    .from(notificationLog)
    .where(eq(notificationLog.memberId, id))
    .orderBy(desc(notificationLog.sentAt))
    .limit(100);

  const totalWeeks = periodsData.reduce((s, p) => s + p.weekCount, 0);
  const completedWeeks = periodsData.reduce((s, p) => s + p.completedCount, 0);
  const completionRate = totalWeeks > 0 ? Math.round((completedWeeks / totalWeeks) * 100) : null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>{member.name}</CardTitle>
            <Badge variant="outline">{STATUS_LABEL[member.rosterStatus] ?? member.rosterStatus}</Badge>
            {!member.rosterActive ? <Badge variant="secondary">Inactive</Badge> : null}
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <div className="text-muted-foreground text-xs">Line #</div>
            <div>{member.lineNumber ?? "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Email</div>
            <div>{member.isPlaceholder ? "—" : member.email}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Periods</div>
            <div>{periodsData.length}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Completion rate</div>
            <div>{completionRate === null ? "—" : `${completionRate}%`}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assignment history</CardTitle>
        </CardHeader>
        <CardContent>
          {periodsData.length === 0 ? (
            <p className="text-muted-foreground text-sm">No assignments yet.</p>
          ) : (
            <div className="flex flex-col divide-y">
              {periodsData.map(({ assignment: a, dots, completedCount, weekCount }) => (
                <div key={a.assignmentId} className="flex flex-col gap-2 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">{a.periodName}</div>
                      <div className="text-muted-foreground text-xs">
                        {a.apparatusName} {a.slotType} · starts {fmtShortDate(a.startDate)}
                      </div>
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {completedCount}/{weekCount} weeks
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {dots.map((d) => (
                      <div
                        key={d.date}
                        title={d.date}
                        className={cn(
                          "size-3 rounded-full border",
                          d.future
                            ? "border-border bg-transparent"
                            : d.done
                              ? "border-success bg-success"
                              : "border-warning bg-warning",
                        )}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notification log</CardTitle>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <p className="text-muted-foreground text-sm">No notifications sent.</p>
          ) : (
            <div className="flex flex-col divide-y text-sm">
              {notifications.map((n) => (
                <div key={n.id} className="flex items-center justify-between gap-2 py-2">
                  <div>
                    <div>Week of {fmtShortDate(n.weekDate)}</div>
                    <div className="text-muted-foreground text-xs">
                      {fmtDateTime(n.sentAt)} · {n.triggeredBy}
                      {n.errorMessage ? ` · ${n.errorMessage}` : ""}
                    </div>
                  </div>
                  <Badge variant={n.status === "sent" ? "success" : "destructive"}>{n.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
