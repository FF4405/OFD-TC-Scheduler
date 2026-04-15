import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getChecklistCompletions, isFirstDueConfigured } from '@/lib/firstdue';
import { getPeriodWeeks } from '@/lib/dates';

// Called by Windows Task Scheduler every hour:
//   Invoke-WebRequest -Uri "http://localhost:3000/api/cron/sync-firstdue" -Method POST \
//     -Headers @{ "x-cron-secret" = "YOUR_SECRET" } -UseBasicParsing

export async function POST(req: Request) {
  // Validate cron secret
  const secret = req.headers.get('x-cron-secret');
  if (!secret || secret !== process.env.NOTIFY_CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isFirstDueConfigured()) {
    return NextResponse.json(
      { error: 'FirstDue is not configured. Set FIRSTDUE_API_KEY and FIRSTDUE_BASE_URL in .env.local.' },
      { status: 503 }
    );
  }

  const db = getDb();

  // Pull slots that have a FirstDue checklist ID mapped
  const slots = db.prepare(`
    SELECT id, apparatus_name, slot_type, firstdue_checklist_id
    FROM assignment_slots
    WHERE firstdue_checklist_id IS NOT NULL AND firstdue_checklist_id != ''
  `).all() as Array<{
    id: number;
    apparatus_name: string;
    slot_type: string;
    firstdue_checklist_id: string;
  }>;

  if (slots.length === 0) {
    return NextResponse.json({
      message: 'No slots have FirstDue checklist IDs configured yet. Set them in the Slots page.',
      completions_found: 0,
      completions_new: 0,
    });
  }

  // Get active periods + their week dates
  const activePeriods = db.prepare(`
    SELECT id, start_date, week_count FROM periods WHERE is_current = 1
  `).all() as Array<{ id: number; start_date: string; week_count: number }>;

  if (activePeriods.length === 0) {
    return NextResponse.json({ message: 'No current period', completions_found: 0, completions_new: 0 });
  }

  // Determine how far back to sync (start of earliest active period)
  const since = activePeriods.reduce((earliest, p) =>
    p.start_date < earliest ? p.start_date : earliest,
    activePeriods[0].start_date
  );

  // Build lookup: member.firstdue_user_id → member.id
  const members = db.prepare(`
    SELECT id, firstdue_user_id FROM members WHERE firstdue_user_id IS NOT NULL AND active = 1
  `).all() as Array<{ id: number; firstdue_user_id: string }>;
  const memberByFdId = new Map(members.map(m => [m.firstdue_user_id, m.id]));

  // Build lookup: period_assignments keyed by (period_id, slot_id)
  const assignments = db.prepare(`
    SELECT pa.id, pa.period_id, pa.slot_id, pa.member_id
    FROM period_assignments pa
    WHERE pa.period_id IN (${activePeriods.map(() => '?').join(',')})
  `).all(...activePeriods.map(p => p.id)) as Array<{
    id: number; period_id: number; slot_id: number; member_id: number | null;
  }>;
  const assignmentKey = (periodId: number, slotId: number) => `${periodId}:${slotId}`;
  const assignmentMap = new Map(assignments.map(a => [assignmentKey(a.period_id, a.slot_id), a]));

  // Build all valid week dates per period for fast lookup
  const periodWeeksMap = new Map(
    activePeriods.map(p => [p.id, new Set(getPeriodWeeks(p.start_date))])
  );

  const insertCompletion = db.prepare(`
    INSERT OR IGNORE INTO weekly_completions (assignment_id, week_date, completed_by)
    VALUES (?, ?, 'FirstDue')
  `);

  const insertSyncLog = db.prepare(`
    INSERT INTO firstdue_sync_log (completions_found, completions_new, errors)
    VALUES (?, ?, ?)
  `);

  let completions_found = 0;
  let completions_new = 0;
  const errors: string[] = [];

  for (const slot of slots) {
    let completions;
    try {
      completions = await getChecklistCompletions(slot.firstdue_checklist_id, since);
    } catch (err) {
      const msg = `Slot ${slot.apparatus_name} ${slot.slot_type}: ${err instanceof Error ? err.message : String(err)}`;
      errors.push(msg);
      continue;
    }

    completions_found += completions.length;

    for (const c of completions) {
      // Resolve FirstDue user → OFD member
      const memberId = memberByFdId.get(c.userId);

      // Resolve completion date → nearest Monday (week_date)
      const completedDate = new Date(c.completedAt);
      const day = completedDate.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const monday = new Date(completedDate);
      monday.setDate(completedDate.getDate() + diff);
      const weekDate = monday.toISOString().split('T')[0];

      // Match to the right period + assignment
      for (const period of activePeriods) {
        const weeks = periodWeeksMap.get(period.id);
        if (!weeks?.has(weekDate)) continue;

        const assignment = assignmentMap.get(assignmentKey(period.id, slot.id));
        if (!assignment) continue;

        // Only auto-mark if this member is the assigned one (or assignment is unassigned)
        if (memberId !== undefined && assignment.member_id !== null && assignment.member_id !== memberId) continue;

        const result = insertCompletion.run(assignment.id, weekDate);
        if (result.changes > 0) completions_new++;
        break;
      }
    }
  }

  insertSyncLog.run(completions_found, completions_new, errors.length ? JSON.stringify(errors) : null);

  return NextResponse.json({ completions_found, completions_new, errors: errors.length ? errors : undefined });
}
