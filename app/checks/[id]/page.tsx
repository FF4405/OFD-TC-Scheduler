'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle, XCircle, Minus, AlertTriangle, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface CheckRecord {
  id: number;
  check_item_id: number;
  item_name: string;
  category: string;
  description: string | null;
  result: 'pending' | 'pass' | 'fail' | 'na';
  notes: string | null;
  checked_at: string | null;
  checked_by: string | null;
}

interface Schedule {
  id: number;
  apparatus_id: number;
  week_start: string;
  apparatus_name: string;
  unit_number: string;
  apparatus_type: string;
  year: number | null;
  make: string | null;
  model: string | null;
  status: string;
  assigned_to: string | null;
}

interface CheckData {
  schedule: Schedule;
  records: CheckRecord[];
}

const resultConfig = {
  pass: { label: 'Pass', bg: 'bg-green-600', border: 'border-green-600', text: 'text-green-600', icon: CheckCircle },
  fail: { label: 'Fail', bg: 'bg-red-600', border: 'border-red-600', text: 'text-red-600', icon: XCircle },
  na: { label: 'N/A', bg: 'bg-gray-400', border: 'border-gray-400', text: 'text-gray-500', icon: Minus },
  pending: { label: '—', bg: 'bg-gray-100', border: 'border-gray-200', text: 'text-gray-400', icon: Minus },
};

const FIREFIGHTERS = [
  'A-Shift', 'B-Shift', 'C-Shift',
  'Lt. Johnson', 'Lt. Davis', 'Capt. Smith',
  'FF Rodriguez', 'FF Williams', 'FF Brown',
];

export default function CheckPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState<CheckData | null>(null);
  const [records, setRecords] = useState<Map<number, CheckRecord>>(new Map());
  const [checkedBy, setCheckedBy] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const [showIssueModal, setShowIssueModal] = useState<number | null>(null);
  const [issueForm, setIssueForm] = useState({ title: '', description: '', severity: 'medium' });

  const fetchData = useCallback(() => {
    fetch(`/api/schedules/${id}`)
      .then(r => r.json())
      .then((d: CheckData) => {
        setData(d);
        const map = new Map<number, CheckRecord>();
        d.records.forEach(r => map.set(r.check_item_id, r));
        setRecords(map);
        if (d.schedule.assigned_to) setCheckedBy(d.schedule.assigned_to);
      });
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const setResult = (itemId: number, result: 'pass' | 'fail' | 'na') => {
    setRecords(prev => {
      const next = new Map(prev);
      const existing = next.get(itemId);
      if (existing) {
        next.set(itemId, { ...existing, result, notes: existing.notes });
      }
      return next;
    });
    if (result === 'fail') {
      const rec = records.get(itemId);
      setIssueForm({ title: `${rec?.item_name || 'Item'} - Failed Check`, description: '', severity: 'medium' });
      setShowIssueModal(itemId);
    }
  };

  const setNotes = (itemId: number, notes: string) => {
    setRecords(prev => {
      const next = new Map(prev);
      const existing = next.get(itemId);
      if (existing) next.set(itemId, { ...existing, notes });
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = Array.from(records.values()).map(r => ({
      check_item_id: r.check_item_id,
      result: r.result,
      notes: r.notes,
    }));
    await fetch(`/api/schedules/${id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: payload, checked_by: checkedBy }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    fetchData();
  };

  const handleReportIssue = async (itemId: number) => {
    if (!data) return;
    await fetch('/api/issues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apparatus_id: data.schedule.apparatus_id,
        schedule_id: parseInt(id as string),
        check_item_id: itemId,
        ...issueForm,
        reported_by: checkedBy,
      }),
    });
    setShowIssueModal(null);
  };

  if (!data) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600"></div></div>;
  }

  const { schedule } = data;
  const allRecords = Array.from(records.values());
  const grouped = allRecords.reduce((acc, r) => {
    if (!acc[r.category]) acc[r.category] = [];
    acc[r.category].push(r);
    return acc;
  }, {} as Record<string, CheckRecord[]>);
  const categories = Object.keys(grouped).sort();

  const total = allRecords.length;
  const passed = allRecords.filter(r => r.result === 'pass').length;
  const failed = allRecords.filter(r => r.result === 'fail').length;
  const na = allRecords.filter(r => r.result === 'na').length;
  const checked = passed + failed + na;
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0;

  const isReadOnly = schedule.status === 'completed' || schedule.status === 'issues';

  const toggleCat = (cat: string) => {
    setCollapsedCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => router.back()} className="mt-1 p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {schedule.apparatus_name}
                <span className="text-gray-400 font-normal ml-2 text-xl">({schedule.unit_number})</span>
              </h1>
              <p className="text-gray-500 text-sm mt-0.5">
                Week of {format(parseISO(schedule.week_start), 'MMMM d, yyyy')} ·{' '}
                {[schedule.year, schedule.make, schedule.model].filter(Boolean).join(' ')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {!isReadOnly && (
                <>
                  <input
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    list="ff-list2"
                    value={checkedBy}
                    onChange={e => setCheckedBy(e.target.value)}
                    placeholder="Checked by..."
                  />
                  <datalist id="ff-list2">
                    {FIREFIGHTERS.map(f => <option key={f} value={f} />)}
                  </datalist>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                      saved ? 'bg-green-600 text-white' : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                  >
                    <Save size={15} />
                    {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Progress'}
                  </button>
                </>
              )}
              {isReadOnly && (
                <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  schedule.status === 'issues' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                }`}>
                  {schedule.status === 'issues' ? 'Completed with Issues' : 'Completed'}
                </span>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">{checked}/{total} items checked ({pct}%)</span>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1 text-green-600"><CheckCircle size={12} /> {passed} pass</span>
                <span className="flex items-center gap-1 text-red-500"><XCircle size={12} /> {failed} fail</span>
                <span className="flex items-center gap-1 text-gray-400"><Minus size={12} /> {na} N/A</span>
              </div>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5 flex overflow-hidden">
              <div className="bg-green-500 h-full" style={{ width: `${total > 0 ? (passed/total)*100 : 0}%` }} />
              <div className="bg-red-500 h-full" style={{ width: `${total > 0 ? (failed/total)*100 : 0}%` }} />
              <div className="bg-gray-300 h-full" style={{ width: `${total > 0 ? (na/total)*100 : 0}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Check Items by Category */}
      <div className="space-y-3">
        {categories.map(cat => {
          const catRecords = grouped[cat];
          const catPassed = catRecords.filter(r => r.result === 'pass').length;
          const catFailed = catRecords.filter(r => r.result === 'fail').length;
          const catPending = catRecords.filter(r => r.result === 'pending').length;
          const isCollapsed = collapsedCats.has(cat);

          return (
            <div key={cat} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <button
                onClick={() => toggleCat(cat)}
                className={`w-full flex items-center justify-between px-5 py-3.5 transition-colors ${
                  catFailed > 0 ? 'bg-red-50' : catPending === 0 ? 'bg-green-50' : 'bg-gray-50'
                } hover:brightness-95`}
              >
                <div className="flex items-center gap-3">
                  {catFailed > 0 ? (
                    <AlertTriangle size={16} className="text-red-500" />
                  ) : catPending === 0 ? (
                    <CheckCircle size={16} className="text-green-500" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                  )}
                  <span className="font-semibold text-gray-800">{cat}</span>
                  <span className="text-xs text-gray-500">
                    {catRecords.length - catPending}/{catRecords.length}
                    {catFailed > 0 && <span className="text-red-500 ml-1">· {catFailed} failed</span>}
                  </span>
                </div>
                {isCollapsed ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronUp size={16} className="text-gray-400" />}
              </button>

              {!isCollapsed && (
                <div className="divide-y divide-gray-50">
                  {catRecords.map(rec => {
                    const current = records.get(rec.check_item_id) || rec;
                    return (
                      <div key={rec.check_item_id} className={`px-5 py-4 ${current.result === 'fail' ? 'bg-red-50/50' : ''}`}>
                        <div className="flex items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{rec.item_name}</p>
                            {rec.description && <p className="text-xs text-gray-500 mt-0.5">{rec.description}</p>}
                            {current.checked_at && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                Checked {format(parseISO(current.checked_at), 'MMM d h:mm a')}
                                {current.checked_by && ` by ${current.checked_by}`}
                              </p>
                            )}
                          </div>

                          {/* Result Buttons */}
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {(['pass', 'fail', 'na'] as const).map(r => {
                              const cfg = resultConfig[r];
                              const isActive = current.result === r;
                              return (
                                <button
                                  key={r}
                                  onClick={() => !isReadOnly && setResult(rec.check_item_id, r)}
                                  disabled={isReadOnly}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                    isActive
                                      ? `${cfg.bg} text-white ${cfg.border} shadow-sm`
                                      : `bg-white border-gray-200 text-gray-400 ${isReadOnly ? '' : 'hover:border-gray-400 hover:text-gray-600'}`
                                  } disabled:cursor-default`}
                                >
                                  {cfg.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Notes */}
                        {(current.result !== 'pending' || current.notes) && (
                          <div className="mt-2 ml-0">
                            {isReadOnly ? (
                              current.notes && <p className="text-xs text-gray-500 italic">{current.notes}</p>
                            ) : (
                              <input
                                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-400 placeholder-gray-300"
                                value={current.notes || ''}
                                onChange={e => setNotes(rec.check_item_id, e.target.value)}
                                placeholder="Add notes..."
                              />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!isReadOnly && checked > 0 && (
        <div className="sticky bottom-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-3.5 rounded-xl font-semibold shadow-lg transition-colors"
          >
            <Save size={18} />
            {saving ? 'Saving...' : `Save Check (${checked}/${total} items)`}
          </button>
        </div>
      )}

      {/* Issue Report Modal */}
      {showIssueModal !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <AlertTriangle className="text-red-500" size={18} />
              <h2 className="font-semibold text-gray-900">Report Issue</h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Issue Title</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  value={issueForm.title}
                  onChange={e => setIssueForm(f => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 h-20 resize-none"
                  value={issueForm.description}
                  onChange={e => setIssueForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the issue..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  value={issueForm.severity}
                  onChange={e => setIssueForm(f => ({ ...f, severity: e.target.value }))}
                >
                  <option value="low">Low - Minor, no impact on operations</option>
                  <option value="medium">Medium - Should be addressed soon</option>
                  <option value="high">High - Needs prompt attention</option>
                  <option value="critical">Critical - Unit out of service</option>
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <button onClick={() => setShowIssueModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                Skip
              </button>
              <button
                onClick={() => handleReportIssue(showIssueModal)}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium"
              >
                Report Issue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
