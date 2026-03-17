import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

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
