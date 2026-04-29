const express = require('express');
const router = express.Router();
const { getDb } = require('../../lib/db');
const { getMailgunClient, MAILGUN_DOMAIN, MAILGUN_FROM, isMailgunConfigured } = require('../../lib/mailgun');

router.post('/', async (req, res) => {
  const db = getDb();
  const { period_id, week_date, target, dry_run = false } = req.body;

  let assignments;

  if (typeof target === 'number') {
    assignments = db.prepare(`
      SELECT pa.id, pa.member_id,
             m.name AS member_name, m.email AS member_email,
             s.apparatus_name, s.slot_type, s.oic_name
      FROM period_assignments pa
      JOIN assignment_slots s ON s.id = pa.slot_id
      LEFT JOIN members m ON m.id = pa.member_id
      WHERE pa.id = ?
    `).all(target);
  } else {
    assignments = db.prepare(`
      SELECT pa.id, pa.member_id,
             m.name AS member_name, m.email AS member_email,
             s.apparatus_name, s.slot_type, s.oic_name
      FROM period_assignments pa
      JOIN assignment_slots s ON s.id = pa.slot_id
      LEFT JOIN members m ON m.id = pa.member_id
      WHERE pa.period_id = ?
      ORDER BY s.sort_order
    `).all(period_id);

    if (target === 'pending') {
      const completed = new Set(
        db.prepare(`
          SELECT assignment_id FROM weekly_completions
          WHERE week_date = ? AND assignment_id IN (
            SELECT id FROM period_assignments WHERE period_id = ?
          )
        `).all(week_date, period_id).map(r => r.assignment_id)
      );
      assignments = assignments.filter(a => !completed.has(a.id));
    }
  }

  const recipients = assignments.map(a => ({
    assignmentId: a.id,
    memberId: a.member_id,
    name: a.member_name || '(Unassigned)',
    email: a.member_email || '',
    slot: `${a.apparatus_name} ${a.slot_type}`.trim(),
    subject: `Reminder: ${a.apparatus_name} ${a.slot_type} Check Due by 7PM Monday`,
    body: [
      `Hi ${a.member_name || 'Firefighter'},`,
      '',
      `This is a reminder that your ${a.apparatus_name} ${a.slot_type} check is due by 7PM this Monday (${week_date}).`,
      '',
      'Please log your completion in First Due.',
      '',
      'Thank you,',
      'Oradell Fire Department',
    ].join('\n'),
  }));

  if (dry_run) {
    return res.json({ recipients, preview: true, sent: 0, failed: 0 });
  }

  if (!isMailgunConfigured()) {
    return res.status(503).json({
      error: 'Mailgun is not configured. Set MAILGUN_API_KEY and MAILGUN_DOMAIN in .env.local.',
    });
  }

  const mg = getMailgunClient();
  const domain = MAILGUN_DOMAIN();
  const from = MAILGUN_FROM();

  const insertLog = db.prepare(`
    INSERT INTO notification_log
      (member_id, assignment_id, week_date, method, recipient, status, error_message, triggered_by)
    VALUES (?, ?, ?, 'email', ?, ?, ?, 'manual')
  `);

  let sent = 0, failed = 0;
  const results = [];

  for (const r of recipients) {
    if (!r.email) {
      insertLog.run(r.memberId ?? null, r.assignmentId, week_date, '', 'failed', 'No email address on file');
      failed++;
      results.push({ name: r.name, email: '', status: 'failed', error: 'No email address' });
      continue;
    }
    try {
      await mg.messages.create(domain, { from, to: [r.email], subject: r.subject, text: r.body });
      insertLog.run(r.memberId ?? null, r.assignmentId, week_date, r.email, 'sent', null);
      sent++;
      results.push({ name: r.name, email: r.email, status: 'sent' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      insertLog.run(r.memberId ?? null, r.assignmentId, week_date, r.email, 'failed', msg);
      failed++;
      results.push({ name: r.name, email: r.email, status: 'failed', error: msg });
    }
  }

  res.json({ recipients, sent, failed, results, preview: false });
});

module.exports = router;
