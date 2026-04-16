import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { isFirstDueConfigured } from '@/lib/firstdue';

export async function GET() {
  if (!isFirstDueConfigured()) {
    return NextResponse.json({ configured: false });
  }

  const db = getDb();

  const latest = db.prepare(`
    SELECT synced_at, completions_found, completions_new, errors
    FROM firstdue_sync_log
    ORDER BY id DESC
    LIMIT 1
  `).get() as {
    synced_at: string;
    completions_found: number;
    completions_new: number;
    errors: string | null;
  } | undefined;

  const slotsConfigured = (db.prepare(`
    SELECT COUNT(*) AS c FROM assignment_slots
    WHERE firstdue_checklist_id IS NOT NULL AND firstdue_checklist_id != ''
  `).get() as { c: number }).c;

  return NextResponse.json({
    configured: true,
    slotsConfigured,
    latest: latest
      ? {
          synced_at: latest.synced_at,
          completions_found: latest.completions_found,
          completions_new: latest.completions_new,
          errors: latest.errors ? JSON.parse(latest.errors) : null,
        }
      : null,
  });
}
