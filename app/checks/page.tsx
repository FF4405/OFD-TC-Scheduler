'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { ClipboardList, ChevronRight, CheckCircle, Clock, XCircle } from 'lucide-react';

interface Schedule {
  id: number;
  week_start: string;
  apparatus_name: string;
  unit_number: string;
  apparatus_type: string;
  status: string;
  assigned_to: string | null;
  total_checks: number;
  passed_checks: number;
  failed_checks: number;
}

const statusConfig = {
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800', icon: CheckCircle, iconColor: 'text-green-500' },
  issues: { label: 'Issues Found', color: 'bg-red-100 text-red-800', icon: XCircle, iconColor: 'text-red-500' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-800', icon: Clock, iconColor: 'text-blue-500' },
  pending: { label: 'Pending', color: 'bg-gray-100 text-gray-600', icon: Clock, iconColor: 'text-gray-400' },
};

export default function ChecksPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get current week
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + diff);
    const weekStartStr = weekStart.toISOString().split('T')[0];

    fetch(`/api/schedules?week=${weekStartStr}`)
      .then(r => r.json())
      .then(d => { setSchedules(d); setLoading(false); });
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600"></div></div>;
  }

  const pending = schedules.filter(s => s.status === 'pending' || s.status === 'in_progress');
  const done = schedules.filter(s => s.status === 'completed' || s.status === 'issues');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Run Check</h1>
        <p className="text-gray-500 text-sm mt-1">Select an apparatus to begin the weekly check</p>
      </div>

      {schedules.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <ClipboardList className="mx-auto text-gray-300 mb-4" size={48} />
          <h3 className="font-semibold text-gray-700">No checks scheduled this week</h3>
          <p className="text-gray-500 text-sm mt-1 mb-4">Create a schedule first to run checks.</p>
          <Link href="/schedules/new" className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm">
            Create Schedule
          </Link>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Needs Attention ({pending.length})</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {pending.map(s => <ScheduleRow key={s.id} schedule={s} />)}
              </div>
            </div>
          )}
          {done.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Completed ({done.length})</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {done.map(s => <ScheduleRow key={s.id} schedule={s} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ScheduleRow({ schedule: s }: { schedule: Schedule }) {
  const cfg = statusConfig[s.status as keyof typeof statusConfig] || statusConfig.pending;
  const StatusIcon = cfg.icon;
  const pct = s.total_checks > 0 ? Math.round(((s.passed_checks + s.failed_checks) / s.total_checks) * 100) : 0;

  return (
    <Link href={`/checks/${s.id}`} className="flex items-center px-6 py-4 hover:bg-gray-50 transition-colors">
      <StatusIcon className={`mr-3 flex-shrink-0 ${cfg.iconColor}`} size={20} />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{s.apparatus_name}</span>
          <span className="text-sm text-gray-400">({s.unit_number})</span>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <div className="w-28 bg-gray-100 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full ${s.failed_checks > 0 ? 'bg-red-500' : 'bg-green-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-gray-500">
            {s.passed_checks + s.failed_checks}/{s.total_checks} items
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
        <ChevronRight size={16} className="text-gray-400" />
      </div>
    </Link>
  );
}
