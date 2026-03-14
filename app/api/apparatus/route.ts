import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const apparatus = db.prepare(`
    SELECT a.*,
      (SELECT COUNT(*) FROM check_items WHERE apparatus_id = a.id) as item_count,
      (SELECT COUNT(*) FROM issues WHERE apparatus_id = a.id AND status = 'open') as open_issues
    FROM apparatus a
    ORDER BY a.unit_number
  `).all();
  return NextResponse.json(apparatus);
}

export async function POST(req: Request) {
  const db = getDb();
  const body = await req.json();
  const { name, type, unit_number, year, make, model } = body;
  const result = db.prepare(`
    INSERT INTO apparatus (name, type, unit_number, year, make, model, status)
    VALUES (?, ?, ?, ?, ?, ?, 'active')
  `).run(name, type, unit_number, year || null, make || null, model || null);
  const apparatus = db.prepare('SELECT * FROM apparatus WHERE id = ?').get(result.lastInsertRowid);
  return NextResponse.json(apparatus, { status: 201 });
}
