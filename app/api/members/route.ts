import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const members = db.prepare(`
    SELECT * FROM members ORDER BY
      CASE WHEN line_number = '' OR line_number IS NULL THEN 1 ELSE 0 END,
      CAST(line_number AS INTEGER),
      name
  `).all();
  return NextResponse.json(members);
}

export async function POST(req: Request) {
  const db = getDb();
  const { line_number, name, email, status, remarks } = await req.json();
  const result = db.prepare(`
    INSERT INTO members (line_number, name, email, status, remarks, active)
    VALUES (?, ?, ?, ?, ?, 1)
  `).run(line_number || null, name, email || null, status || 'active', remarks || null);
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(result.lastInsertRowid);
  return NextResponse.json(member, { status: 201 });
}
