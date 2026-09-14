import type { getDb } from "@/db/client";
import { settings } from "@/db/schema";

export const SETTINGS_DEFAULTS = {
  notify_day: "1", // 0=Sunday .. 6=Saturday; 1=Monday
  notify_hour: "8",
  auto_schedule_months: "6",
  repeat_miss_num: "3",
  repeat_miss_den: "4",
} as const;

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
