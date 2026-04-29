const express = require('express');
const router = express.Router();
const { getDb } = require('../../lib/db');

router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const r of rows) settings[r.key] = r.value;
  res.json(settings);
});

router.put('/', (req, res) => {
  const db = getDb();
  const upsert = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value'
  );
  const txn = db.transaction((data) => {
    for (const [k, v] of Object.entries(data)) upsert.run(k, String(v));
  });
  txn(req.body);
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const r of rows) settings[r.key] = r.value;
  res.json(settings);
});

module.exports = router;
