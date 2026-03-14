'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, CheckCircle, Clock, FileText, ChevronRight, XCircle } from 'lucide-react';

interface Issue {
  id: number;
  apparatus_name: string;
  unit_number: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  reported_by: string | null;
  reported_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  check_item_name: string | null;
}

interface ScheduleRecord {
  id: number;
  week_start: string;
  apparatus_name: string;
  unit_number: string;
  status: string;
  assigned_to: string | null;
}

const severityConfig = {
  critical: { color: 'bg-red-600 text-white', label: 'Critical' },
  high: { color: 'bg-orange-500 text-white', label: 'High' },
  medium: { color: 'bg-yellow-400 text-yellow-900', label: 'Medium' },
  low: { color: 'bg-gray-200 text-gray-700', label: 'Low' },
};

function HistoryContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'issues';
  const [tab, setTab] = useState<'issues' | 'history'>(initialTab as 'issues' | 'history');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [history, setHistory] = useState<ScheduleRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [resolvedBy, setResolvedBy] = useState('');

  useEffect(() => {
    setLoading(true);
    if (tab === 'issues') {
      fetch(`/api/issues?status=${statusFilter}`)
        .then(r => r.json())
        .then(d => { setIssues(d); setLoading(false); });
    } else {
      fetch('/api/schedules')
        .then(r => r.json())
        .then(async (weeks: { week_start: string }[]) => {
          const all: ScheduleRecord[] = [];
          for (const w of weeks.slice(0, 8)) {
            const s = await fetch(`/api/schedules?week=${w.week_start}`).then(r => r.json());
            all.push(...s);
          }
          setHistory(all);
          setLoading(false);
        });
    }
  }, [tab, statusFilter]);

  const handleResolve = async (issueId: number) => {
    await fetch(`/api/issues/${issueId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolved', resolved_by: resolvedBy }),
    });
    setResolvingId(null);
    setResolvedBy('');
    // Refresh
    fetch(`/api/issues?status=${statusFilter}`)
      .then(r => r.json())
      .then(setIssues);
  };

  const handleDeleteIssue = async (issueId: number) => {
    if (!confirm('Delete this issue?')) return;
    await fetch(`/api/issues/${issueId}`, { method: 'DELETE' });
    setIssues(prev => prev.filter(i => i.id !== issueId));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">History & Issues</h1>
        <p className="text-gray-500 text-sm mt-1">Track issues and review past check records</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('issues')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'issues' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <AlertTriangle size={14} />
          Issues
        </button>
        <button
          onClick={() => setTab('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'history' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText size={14} />
          Check History
        </button>
      </div>

      {tab === 'issues' && (
        <div className="space-y-4">
          {/* Status filter */}
          <div className="flex gap-2">
            {['open', 'resolved'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                  statusFilter === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div></div>
          ) : issues.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <CheckCircle className="mx-auto text-green-400 mb-3" size={40} />
              <p className="font-medium text-gray-700">No {statusFilter} issues</p>
            </div>
          ) : (
            <div className="space-y-3">
              {issues.map(issue => {
                const sev = severityConfig[issue.severity as keyof typeof severityConfig] || severityConfig.low;
                return (
                  <div key={issue.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${sev.color}`}>{sev.label}</span>
                          <span className="text-xs text-gray-500 font-medium">{issue.unit_number} · {issue.apparatus_name}</span>
                          {issue.check_item_name && <span className="text-xs text-gray-400">({issue.check_item_name})</span>}
                        </div>
                        <h3 className="font-semibold text-gray-900">{issue.title}</h3>
                        {issue.description && <p className="text-sm text-gray-600 mt-1">{issue.description}</p>}
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                          <span>Reported {format(parseISO(issue.reported_at), 'MMM d, yyyy')}</span>
                          {issue.reported_by && <span>by {issue.reported_by}</span>}
                          {issue.resolved_at && (
                            <span className="text-green-600">
                              · Resolved {format(parseISO(issue.resolved_at), 'MMM d')}
                              {issue.resolved_by && ` by ${issue.resolved_by}`}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {issue.status === 'open' && (
                          <>
                            {resolvingId === issue.id ? (
                              <div className="flex items-center gap-2">
                                <input
                                  className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-500 w-32"
                                  value={resolvedBy}
                                  onChange={e => setResolvedBy(e.target.value)}
                                  placeholder="Resolved by..."
                                />
                                <button
                                  onClick={() => handleResolve(issue.id)}
                                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg font-medium"
                                >
                                  Confirm
                                </button>
                                <button onClick={() => setResolvingId(null)} className="text-gray-400 hover:text-gray-600">
                                  <XCircle size={14} />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setResolvingId(issue.id)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 text-xs rounded-lg font-medium transition-colors"
                              >
                                <CheckCircle size={12} /> Resolve
                              </button>
                            )}
                          </>
                        )}
                        <button
                          onClick={() => handleDeleteIssue(issue.id)}
                          className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <XCircle size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div></div>
          ) : history.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <FileText className="mx-auto text-gray-300 mb-3" size={40} />
              <p className="font-medium text-gray-700">No check history yet</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-50">
              {history.map(s => {
                const statusIcons = {
                  completed: <CheckCircle size={15} className="text-green-500" />,
                  issues: <AlertTriangle size={15} className="text-red-500" />,
                  in_progress: <Clock size={15} className="text-blue-500" />,
                  pending: <Clock size={15} className="text-gray-300" />,
                };
                const statusLabels = {
                  completed: 'text-green-700 bg-green-50',
                  issues: 'text-red-700 bg-red-50',
                  in_progress: 'text-blue-700 bg-blue-50',
                  pending: 'text-gray-500 bg-gray-50',
                };
                return (
                  <div key={s.id} className="flex items-center px-5 py-3.5 hover:bg-gray-50 transition-colors">
                    <div className="mr-3">{statusIcons[s.status as keyof typeof statusIcons] || statusIcons.pending}</div>
                    <div className="flex-1">
                      <span className="font-medium text-gray-900 text-sm">{s.apparatus_name}</span>
                      <span className="text-gray-400 text-xs ml-2">({s.unit_number})</span>
                      {s.assigned_to && <span className="text-xs text-gray-500 ml-2">· {s.assigned_to}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">
                        Week of {format(parseISO(s.week_start), 'MMM d, yyyy')}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${statusLabels[s.status as keyof typeof statusLabels] || statusLabels.pending}`}>
                        {s.status.replace('_', ' ')}
                      </span>
                      <Link href={`/checks/${s.id}`} className="text-xs text-red-600 hover:text-red-700 flex items-center gap-0.5">
                        View <ChevronRight size={12} />
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
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600"></div></div>}>
      <HistoryContent />
    </Suspense>
  );
}
