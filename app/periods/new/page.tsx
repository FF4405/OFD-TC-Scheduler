'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, AlertTriangle } from 'lucide-react';
import { format, startOfWeek, addWeeks } from 'date-fns';

interface Member {
  id: number;
  line_number: string | null;
  name: string;
  email: string | null;
  active: number;
  status: string;
}

interface Slot {
  id: number;
  apparatus_name: string;
  slot_type: string;
  rotation_note: string | null;
  oic_name: string | null;
  sort_order: number;
}

interface CurrentAssignment {
  slot_id: number;
  member_id: number | null;
  member_name: string | null;
}

export default function NewPeriodPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [currentAssignments, setCurrentAssignments] = useState<Map<number, number | null>>(new Map());
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [weekCount, setWeekCount] = useState(4);
  const [assignments, setAssignments] = useState<Map<number, number | null>>(new Map());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Default start = next Monday
    const monday = startOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 });
    const d = format(monday, 'yyyy-MM-dd');
    setStartDate(d);
    setName(format(monday, 'MMMM yyyy'));

    Promise.all([fetch('/api/members').then(r => r.json()), fetch('/api/slots').then(r => r.json())])
      .then(([m, s]) => {
        setMembers((m as Member[]).filter(x => x.active && x.status !== 'retired' && x.name !== 'NOT ASSIGNED'));
        setSlots(s as Slot[]);
      });

    // Load current period assignments as defaults
    fetch('/api/periods').then(r => r.json()).then(async (periods: { id: number; is_current: number }[]) => {
      const current = periods.find(p => p.is_current);
      if (current) {
        const res = await fetch(`/api/periods/${current.id}`);
        const d = await res.json();
        const map = new Map<number, number | null>();
        for (const row of d.rows || []) {
          map.set(row.slot_id, row.member_id);
        }
        setCurrentAssignments(map);
        setAssignments(new Map(map)); // default to same assignments
      }
    });
  }, []);

  const setMember = (slotId: number, memberId: number | null) => {
    setAssignments(prev => new Map(prev).set(slotId, memberId));
  };

  const handleCreate = async () => {
    if (!name || !startDate) return;
    setSaving(true);
    const assignArr = Array.from(assignments.entries()).map(([slot_id, member_id]) => ({
      slot_id, member_id,
    }));
    const res = await fetch('/api/periods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, start_date: startDate, week_count: weekCount, assignments: assignArr }),
    });
    const period = await res.json();
    router.push(`/periods/${period.id}`);
  };

  const weekOptions = Array.from({ length: 10 }, (_, i) => {
    const monday = startOfWeek(addWeeks(new Date(), i), { weekStartsOn: 1 });
    return format(monday, 'yyyy-MM-dd');
  });

  // Group slots by OIC
  const oicGroups: { oic: string; slots: Slot[] }[] = [];
  for (const slot of slots) {
    const oic = slot.oic_name || '';
    const last = oicGroups[oicGroups.length - 1];
    if (last && last.oic === oic) last.slots.push(slot);
    else oicGroups.push({ oic, slots: [slot] });
  }

  const unassigned = Array.from(assignments.values()).filter(v => v === null).length;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Period</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create a new monthly assignment period</p>
        </div>
      </div>

      {/* Period details */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Calendar className="text-red-500" size={16} />
          <h2 className="font-semibold text-gray-800">Period Details</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">Period Name *</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="April 2026"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Start Date (Monday) *</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            >
              {weekOptions.map(w => (
                <option key={w} value={w}>{format(new Date(w + 'T00:00:00'), 'MMMM d, yyyy')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Number of Weeks</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              value={weekCount}
              onChange={e => setWeekCount(Number(e.target.value))}
            >
              {[4, 5, 6].map(n => <option key={n} value={n}>{n} weeks</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Assignments */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-yellow-400 border-b-2 border-yellow-500">
          <div className="grid grid-cols-12 gap-2 text-xs font-bold text-gray-900">
            <div className="col-span-2">OIC</div>
            <div className="col-span-4">Assignment</div>
            <div className="col-span-6">Assign Member</div>
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {oicGroups.map(({ oic, slots: oicSlots }, gi) =>
            oicSlots.map((slot, si) => {
              const memberId = assignments.get(slot.id) ?? null;
              const prevMemberId = currentAssignments.get(slot.id);
              const changed = memberId !== prevMemberId;
              return (
                <div key={slot.id} className={`grid grid-cols-12 gap-2 items-center px-5 py-3 ${gi % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <div className="col-span-2 text-sm font-semibold text-gray-700">{si === 0 ? oic : ''}</div>
                  <div className="col-span-4">
                    <div className="font-medium text-gray-900 text-sm">{slot.apparatus_name}</div>
                    <div className="text-xs text-gray-500">{slot.slot_type}</div>
                  </div>
                  <div className="col-span-6 flex items-center gap-2">
                    <select
                      className={`flex-1 border rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 ${
                        memberId === null ? 'border-amber-300 bg-amber-50' :
                        changed ? 'border-blue-300 bg-blue-50' : 'border-gray-300 bg-white'
                      }`}
                      value={memberId ?? ''}
                      onChange={e => setMember(slot.id, e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">— Unassigned —</option>
                      {members.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.line_number ? `[${m.line_number}] ` : ''}{m.name}
                        </option>
                      ))}
                    </select>
                    {changed && prevMemberId && (
                      <span className="text-xs text-blue-500 whitespace-nowrap">changed</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {unassigned > 0 && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
          <AlertTriangle size={14} /> {unassigned} slot{unassigned > 1 ? 's' : ''} still unassigned
        </div>
      )}

      <div className="flex gap-3 justify-end">
        <button onClick={() => router.back()} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          Cancel
        </button>
        <button
          onClick={handleCreate}
          disabled={saving || !name || !startDate}
          className="px-5 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {saving ? 'Creating…' : 'Create Period & Set as Current'}
        </button>
      </div>
    </div>
  );
}
