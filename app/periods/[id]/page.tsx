'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, UserCheck, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface Member {
  id: number;
  line_number: string | null;
  name: string;
  email: string | null;
  status: string;
  active: number;
}

interface Slot {
  id: number;
  apparatus_name: string;
  slot_type: string;
  rotation_note: string | null;
  oic_name: string | null;
  sort_order: number;
}

interface Row {
  id: number;
  slot_id: number;
  member_id: number | null;
  member_name: string | null;
  apparatus_name: string;
  slot_type: string;
  oic_name: string | null;
}

interface Period {
  id: number;
  name: string;
  start_date: string;
  week_count: number;
  is_current: number;
}

export default function PeriodDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [period, setPeriod] = useState<Period | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [assignments, setAssignments] = useState<Map<number, number | null>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const [pRes, mRes, sRes] = await Promise.all([
      fetch(`/api/periods/${id}`),
      fetch('/api/members'),
      fetch('/api/slots'),
    ]);
    const pData = await pRes.json();
    const mData: Member[] = await mRes.json();
    const sData: Slot[] = await sRes.json();

    setPeriod(pData.period);
    setRows(pData.rows || []);
    setMembers(mData.filter(m => m.active && m.status !== 'retired' && m.name !== 'NOT ASSIGNED'));
    setSlots(sData);

    // Initialize assignments map from existing rows
    const map = new Map<number, number | null>();
    for (const row of pData.rows || []) {
      map.set(row.slot_id, row.member_id);
    }
    // Fill any missing slots with null
    for (const slot of sData) {
      if (!map.has(slot.id)) map.set(slot.id, null);
    }
    setAssignments(map);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const saveAssignments = async () => {
    setSaving(true);
    const assignArr = Array.from(assignments.entries()).map(([slot_id, member_id]) => ({
      slot_id, member_id,
    }));
    await fetch(`/api/periods/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: period?.name,
        is_current: period?.is_current,
        assignments: assignArr,
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    load();
  };

  const setMember = (slotId: number, memberId: number | null) => {
    setAssignments(prev => new Map(prev).set(slotId, memberId));
  };

  if (loading) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" /></div>;
  if (!period) return <div className="text-center py-20 text-gray-500">Period not found.</div>;

  // Group slots by OIC (same as schedule view)
  const oicGroups: { oic: string; slots: Slot[] }[] = [];
  for (const slot of slots) {
    const oic = slot.oic_name || '';
    const last = oicGroups[oicGroups.length - 1];
    if (last && last.oic === oic) last.slots.push(slot);
    else oicGroups.push({ oic, slots: [slot] });
  }

  const unassignedCount = Array.from(assignments.values()).filter(v => v === null).length;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{period.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Starts {period.start_date} · {period.week_count} weeks
            {period.is_current ? <span className="ml-2 text-green-600 font-medium">· Current Period</span> : ''}
          </p>
        </div>
        <button
          onClick={saveAssignments}
          disabled={saving}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            saved ? 'bg-green-600 text-white' : 'bg-red-600 hover:bg-red-700 text-white'
          } disabled:opacity-50`}
        >
          <Save size={15} />
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Assignments'}
        </button>
      </div>

      {unassignedCount > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm text-amber-800">
          <AlertTriangle size={15} />
          {unassignedCount} slot{unassignedCount > 1 ? 's are' : ' is'} unassigned
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-yellow-400 border-b-2 border-yellow-500">
          <div className="grid grid-cols-12 gap-2 text-xs font-bold text-gray-900">
            <div className="col-span-2">OIC</div>
            <div className="col-span-5">Assignment</div>
            <div className="col-span-5">Assigned Member</div>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {oicGroups.map(({ oic, slots: oicSlots }, gi) => (
            oicSlots.map((slot, si) => {
              const memberId = assignments.get(slot.id) ?? null;
              const member = members.find(m => m.id === memberId) || null;
              const isFirstInGroup = si === 0;

              return (
                <div key={slot.id} className={`grid grid-cols-12 gap-2 items-center px-5 py-3 ${gi % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:brightness-95 transition-all`}>
                  <div className="col-span-2 text-sm font-semibold text-gray-700">
                    {isFirstInGroup ? oic : ''}
                  </div>
                  <div className="col-span-5">
                    <div className="font-medium text-gray-900 text-sm">{slot.apparatus_name}</div>
                    <div className="text-xs text-gray-500">{slot.slot_type}</div>
                    {slot.rotation_note && (
                      <div className="text-xs text-gray-400 italic">{slot.rotation_note}</div>
                    )}
                  </div>
                  <div className="col-span-5">
                    <select
                      className={`w-full border rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 ${
                        memberId === null ? 'border-red-300 bg-red-50 text-red-600' : 'border-gray-300 bg-white text-gray-900'
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
                    {member?.email && (
                      <p className="text-xs text-gray-400 mt-0.5 pl-0.5">{member.email}</p>
                    )}
                  </div>
                </div>
              );
            })
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-500">
        <UserCheck size={15} />
        <span>Changes are not saved until you click <strong>Save Assignments</strong>.</span>
      </div>

      <div className="pt-2 border-t border-gray-200">
        <Link href="/slots" className="text-sm text-red-600 hover:underline">Manage assignment slots →</Link>
      </div>
    </div>
  );
}
