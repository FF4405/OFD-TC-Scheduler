"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db/client";
import { assignmentSlots, notificationLog, periodAssignments, users, weeklyCompletions } from "@/db/schema";
import { canMarkCompletion } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { checkReminderEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/sender";
import { isMailgunConfigured } from "@/lib/email/mailgun-client";
import { getAppOrigin } from "@/lib/get-app-origin";

export async function toggleCompletion(assignmentId: string, weekDate: string, undo: boolean): Promise<void> {
  const user = await getCurrentUser();
  if (!user || !canMarkCompletion(user)) throw new Error("You're not authorized to do that.");

  const db = getDb();
  if (undo) {
    await db
      .delete(weeklyCompletions)
      .where(and(eq(weeklyCompletions.assignmentId, assignmentId), eq(weeklyCompletions.weekDate, weekDate)));
  } else {
    await db
      .insert(weeklyCompletions)
      .values({ id: crypto.randomUUID(), assignmentId, weekDate, completedBy: user.name })
      .onConflictDoUpdate({
        target: [weeklyCompletions.assignmentId, weeklyCompletions.weekDate],
        set: { completedBy: user.name, completedAt: new Date() },
      });
  }

  revalidatePath("/");
  revalidatePath("/members/[id]", "page");
}

export type NotifyRecipient = {
  assignmentId: string;
  memberId: string | null;
  name: string;
  email: string;
  slot: string;
};

async function loadRecipients(
  periodId: string,
  weekDate: string,
  target: string | "pending",
): Promise<NotifyRecipient[]> {
  const db = getDb();

  const rows = await db
    .select({
      id: periodAssignments.id,
      memberId: periodAssignments.memberId,
      memberName: users.name,
      memberEmail: users.email,
      apparatusName: assignmentSlots.apparatusName,
      slotType: assignmentSlots.slotType,
    })
    .from(periodAssignments)
    .innerJoin(assignmentSlots, eq(assignmentSlots.id, periodAssignments.slotId))
    .leftJoin(users, eq(users.id, periodAssignments.memberId))
    .where(
      target === "pending" || target === "all"
        ? eq(periodAssignments.periodId, periodId)
        : eq(periodAssignments.id, target),
    );

  let filtered = rows;
  if (target === "pending") {
    const completed = await db
      .select({ assignmentId: weeklyCompletions.assignmentId })
      .from(weeklyCompletions)
      .where(
        and(
          eq(weeklyCompletions.weekDate, weekDate),
          inArray(
            weeklyCompletions.assignmentId,
            rows.map((r) => r.id),
          ),
        ),
      );
    const completedSet = new Set(completed.map((c) => c.assignmentId));
    filtered = rows.filter((r) => !completedSet.has(r.id));
  }

  return filtered.map((r) => ({
    assignmentId: r.id,
    memberId: r.memberId,
    name: r.memberName ?? "(Unassigned)",
    email: r.memberEmail ?? "",
    slot: `${r.apparatusName} ${r.slotType}`.trim(),
  }));
}

export async function previewReminders(
  periodId: string,
  weekDate: string,
  target: string | "pending",
): Promise<NotifyRecipient[]> {
  const user = await getCurrentUser();
  if (!user || !canMarkCompletion(user)) throw new Error("You're not authorized to do that.");
  return loadRecipients(periodId, weekDate, target);
}

export type SendRemindersResult = { sent: number; failed: number };

export async function sendReminders(
  periodId: string,
  weekDate: string,
  target: string | "pending",
): Promise<SendRemindersResult> {
  const user = await getCurrentUser();
  if (!user || !canMarkCompletion(user)) throw new Error("You're not authorized to do that.");
  if (!isMailgunConfigured()) throw new Error("Mailgun is not configured.");

  const recipients = await loadRecipients(periodId, weekDate, target);
  const db = getDb();
  const origin = await getAppOrigin();
  const weekDateLabel = new Date(weekDate + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  let sent = 0;
  let failed = 0;

  for (const r of recipients) {
    if (!r.email) {
      await db.insert(notificationLog).values({
        id: crypto.randomUUID(),
        memberId: r.memberId,
        assignmentId: r.assignmentId,
        weekDate,
        recipient: "",
        status: "failed",
        errorMessage: "No email address on file",
        triggeredBy: "manual",
      });
      failed++;
      continue;
    }
    try {
      const [apparatusName, ...slotTypeParts] = r.slot.split(" ");
      const { subject, html, text } = checkReminderEmail({
        memberName: r.name,
        apparatusName,
        slotType: slotTypeParts.join(" "),
        weekDate,
        weekDateLabel,
        appUrl: origin,
      });
      await sendEmail({ to: [r.email], subject, html, text });
      await db.insert(notificationLog).values({
        id: crypto.randomUUID(),
        memberId: r.memberId,
        assignmentId: r.assignmentId,
        weekDate,
        recipient: r.email,
        status: "sent",
        triggeredBy: "manual",
      });
      sent++;
    } catch (err) {
      await db.insert(notificationLog).values({
        id: crypto.randomUUID(),
        memberId: r.memberId,
        assignmentId: r.assignmentId,
        weekDate,
        recipient: r.email,
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
        triggeredBy: "manual",
      });
      failed++;
    }
  }

  revalidatePath("/members/[id]", "page");
  return { sent, failed };
}
