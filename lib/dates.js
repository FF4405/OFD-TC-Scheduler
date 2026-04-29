function getSecondMonday(year, month) {
  const d = new Date(year, month, 1);
  const dow = d.getDay();
  const daysToFirstMonday = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow;
  d.setDate(1 + daysToFirstMonday);
  d.setDate(d.getDate() + 7);
  return d;
}

function secondMondayStr(year, month) {
  return getSecondMonday(year, month).toISOString().split('T')[0];
}

function getPeriodWeeks(startDate) {
  const start = new Date(startDate + 'T00:00:00');
  const nextYear  = start.getMonth() === 11 ? start.getFullYear() + 1 : start.getFullYear();
  const nextMonth = (start.getMonth() + 1) % 12;
  const nextPeriodStart = getSecondMonday(nextYear, nextMonth);

  const weeks = [];
  const cursor = new Date(start);
  while (cursor < nextPeriodStart) {
    weeks.push(cursor.toISOString().split('T')[0]);
    cursor.setDate(cursor.getDate() + 7);
  }
  return weeks;
}

function getPeriodEndDate(startDate) {
  const weeks = getPeriodWeeks(startDate);
  return weeks[weeks.length - 1] ?? startDate;
}

function upcomingSecondMondays(count = 6) {
  const today = new Date();
  const results = [];
  let year = today.getFullYear();
  let month = today.getMonth();

  while (results.length < count) {
    const sm = getSecondMonday(year, month);
    if (sm >= new Date(today.toDateString())) {
      results.push(sm.toISOString().split('T')[0]);
    }
    month++;
    if (month > 11) { month = 0; year++; }
  }
  return results;
}

module.exports = { getSecondMonday, secondMondayStr, getPeriodWeeks, getPeriodEndDate, upcomingSecondMondays };
