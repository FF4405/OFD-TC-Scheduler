'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, Users, CheckSquare, Square } from 'lucide-react';
import { format, startOfWeek, addWeeks } from 'date-fns';

interface Apparatus {
  id: number;
  name: string;
  type: string;
  unit_number: string;
  status: string;
}

const FIREFIGHTERS = [
  'A-Shift', 'B-Shift', 'C-Shift',
  'Lt. Johnson', 'Lt. Davis', 'Capt. Smith',
  'FF Rodriguez', 'FF Williams', 'FF Brown',
];

export default function NewSchedulePage() {
  const router = useRouter();
  const [apparatus, setApparatus] = useState<Apparatus[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [weekStart, setWeekStart] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/apparatus')
      .then(r => r.json())
      .then((a: Apparatus[]) => {
        setApparatus(a.filter(ap => ap.status === 'active'));
      });

    // Default to current week Monday
    const now = new Date();
    const monday = startOfWeek(now, { weekStartsOn: 1 });
    setWeekStart(format(monday, 'yyyy-MM-dd'));
  }, []);

  const toggleId = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(apparatus.map(a => a.id)));
  const clearAll = () => setSelectedIds(new Set());

  const weekOptions = Array.from({ length: 8 }, (_, i) => {
    const monday = startOfWeek(addWeeks(new Date(), i - 1), { weekStartsOn: 1 });
    return format(monday, 'yyyy-MM-dd');
  });

  const handleSubmit = async () => {
    if (!weekStart || selectedIds.size === 0) return;
    setSaving(true);
    await fetch('/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        week_start: weekStart,
        apparatus_ids: Array.from(selectedIds),
        assigned_to: assignedTo || null,
      }),
    });
    setSaving(false);
    router.push('/schedules');
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Schedule</h1>
          <p className="text-gray-500 text-sm mt-1">Schedule weekly apparatus checks</p>
        </div>
      </div>

      {/* Week Selection */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="text-red-500" size={18} />
          <h2 className="font-semibold text-gray-900">Select Week</h2>
        </div>
        <select
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          value={weekStart}
          onChange={e => setWeekStart(e.target.value)}
        >
          {weekOptions.map(w => (
            <option key={w} value={w}>
              Week of {format(new Date(w + 'T00:00:00'), 'MMMM d, yyyy')}
            </option>
          ))}
        </select>
      </div>

      {/* Assignment */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="text-red-500" size={18} />
          <h2 className="font-semibold text-gray-900">Assign To (Optional)</h2>
        </div>
        <input
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          list="ff-list"
          value={assignedTo}
          onChange={e => setAssignedTo(e.target.value)}
          placeholder="e.g. A-Shift, Lt. Johnson..."
        />
        <datalist id="ff-list">
          {FIREFIGHTERS.map(f => <option key={f} value={f} />)}
        </datalist>
      </div>

      {/* Apparatus Selection */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Select Apparatus</h2>
          <div className="flex gap-2">
            <button onClick={selectAll} className="text-xs text-red-600 hover:underline flex items-center gap-1">
              <CheckSquare size={12} /> All
            </button>
            <button onClick={clearAll} className="text-xs text-gray-500 hover:underline flex items-center gap-1">
              <Square size={12} /> None
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {apparatus.map(a => (
            <label key={a.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              selectedIds.has(a.id) ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:bg-gray-50'
            }`}>
              <input
                type="checkbox"
                checked={selectedIds.has(a.id)}
                onChange={() => toggleId(a.id)}
                className="accent-red-600 w-4 h-4"
              />
              <div className="flex-1">
                <span className="font-medium text-gray-900">{a.name}</span>
                <span className="text-gray-400 text-sm ml-2">({a.unit_number})</span>
              </div>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{a.type}</span>
            </label>
          ))}
          {apparatus.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-4">No active apparatus found.</p>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-3">{selectedIds.size} apparatus selected</p>
      </div>

      <div className="flex gap-3 justify-end">
        <button onClick={() => router.back()} className="px-5 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || selectedIds.size === 0 || !weekStart}
          className="px-5 py-2.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {saving ? 'Creating...' : `Create Schedule (${selectedIds.size} apparatus)`}
        </button>
      </div>
    </div>
  );
}
