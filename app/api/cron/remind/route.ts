import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getMailgunClient, MAILGUN_DOMAIN, MAILGUN_FROM, isMailgunConfigured } from '@/lib/mailgun';
import { getSecondMonday } from '@/lib/dates';

// Called by Windows Task Scheduler every Monday at 8 AM:
//   Invoke-WebRequest -Uri "http://localhost:3000/api/cron/remind" -Method POST \
//     -Headers @{ "x-cron-secret" = "YOUR_SECRET" } -UseBasicParsing

function getCurrentMondayDate(): string {
  const today = new Date();
  const day = today.getDay(); // 0=Sun, 1=Mon...
  const diff = day === 0 ? -6 : 1 - day; // roll back to most recent Monday
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  return monday.toISOString().split('T')[0];
}

export async function POST(req: Request) {
  // Validate cron secret
  const secret = req.headers.get('x-cron-secret');
  if (!secret || secret !== process.env.NOTIFY_CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();

  // Find current period
  const period = db.prepare(
    "SELECT id FROM periods WHERE is_current = 1 LIMIT 1"
  ).get() as { id: number } | undefined;

  if (!period) {
    return NextResponse.json({ error: 'No current period set', sent: 0, failed: 0, skipped: 0 });
  }

  const weekDate = getCurrentMondayDate();

  // Find pending assignments (no completion for this week)
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
  `).all(period.id, weekDate) as Array<{
    assignment_id: number;
    member_id: number | null;
    member_name: string | null;
    member_email: string | null;
    apparatus_name: string;
    slot_type: string;
  }>;

  if (pending.length === 0) {
    return NextResponse.json({ message: 'All checks complete — no reminders sent', sent: 0, failed: 0, skipped: 0 });
  }

  if (!isMailgunConfigured()) {
    return NextResponse.json(
      { error: 'Mailgun is not configured', sent: 0, failed: 0, skipped: pending.length },
      { status: 503 }
    );
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
    if (!a.member_email) {
      skipped++;
      continue;
    }

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

  return NextResponse.json({ weekDate, sent, failed, skipped });
}
