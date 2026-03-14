import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const apparatus = db.prepare('SELECT * FROM apparatus WHERE id = ?').get(id);
  if (!apparatus) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(apparatus);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const body = await req.json();
  const { name, type, unit_number, year, make, model, status } = body;
  db.prepare(`
    UPDATE apparatus SET name=?, type=?, unit_number=?, year=?, make=?, model=?, status=?
    WHERE id=?
  `).run(name, type, unit_number, year || null, make || null, model || null, status, id);
  const apparatus = db.prepare('SELECT * FROM apparatus WHERE id = ?').get(id);
  return NextResponse.json(apparatus);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.prepare('DELETE FROM apparatus WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
}
