import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const body = await req.json();
  const { records, checked_by } = body;

  // records: Array<{ check_item_id: number, result: 'pass'|'fail'|'na', notes?: string }>
  const updateRecord = db.prepare(`
    UPDATE check_records
    SET result = ?, notes = ?, checked_at = datetime('now'), checked_by = ?
    WHERE schedule_id = ? AND check_item_id = ?
  `);

  const txn = db.transaction(() => {
    for (const rec of records) {
      updateRecord.run(rec.result, rec.notes || null, checked_by || null, id, rec.check_item_id);
    }

    // Update schedule status
    const total = (db.prepare(`
      SELECT COUNT(*) as c FROM check_records WHERE schedule_id = ?
    `).get(id) as { c: number }).c;

    const completed = (db.prepare(`
      SELECT COUNT(*) as c FROM check_records WHERE schedule_id = ? AND result != 'pending'
    `).get(id) as { c: number }).c;

    const failed = (db.prepare(`
      SELECT COUNT(*) as c FROM check_records WHERE schedule_id = ? AND result = 'fail'
    `).get(id) as { c: number }).c;

    let status = 'pending';
    if (completed === total) {
      status = failed > 0 ? 'issues' : 'completed';
    } else if (completed > 0) {
      status = 'in_progress';
    }

    db.prepare(`
      UPDATE weekly_schedules SET status = ? WHERE id = ?
    `).run(status, id);
  });

  txn();
  return NextResponse.json({ success: true });
}
