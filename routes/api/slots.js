const express = require('express');
const router = express.Router();
const { getDb } = require('../../lib/db');

router.get('/', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM assignment_slots ORDER BY sort_order').all());
});

router.post('/', (req, res) => {
  const db = getDb();
  const { apparatus_name, slot_type, rotation_note, rotation_labels, oic_name } = req.body;
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order),0) as m FROM assignment_slots').get().m;
  const result = db.prepare(`
    INSERT INTO assignment_slots (apparatus_name, slot_type, rotation_note, rotation_labels, oic_name, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    apparatus_name, slot_type,
    rotation_note || null,
    rotation_labels ? JSON.stringify(rotation_labels) : null,
    oic_name || null,
    maxOrder + 1
  );
  res.status(201).json(db.prepare('SELECT * FROM assignment_slots WHERE id = ?').get(result.lastInsertRowid));
});

router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const { apparatus_name, slot_type, rotation_note, rotation_labels, oic_name } = req.body;
  db.prepare(`
    UPDATE assignment_slots
    SET apparatus_name=?, slot_type=?, rotation_note=?, rotation_labels=?, oic_name=?
    WHERE id=?
  `).run(
    apparatus_name, slot_type,
    rotation_note || null,
    rotation_labels ? JSON.stringify(rotation_labels) : null,
    oic_name || null,
    id
  );
  res.json(db.prepare('SELECT * FROM assignment_slots WHERE id = ?').get(id));
});

router.delete('/:id', (req, res) => {
  getDb().prepare('DELETE FROM assignment_slots WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
