'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { Plus, CheckCircle, XCircle, Clock, ChevronRight, Calendar } from 'lucide-react';

interface WeekEntry {
  week_start: string;
}

interface Schedule {
  id: number;
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
  issues: { label: 'Issues', color: 'bg-red-100 text-red-800', icon: XCircle, iconColor: 'text-red-500' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-800', icon: Clock, iconColor: 'text-blue-500' },
  pending: { label: 'Pending', color: 'bg-gray-100 text-gray-600', icon: Clock, iconColor: 'text-gray-400' },
};

export default function SchedulesPage() {
  const [weeks, setWeeks] = useState<WeekEntry[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/schedules')
      .then(r => r.json())
      .then((w: WeekEntry[]) => {
        setWeeks(w);
        if (w.length > 0) setSelectedWeek(w[0].week_start);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!selectedWeek) return;
    fetch(`/api/schedules?week=${selectedWeek}`)
      .then(r => r.json())
      .then(setSchedules);
  }, [selectedWeek]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600"></div></div>;
  }

  const completed = schedules.filter(s => s.status === 'completed' || s.status === 'issues').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Schedules</h1>
          <p className="text-gray-500 text-sm mt-1">Manage weekly apparatus check schedules</p>
        </div>
        <Link
          href="/schedules/new"
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus size={16} />
          New Schedule
        </Link>
      </div>

      {weeks.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <Calendar className="mx-auto text-gray-300 mb-4" size={48} />
          <h3 className="font-semibold text-gray-700 text-lg">No schedules yet</h3>
          <p className="text-gray-500 text-sm mt-1 mb-4">Create your first weekly check schedule to get started.</p>
          <Link href="/schedules/new" className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
            <Plus size={16} /> Create Schedule
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Week Sidebar */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <h3 className="font-medium text-gray-700 text-sm">Select Week</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {weeks.map(w => (
                <button
                  key={w.week_start}
                  onClick={() => setSelectedWeek(w.week_start)}
                  className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                    selectedWeek === w.week_start ? 'bg-red-50 text-red-700 font-medium' : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  {format(parseISO(w.week_start), 'MMM d, yyyy')}
                </button>
              ))}
            </div>
          </div>

          {/* Schedule Detail */}
          <div className="lg:col-span-3 space-y-4">
            {selectedWeek && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-gray-900">
                      Week of {format(parseISO(selectedWeek), 'MMMM d, yyyy')}
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5">{completed}/{schedules.length} checks complete</p>
                  </div>
                  {schedules.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-gray-100 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-green-500 transition-all"
                          style={{ width: `${schedules.length > 0 ? (completed / schedules.length) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-500">{schedules.length > 0 ? Math.round((completed / schedules.length) * 100) : 0}%</span>
                    </div>
                  )}
                </div>

                {schedules.length === 0 ? (
                  <div className="px-6 py-8 text-center text-gray-500 text-sm">No apparatus scheduled this week.</div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {schedules.map(s => {
                      const cfg = statusConfig[s.status as keyof typeof statusConfig] || statusConfig.pending;
                      const StatusIcon = cfg.icon;
                      const pct = s.total_checks > 0 ? Math.round(((s.passed_checks + s.failed_checks) / s.total_checks) * 100) : 0;
                      return (
                        <div key={s.id} className="flex items-center px-6 py-4 hover:bg-gray-50 transition-colors">
                          <StatusIcon className={`mr-3 flex-shrink-0 ${cfg.iconColor}`} size={18} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">{s.apparatus_name}</span>
                              <span className="text-xs text-gray-400">({s.unit_number})</span>
                              {s.assigned_to && <span className="text-xs text-gray-500">· {s.assigned_to}</span>}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="w-24 bg-gray-100 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${s.failed_checks > 0 ? 'bg-red-500' : 'bg-green-500'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500">{s.passed_checks + s.failed_checks}/{s.total_checks}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 ml-4">
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                            <Link href={`/checks/${s.id}`} className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-medium">
                              {s.status === 'pending' ? 'Start' : 'View'} <ChevronRight size={12} />
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
