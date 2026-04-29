const express = require('express');
const router = express.Router();
const { getDb } = require('../../lib/db');

router.post('/', (req, res) => {
  const db = getDb();
  const { assignment_id, week_date, completed_by, notes, undo } = req.body;

  if (undo) {
    db.prepare('DELETE FROM weekly_completions WHERE assignment_id = ? AND week_date = ?')
      .run(assignment_id, week_date);
    return res.json({ success: true, action: 'undone' });
  }

  db.prepare(`
    INSERT INTO weekly_completions (assignment_id, week_date, completed_by, notes)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(assignment_id, week_date) DO UPDATE
    SET completed_by=excluded.completed_by, notes=excluded.notes,
        completed_at=datetime('now')
  `).run(assignment_id, week_date, completed_by || null, notes || null);

  res.json({ success: true, action: 'completed' });
});

router.get('/', (req, res) => {
  const db = getDb();

  const currentPeriod = db.prepare('SELECT * FROM periods WHERE is_current = 1 LIMIT 1').get();
  if (!currentPeriod) return res.json({ currentPeriod: null });

  const today = new Date();
  const dayOfWeek = today.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  const thisWeek = monday.toISOString().split('T')[0];

  const assignments = db.prepare(`
    SELECT pa.id, pa.member_id,
           m.name as member_name, m.email as member_email,
           s.apparatus_name, s.slot_type, s.oic_name
    FROM period_assignments pa
    JOIN assignment_slots s ON s.id = pa.slot_id
    LEFT JOIN members m ON m.id = pa.member_id
    WHERE pa.period_id = ?
    ORDER BY s.sort_order
  `).all(currentPeriod.id);

  const thisWeekCompletions = db.prepare(`
    SELECT wc.assignment_id
    FROM weekly_completions wc
    JOIN period_assignments pa ON pa.id = wc.assignment_id
    WHERE pa.period_id = ? AND wc.week_date = ?
  `).all(currentPeriod.id, thisWeek).map(r => r.assignment_id);

  const completedSet = new Set(thisWeekCompletions);

  res.json({
    currentPeriod,
    thisWeek,
    assignments,
    completedThisWeek: thisWeekCompletions.length,
    totalSlots: assignments.length,
    pendingAssignments: assignments.filter(a => !completedSet.has(a.id)),
  });
});

module.exports = router;
