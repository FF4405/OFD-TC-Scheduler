const express = require('express');
const router = express.Router();
const { getDb } = require('../../lib/db');
const { getPeriodWeeks, upcomingSecondMondays } = require('../../lib/dates');
const { format, parseISO } = require('date-fns');

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

router.post('/auto-generate', (req, res) => {
  try {
    const db = getDb();

    // Settings
    const s = {};
    for (const r of db.prepare('SELECT key, value FROM settings').all()) s[r.key] = r.value;
    const months = parseInt(s.auto_schedule_months || '6', 10);
    const missNum = parseFloat(s.repeat_miss_num || '3');
    const missDen = parseFloat(s.repeat_miss_den || '4');
    const missThreshold = missNum / missDen;

    // Upcoming 2nd Mondays not yet covered
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() + months);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    const candidates = upcomingSecondMondays(months * 2).filter(d => d <= cutoffStr);
    const existingDates = new Set(db.prepare('SELECT start_date FROM periods').all().map(p => p.start_date));
    const toCreate = candidates.filter(d => !existingDates.has(d));

    if (toCreate.length === 0) {
      return res.json({ created: 0, periods: [], message: 'All periods already exist' });
    }

    // All slots in sort order
    const allSlots = db.prepare('SELECT * FROM assignment_slots ORDER BY sort_order').all();

    // Most recent period that has actual completion data → use for repeat/graduate logic
    const sourcePeriod = db.prepare(`
      SELECT p.* FROM periods p
      WHERE EXISTS (
        SELECT 1 FROM period_assignments pa
        JOIN weekly_completions wc ON wc.assignment_id = pa.id
        WHERE pa.period_id = p.id
      )
      ORDER BY p.start_date DESC LIMIT 1
    `).get() || db.prepare('SELECT * FROM periods ORDER BY start_date DESC LIMIT 1').get();

    // slot_id → member_id for slots where previous member should repeat (bad attendance)
    const repeatSlotToMember = {};

    if (sourcePeriod) {
      const srcAssignments = db.prepare(`
        SELECT pa.id, pa.slot_id, pa.member_id,
               (SELECT COUNT(*) FROM weekly_completions wc WHERE wc.assignment_id = pa.id) as completed_count
        FROM period_assignments pa
        WHERE pa.period_id = ?
      `).all(sourcePeriod.id);

      const srcWeekCount = getPeriodWeeks(sourcePeriod.start_date).length;
      const graduatingIds = [];

      for (const a of srcAssignments) {
        if (!a.member_id) continue;
        const missRate = srcWeekCount > 0 ? (srcWeekCount - a.completed_count) / srcWeekCount : 0;
        if (missRate >= missThreshold) {
          // Bad attendance → repeat the same slot next period
          repeatSlotToMember[a.slot_id] = a.member_id;
        } else if (a.completed_count > 0) {
          // Good attendance → push to back of rotation
          graduatingIds.push(a.member_id);
        }
      }

      // Push graduating members to back of rotation, preserving their relative order
      if (graduatingIds.length > 0) {
        const maxPos = db.prepare('SELECT COALESCE(MAX(rotation_position), 0) as m FROM members').get().m;
        const grads = db.prepare(
          `SELECT id FROM members WHERE id IN (${graduatingIds.map(() => '?').join(',')}) ORDER BY rotation_position ASC NULLS LAST`
        ).all(...graduatingIds);
        const updPos = db.prepare('UPDATE members SET rotation_position = ? WHERE id = ?');
        let pos = maxPos;
        for (const m of grads) updPos.run(++pos, m.id);
      }
    }

    // Rotation queue: active eligible members ordered by position (re-read after graduation updates)
    const rotationIds = db.prepare(`
      SELECT id FROM members
      WHERE active = 1 AND status != 'retired' AND name != 'NOT ASSIGNED'
      ORDER BY rotation_position ASC NULLS LAST, id ASC
    `).all().map(r => r.id);

    const insAssignment = db.prepare(`
      INSERT INTO period_assignments (period_id, slot_id, member_id, is_repeat)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(period_id, slot_id) DO NOTHING
    `);

    const txn = db.transaction(() => {
      const created = [];
      let rotationIndex = 0; // advances continuously across periods

      for (let pi = 0; pi < toCreate.length; pi++) {
        const startDate = toCreate[pi];
        const weekCount = getPeriodWeeks(startDate).length;
        const name = format(parseISO(startDate), 'MMMM yyyy');

        const periodId = db.prepare(
          'INSERT INTO periods (name, start_date, week_count, is_current) VALUES (?, ?, ?, 0)'
        ).run(name, startDate, weekCount).lastInsertRowid;

        const assignedInPeriod = new Set();

        // First pass: repeating slots (only applied to first new period)
        if (pi === 0) {
          for (const slot of allSlots) {
            const memberId = repeatSlotToMember[slot.id];
            if (memberId) {
              assignedInPeriod.add(memberId);
              insAssignment.run(periodId, slot.id, memberId, 1);
            }
          }
        }

        // Second pass: fill remaining slots from rotation (circular)
        for (const slot of allSlots) {
          if (pi === 0 && repeatSlotToMember[slot.id]) continue; // already handled

          // Advance past members already assigned in this period
          let tries = 0;
          while (tries < rotationIds.length && assignedInPeriod.has(rotationIds[rotationIndex % rotationIds.length])) {
            rotationIndex++;
            tries++;
          }

          const memberId = rotationIds.length > 0 ? rotationIds[rotationIndex % rotationIds.length] : null;
          if (memberId) {
            assignedInPeriod.add(memberId);
            rotationIndex++;
          }
          insAssignment.run(periodId, slot.id, memberId, 0);
        }

        created.push({ id: periodId, name, start_date: startDate, week_count: weekCount });
      }

      return created;
    });

    const created = txn();
    res.json({ created: created.length, periods: created });
  } catch (err) {
    console.error('auto-generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', (req, res) => {
  try {
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
  } catch (err) {
    console.error('PATCH /api/periods error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
