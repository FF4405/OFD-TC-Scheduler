import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/db/client";
import { assignmentSlots, periodAssignments, periods, users } from "@/db/schema";
import { canManageSchedule } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";

import { PeriodDetailForm } from "./period-detail-form";

export const dynamic = "force-dynamic";

export default async function PeriodDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const db = getDb();
  const [period] = await db.select().from(periods).where(eq(periods.id, id)).limit(1);
  if (!period) notFound();

  if (!canManageSchedule(user)) redirect(`/?period=${id}`);

  const slotsRaw = await db.select().from(assignmentSlots).orderBy(assignmentSlots.sortOrder);
  const eligibleMembers = (await db.select().from(users))
    .filter((m) => m.rosterActive && m.rosterStatus !== "retired")
    .sort((a, b) => {
      const an = a.lineNumber ? parseInt(a.lineNumber, 10) : Infinity;
      const bn = b.lineNumber ? parseInt(b.lineNumber, 10) : Infinity;
      return an - bn || a.name.localeCompare(b.name);
    })
    .map((m) => ({ id: m.id, name: m.name, lineNumber: m.lineNumber }));

  const rows = await db.select().from(periodAssignments).where(eq(periodAssignments.periodId, id));
  const assignmentBySlot = new Map(rows.map((r) => [r.slotId, r]));

  const slots = slotsRaw.map((s) => ({
    id: s.id,
    apparatusName: s.apparatusName,
    slotType: s.slotType,
    oicName: s.oicName,
    isRepeat: assignmentBySlot.get(s.id)?.isRepeat ?? false,
  }));

  const oicGroups: { oic: string; slots: typeof slots }[] = [];
  for (const slot of slots) {
    const oic = slot.oicName || "";
    const last = oicGroups[oicGroups.length - 1];
    if (last && last.oic === oic) last.slots.push(slot);
    else oicGroups.push({ oic, slots: [slot] });
  }

  const initialAssignments: Record<string, string | null> = {};
  for (const s of slots) initialAssignments[s.id] = assignmentBySlot.get(s.id)?.memberId ?? null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <Card>
        <CardHeader>
          <CardTitle>{period.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <PeriodDetailForm
            periodId={period.id}
            periodName={period.name}
            isCurrentInitial={period.isCurrent}
            oicGroups={oicGroups}
            members={eligibleMembers}
            initialAssignments={initialAssignments}
          />
        </CardContent>
      </Card>
    </div>
  );
}
