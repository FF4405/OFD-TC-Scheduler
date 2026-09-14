import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/db/client";
import { periodAssignments, periods, weeklyCompletions } from "@/db/schema";
import { canManageSchedule } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { getPeriodEndDate } from "@/lib/dates";
import { fmtShortDate } from "@/lib/format-date";

export const dynamic = "force-dynamic";

export default async function PeriodsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = getDb();
  const allPeriods = await db.select().from(periods).orderBy(desc(periods.startDate));

  const counts = await db
    .select({
      periodId: periodAssignments.periodId,
      slotCount: sql<number>`count(distinct ${periodAssignments.id})`,
      completionCount: sql<number>`count(${weeklyCompletions.id})`,
    })
    .from(periodAssignments)
    .leftJoin(weeklyCompletions, eq(weeklyCompletions.assignmentId, periodAssignments.id))
    .groupBy(periodAssignments.periodId);
  const countMap = new Map(counts.map((c) => [c.periodId, c]));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Periods</h1>
        {canManageSchedule(user) ? (
          <Button asChild size="sm">
            <Link href="/periods/new">New period</Link>
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All periods</CardTitle>
        </CardHeader>
        <CardContent>
          {allPeriods.length === 0 ? (
            <p className="text-muted-foreground text-sm">No periods yet.</p>
          ) : (
            <div className="flex flex-col divide-y">
              {allPeriods.map((p) => {
                const c = countMap.get(p.id);
                return (
                  <Link
                    key={p.id}
                    href={`/periods/${p.id}`}
                    className="hover:bg-accent/50 flex items-center justify-between gap-4 rounded-md px-2 py-3 -mx-2"
                  >
                    <div>
                      <div className="flex items-center gap-2 font-medium">
                        {p.name}
                        {p.isCurrent ? <Badge>Current</Badge> : null}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {fmtShortDate(p.startDate)} – {fmtShortDate(getPeriodEndDate(p.startDate))}
                      </div>
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {c ? `${c.slotCount} slots · ${c.completionCount} completed` : "0 slots"}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
