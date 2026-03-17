import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// Returns full period data including assignments + weekly completion grid
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const period = db.prepare('SELECT * FROM periods WHERE id = ?').get(id) as {
    id: number; name: string; start_date: string; week_count: number; is_current: number;
  } | undefined;

  if (!period) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Build list of Mondays in this period
  const weeks: string[] = [];
  for (let i = 0; i < period.week_count; i++) {
    const d = new Date(period.start_date + 'T00:00:00');
    d.setDate(d.getDate() + i * 7);
    weeks.push(d.toISOString().split('T')[0]);
  }

  // Assignments with member info and slot info
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
  `).all(id) as Array<{
    id: number;
    slot_id: number;
    member_id: number | null;
    member_name: string | null;
    member_email: string | null;
    apparatus_name: string;
    slot_type: string;
    rotation_note: string | null;
    rotation_labels: string | null;
    oic_name: string | null;
    sort_order: number;
  }>;

  // All completions for this period
  const completions = db.prepare(`
    SELECT wc.assignment_id, wc.week_date, wc.completed_at, wc.completed_by, wc.notes
    FROM weekly_completions wc
    JOIN period_assignments pa ON pa.id = wc.assignment_id
    WHERE pa.period_id = ?
  `).all(id) as Array<{
    assignment_id: number; week_date: string;
    completed_at: string; completed_by: string | null; notes: string | null;
  }>;

  // Build completion lookup: assignmentId:weekDate → completion
  const completionMap = new Map<string, typeof completions[0]>();
  for (const c of completions) {
    completionMap.set(`${c.assignment_id}:${c.week_date}`, c);
  }

  // Attach sub-labels and completion status to each week per assignment
  const today = new Date().toISOString().split('T')[0];

  const rows = assignments.map(a => {
    const labels: string[] | null = a.rotation_labels ? JSON.parse(a.rotation_labels) : null;

    const weekData = weeks.map((weekDate, i) => {
      const label = labels ? labels[i % labels.length] : null;
      const completion = completionMap.get(`${a.id}:${weekDate}`) || null;
      const isPast = weekDate < today;
      const isCurrentWeek = weekDate <= today &&
        (weeks[i + 1] ? weeks[i + 1] > today : true);
      return { weekDate, label, completion, isPast, isCurrentWeek };
    });

    return { ...a, weekData };
  });

  return NextResponse.json({ period, weeks, rows });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const { name, is_current, assignments } = await req.json();

  const txn = db.transaction(() => {
    if (is_current) {
      db.prepare('UPDATE periods SET is_current = 0').run();
    }
    db.prepare('UPDATE periods SET name=?, is_current=? WHERE id=?')
      .run(name, is_current ? 1 : 0, id);

    if (assignments && Array.isArray(assignments)) {
      const upsert = db.prepare(`
        INSERT INTO period_assignments (period_id, slot_id, member_id)
        VALUES (?, ?, ?)
        ON CONFLICT(period_id, slot_id) DO UPDATE SET member_id=excluded.member_id
      `);
      for (const a of assignments) {
        upsert.run(id, a.slot_id, a.member_id || null);
      }
    }
  });

  txn();
  const period = db.prepare('SELECT * FROM periods WHERE id = ?').get(id);
  return NextResponse.json(period);
}
