import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const periods = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM period_assignments WHERE period_id = p.id) as slot_count,
      (SELECT COUNT(*) FROM period_assignments pa
       JOIN weekly_completions wc ON wc.assignment_id = pa.id
       WHERE pa.period_id = p.id) as total_completions
    FROM periods p
    ORDER BY p.start_date DESC
  `).all();
  return NextResponse.json(periods);
}

export async function POST(req: Request) {
  const db = getDb();
  const { name, start_date, week_count, assignments } = await req.json();
  // assignments: Array<{ slot_id: number, member_id: number | null }>

  const txn = db.transaction(() => {
    // Clear current flag from all periods
    db.prepare('UPDATE periods SET is_current = 0').run();

    const result = db.prepare(`
      INSERT INTO periods (name, start_date, week_count, is_current)
      VALUES (?, ?, ?, 1)
    `).run(name, start_date, week_count || 4);
    const periodId = result.lastInsertRowid;

    if (assignments && Array.isArray(assignments)) {
      const insertAssignment = db.prepare(`
        INSERT INTO period_assignments (period_id, slot_id, member_id)
        VALUES (?, ?, ?)
      `);
      for (const a of assignments) {
        insertAssignment.run(periodId, a.slot_id, a.member_id || null);
      }
    }

    return periodId;
  });

  const periodId = txn();
  const period = db.prepare('SELECT * FROM periods WHERE id = ?').get(periodId);
  return NextResponse.json(period, { status: 201 });
}
