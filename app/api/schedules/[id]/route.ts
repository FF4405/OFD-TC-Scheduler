import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const schedule = db.prepare(`
    SELECT s.*, a.name as apparatus_name, a.unit_number, a.type as apparatus_type,
           a.year, a.make, a.model
    FROM weekly_schedules s
    JOIN apparatus a ON a.id = s.apparatus_id
    WHERE s.id = ?
  `).get(id);

  if (!schedule) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const records = db.prepare(`
    SELECT cr.*, ci.category, ci.name as item_name, ci.description, ci.sort_order
    FROM check_records cr
    JOIN check_items ci ON ci.id = cr.check_item_id
    WHERE cr.schedule_id = ?
    ORDER BY ci.sort_order, ci.category, ci.name
  `).all(id);

  return NextResponse.json({ schedule, records });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const body = await req.json();
  const { assigned_to, status } = body;

  db.prepare(`
    UPDATE weekly_schedules SET assigned_to = ?, status = ? WHERE id = ?
  `).run(assigned_to || null, status, id);

  return NextResponse.json({ success: true });
}
