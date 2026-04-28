const express = require('express');
const router = express.Router();
const { getDb } = require('../../lib/db');
const { getPeriodWeeks } = require('../../lib/dates');

router.get('/', (req, res) => {
  const db = getDb();
  res.json(db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM period_assignments WHERE period_id = p.id) as slot_count,
      (SELECT COUNT(*) FROM period_assignments pa
       JOIN weekly_completions wc ON wc.assignment_id = pa.id
       WHERE pa.period_id = p.id) as total_completions
    FROM periods p
    ORDER BY p.start_date DESC
  `).all());
});

router.post('/', (req, res) => {
  const db = getDb();
  const { name, start_date, week_count, assignments } = req.body;

  const txn = db.transaction(() => {
    db.prepare('UPDATE periods SET is_current = 0').run();
    const result = db.prepare(`
      INSERT INTO periods (name, start_date, week_count, is_current)
      VALUES (?, ?, ?, 1)
    `).run(name, start_date, week_count || 4);
    const periodId = result.lastInsertRowid;

    if (assignments && Array.isArray(assignments)) {
      const ins = db.prepare('INSERT INTO period_assignments (period_id, slot_id, member_id) VALUES (?, ?, ?)');
      for (const a of assignments) ins.run(periodId, a.slot_id, a.member_id || null);
    }
    return periodId;
  });

  const periodId = txn();
  res.status(201).json(db.prepare('SELECT * FROM periods WHERE id = ?').get(periodId));
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const period = db.prepare('SELECT * FROM periods WHERE id = ?').get(id);
  if (!period) return res.status(404).json({ error: 'Not found' });

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
  `).all(id);

  const completions = db.prepare(`
    SELECT wc.assignment_id, wc.week_date, wc.completed_at, wc.completed_by, wc.notes
    FROM weekly_completions wc
    JOIN period_assignments pa ON pa.id = wc.assignment_id
    WHERE pa.period_id = ?
  `).all(id);

  const completionMap = new Map();
  for (const c of completions) {
    completionMap.set(`${c.assignment_id}:${c.week_date}`, c);
  }

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
    return { ...a, weekData };
  });

  res.json({ period, weeks, rows });
});

router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const { name, is_current, assignments } = req.body;

  const txn = db.transaction(() => {
    if (is_current) db.prepare('UPDATE periods SET is_current = 0').run();
    db.prepare('UPDATE periods SET name=?, is_current=? WHERE id=?')
      .run(name, is_current ? 1 : 0, id);
    if (assignments && Array.isArray(assignments)) {
      const upsert = db.prepare(`
        INSERT INTO period_assignments (period_id, slot_id, member_id)
        VALUES (?, ?, ?)
        ON CONFLICT(period_id, slot_id) DO UPDATE SET member_id=excluded.member_id
      `);
      for (const a of assignments) upsert.run(id, a.slot_id, a.member_id || null);
    }
  });

  txn();
  res.json(db.prepare('SELECT * FROM periods WHERE id = ?').get(id));
});

module.exports = router;
