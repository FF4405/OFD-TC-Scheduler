'use client';

import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, GripVertical } from 'lucide-react';

interface Slot {
  id: number;
  apparatus_name: string;
  slot_type: string;
  rotation_note: string | null;
  rotation_labels: string | null;  // JSON string
  oic_name: string | null;
  sort_order: number;
}

const EMPTY = {
  apparatus_name: '',
  slot_type: '',
  rotation_note: '',
  rotation_labels: '',
  oic_name: '',
};

export default function SlotsPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Slot | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = () =>
    fetch('/api/slots').then(r => r.json()).then((d: Slot[]) => { setSlots(d); setLoading(false); });

  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(EMPTY); setEditing(null); setShowForm(true); };
  const openEdit = (s: Slot) => {
    const labels = s.rotation_labels ? JSON.parse(s.rotation_labels) as string[] : [];
    setForm({
      apparatus_name: s.apparatus_name,
      slot_type: s.slot_type,
      rotation_note: s.rotation_note ?? '',
      rotation_labels: labels.join(', '),
      oic_name: s.oic_name ?? '',
    });
    setEditing(s);
    setShowForm(true);
  };

  const save = async () => {
    setSaving(true);
    const labelsArr = form.rotation_labels.trim()
      ? form.rotation_labels.split(',').map(l => l.trim()).filter(Boolean)
      : null;
    const payload = {
      apparatus_name: form.apparatus_name,
      slot_type: form.slot_type,
      rotation_note: form.rotation_note || null,
      rotation_labels: labelsArr,
      oic_name: form.oic_name || null,
    };
    const url = editing ? `/api/slots/${editing.id}` : '/api/slots';
    const method = editing ? 'PATCH' : 'POST';
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setSaving(false);
    setShowForm(false);
    load();
  };

  const remove = async (s: Slot) => {
    if (!confirm(`Remove "${s.apparatus_name} ${s.slot_type}" slot?`)) return;
    await fetch(`/api/slots/${s.id}`, { method: 'DELETE' });
    load();
  };

  if (loading) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" /></div>;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assignment Slots</h1>
          <p className="text-sm text-gray-500 mt-1">The fixed weekly check positions</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
          <Plus size={16} /> Add Slot
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-yellow-400 border-b-2 border-yellow-500">
          <div className="grid grid-cols-12 text-xs font-bold text-gray-900 gap-2">
            <div className="col-span-3">Apparatus / Slot</div>
            <div className="col-span-3">OIC</div>
            <div className="col-span-3">Rotation</div>
            <div className="col-span-3">Sub-labels</div>
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {slots.map((s, i) => {
            const labels = s.rotation_labels ? (JSON.parse(s.rotation_labels) as string[]).join(' / ') : '—';
            return (
              <div key={s.id} className={`grid grid-cols-12 items-start gap-2 px-5 py-3.5 group ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:brightness-95 transition-all`}>
                <div className="col-span-3">
                  <div className="font-semibold text-gray-900 text-sm">{s.apparatus_name}</div>
                  <div className="text-xs text-gray-500">{s.slot_type}</div>
                </div>
                <div className="col-span-3 text-sm text-gray-700">{s.oic_name || '—'}</div>
                <div className="col-span-3 text-xs text-gray-500 italic">{s.rotation_note || '—'}</div>
                <div className="col-span-2 text-xs font-mono text-gray-500">
                  {labels}
                </div>
                <div className="col-span-1 flex gap-1 justify-end">
                  <button onClick={() => openEdit(s)}
                    className="p-1.5 text-gray-300 hover:text-gray-600 hover:bg-gray-100 rounded opacity-0 group-hover:opacity-100 transition-all">
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => remove(s)}
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-gray-400">
        Sub-labels are the alternating values shown in the weekly grid (e.g. Officer/Driver, Engine 23/Engine 24). Enter them comma-separated.
      </p>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{editing ? 'Edit Slot' : 'Add Slot'}</h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Apparatus Name *</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    value={form.apparatus_name}
                    onChange={e => setForm(f => ({ ...f, apparatus_name: e.target.value }))}
                    placeholder="Tower 21" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Slot Type *</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    value={form.slot_type}
                    onChange={e => setForm(f => ({ ...f, slot_type: e.target.value }))}
                    placeholder="SCBA" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">OIC</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  value={form.oic_name}
                  onChange={e => setForm(f => ({ ...f, oic_name: e.target.value }))}
                  placeholder="Lt. Jaimes" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Rotation Note</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  value={form.rotation_note}
                  onChange={e => setForm(f => ({ ...f, rotation_note: e.target.value }))}
                  placeholder="Alternate Sides Each Week" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Sub-labels <span className="text-gray-400 font-normal">(comma-separated, leave blank if none)</span>
                </label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  value={form.rotation_labels}
                  onChange={e => setForm(f => ({ ...f, rotation_labels: e.target.value }))}
                  placeholder="Officer, Driver" />
                <p className="text-xs text-gray-400 mt-1">
                  E.g. <code>Officer, Driver</code> or <code>Engine 23, Engine 24</code>
                </p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={save} disabled={saving || !form.apparatus_name || !form.slot_type}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50">
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Slot'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
