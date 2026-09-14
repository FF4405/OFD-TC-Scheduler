import type { getDb } from "@/db/client";
import { settings } from "@/db/schema";

export const SETTINGS_DEFAULTS = {
  notify_day: "1", // 0=Sunday .. 6=Saturday; 1=Monday
  notify_hour: "8",
  auto_schedule_months: "6",
  repeat_miss_num: "3",
  repeat_miss_den: "4",
  // "1" redirects every reminder email (manual or cron) to
  // DEMO_RECIPIENT_EMAIL instead of the real assignee — for testing the
  // reminder flow without emailing actual members.
  demo_mode: "0",
  // Internal bookkeeping, not user-facing: the member id the auto-generate
  // rotation last assigned, so the next run resumes right after them in
  // the line-number cycle instead of restarting from the top. Empty means
  // "start from the beginning of the roster."
  rotation_cursor_member_id: "",
  // Internal bookkeeping, not user-facing: the America/New_York date
  // (YYYY-MM-DD) auto-generate last actually ran on, via the daily cron —
  // see src/app/api/cron/auto-generate-periods/route.ts. Keeps that route
  // a once-a-day no-op the rest of the time despite firing on the same
  // hourly trigger as the reminder cron.
  auto_generate_last_run_date: "",
} as const;

// Where every reminder email goes when demo_mode is on.
export const DEMO_RECIPIENT_EMAIL = "jgothelf@oradellfire.org";

export type SettingsMap = Record<keyof typeof SETTINGS_DEFAULTS, string>;

type Db = ReturnType<typeof getDb>;

export async function getSettings(db: Db): Promise<SettingsMap> {
  const rows = await db.select().from(settings);
  const map = { ...SETTINGS_DEFAULTS } as SettingsMap;
  for (const row of rows) {
    if (row.key in map) map[row.key as keyof typeof SETTINGS_DEFAULTS] = row.value;
  }
  return map;
}

export async function getAutoScheduleMonths(db: Db): Promise<number> {
  const s = await getSettings(db);
  return parseInt(s.auto_schedule_months, 10) || 6;
}

export async function getRepeatSettings(db: Db): Promise<{ missNum: number; missDen: number }> {
  const s = await getSettings(db);
  return {
    missNum: parseFloat(s.repeat_miss_num) || 3,
    missDen: parseFloat(s.repeat_miss_den) || 4,
  };
}
