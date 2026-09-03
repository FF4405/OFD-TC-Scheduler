import { and, eq, notInArray } from "drizzle-orm";

import { getDb } from "@/db/client";
import { assignmentSlots, notificationLog, periodAssignments, periods, users, weeklyCompletions } from "@/db/schema";
import { getCurrentMondayDate } from "@/lib/dates";
import { checkReminderEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/sender";
import { isMailgunConfigured } from "@/lib/email/mailgun-client";
import { getSettings } from "@/lib/settings";

// Deliberately outside the (app) route group — hit by the Cloudflare Cron
// Trigger (via worker.ts's `scheduled` handler self-fetching this route
// through the WORKER_SELF_REFERENCE service binding), not by a signed-in
// browser, so the group layout's session-cookie auth doesn't apply.
// Authorized instead by a shared secret header, checked against the
// CRON_SECRET Worker secret (`wrangler secret put CRON_SECRET`).
export const dynamic = "force-dynamic";

function currentEasternDayAndHour(): { day: number; hour: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    hour12: false,
  }).formatToParts(new Date());
  const weekdayStr = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hourStr = parts.find((p) => p.type === "hour")?.value ?? "0";
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const day = days.indexOf(weekdayStr);
  // Intl can format midnight as "24" instead of "0".
  const hour = parseInt(hourStr, 10) % 24;
  return { day: day < 0 ? 0 : day, hour };
}

export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get("x-cron-secret") !== expected) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const settings = await getSettings(db);
  const configuredDay = parseInt(settings.notify_day, 10);
  const configuredHour = parseInt(settings.notify_hour, 10);
  const { day, hour } = currentEasternDayAndHour();

  if (day !== configuredDay || hour !== configuredHour) {
    return Response.json({ skipped: "not the configured reminder time", day, hour });
  }

  const weekDate = getCurrentMondayDate();

  // Idempotency: this route can be hit multiple times within the matching
  // hour (Workers cron granularity), so skip if a cron-triggered reminder
  // already went out for this week.
  const [alreadySent] = await db
    .select({ id: notificationLog.id })
    .from(notificationLog)
    .where(and(eq(notificationLog.weekDate, weekDate), eq(notificationLog.triggeredBy, "cron")))
    .limit(1);
  if (alreadySent) {
    return Response.json({ message: "Already sent this week", weekDate, sent: 0, failed: 0, skipped: 0 });
  }

  const [currentPeriod] = await db.select().from(periods).where(eq(periods.isCurrent, true)).limit(1);
  if (!currentPeriod) {
    return Response.json({ message: "No current period set", sent: 0, failed: 0, skipped: 0 });
  }

  const completedAssignmentIds = (
    await db
      .select({ assignmentId: weeklyCompletions.assignmentId })
      .from(weeklyCompletions)
      .where(eq(weeklyCompletions.weekDate, weekDate))
  ).map((r) => r.assignmentId);

  const pending = await db
    .select({
      assignmentId: periodAssignments.id,
      memberId: periodAssignments.memberId,
      memberName: users.name,
      memberEmail: users.email,
      isPlaceholder: users.isPlaceholder,
      apparatusName: assignmentSlots.apparatusName,
      slotType: assignmentSlots.slotType,
    })
    .from(periodAssignments)
    .innerJoin(assignmentSlots, eq(assignmentSlots.id, periodAssignments.slotId))
    .leftJoin(users, eq(users.id, periodAssignments.memberId))
    .where(
      completedAssignmentIds.length > 0
        ? and(eq(periodAssignments.periodId, currentPeriod.id), notInArray(periodAssignments.id, completedAssignmentIds))
        : eq(periodAssignments.periodId, currentPeriod.id),
    );

  if (pending.length === 0) {
    return Response.json({ message: "All checks complete — no reminders sent", weekDate, sent: 0, failed: 0, skipped: 0 });
  }

  if (!isMailgunConfigured()) {
    return Response.json({ error: "Mailgun is not configured", weekDate, sent: 0, failed: 0, skipped: pending.length }, { status: 503 });
  }

  const origin = `${request.headers.get("x-forwarded-proto") ?? "https"}://${request.headers.get("host") ?? request.headers.get("x-forwarded-host") ?? ""}`;
  const weekDateLabel = new Date(weekDate + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const a of pending) {
    if (!a.memberEmail || a.isPlaceholder) {
      skipped++;
      continue;
    }
    try {
      const { subject, html, text } = checkReminderEmail({
        memberName: a.memberName ?? "Firefighter",
        apparatusName: a.apparatusName,
        slotType: a.slotType,
        weekDate,
        weekDateLabel,
        appUrl: origin,
      });
      await sendEmail({ to: [a.memberEmail], subject, html, text });
      await db.insert(notificationLog).values({
        id: crypto.randomUUID(),
        memberId: a.memberId,
        assignmentId: a.assignmentId,
        weekDate,
        recipient: a.memberEmail,
        status: "sent",
        triggeredBy: "cron",
      });
      sent++;
    } catch (err) {
      await db.insert(notificationLog).values({
        id: crypto.randomUUID(),
        memberId: a.memberId,
        assignmentId: a.assignmentId,
        weekDate,
        recipient: a.memberEmail,
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
        triggeredBy: "cron",
      });
      failed++;
    }
  }

  return Response.json({ weekDate, sent, failed, skipped });
}
