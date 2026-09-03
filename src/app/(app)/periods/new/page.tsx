import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/db/client";
import { assignmentSlots, periodAssignments, periods, users } from "@/db/schema";
import { canManageSchedule } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { upcomingSecondMondays } from "@/lib/dates";

import { NewPeriodForm } from "./new-period-form";

export const dynamic = "force-dynamic";

export default async function NewPeriodPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canManageSchedule(user)) redirect("/periods");

  const db = getDb();
  const slots = await db.select().from(assignmentSlots).orderBy(assignmentSlots.sortOrder);
  const eligibleMembers = (await db.select().from(users))
    .filter((m) => m.rosterActive && m.rosterStatus !== "retired")
    .sort((a, b) => {
      const an = a.lineNumber ? parseInt(a.lineNumber, 10) : Infinity;
      const bn = b.lineNumber ? parseInt(b.lineNumber, 10) : Infinity;
      return an - bn || a.name.localeCompare(b.name);
    })
    .map((m) => ({ id: m.id, name: m.name, lineNumber: m.lineNumber }));

  const secondMondays = upcomingSecondMondays(8);

  const oicGroups: { oic: string; slots: typeof slots }[] = [];
  for (const slot of slots) {
    const oic = slot.oicName || "";
    const last = oicGroups[oicGroups.length - 1];
    if (last && last.oic === oic) last.slots.push(slot);
    else oicGroups.push({ oic, slots: [slot] });
  }

  const [current] = await db.select().from(periods).where(eq(periods.isCurrent, true)).limit(1);
  const currentAssignments: Record<string, string | null> = {};
  if (current) {
    const rows = await db.select().from(periodAssignments).where(eq(periodAssignments.periodId, current.id));
    for (const r of rows) currentAssignments[r.slotId] = r.memberId;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <Card>
        <CardHeader>
          <CardTitle>New period</CardTitle>
        </CardHeader>
        <CardContent>
          <NewPeriodForm
            oicGroups={oicGroups}
            members={eligibleMembers}
            secondMondays={secondMondays}
            currentAssignments={currentAssignments}
          />
        </CardContent>
      </Card>
    </div>
  );
}
