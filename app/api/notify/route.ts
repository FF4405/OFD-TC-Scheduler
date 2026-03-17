import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// Returns email preview / recipient list for pending assignments
// In production this would trigger actual emails via SendGrid/SES/etc.
export async function POST(req: Request) {
  const db = getDb();
  const { period_id, week_date, target } = await req.json();
  // target: 'pending' | 'all' | assignment_id number

  let assignments;

  if (typeof target === 'number') {
    assignments = db.prepare(`
      SELECT pa.id, pa.member_id,
             m.name as member_name, m.email as member_email,
             s.apparatus_name, s.slot_type, s.oic_name
      FROM period_assignments pa
      JOIN assignment_slots s ON s.id = pa.slot_id
      LEFT JOIN members m ON m.id = pa.member_id
      WHERE pa.id = ?
    `).all(target);
  } else {
    assignments = db.prepare(`
      SELECT pa.id, pa.member_id,
             m.name as member_name, m.email as member_email,
             s.apparatus_name, s.slot_type, s.oic_name
      FROM period_assignments pa
      JOIN assignment_slots s ON s.id = pa.slot_id
      LEFT JOIN members m ON m.id = pa.member_id
      WHERE pa.period_id = ?
      ORDER BY s.sort_order
    `).all(period_id) as Array<{
      id: number; member_name: string | null; member_email: string | null;
      apparatus_name: string; slot_type: string;
    }>;

    if (target === 'pending') {
      // Filter to those without a completion for this week
      const completed = new Set(
        (db.prepare(`
          SELECT assignment_id FROM weekly_completions
          WHERE week_date = ? AND assignment_id IN (
            SELECT id FROM period_assignments WHERE period_id = ?
          )
        `).all(week_date, period_id) as Array<{ assignment_id: number }>)
          .map(r => r.assignment_id)
      );
      assignments = assignments.filter((a: { id: number }) => !completed.has(a.id));
    }
  }

  const recipients = (assignments as Array<{
    id: number; member_name: string | null; member_email: string | null;
    apparatus_name: string; slot_type: string; oic_name?: string | null;
  }>).map(a => ({
    assignmentId: a.id,
    name: a.member_name || '(Unassigned)',
    email: a.member_email || '',
    slot: `${a.apparatus_name} ${a.slot_type}`.trim(),
    subject: `Reminder: ${a.apparatus_name} ${a.slot_type} Check Due by 7PM Monday`,
    body: `Hi ${a.member_name || 'Firefighter'},\n\nThis is a reminder that your ${a.apparatus_name} ${a.slot_type} check is due by 7PM this Monday (${week_date}).\n\nPlease log your completion in the OFD Check Tracker.\n\nThank you,\nOradell Fire Department`,
  }));

  // In a real deployment, send emails here via nodemailer / SendGrid / SES
  // For now, return the preview so the admin can verify before sending

  return NextResponse.json({ recipients, preview: true });
}
