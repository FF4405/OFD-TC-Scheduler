import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const { apparatus_name, slot_type, rotation_note, rotation_labels, oic_name, firstdue_checklist_id } = await req.json();
  db.prepare(`
    UPDATE assignment_slots
    SET apparatus_name=?, slot_type=?, rotation_note=?, rotation_labels=?, oic_name=?, firstdue_checklist_id=?
    WHERE id=?
  `).run(
    apparatus_name, slot_type,
    rotation_note || null,
    rotation_labels ? JSON.stringify(rotation_labels) : null,
    oic_name || null,
    firstdue_checklist_id || null,
    id
  );
  const slot = db.prepare('SELECT * FROM assignment_slots WHERE id = ?').get(id);
  return NextResponse.json(slot);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.prepare('DELETE FROM assignment_slots WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
}
