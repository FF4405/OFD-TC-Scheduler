import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getMailgunClient, MAILGUN_DOMAIN, MAILGUN_FROM, isMailgunConfigured } from '@/lib/mailgun';

export async function POST(req: Request) {
  const db = getDb();
  const { period_id, week_date, target, dry_run = false } = await req.json();
  // target: 'pending' | 'all' | assignment_id number
  // dry_run: true returns preview only (no email sent, no log written)

  let assignments: Array<{
    id: number;
    member_id: number | null;
    member_name: string | null;
    member_email: string | null;
    apparatus_name: string;
    slot_type: string;
    oic_name?: string | null;
  }>;

  if (typeof target === 'number') {
    assignments = db.prepare(`
      SELECT pa.id, pa.member_id,
             m.name  AS member_name,  m.email AS member_email,
             s.apparatus_name, s.slot_type, s.oic_name
      FROM period_assignments pa
      JOIN assignment_slots s ON s.id = pa.slot_id
      LEFT JOIN members m ON m.id = pa.member_id
      WHERE pa.id = ?
    `).all(target) as typeof assignments;
  } else {
    assignments = db.prepare(`
      SELECT pa.id, pa.member_id,
             m.name  AS member_name,  m.email AS member_email,
             s.apparatus_name, s.slot_type, s.oic_name
      FROM period_assignments pa
      JOIN assignment_slots s ON s.id = pa.slot_id
      LEFT JOIN members m ON m.id = pa.member_id
      WHERE pa.period_id = ?
      ORDER BY s.sort_order
    `).all(period_id) as typeof assignments;

    if (target === 'pending') {
      const completed = new Set(
        (db.prepare(`
          SELECT assignment_id FROM weekly_completions
          WHERE week_date = ? AND assignment_id IN (
            SELECT id FROM period_assignments WHERE period_id = ?
          )
        `).all(week_date, period_id) as Array<{ assignment_id: number }>)
          .map(r => r.assignment_id)
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

  // Dry-run: return preview without sending
  if (dry_run) {
    return NextResponse.json({ recipients, preview: true, sent: 0, failed: 0 });
  }

  if (!isMailgunConfigured()) {
    return NextResponse.json(
      { error: 'Mailgun is not configured. Set MAILGUN_API_KEY and MAILGUN_DOMAIN in .env.local.' },
      { status: 503 }
    );
  }

  const mg = getMailgunClient();
  const domain = MAILGUN_DOMAIN();
  const from = MAILGUN_FROM();

  const insertLog = db.prepare(`
    INSERT INTO notification_log
      (member_id, assignment_id, week_date, method, recipient, status, error_message, triggered_by)
    VALUES (?, ?, ?, 'email', ?, ?, ?, 'manual')
  `);

  let sent = 0;
  let failed = 0;
  const results: Array<{ name: string; email: string; status: string; error?: string }> = [];

  for (const r of recipients) {
    if (!r.email) {
      insertLog.run(r.memberId ?? null, r.assignmentId, week_date, '', 'failed', 'No email address on file');
      failed++;
      results.push({ name: r.name, email: '', status: 'failed', error: 'No email address' });
      continue;
    }

    try {
      await mg.messages.create(domain, {
        from,
        to: [r.email],
        subject: r.subject,
        text: r.body,
      });
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

  return NextResponse.json({ recipients, sent, failed, results, preview: false });
}
