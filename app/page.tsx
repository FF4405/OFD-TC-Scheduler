'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle, XCircle, Clock, AlertTriangle, Truck,
  TrendingUp, ChevronRight, Plus
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

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
  pending_checks: number;
}

interface Issue {
  id: number;
  apparatus_name: string;
  unit_number: string;
  title: string;
  severity: string;
  reported_at: string;
}

interface WeeklyStat {
  week_start: string;
  total: number;
  completed: number;
  with_issues: number;
}

interface DashboardData {
  weekStart: string;
  thisWeekSchedules: Schedule[];
  openIssues: Issue[];
  totalApparatus: number;
  totalIssues: number;
  weeklyCompletionStats: WeeklyStat[];
}

const statusConfig = {
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800', icon: CheckCircle, iconColor: 'text-green-500' },
  issues: { label: 'Issues Found', color: 'bg-red-100 text-red-800', icon: XCircle, iconColor: 'text-red-500' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-800', icon: Clock, iconColor: 'text-blue-500' },
  pending: { label: 'Pending', color: 'bg-gray-100 text-gray-700', icon: Clock, iconColor: 'text-gray-400' },
};

const severityConfig = {
  critical: 'bg-red-600 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-400 text-yellow-900',
  low: 'bg-gray-200 text-gray-700',
};

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (!data) return null;

  const weekLabel = format(parseISO(data.weekStart), 'MMMM d, yyyy');
  const totalScheduled = data.thisWeekSchedules.length;
  const totalCompleted = data.thisWeekSchedules.filter(s => s.status === 'completed' || s.status === 'issues').length;
  const totalPending = data.thisWeekSchedules.filter(s => s.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Week of {weekLabel}</p>
        </div>
        <Link
          href="/schedules/new"
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus size={16} />
          New Schedule
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Active Apparatus"
          value={data.totalApparatus}
          icon={<Truck className="text-blue-500" size={22} />}
          bg="bg-blue-50"
        />
        <StatCard
          label="Scheduled This Week"
          value={totalScheduled}
          icon={<Clock className="text-purple-500" size={22} />}
          bg="bg-purple-50"
        />
        <StatCard
          label="Checks Completed"
          value={`${totalCompleted}/${totalScheduled}`}
          icon={<CheckCircle className="text-green-500" size={22} />}
          bg="bg-green-50"
        />
        <StatCard
          label="Open Issues"
          value={data.totalIssues}
          icon={<AlertTriangle className="text-red-500" size={22} />}
          bg="bg-red-50"
          alert={data.totalIssues > 0}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* This Week's Checks */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">This Week&apos;s Checks</h2>
            <Link href="/schedules" className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1">
              View all <ChevronRight size={14} />
            </Link>
          </div>
          {data.thisWeekSchedules.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              <svg className="mx-auto text-gray-300 mb-3" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M8 2v4M16 2v4M3 10h18" />
              </svg>
              <p className="font-medium">No checks scheduled this week</p>
              <Link href="/schedules/new" className="mt-2 inline-block text-sm text-red-600 hover:underline">
                Create a schedule
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {data.thisWeekSchedules.map(s => {
                const cfg = statusConfig[s.status as keyof typeof statusConfig] || statusConfig.pending;
                const StatusIcon = cfg.icon;
                const pct = s.total_checks > 0 ? Math.round(((s.passed_checks + s.failed_checks) / s.total_checks) * 100) : 0;
                return (
                  <div key={s.id} className="flex items-center px-6 py-4 hover:bg-gray-50 transition-colors">
                    <StatusIcon className={`mr-3 flex-shrink-0 ${cfg.iconColor}`} size={20} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{s.apparatus_name}</span>
                        <span className="text-xs text-gray-400">({s.unit_number})</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-32">
                          <div
                            className={`h-1.5 rounded-full ${s.failed_checks > 0 ? 'bg-red-500' : 'bg-green-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">
                          {s.passed_checks + s.failed_checks}/{s.total_checks} checked
                          {s.failed_checks > 0 && <span className="text-red-500 ml-1">({s.failed_checks} failed)</span>}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4 flex items-center gap-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      <Link
                        href={`/checks/${s.id}`}
                        className="text-xs text-red-600 hover:text-red-700 font-medium"
                      >
                        {s.status === 'pending' ? 'Start' : 'View'} →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Open Issues */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Open Issues</h2>
            <Link href="/history?tab=issues" className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1">
              View all <ChevronRight size={14} />
            </Link>
          </div>
          {data.openIssues.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              <CheckCircle className="mx-auto text-green-400" size={32} />
              <p className="mt-2 text-sm font-medium">No open issues!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {data.openIssues.map(issue => (
                <div key={issue.id} className="px-6 py-3">
                  <div className="flex items-start gap-2">
                    <span className={`mt-0.5 text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${severityConfig[issue.severity as keyof typeof severityConfig] || severityConfig.low}`}>
                      {issue.severity}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{issue.title}</p>
                      <p className="text-xs text-gray-500">{issue.unit_number} · {format(parseISO(issue.reported_at), 'MMM d')}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Weekly Completion Trend */}
      {data.weeklyCompletionStats.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="text-gray-500" size={18} />
            <h2 className="font-semibold text-gray-900">Weekly Completion History</h2>
          </div>
          <div className="flex items-end gap-3 h-24">
            {[...data.weeklyCompletionStats].reverse().map(stat => {
              const pct = stat.total > 0 ? (stat.completed / stat.total) * 100 : 0;
              return (
                <div key={stat.week_start} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col justify-end" style={{ height: '72px' }}>
                    <div
                      className={`w-full rounded-t ${stat.with_issues > 0 ? 'bg-orange-400' : 'bg-green-500'}`}
                      style={{ height: `${Math.max(pct * 0.72, pct > 0 ? 4 : 0)}px` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {format(parseISO(stat.week_start), 'M/d')}
                  </span>
                  <span className="text-xs font-medium text-gray-600">{stat.completed}/{stat.total}</span>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block"></span> Completed clean</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-400 inline-block"></span> Completed with issues</span>
          </div>
        </div>
      )}

      {totalPending > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="text-amber-500 flex-shrink-0" size={20} />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">{totalPending} apparatus</span> still need checks this week.{' '}
            <Link href="/checks" className="underline font-medium">Start a check now.</Link>
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, bg, alert }: {
  label: string; value: string | number; icon: React.ReactNode; bg: string; alert?: boolean;
}) {
  return (
    <div className={`${bg} rounded-xl p-4 border ${alert ? 'border-red-200' : 'border-transparent'}`}>
      <div className="flex items-center justify-between mb-2">
        {icon}
        {alert && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}
