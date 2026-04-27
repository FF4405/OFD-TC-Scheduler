'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { ArrowLeft, CheckCircle2, Circle, AlertTriangle, Mail, Clock } from 'lucide-react';

interface Member {
  id: number;
  line_number: string | null;
  name: string;
  email: string | null;
  status: string;
  remarks: string | null;
  active: number;
}

interface PeriodEntry {
  period: { id: number; name: string; start_date: string; week_count: number };
  slot: { apparatus_name: string; slot_type: string; oic_name: string | null };
  assignment_id: number;
  weekCount: number;
  completedCount: number;
  completions: Array<{ week_date: string; completed_at: string; completed_by: string | null }>;
}

interface NotificationEntry {
  sent_at: string;
  method: string;
  status: string;
  week_date: string;
  triggered_by: string;
  error_message: string | null;
}

interface MemberHistory {
  member: Member;
  periods: PeriodEntry[];
  notifications: NotificationEntry[];
  stats: {
    totalPeriods: number;
    totalWeeks: number;
    completedWeeks: number;
    completionRate: number | null;
  };
}

const STATUS_COLOR: Record<string, string> = {
  active:   'bg-green-100 text-green-800',
  officer:  'bg-blue-100 text-blue-800',
  '50yr':   'bg-purple-100 text-purple-800',
  inactive: 'bg-gray-100 text-gray-600',
  retired:  'bg-red-100 text-red-700',
};
const STATUS_LABEL: Record<string, string> = {
  active: 'Active', officer: 'Officer', '50yr': '50-Year', inactive: 'Inactive', retired: 'Retired',
};

function rateColor(rate: number | null) {
  if (rate === null) return 'text-gray-400';
  if (rate >= 80) return 'text-green-700';
  if (rate >= 50) return 'text-amber-600';
  return 'text-red-600';
}

export default function MemberHistoryPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<MemberHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/members/${id}`)
      .then(r => r.json())
      .then((d: MemberHistory) => { setData(d); setLoading(false); })
      .catch(() => { setError('Failed to load member data.'); setLoading(false); });
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" />
      </div>
    );
  }
  if (error || !data) {
    return <div className="text-center py-20 text-red-600">{error || 'Member not found.'}</div>;
  }

  const { member, periods, notifications, stats } = data;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back link */}
      <Link href="/members" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={15} /> Back to Members
      </Link>

      {/* Member header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{member.name}</h1>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[member.status] ?? 'bg-gray-100 text-gray-600'}`}>
                {STATUS_LABEL[member.status] ?? member.status}
              </span>
              {member.active === 0 && (
                <span className="text-xs bg-gray-200 text-gray-500 px-2.5 py-1 rounded-full">Inactive</span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-500">
              {member.line_number && <span>Line #{member.line_number}</span>}
              {member.email && (
                <a href={`mailto:${member.email}`} className="flex items-center gap-1 text-blue-500 hover:underline">
                  <Mail size={13} /> {member.email}
                </a>
              )}
            </div>
            {member.remarks && (
              <p className="mt-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 inline-block">
                {member.remarks}
              </p>
            )}
          </div>

          {/* Stats */}
          <div className="flex gap-6 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.totalPeriods}</div>
              <div className="text-xs text-gray-500 mt-0.5">Periods</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.completedWeeks}<span className="text-base text-gray-400">/{stats.totalWeeks}</span></div>
              <div className="text-xs text-gray-500 mt-0.5">Weeks done</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${rateColor(stats.completionRate)}`}>
                {stats.completionRate !== null ? `${stats.completionRate}%` : '—'}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">Completion</div>
            </div>
          </div>
        </div>
      </div>

      {/* Period history */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Assignment History</h2>
        </div>
        {periods.length === 0 ? (
          <div className="px-6 py-10 text-center text-gray-400 text-sm">No assignment history yet.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {periods.map(p => {
              const completedSet = new Set(p.completions.map(c => c.week_date));
              const rate = p.weekCount > 0 ? Math.round((p.completedCount / p.weekCount) * 100) : null;
              const today = new Date().toISOString().split('T')[0];

              // Generate all week dates for this period to show dots
              const periodStart = p.period.start_date;
              const dots: Array<{ date: string; done: boolean; future: boolean }> = [];
              for (let i = 0; i < p.weekCount; i++) {
                const d = new Date(periodStart);
                d.setDate(d.getDate() + i * 7);
                const dateStr = d.toISOString().split('T')[0];
                dots.push({
                  date: dateStr,
                  done: completedSet.has(dateStr),
                  future: dateStr > today,
                });
              }

              return (
                <div key={p.assignment_id} className="px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900">{p.period.name}</div>
                    <div className="text-xs text-gray-500">
                      {p.slot.apparatus_name} · {p.slot.slot_type}
                      {p.slot.oic_name && <span className="text-gray-400"> · OIC: {p.slot.oic_name}</span>}
                    </div>
                  </div>

                  {/* Week dots */}
                  <div className="flex items-center gap-1">
                    {dots.map((dot, i) => (
                      <span
                        key={i}
                        title={`${dot.date}${dot.done ? ' — completed' : dot.future ? ' — future' : ' — missed'}`}
                        className={`inline-block w-5 h-5 rounded-full ${
                          dot.done ? 'bg-green-400' : dot.future ? 'bg-gray-200' : 'bg-red-300'
                        }`}
                      />
                    ))}
                  </div>

                  <div className={`text-sm font-semibold tabular-nums ${rateColor(rate)}`}>
                    {p.completedCount}/{p.weekCount}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Notification history */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Notification History</h2>
        </div>
        {notifications.length === 0 ? (
          <div className="px-6 py-10 text-center text-gray-400 text-sm">No notifications sent yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-left text-xs text-gray-500 font-medium">
                <th className="px-6 py-2">Sent</th>
                <th className="px-4 py-2">Week</th>
                <th className="px-4 py-2">Method</th>
                <th className="px-4 py-2">Triggered by</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {notifications.map((n, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-6 py-2 text-gray-600 whitespace-nowrap">
                    <span className="flex items-center gap-1">
                      <Clock size={12} className="text-gray-400" />
                      {format(parseISO(n.sent_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-600">{format(parseISO(n.week_date), 'M/d/yyyy')}</td>
                  <td className="px-4 py-2 capitalize text-gray-600">{n.method}</td>
                  <td className="px-4 py-2 capitalize text-gray-500">{n.triggered_by}</td>
                  <td className="px-4 py-2">
                    {n.status === 'sent' ? (
                      <span className="flex items-center gap-1 text-green-700">
                        <CheckCircle2 size={13} /> Sent
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-600" title={n.error_message ?? ''}>
                        <AlertTriangle size={13} /> Failed
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
