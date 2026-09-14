import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { settings } from "@/db/schema";
import { runAutoGeneratePeriods } from "@/lib/rotation";

// Keeps the scheduling horizon topped up on its own — no admin needs to
// remember to click "Auto-generate periods." Deliberately outside the
// (app) route group and hit by the Cloudflare Cron Trigger (via worker.ts's
// `scheduled` handler self-fetching this route through the
// WORKER_SELF_REFERENCE service binding), same pattern and same
// CRON_SECRET as /api/cron/remind.
export const dynamic = "force-dynamic";

function currentEasternDateStr(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get("x-cron-secret") !== expected) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const today = currentEasternDateStr();

  // The Worker's cron fires hourly (shared with /api/cron/remind); this
  // route only needs to actually do anything once a day, so it no-ops
  // every other hour rather than needing its own separate Cron Trigger.
  const [lastRun] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, "auto_generate_last_run_date"))
    .limit(1);
  if (lastRun?.value === today) {
    return Response.json({ skipped: "already ran today" });
  }

  const result = await runAutoGeneratePeriods();

  await db
    .insert(settings)
    .values({ key: "auto_generate_last_run_date", value: today })
    .onConflictDoUpdate({ target: settings.key, set: { value: today } });

  return Response.json(result);
}
