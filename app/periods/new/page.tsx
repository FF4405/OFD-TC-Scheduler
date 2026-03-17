'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, AlertTriangle, Info } from 'lucide-react';
import { format } from 'date-fns';
import { upcomingSecondMondays, getPeriodWeeks, getPeriodEndDate } from '@/lib/dates';

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

export default function NewPeriodPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [currentAssignments, setCurrentAssignments] = useState<Map<number, number | null>>(new Map());
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [assignments, setAssignments] = useState<Map<number, number | null>>(new Map());
  const [saving, setSaving] = useState(false);

  // The 2nd-Monday options for the next 6 months
  const secondMondays = upcomingSecondMondays(6);

  // Derived from startDate via the rule (no manual override needed)
  const weekDates = startDate ? getPeriodWeeks(startDate) : [];
  const endDate   = startDate ? getPeriodEndDate(startDate) : '';

  useEffect(() => {
    if (secondMondays.length > 0 && !startDate) {
      const d = secondMondays[0];
      setStartDate(d);
      setName(format(new Date(d + 'T00:00:00'), 'MMMM yyyy'));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    Promise.all([fetch('/api/members').then(r => r.json()), fetch('/api/slots').then(r => r.json())])
      .then(([m, s]) => {
        setMembers((m as Member[]).filter(x => x.active && x.status !== 'retired' && x.name !== 'NOT ASSIGNED'));
        setSlots(s as Slot[]);
      });

    fetch('/api/periods').then(r => r.json()).then(async (periods: { id: number; is_current: number }[]) => {
      const current = periods.find(p => p.is_current);
      if (current) {
        const res = await fetch(`/api/periods/${current.id}`);
        const d = await res.json();
        const map = new Map<number, number | null>();
        for (const row of d.rows || []) map.set(row.slot_id, row.member_id);
        setCurrentAssignments(map);
        setAssignments(new Map(map));
      }
    });
  }, []);

  const handleStartDateChange = (d: string) => {
    setStartDate(d);
    setName(format(new Date(d + 'T00:00:00'), 'MMMM yyyy'));
  };

  const setMember = (slotId: number, memberId: number | null) =>
    setAssignments(prev => new Map(prev).set(slotId, memberId));

  const handleCreate = async () => {
    if (!name || !startDate) return;
    setSaving(true);
    const assignArr = Array.from(assignments.entries()).map(([slot_id, member_id]) => ({ slot_id, member_id }));
    const res = await fetch('/api/periods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, start_date: startDate, week_count: weekDates.length, assignments: assignArr }),
    });
    const period = await res.json();
    router.push(`/periods/${period.id}`);
  };

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

      {/* Rule callout */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
        <Info size={16} className="mt-0.5 flex-shrink-0 text-blue-500" />
        <div>
          <span className="font-semibold">Periods run from the 2nd Monday of each month</span> through the
          Monday before the next month&apos;s 2nd Monday. The number of weeks is calculated automatically.
        </div>
      </div>

      {/* Period details */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Calendar className="text-red-500" size={16} />
          <h2 className="font-semibold text-gray-800">Period Details</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Period Name *</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="April 2026"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Start Date <span className="text-gray-400 font-normal">(2nd Monday of month)</span>
            </label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              value={startDate}
              onChange={e => handleStartDateChange(e.target.value)}
            >
              {secondMondays.map(d => (
                <option key={d} value={d}>
                  {format(new Date(d + 'T00:00:00'), 'MMMM d, yyyy')} — 2nd Monday
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Auto-calculated range */}
        {startDate && endDate && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-700 flex items-center gap-4">
            <span>
              <span className="font-medium">Dates:</span>{' '}
              {format(new Date(startDate + 'T00:00:00'), 'MMM d')} – {format(new Date(endDate + 'T00:00:00'), 'MMM d, yyyy')}
            </span>
            <span className="text-gray-400">·</span>
            <span className="font-medium text-gray-900">{weekDates.length} weeks</span>
            <span className="text-gray-400">·</span>
            <span className="text-xs text-gray-500">
              Mondays: {weekDates.map(d => format(new Date(d + 'T00:00:00'), 'M/d')).join(', ')}
            </span>
          </div>
        )}
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
