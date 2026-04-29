const express = require('express');
const router = express.Router();
const { getDb } = require('../../lib/db');
const { getMailgunClient, MAILGUN_DOMAIN, MAILGUN_FROM, isMailgunConfigured } = require('../../lib/mailgun');

function getCurrentMondayDate() {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  return monday.toISOString().split('T')[0];
}

router.post('/remind', async (req, res) => {
  const secret = req.headers['x-cron-secret'];
  if (!secret || secret !== process.env.NOTIFY_CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const db = getDb();
  const period = db.prepare('SELECT id FROM periods WHERE is_current = 1 LIMIT 1').get();
  if (!period) {
    return res.json({ error: 'No current period set', sent: 0, failed: 0, skipped: 0 });
  }

  const weekDate = getCurrentMondayDate();

  const pending = db.prepare(`
    SELECT pa.id AS assignment_id, pa.member_id,
           m.name AS member_name, m.email AS member_email,
           s.apparatus_name, s.slot_type
    FROM period_assignments pa
    JOIN assignment_slots s ON s.id = pa.slot_id
    LEFT JOIN members m ON m.id = pa.member_id
    WHERE pa.period_id = ?
      AND pa.id NOT IN (
        SELECT assignment_id FROM weekly_completions WHERE week_date = ?
      )
    ORDER BY s.sort_order
  `).all(period.id, weekDate);

  if (pending.length === 0) {
    return res.json({ message: 'All checks complete — no reminders sent', sent: 0, failed: 0, skipped: 0 });
  }

  if (!isMailgunConfigured()) {
    return res.status(503).json({ error: 'Mailgun is not configured', sent: 0, failed: 0, skipped: pending.length });
  }

  const mg = getMailgunClient();
  const domain = MAILGUN_DOMAIN();
  const from = MAILGUN_FROM();

  const insertLog = db.prepare(`
    INSERT INTO notification_log
      (member_id, assignment_id, week_date, method, recipient, status, error_message, triggered_by)
    VALUES (?, ?, ?, 'email', ?, ?, ?, 'cron')
  `);

  let sent = 0, failed = 0, skipped = 0;

  for (const a of pending) {
    if (!a.member_email) { skipped++; continue; }
    const subject = `Reminder: ${a.apparatus_name} ${a.slot_type} Check Due by 7PM Today`;
    const body = [
      `Hi ${a.member_name || 'Firefighter'},`,
      '',
      `This is your automated Monday morning reminder that your ${a.apparatus_name} ${a.slot_type} check is due by 7PM tonight (${weekDate}).`,
      '',
      'Please log your completion in First Due.',
      '',
      'Thank you,',
      'Oradell Fire Department',
    ].join('\n');

    try {
      await mg.messages.create(domain, { from, to: [a.member_email], subject, text: body });
      insertLog.run(a.member_id, a.assignment_id, weekDate, a.member_email, 'sent', null);
      sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      insertLog.run(a.member_id, a.assignment_id, weekDate, a.member_email, 'failed', msg);
      failed++;
    }
  }

  res.json({ weekDate, sent, failed, skipped });
});

module.exports = router;
