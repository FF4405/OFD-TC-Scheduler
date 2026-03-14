import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: Request) {
  const db = getDb();
  const url = new URL(req.url);
  const weekStart = url.searchParams.get('week');

  let schedules;
  if (weekStart) {
    schedules = db.prepare(`
      SELECT s.*, a.name as apparatus_name, a.unit_number, a.type as apparatus_type,
        COUNT(DISTINCT cr.id) as total_checks,
        SUM(CASE WHEN cr.result = 'pass' THEN 1 ELSE 0 END) as passed_checks,
        SUM(CASE WHEN cr.result = 'fail' THEN 1 ELSE 0 END) as failed_checks
      FROM weekly_schedules s
      JOIN apparatus a ON a.id = s.apparatus_id
      LEFT JOIN check_records cr ON cr.schedule_id = s.id
      WHERE s.week_start = ?
      GROUP BY s.id
      ORDER BY a.unit_number
    `).all(weekStart);
  } else {
    schedules = db.prepare(`
      SELECT DISTINCT week_start FROM weekly_schedules
      ORDER BY week_start DESC LIMIT 12
    `).all();
  }
  return NextResponse.json(schedules);
}

export async function POST(req: Request) {
  const db = getDb();
  const body = await req.json();
  const { week_start, apparatus_ids, assigned_to } = body;

  const insertSchedule = db.prepare(`
    INSERT OR IGNORE INTO weekly_schedules (week_start, apparatus_id, assigned_to, status)
    VALUES (?, ?, ?, 'pending')
  `);

  const insertRecord = db.prepare(`
    INSERT INTO check_records (schedule_id, check_item_id, result)
    VALUES (?, ?, 'pending')
  `);

  const getSchedule = db.prepare(`
    SELECT id FROM weekly_schedules WHERE week_start = ? AND apparatus_id = ?
  `);

  const getItems = db.prepare(`
    SELECT id FROM check_items WHERE apparatus_id = ?
  `);

  const txn = db.transaction(() => {
    const created = [];
    for (const appId of apparatus_ids) {
      insertSchedule.run(week_start, appId, assigned_to || null);
      const schedule = getSchedule.get(week_start, appId) as { id: number };
      if (schedule) {
        const existing = db.prepare(`
          SELECT COUNT(*) as c FROM check_records WHERE schedule_id = ?
        `).get(schedule.id) as { c: number };
        if (existing.c === 0) {
          const items = getItems.all(appId) as { id: number }[];
          for (const item of items) {
            insertRecord.run(schedule.id, item.id);
          }
        }
        created.push(schedule.id);
      }
    }
    return created;
  });

  const ids = txn();
  return NextResponse.json({ created: ids }, { status: 201 });
}
