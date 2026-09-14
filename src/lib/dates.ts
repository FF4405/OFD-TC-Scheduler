// A scheduling period runs from one 2nd-Monday-of-the-month to the next
// (not a fixed 4 weeks) — see getPeriodWeeks. Ported as-is from the
// pre-Cloudflare version of this app.

export function getSecondMonday(year: number, month: number): Date {
  const d = new Date(year, month, 1);
  const dow = d.getDay();
  const daysToFirstMonday = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow;
  d.setDate(1 + daysToFirstMonday);
  d.setDate(d.getDate() + 7);
  return d;
}

export function secondMondayStr(year: number, month: number): string {
  return getSecondMonday(year, month).toISOString().split("T")[0];
}

// Every Monday (as an ISO date string) from startDate up to, but not
// including, the following period's start (the next month's 2nd Monday).
export function getPeriodWeeks(startDate: string): string[] {
  const start = new Date(startDate + "T00:00:00");
  const nextYear = start.getMonth() === 11 ? start.getFullYear() + 1 : start.getFullYear();
  const nextMonth = (start.getMonth() + 1) % 12;
  const nextPeriodStart = getSecondMonday(nextYear, nextMonth);

  const weeks: string[] = [];
  const cursor = new Date(start);
  while (cursor < nextPeriodStart) {
    weeks.push(cursor.toISOString().split("T")[0]);
    cursor.setDate(cursor.getDate() + 7);
  }
  return weeks;
}

export function getPeriodEndDate(startDate: string): string {
  const weeks = getPeriodWeeks(startDate);
  return weeks[weeks.length - 1] ?? startDate;
}

// The next `count` 2nd Mondays from today (inclusive of today).
export function upcomingSecondMondays(count = 6): string[] {
  const today = new Date();
  const results: string[] = [];
  let year = today.getFullYear();
  let month = today.getMonth();

  while (results.length < count) {
    const sm = getSecondMonday(year, month);
    if (sm >= new Date(today.toDateString())) {
      results.push(sm.toISOString().split("T")[0]);
    }
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }
  return results;
}

export function getCurrentMondayDate(): string {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  return monday.toISOString().split("T")[0];
}
