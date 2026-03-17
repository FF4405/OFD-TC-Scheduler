/**
 * Periods run from the 2nd Monday of one month to the Monday before
 * the 2nd Monday of the following month.
 */

/** Returns the date of the 2nd Monday of a given year/month (0-indexed month). */
export function getSecondMonday(year: number, month: number): Date {
  const d = new Date(year, month, 1);
  // Advance to the first Monday of the month
  const dow = d.getDay(); // 0=Sun … 6=Sat
  const daysToFirstMonday = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow;
  d.setDate(1 + daysToFirstMonday);
  // Second Monday is one week later
  d.setDate(d.getDate() + 7);
  return d;
}

/** ISO yyyy-MM-dd string for the 2nd Monday of a given year/month. */
export function secondMondayStr(year: number, month: number): string {
  return getSecondMonday(year, month).toISOString().split('T')[0];
}

/**
 * Given a period start date (the 2nd Monday of month M), returns an array of
 * ISO date strings for every Monday up to (but not including) the 2nd Monday
 * of month M+1.
 */
export function getPeriodWeeks(startDate: string): string[] {
  const start = new Date(startDate + 'T00:00:00');
  const nextYear  = start.getMonth() === 11 ? start.getFullYear() + 1 : start.getFullYear();
  const nextMonth = (start.getMonth() + 1) % 12;
  const nextPeriodStart = getSecondMonday(nextYear, nextMonth);

  const weeks: string[] = [];
  const cursor = new Date(start);
  while (cursor < nextPeriodStart) {
    weeks.push(cursor.toISOString().split('T')[0]);
    cursor.setDate(cursor.getDate() + 7);
  }
  return weeks;
}

/** The last Monday of a period (one week before the next 2nd Monday). */
export function getPeriodEndDate(startDate: string): string {
  const weeks = getPeriodWeeks(startDate);
  return weeks[weeks.length - 1] ?? startDate;
}

/**
 * Returns an array of the next N upcoming 2nd-Monday start dates,
 * starting from today's month (or next month if today is past the 2nd Monday).
 */
export function upcomingSecondMondays(count = 6): string[] {
  const today = new Date();
  const results: string[] = [];
  let year = today.getFullYear();
  let month = today.getMonth();

  while (results.length < count) {
    const sm = getSecondMonday(year, month);
    // Include if the 2nd Monday is today or in the future
    if (sm >= new Date(today.toDateString())) {
      results.push(sm.toISOString().split('T')[0]);
    }
    month++;
    if (month > 11) { month = 0; year++; }
  }
  return results;
}
