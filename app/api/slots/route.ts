import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const slots = db.prepare('SELECT * FROM assignment_slots ORDER BY sort_order').all();
  return NextResponse.json(slots);
}

export async function POST(req: Request) {
  const db = getDb();
  const { apparatus_name, slot_type, rotation_note, rotation_labels, oic_name } = await req.json();
  const maxOrder = (db.prepare('SELECT COALESCE(MAX(sort_order),0) as m FROM assignment_slots').get() as { m: number }).m;
  const result = db.prepare(`
    INSERT INTO assignment_slots (apparatus_name, slot_type, rotation_note, rotation_labels, oic_name, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    apparatus_name, slot_type,
    rotation_note || null,
    rotation_labels ? JSON.stringify(rotation_labels) : null,
    oic_name || null,
    maxOrder + 1
  );
  const slot = db.prepare('SELECT * FROM assignment_slots WHERE id = ?').get(result.lastInsertRowid);
  return NextResponse.json(slot, { status: 201 });
}
