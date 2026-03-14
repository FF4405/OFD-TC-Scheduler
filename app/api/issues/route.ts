import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: Request) {
  const db = getDb();
  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const apparatusId = url.searchParams.get('apparatus_id');

  let query = `
    SELECT i.*, a.name as apparatus_name, a.unit_number,
           ci.name as check_item_name
    FROM issues i
    JOIN apparatus a ON a.id = i.apparatus_id
    LEFT JOIN check_items ci ON ci.id = i.check_item_id
    WHERE 1=1
  `;
  const args: (string | number)[] = [];

  if (status) { query += ' AND i.status = ?'; args.push(status); }
  if (apparatusId) { query += ' AND i.apparatus_id = ?'; args.push(apparatusId); }

  query += ' ORDER BY i.reported_at DESC';

  const issues = db.prepare(query).all(...args);
  return NextResponse.json(issues);
}

export async function POST(req: Request) {
  const db = getDb();
  const body = await req.json();
  const { apparatus_id, schedule_id, check_item_id, title, description, severity, reported_by } = body;

  const result = db.prepare(`
    INSERT INTO issues (apparatus_id, schedule_id, check_item_id, title, description, severity, status, reported_by)
    VALUES (?, ?, ?, ?, ?, ?, 'open', ?)
  `).run(
    apparatus_id,
    schedule_id || null,
    check_item_id || null,
    title,
    description || null,
    severity || 'low',
    reported_by || null
  );

  const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(result.lastInsertRowid);
  return NextResponse.json(issue, { status: 201 });
}
