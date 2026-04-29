const express = require('express');
const router = express.Router();
const { getDb } = require('../../lib/db');
const { getPeriodWeeks } = require('../../lib/dates');

router.get('/', (req, res) => {
  const db = getDb();
  const members = db.prepare(`
    SELECT * FROM members ORDER BY
      CASE WHEN line_number = '' OR line_number IS NULL THEN 1 ELSE 0 END,
      CAST(line_number AS INTEGER),
      name
  `).all();
  res.json(members);
});

router.post('/', (req, res) => {
  const db = getDb();
  const { line_number, name, email, status, remarks } = req.body;
  const result = db.prepare(`
    INSERT INTO members (line_number, name, email, status, remarks, active)
    VALUES (?, ?, ?, ?, ?, 1)
  `).run(line_number || null, name, email || null, status || 'active', remarks || null);
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(member);
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(id);
  if (!member) return res.status(404).json({ error: 'Member not found' });

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

  const periods = assignments.map(a => {
    const weeks = getPeriodWeeks(a.start_date);
    const completions = db.prepare(`
      SELECT week_date, completed_at, completed_by
      FROM weekly_completions
      WHERE assignment_id = ?
      ORDER BY week_date
    `).all(a.assignment_id);

    return {
      period: { id: a.period_id, name: a.period_name, start_date: a.start_date, week_count: a.week_count },
      slot: { apparatus_name: a.apparatus_name, slot_type: a.slot_type, oic_name: a.oic_name },
      assignment_id: a.assignment_id,
      weekCount: weeks.length,
      completedCount: completions.length,
      completions,
    };
  });

  const notifications = db.prepare(`
    SELECT sent_at, method, status, week_date, triggered_by, error_message
    FROM notification_log
    WHERE member_id = ?
    ORDER BY sent_at DESC
    LIMIT 100
  `).all(id);

  const totalWeeks = periods.reduce((s, p) => s + p.weekCount, 0);
  const completedWeeks = periods.reduce((s, p) => s + p.completedCount, 0);

  res.json({
    member,
    periods,
    notifications,
    stats: {
      totalPeriods: periods.length,
      totalWeeks,
      completedWeeks,
      completionRate: totalWeeks > 0 ? Math.round((completedWeeks / totalWeeks) * 100) : null,
    },
  });
});

router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const { line_number, name, email, status, remarks, active } = req.body;
  db.prepare(`
    UPDATE members SET line_number=?, name=?, email=?, status=?, remarks=?, active=?
    WHERE id=?
  `).run(line_number || null, name, email || null, status, remarks || null, active ? 1 : 0, id);
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(id);
  res.json(member);
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const assigned = db.prepare('SELECT COUNT(*) as c FROM period_assignments WHERE member_id = ?').get(id);
  if (assigned.c > 0) {
    return res.status(409).json({ error: 'Member is assigned to one or more periods. Remove assignments first.' });
  }
  db.prepare('DELETE FROM members WHERE id = ?').run(id);
  res.json({ success: true });
});

module.exports = router;
