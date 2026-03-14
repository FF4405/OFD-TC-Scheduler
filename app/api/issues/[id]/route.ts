import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const body = await req.json();
  const { status, resolved_by, severity, title, description } = body;

  const updates: string[] = [];
  const args: (string | null)[] = [];

  if (title !== undefined) { updates.push('title = ?'); args.push(title); }
  if (description !== undefined) { updates.push('description = ?'); args.push(description); }
  if (severity !== undefined) { updates.push('severity = ?'); args.push(severity); }
  if (status !== undefined) {
    updates.push('status = ?'); args.push(status);
    if (status === 'resolved') {
      updates.push("resolved_at = datetime('now')");
      updates.push('resolved_by = ?'); args.push(resolved_by || null);
    }
  }

  if (updates.length === 0) return NextResponse.json({ error: 'No updates' }, { status: 400 });

  args.push(id);
  db.prepare(`UPDATE issues SET ${updates.join(', ')} WHERE id = ?`).run(...args);
  const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(id);
  return NextResponse.json(issue);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.prepare('DELETE FROM issues WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
}
