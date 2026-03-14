import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const items = db.prepare(`
    SELECT * FROM check_items WHERE apparatus_id = ?
    ORDER BY sort_order, category, name
  `).all(id);
  return NextResponse.json(items);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const body = await req.json();
  const { category, name, description } = body;
  const maxOrder = (db.prepare(`
    SELECT COALESCE(MAX(sort_order), 0) as m FROM check_items WHERE apparatus_id = ?
  `).get(id) as { m: number }).m;
  const result = db.prepare(`
    INSERT INTO check_items (apparatus_id, category, name, description, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, category, name, description || null, maxOrder + 1);
  const item = db.prepare('SELECT * FROM check_items WHERE id = ?').get(result.lastInsertRowid);
  return NextResponse.json(item, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const url = new URL(req.url);
  const itemId = url.searchParams.get('itemId');
  if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 });
  db.prepare('DELETE FROM check_items WHERE id = ? AND apparatus_id = ?').run(itemId, id);
  return NextResponse.json({ success: true });
}
