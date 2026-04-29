const express = require('express');
const router = express.Router();
const { getDb } = require('../lib/db');
const { getPeriodWeeks, getPeriodEndDate, upcomingSecondMondays } = require('../lib/dates');
const { format, parseISO } = require('date-fns');

// ── Date helpers passed to every template ─────────────────────────────────────

function fmtShortDate(d) {
  try { return format(parseISO(d), 'M/d/yyyy'); } catch { return d; }
}

function fmtLongDate(d) {
  try { return format(new Date(d + 'T00:00:00'), 'MMMM d, yyyy'); } catch { return d; }
}

function fmtDateTime(d) {
  try { return format(parseISO(d), 'MMM d, yyyy h:mm a'); } catch { return d; }
}

function weekFmt(d) {
  try { return format(parseISO(d), 'MMM d, yyyy'); } catch { return d; }
}

function statusLabel(s) {
  return { active:'Active', officer:'Officer', '50yr':'50-Year', inactive:'Inactive', retired:'Retired' }[s] ?? s;
}

function rateColor(rate) {
  if (rate === null) return 'var(--text-muted)';
  if (rate >= 80) return 'var(--success)';
  if (rate >= 50) return 'var(--warning)';
  return 'var(--danger)';
}

// Shared template locals
function locals(req, extra = {}) {
  return { currentPath: req.path, fmtShortDate, fmtLongDate, fmtDateTime, weekFmt, statusLabel, rateColor, ...extra };
}

// Build OIC groups from a sorted slot/row array
function buildOicGroups(rows) {
  const groups = [];
  for (const row of rows) {
    const oic = row.oic_name || '';
    const last = groups[groups.length - 1];
    if (last && last.oic === oic) last.rows.push(row);
    else groups.push({ oic, rows: [row] });
  }
  return groups;
}

function buildOicSlotGroups(slots) {
  const groups = [];
  for (const slot of slots) {
    const oic = slot.oic_name || '';
    const last = groups[groups.length - 1];
    if (last && last.oic === oic) last.slots.push(slot);
    else groups.push({ oic, slots: [slot] });
  }
  return groups;
}

// ── Schedule ──────────────────────────────────────────────────────────────────

router.get('/', (req, res) => {
  const db = getDb();
  const allPeriods = db.prepare(`
    SELECT * FROM periods ORDER BY start_date DESC
  `).all();

  let periodId = req.query.period ? Number(req.query.period) : null;
  if (!periodId) {
    const current = allPeriods.find(p => p.is_current) || allPeriods[0];
    if (current) periodId = current.id;
  }

  if (!periodId) {
    return res.render('schedule', locals(req, { period: null, allPeriods, weeks: [], rows: [], oicGroups: [], currentWeek: null }));
  }

  const period = db.prepare('SELECT * FROM periods WHERE id = ?').get(periodId);
  const weeks = getPeriodWeeks(period.start_date);

  const assignments = db.prepare(`
    SELECT pa.id, pa.slot_id, pa.member_id,
           m.name as member_name, m.email as member_email,
           s.apparatus_name, s.slot_type, s.rotation_note,
           s.rotation_labels, s.oic_name, s.sort_order
    FROM period_assignments pa
    JOIN assignment_slots s ON s.id = pa.slot_id
    LEFT JOIN members m ON m.id = pa.member_id
    WHERE pa.period_id = ?
    ORDER BY s.sort_order
  `).all(period.id);

  const completions = db.prepare(`
    SELECT wc.assignment_id, wc.week_date, wc.completed_at, wc.completed_by, wc.notes
    FROM weekly_completions wc
    JOIN period_assignments pa ON pa.id = wc.assignment_id
    WHERE pa.period_id = ?
  `).all(period.id);

  const completionMap = new Map();
  for (const c of completions) completionMap.set(`${c.assignment_id}:${c.week_date}`, c);

  const today = new Date().toISOString().split('T')[0];

  const rows = assignments.map(a => {
    const labels = a.rotation_labels ? JSON.parse(a.rotation_labels) : null;
    const weekData = weeks.map((weekDate, i) => {
      const label = labels ? labels[i % labels.length] : null;
      const completion = completionMap.get(`${a.id}:${weekDate}`) || null;
      const isPast = weekDate < today;
      const isCurrentWeek = weekDate <= today && (weeks[i + 1] ? weeks[i + 1] > today : true);
      return { weekDate, label, completion, isPast, isCurrentWeek };
    });
    return { ...a, weekData, period_id: period.id };
  });

  const currentWeek = weeks.find((w, i) =>
    w <= today && (weeks[i + 1] ? weeks[i + 1] > today : true)
  ) || null;

  const oicGroups = buildOicGroups(rows);

  res.render('schedule', locals(req, { period, allPeriods, weeks, rows, oicGroups, currentWeek }));
});

// ── Members ───────────────────────────────────────────────────────────────────

router.get('/members', (req, res) => {
  const db = getDb();
  const members = db.prepare(`
    SELECT * FROM members ORDER BY
      CASE WHEN line_number = '' OR line_number IS NULL THEN 1 ELSE 0 END,
      CAST(line_number AS INTEGER), name
  `).all();

  // Compute rotation queue rank (1 = next up) among active eligible members
  const rotationOrdered = members
    .filter(m => m.active && m.status !== 'retired' && m.name !== 'NOT ASSIGNED')
    .slice()
    .sort((a, b) => (a.rotation_position ?? 999999) - (b.rotation_position ?? 999999));
  const rankMap = new Map(rotationOrdered.map((m, i) => [m.id, i + 1]));
  for (const m of members) m.queue_rank = rankMap.get(m.id) ?? null;

  res.render('members', locals(req, { members }));
});

router.get('/members/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(id);
  if (!member) return res.status(404).send('Member not found');

  const assignments = db.prepare(`
    SELECT pa.id AS assignment_id, pa.period_id, pa.slot_id,
           p.name AS period_name, p.start_date, p.week_count,
           s.apparatus_name, s.slot_type, s.oic_name
    FROM period_assignments pa
    JOIN periods p ON p.id = pa.period_id
    JOIN assignment_slots s ON s.id = pa.slot_id
    WHERE pa.member_id = ?
    ORDER BY p.start_date DESC
  `).all(id);

  const today = new Date().toISOString().split('T')[0];

  const periods = assignments.map(a => {
    const weeks = getPeriodWeeks(a.start_date);
    const completions = db.prepare(`
      SELECT week_date, completed_at, completed_by FROM weekly_completions
      WHERE assignment_id = ? ORDER BY week_date
    `).all(a.assignment_id);
    const completedSet = new Set(completions.map(c => c.week_date));

    const dots = weeks.map(weekDate => ({
      date: weekDate,
      done: completedSet.has(weekDate),
      future: weekDate > today,
    }));

    return {
      period: { id: a.period_id, name: a.period_name, start_date: a.start_date, week_count: a.week_count },
      slot: { apparatus_name: a.apparatus_name, slot_type: a.slot_type, oic_name: a.oic_name },
      assignment_id: a.assignment_id,
      weekCount: weeks.length,
      completedCount: completions.length,
      completions,
      dots,
    };
  });

  const notifications = db.prepare(`
    SELECT sent_at, method, status, week_date, triggered_by, error_message
    FROM notification_log WHERE member_id = ? ORDER BY sent_at DESC LIMIT 100
  `).all(id);

  const totalWeeks = periods.reduce((s, p) => s + p.weekCount, 0);
  const completedWeeks = periods.reduce((s, p) => s + p.completedCount, 0);

  const stats = {
    totalPeriods: periods.length,
    totalWeeks,
    completedWeeks,
    completionRate: totalWeeks > 0 ? Math.round((completedWeeks / totalWeeks) * 100) : null,
  };

  res.render('member-detail', locals(req, { member, periods, notifications, stats }));
});

// ── Slots ─────────────────────────────────────────────────────────────────────

router.get('/slots', (req, res) => {
  const db = getDb();
  const slots = db.prepare('SELECT * FROM assignment_slots ORDER BY sort_order').all();
  res.render('slots', locals(req, { slots }));
});

// ── Periods ───────────────────────────────────────────────────────────────────

router.get('/periods', (req, res) => {
  const db = getDb();
  const periods = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM period_assignments WHERE period_id = p.id) as slot_count,
      (SELECT COUNT(*) FROM period_assignments pa
       JOIN weekly_completions wc ON wc.assignment_id = pa.id
       WHERE pa.period_id = p.id) as total_completions
    FROM periods p ORDER BY p.start_date DESC
  `).all().map(p => ({ ...p, end_date: fmtShortDate(getPeriodEndDate(p.start_date)) }));

  res.render('periods', locals(req, { periods }));
});

router.get('/periods/new', (req, res) => {
  const db = getDb();
  const slots = db.prepare('SELECT * FROM assignment_slots ORDER BY sort_order').all();
  const members = db.prepare(`
    SELECT * FROM members WHERE active = 1 AND status != 'retired' AND name != 'NOT ASSIGNED'
    ORDER BY CASE WHEN line_number='' OR line_number IS NULL THEN 1 ELSE 0 END,
             CAST(line_number AS INTEGER), name
  `).all();
  const secondMondays = upcomingSecondMondays(6);
  const oicGroups = buildOicSlotGroups(slots);

  // Pre-populate from current period
  const currentAssignments = {};
  const current = db.prepare('SELECT id FROM periods WHERE is_current = 1 LIMIT 1').get();
  if (current) {
    const rows = db.prepare(`
      SELECT pa.slot_id, pa.member_id FROM period_assignments pa WHERE pa.period_id = ?
    `).all(current.id);
    for (const r of rows) currentAssignments[r.slot_id] = r.member_id;
  }

  res.render('periods-new', locals(req, { slots, members, secondMondays, oicGroups, currentAssignments, fmtLongDate }));
});

router.get('/periods/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const period = db.prepare('SELECT * FROM periods WHERE id = ?').get(id);
  if (!period) return res.status(404).send('Period not found');

  const slots = db.prepare('SELECT * FROM assignment_slots ORDER BY sort_order').all();
  const members = db.prepare(`
    SELECT * FROM members WHERE active = 1 AND status != 'retired' AND name != 'NOT ASSIGNED'
    ORDER BY CASE WHEN line_number='' OR line_number IS NULL THEN 1 ELSE 0 END,
             CAST(line_number AS INTEGER), name
  `).all();

  const rows = db.prepare(`
    SELECT pa.slot_id, pa.member_id FROM period_assignments pa WHERE pa.period_id = ?
  `).all(id);

  const assignments = {};
  for (const r of rows) assignments[r.slot_id] = r.member_id;
  for (const s of slots) if (!(s.id in assignments)) assignments[s.id] = null;

  const oicGroups = buildOicSlotGroups(slots);

  // Include is_repeat per slot
  const repeatSet = new Set(
    db.prepare('SELECT slot_id FROM period_assignments WHERE period_id = ? AND is_repeat = 1').all(id).map(r => r.slot_id)
  );
  for (const s of slots) s.is_repeat = repeatSet.has(s.id) ? 1 : 0;

  res.render('period-detail', locals(req, { period, slots, members, assignments, oicGroups }));
});

// ── Settings ──────────────────────────────────────────────────────────────────

router.get('/settings', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const r of rows) settings[r.key] = r.value;

  const { upcomingSecondMondays: upcoming } = require('../lib/dates');
  const months = parseInt(settings.auto_schedule_months || '6', 10);
  const candidates = upcoming(months + 2).filter(d => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() + months);
    return d <= cutoff.toISOString().split('T')[0];
  });
  const existingDates = new Set(db.prepare('SELECT start_date FROM periods').all().map(p => p.start_date));
  const upcomingPeriods = candidates.map(d => ({ date: d, exists: existingDates.has(d) }));

  res.render('settings', locals(req, { settings, upcomingPeriods }));
});

module.exports = router;
