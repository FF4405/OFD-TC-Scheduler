import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getPeriodWeeks } from '@/lib/dates';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(id) as {
    id: number; line_number: string | null; name: string; email: string | null;
    status: string; remarks: string | null; active: number;
  } | undefined;

  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  // All periods where this member had an assignment
  const assignments = db.prepare(`
    SELECT pa.id AS assignment_id, pa.period_id, pa.slot_id,
           p.name AS period_name, p.start_date, p.week_count,
           s.apparatus_name, s.slot_type, s.oic_name
    FROM period_assignments pa
    JOIN periods p ON p.id = pa.period_id
    JOIN assignment_slots s ON s.id = pa.slot_id
    WHERE pa.member_id = ?
    ORDER BY p.start_date DESC
  `).all(id) as Array<{
    assignment_id: number; period_id: number; slot_id: number;
    period_name: string; start_date: string; week_count: number;
    apparatus_name: string; slot_type: string; oic_name: string | null;
  }>;

  const periods = assignments.map(a => {
    const weeks = getPeriodWeeks(a.start_date);
    const completions = db.prepare(`
      SELECT week_date, completed_at, completed_by
      FROM weekly_completions
      WHERE assignment_id = ?
      ORDER BY week_date
    `).all(a.assignment_id) as Array<{
      week_date: string; completed_at: string; completed_by: string | null;
    }>;

    return {
      period: { id: a.period_id, name: a.period_name, start_date: a.start_date, week_count: a.week_count },
      slot: { apparatus_name: a.apparatus_name, slot_type: a.slot_type, oic_name: a.oic_name },
      assignment_id: a.assignment_id,
      weekCount: weeks.length,
      completedCount: completions.length,
      completions,
    };
  });

  // Notification log for this member
  const notifications = db.prepare(`
    SELECT sent_at, method, status, week_date, triggered_by, error_message
    FROM notification_log
    WHERE member_id = ?
    ORDER BY sent_at DESC
    LIMIT 100
  `).all(id) as Array<{
    sent_at: string; method: string; status: string;
    week_date: string; triggered_by: string; error_message: string | null;
  }>;

  // Aggregate stats
  const totalWeeks = periods.reduce((s, p) => s + p.weekCount, 0);
  const completedWeeks = periods.reduce((s, p) => s + p.completedCount, 0);

  return NextResponse.json({
    member,
    periods,
    notifications,
    stats: {
      totalPeriods: periods.length,
      totalWeeks,
      completedWeeks,
      completionRate: totalWeeks > 0 ? Math.round((completedWeeks / totalWeeks) * 100) : null,
    },
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const { line_number, name, email, status, remarks, active } = await req.json();
  db.prepare(`
    UPDATE members SET line_number=?, name=?, email=?, status=?, remarks=?, active=?
    WHERE id=?
  `).run(line_number || null, name, email || null, status, remarks || null, active ? 1 : 0, id);
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(id);
  return NextResponse.json(member);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  // Check if member is currently assigned to any period
  const assigned = db.prepare(`
    SELECT COUNT(*) as c FROM period_assignments WHERE member_id = ?
  `).get(id) as { c: number };
  if (assigned.c > 0) {
    return NextResponse.json(
      { error: 'Member is assigned to one or more periods. Remove assignments first.' },
      { status: 409 }
    );
  }
  db.prepare('DELETE FROM members WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
}
