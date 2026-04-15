'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import {
  CheckCircle2, Circle, AlertTriangle, Mail, ChevronDown, RefreshCw, Plus, Zap
} from 'lucide-react';

interface WeekCell {
  weekDate: string;
  label: string | null;
  completion: { completed_at: string; completed_by: string | null; notes: string | null } | null;
  isPast: boolean;
  isCurrentWeek: boolean;
}

interface Row {
  id: number;          // assignment id
  slot_id: number;
  member_id: number | null;
  member_name: string | null;
  member_email: string | null;
  apparatus_name: string;
  slot_type: string;
  rotation_note: string | null;
  oic_name: string | null;
  sort_order: number;
  weekData: WeekCell[];
}

interface Period {
  id: number;
  name: string;
  start_date: string;
  week_count: number;
  is_current: number;
}

interface PeriodData {
  period: Period;
  weeks: string[];
  rows: Row[];
}

interface AllPeriods {
  id: number;
  name: string;
  start_date: string;
  is_current: number;
}

interface FirstDueStatus {
  configured: boolean;
  slotsConfigured?: number;
  latest?: {
    synced_at: string;
    completions_found: number;
    completions_new: number;
    errors: string[] | null;
  } | null;
}

export default function SchedulePage() {
  const [data, setData] = useState<PeriodData | null>(null);
  const [allPeriods, setAllPeriods] = useState<AllPeriods[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [completingCell, setCompletingCell] = useState<string | null>(null);
  const [notifyModal, setNotifyModal] = useState<{ week: string; assignmentId?: number } | null>(null);
  const [notifyRecipients, setNotifyRecipients] = useState<NotifyRecipient[] | null>(null);
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [firstDueStatus, setFirstDueStatus] = useState<FirstDueStatus | null>(null);

  const fetchPeriods = async () => {
    const res = await fetch('/api/periods');
    const periods = await res.json() as AllPeriods[];
    setAllPeriods(periods);
    if (!selectedPeriodId && periods.length > 0) {
      const current = periods.find(p => p.is_current) || periods[0];
      setSelectedPeriodId(current.id);
    }
  };

  const fetchData = useCallback(async (periodId: number) => {
    setLoading(true);
    const res = await fetch(`/api/periods/${periodId}`);
    const d = await res.json() as PeriodData;
    setData(d);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPeriods();
    fetch('/api/firstdue/status').then(r => r.json()).then(setFirstDueStatus).catch(() => null);
  }, []);
  useEffect(() => {
    if (selectedPeriodId) fetchData(selectedPeriodId);
  }, [selectedPeriodId, fetchData]);

  const toggleComplete = async (row: Row, cell: WeekCell) => {
    const key = `${row.id}:${cell.weekDate}`;
    setCompletingCell(key);
    await fetch('/api/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assignment_id: row.id,
        week_date: cell.weekDate,
        undo: !!cell.completion,
      }),
    });
    setCompletingCell(null);
    if (selectedPeriodId) fetchData(selectedPeriodId);
  };

  const openNotify = async (week: string, assignmentId?: number) => {
    if (!data) return;
    setNotifyModal({ week, assignmentId });
    setNotifyLoading(true);
    setNotifyRecipients(null);
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        period_id: data.period.id,
        week_date: week,
        target: assignmentId ?? 'pending',
      }),
    });
    const d = await res.json();
    setNotifyRecipients(d.recipients);
    setNotifyLoading(false);
  };

  if (!data && loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 mb-4">No periods have been created yet.</p>
        <Link href="/periods/new" className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
          <Plus size={16} /> Create First Period
        </Link>
      </div>
    );
  }

  const { period, weeks, rows } = data;
  const today = new Date().toISOString().split('T')[0];

  // Group rows by OIC for rendering (same OIC spans multiple rows)
  const oicGroups: { oic: string; rows: Row[] }[] = [];
  for (const row of rows) {
    const oic = row.oic_name || '';
    const last = oicGroups[oicGroups.length - 1];
    if (last && last.oic === oic) last.rows.push(row);
    else oicGroups.push({ oic, rows: [row] });
  }

  // Stats
  const currentWeekIdx = weeks.findIndex(w => {
    const next = weeks[weeks.indexOf(w) + 1];
    return w <= today && (!next || next > today);
  });
  const currentWeek = currentWeekIdx >= 0 ? weeks[currentWeekIdx] : null;
  const completedThisWeek = currentWeek
    ? rows.filter(r => r.weekData[currentWeekIdx]?.completion).length
    : 0;
  const pendingThisWeek = rows.length - completedThisWeek;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Oradell Fire Department</h1>
        <p className="text-lg font-semibold text-gray-700">House Committee Assignments</p>
        <p className="text-sm text-red-600 font-medium mt-1">Complete all checks by 7PM each Monday</p>
        <p className="text-xs text-gray-400 mt-1">
          Periods run from the <span className="font-medium text-gray-600">2nd Monday of each month</span> through the Monday before the next month&apos;s 2nd Monday
        </p>
      </div>

      {/* Period selector + stats bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
              value={selectedPeriodId ?? ''}
              onChange={e => setSelectedPeriodId(Number(e.target.value))}
            >
              {allPeriods.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.is_current ? ' (Current)' : ''}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <button onClick={() => selectedPeriodId && fetchData(selectedPeriodId)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <RefreshCw size={15} />
          </button>
          <Link href="/periods/new"
            className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 font-medium">
            <Plus size={14} /> New Period
          </Link>
        </div>

        {/* Period date range */}
        {weeks.length > 0 && (
          <div className="w-full text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-700">
              {format(parseISO(weeks[0]), 'MMM d')} – {format(parseISO(weeks[weeks.length - 1]), 'MMM d, yyyy')}
            </span>
            <span className="text-gray-300">·</span>
            <span>{weeks.length} weeks</span>
            <span className="text-gray-300">·</span>
            <span>2nd Monday of each month</span>
            {firstDueStatus?.configured && (
              <>
                <span className="text-gray-300">·</span>
                <span className="flex items-center gap-1 text-blue-600">
                  <Zap size={11} />
                  {firstDueStatus.latest
                    ? <>FirstDue synced {format(parseISO(firstDueStatus.latest.synced_at), 'M/d h:mm a')} · {firstDueStatus.latest.completions_new} new</>
                    : 'FirstDue connected (no sync yet)'}
                </span>
              </>
            )}
          </div>
        )}

        <div className="flex items-center gap-4 text-sm">
          {currentWeek && (
            <>
              <span className="flex items-center gap-1.5 text-green-700 font-medium">
                <CheckCircle2 size={16} className="text-green-500" />
                {completedThisWeek}/{rows.length} done this week
              </span>
              {pendingThisWeek > 0 && (
                <button
                  onClick={() => openNotify(currentWeek)}
                  className="flex items-center gap-1.5 text-sm bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors font-medium"
                >
                  <Mail size={14} />
                  Remind {pendingThisWeek} pending
                </button>
              )}
            </>
          )}
          <Link href={`/periods/${period.id}`}
            className="text-sm text-gray-500 hover:text-gray-700 underline">
            Manage assignments
          </Link>
        </div>
      </div>

      {/* Main grid */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-yellow-400 border-b-2 border-yellow-500">
              <th className="px-4 py-3 text-left font-bold text-gray-900 w-28">OIC</th>
              <th className="px-4 py-3 text-left font-bold text-gray-900">Assignment</th>
              <th className="px-4 py-3 text-left font-bold text-gray-900 w-32">
                This Period
              </th>
              {weeks.map(w => {
                const isCurrentWk = w <= today && (weeks[weeks.indexOf(w) + 1]
                  ? weeks[weeks.indexOf(w) + 1] > today : true);
                return (
                  <th key={w} className={`px-3 py-3 text-center font-bold text-gray-900 w-24 ${
                    isCurrentWk ? 'bg-yellow-300' : ''
                  }`}>
                    <div>{format(parseISO(w), 'M/d/yyyy')}</div>
                    {isCurrentWk && (
                      <div className="text-xs font-normal text-yellow-800 mt-0.5">← This Week</div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {oicGroups.map(({ oic, rows: groupRows }, gi) => (
              groupRows.map((row, ri) => {
                const isFirstInGroup = ri === 0;
                const isLastInGroup = ri === groupRows.length - 1;
                const isLastGroup = gi === oicGroups.length - 1;
                const rowBg = gi % 2 === 0 ? 'bg-white' : 'bg-gray-50';

                return (
                  <tr key={row.id} className={`${rowBg} border-b border-gray-100 last:border-0 hover:brightness-95 transition-all`}>
                    {/* OIC cell — spans rows within group */}
                    {isFirstInGroup && (
                      <td
                        rowSpan={groupRows.length}
                        className={`px-4 py-3 font-semibold text-gray-800 text-center align-middle border-r border-gray-200 ${
                          !isLastGroup ? 'border-b border-gray-200' : ''
                        } ${rowBg}`}
                      >
                        {oic}
                      </td>
                    )}

                    {/* Assignment slot */}
                    <td className={`px-4 py-3 border-r border-gray-100 ${!isLastInGroup ? '' : 'border-b border-gray-200'}`}>
                      <div className="font-semibold text-gray-900">{row.apparatus_name}</div>
                      <div className="text-xs text-gray-500 font-medium">{row.slot_type}</div>
                      {row.rotation_note && (
                        <div className="text-xs text-gray-400 italic mt-0.5">{row.rotation_note}</div>
                      )}
                    </td>

                    {/* Current assignee */}
                    <td className="px-4 py-3 border-r border-gray-100">
                      {row.member_name ? (
                        <div>
                          <div className="font-medium text-gray-900">{row.member_name}</div>
                          {row.member_email && (
                            <a href={`mailto:${row.member_email}`}
                              className="text-xs text-blue-500 hover:underline truncate block max-w-28">
                              {row.member_email.split('@')[0]}
                            </a>
                          )}
                        </div>
                      ) : (
                        <Link href={`/periods/${period.id}`}
                          className="text-xs text-red-500 font-medium hover:underline flex items-center gap-1">
                          <AlertTriangle size={12} /> Unassigned
                        </Link>
                      )}
                    </td>

                    {/* Week cells */}
                    {row.weekData.map((cell, wi) => {
                      const key = `${row.id}:${cell.weekDate}`;
                      const isSpinning = completingCell === key;
                      const isFuture = !cell.isPast && !cell.isCurrentWeek;
                      const isOverdue = cell.isPast && !cell.completion;

                      return (
                        <td key={wi} className={`px-2 py-2 text-center border-l border-gray-100 ${
                          cell.isCurrentWeek ? 'bg-yellow-50' : ''
                        }`}>
                          <button
                            onClick={() => !isFuture && toggleComplete(row, cell)}
                            disabled={isSpinning || isFuture}
                            title={
                              cell.completion
                                ? `Completed by ${cell.completion.completed_by || 'unknown'} — click to undo`
                                : isFuture ? 'Future week'
                                : isOverdue ? 'Overdue — click to mark complete'
                                : 'Click to mark complete'
                            }
                            className={`w-full flex flex-col items-center justify-center gap-0.5 rounded-lg py-2 px-1 transition-all ${
                              isSpinning ? 'opacity-50 cursor-wait' :
                              isFuture ? 'cursor-default opacity-30' :
                              cell.completion
                                ? 'bg-green-100 hover:bg-green-200 cursor-pointer'
                                : isOverdue
                                  ? 'bg-red-50 hover:bg-red-100 cursor-pointer'
                                  : 'hover:bg-gray-100 cursor-pointer'
                            }`}
                          >
                            {isSpinning ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent" />
                            ) : cell.completion ? (
                              <CheckCircle2 size={18} className="text-green-600" />
                            ) : isOverdue ? (
                              <AlertTriangle size={16} className="text-red-400" />
                            ) : (
                              <Circle size={16} className="text-gray-300" />
                            )}
                            {cell.label && (
                              <span className={`text-xs font-medium leading-tight ${
                                cell.completion ? 'text-green-700' :
                                isOverdue ? 'text-red-500' : 'text-gray-500'
                              }`}>
                                {cell.label}
                              </span>
                            )}
                            {cell.completion?.completed_by && (
                              <span className="text-xs text-green-600 leading-tight truncate max-w-full px-1">
                                {cell.completion.completed_by.split(' ').pop()}
                              </span>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer warning */}
      <div className="bg-amber-400 text-gray-900 font-bold text-center py-3 rounded-xl text-sm tracking-wide">
        ** REPEAT OFFENDERS ARE SUBJECT TO SUSPENSION — JUST DO IT! **
      </div>

      {/* Notify Modal */}
      {notifyModal && data && (
        <NotifyModal
          week={notifyModal.week}
          periodId={data.period.id}
          assignmentId={notifyModal.assignmentId}
          recipients={notifyRecipients}
          loading={notifyLoading}
          onClose={() => { setNotifyModal(null); setNotifyRecipients(null); }}
          onSent={() => selectedPeriodId && fetchData(selectedPeriodId)}
        />
      )}
    </div>
  );
}

interface NotifyRecipient {
  assignmentId: number;
  name: string;
  email: string;
  slot: string;
  subject: string;
  body: string;
}

function NotifyModal({ week, periodId, assignmentId, recipients, loading, onClose, onSent }: {
  week: string;
  periodId: number;
  assignmentId?: number;
  recipients: NotifyRecipient[] | null;
  loading: boolean;
  onClose: () => void;
  onSent: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number } | null>(null);

  const sendEmails = async () => {
    setSending(true);
    setSendResult(null);
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        period_id: periodId,
        week_date: week,
        target: assignmentId ?? 'pending',
        dry_run: false,
      }),
    });
    const d = await res.json();
    setSendResult({ sent: d.sent ?? 0, failed: d.failed ?? 0 });
    setSending(false);
    onSent();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Send Reminders</h2>
            <p className="text-xs text-gray-500 mt-0.5">Week of {format(parseISO(week), 'MMMM d, yyyy')}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg font-bold">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-24">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
            </div>
          ) : sendResult ? (
            <div className="text-center py-8 space-y-2">
              <CheckCircle2 className="mx-auto text-green-500 mb-2" size={32} />
              <p className="font-semibold text-gray-800">Reminders sent!</p>
              <p className="text-sm text-gray-500">
                <span className="text-green-700 font-medium">{sendResult.sent} sent</span>
                {sendResult.failed > 0 && (
                  <span className="text-red-600 font-medium"> · {sendResult.failed} failed</span>
                )}
              </p>
            </div>
          ) : !recipients || recipients.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="mx-auto text-green-500 mb-2" size={32} />
              <p className="font-medium text-gray-700">All checks complete for this week!</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">{recipients.length} member{recipients.length > 1 ? 's' : ''} pending:</p>
              {recipients.map(r => (
                <div key={r.assignmentId} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-900">{r.name}</p>
                      <p className="text-xs text-gray-500">{r.slot}</p>
                      {r.email
                        ? <span className="text-xs text-blue-500">{r.email}</span>
                        : <span className="text-xs text-red-400">No email on file</span>}
                    </div>
                    {r.email
                      ? <Mail size={14} className="text-gray-300 flex-shrink-0 mt-1" />
                      : <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-1" />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {recipients && recipients.length > 0 && !sendResult && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3">
            <button
              onClick={sendEmails}
              disabled={sending}
              className="flex items-center gap-2 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors font-medium"
            >
              {sending
                ? <><div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" /> Sending…</>
                : <><Mail size={14} /> Send {recipients.filter(r => r.email).length} Email{recipients.filter(r => r.email).length !== 1 ? 's' : ''}</>}
            </button>
            <span className="text-xs text-gray-400">via Mailgun · logged automatically</span>
          </div>
        )}
      </div>
    </div>
  );
}
