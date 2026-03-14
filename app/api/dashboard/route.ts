import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();

  // Get current week start (Monday)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + diff);
  const weekStartStr = weekStart.toISOString().split('T')[0];

  const thisWeekSchedules = db.prepare(`
    SELECT s.*, a.name as apparatus_name, a.unit_number, a.type as apparatus_type,
      COUNT(DISTINCT cr.id) as total_checks,
      SUM(CASE WHEN cr.result = 'pass' THEN 1 ELSE 0 END) as passed_checks,
      SUM(CASE WHEN cr.result = 'fail' THEN 1 ELSE 0 END) as failed_checks,
      SUM(CASE WHEN cr.result = 'pending' THEN 1 ELSE 0 END) as pending_checks
    FROM weekly_schedules s
    JOIN apparatus a ON a.id = s.apparatus_id
    LEFT JOIN check_records cr ON cr.schedule_id = s.id
    WHERE s.week_start = ?
    GROUP BY s.id
    ORDER BY a.unit_number
  `).all(weekStartStr);

  const openIssues = db.prepare(`
    SELECT i.*, a.name as apparatus_name, a.unit_number
    FROM issues i
    JOIN apparatus a ON a.id = i.apparatus_id
    WHERE i.status = 'open'
    ORDER BY CASE i.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
             i.reported_at DESC
    LIMIT 10
  `).all();

  const totalApparatus = (db.prepare('SELECT COUNT(*) as c FROM apparatus WHERE status = ?').get('active') as { c: number }).c;
  const totalIssues = (db.prepare("SELECT COUNT(*) as c FROM issues WHERE status = 'open'").get() as { c: number }).c;

  const recentActivity = db.prepare(`
    SELECT s.week_start, a.name as apparatus_name, a.unit_number, s.status,
           s.assigned_to
    FROM weekly_schedules s
    JOIN apparatus a ON a.id = s.apparatus_id
    ORDER BY s.week_start DESC, a.unit_number
    LIMIT 20
  `).all();

  const weeklyCompletionStats = db.prepare(`
    SELECT week_start,
      COUNT(*) as total,
      SUM(CASE WHEN status IN ('completed', 'issues') THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'issues' THEN 1 ELSE 0 END) as with_issues
    FROM weekly_schedules
    GROUP BY week_start
    ORDER BY week_start DESC
    LIMIT 8
  `).all();

  return NextResponse.json({
    weekStart: weekStartStr,
    thisWeekSchedules,
    openIssues,
    totalApparatus,
    totalIssues,
    recentActivity,
    weeklyCompletionStats,
  });
}
