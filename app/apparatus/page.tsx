'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Truck, Edit2, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';

interface Apparatus {
  id: number;
  name: string;
  type: string;
  unit_number: string;
  year: number | null;
  make: string | null;
  model: string | null;
  status: string;
  item_count: number;
  open_issues: number;
}

const typeColors: Record<string, string> = {
  Engine: 'bg-red-100 text-red-700',
  Ladder: 'bg-orange-100 text-orange-700',
  Rescue: 'bg-blue-100 text-blue-700',
  Tanker: 'bg-cyan-100 text-cyan-700',
  Command: 'bg-purple-100 text-purple-700',
};

const TYPES = ['Engine', 'Ladder', 'Rescue', 'Tanker', 'Command', 'Brush', 'ATV', 'Boat', 'Other'];

const emptyForm = { name: '', type: 'Engine', unit_number: '', year: '', make: '', model: '' };

export default function ApparatusPage() {
  const [apparatus, setApparatus] = useState<Apparatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Apparatus | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchApparatus = () => {
    fetch('/api/apparatus')
      .then(r => r.json())
      .then(d => { setApparatus(d); setLoading(false); });
  };

  useEffect(() => { fetchApparatus(); }, []);

  const openNew = () => { setForm(emptyForm); setEditing(null); setShowForm(true); };
  const openEdit = (a: Apparatus) => {
    setForm({ name: a.name, type: a.type, unit_number: a.unit_number, year: a.year?.toString() ?? '', make: a.make ?? '', model: a.model ?? '' });
    setEditing(a);
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = { ...form, year: form.year ? parseInt(form.year) : null };
    if (editing) {
      await fetch(`/api/apparatus/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, status: editing.status }),
      });
    } else {
      await fetch('/api/apparatus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    setSaving(false);
    setShowForm(false);
    fetchApparatus();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this apparatus and all associated data?')) return;
    await fetch(`/api/apparatus/${id}`, { method: 'DELETE' });
    fetchApparatus();
  };

  const handleStatus = async (a: Apparatus) => {
    const newStatus = a.status === 'active' ? 'out_of_service' : 'active';
    await fetch(`/api/apparatus/${a.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...a, status: newStatus }),
    });
    fetchApparatus();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Apparatus</h1>
          <p className="text-gray-500 text-sm mt-1">{apparatus.length} units in fleet</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus size={16} />
          Add Apparatus
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {apparatus.map(a => (
          <div key={a.id} className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden ${a.status !== 'active' ? 'opacity-60' : ''}`}>
            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Truck className="text-gray-400" size={18} />
                    <span className="font-bold text-gray-900 text-lg">{a.unit_number}</span>
                  </div>
                  <p className="text-gray-700 font-medium mt-0.5">{a.name}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${typeColors[a.type] || 'bg-gray-100 text-gray-600'}`}>
                  {a.type}
                </span>
              </div>

              {(a.year || a.make || a.model) && (
                <p className="text-sm text-gray-500 mb-3">
                  {[a.year, a.make, a.model].filter(Boolean).join(' ')}
                </p>
              )}

              <div className="flex items-center gap-3 mb-4">
                <span className={`flex items-center gap-1 text-xs font-medium ${a.status === 'active' ? 'text-green-600' : 'text-red-500'}`}>
                  {a.status === 'active' ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
                  {a.status === 'active' ? 'In Service' : 'Out of Service'}
                </span>
                <span className="text-gray-300">|</span>
                <span className="text-xs text-gray-500">{a.item_count} check items</span>
                {a.open_issues > 0 && (
                  <>
                    <span className="text-gray-300">|</span>
                    <span className="text-xs text-red-500 font-medium">{a.open_issues} open issues</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/apparatus/${a.id}`}
                  className="flex-1 text-center text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg font-medium transition-colors"
                >
                  View Checklist
                </Link>
                <button
                  onClick={() => openEdit(a)}
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Edit2 size={15} />
                </button>
                <button
                  onClick={() => handleStatus(a)}
                  className={`p-1.5 rounded-lg transition-colors ${a.status === 'active' ? 'text-amber-500 hover:bg-amber-50' : 'text-green-500 hover:bg-green-50'}`}
                  title={a.status === 'active' ? 'Mark out of service' : 'Mark in service'}
                >
                  {a.status === 'active' ? <AlertTriangle size={15} /> : <CheckCircle size={15} />}
                </button>
                <button
                  onClick={() => handleDelete(a.id)}
                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{editing ? 'Edit Apparatus' : 'Add Apparatus'}</h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit Number *</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    value={form.unit_number}
                    onChange={e => setForm(f => ({ ...f, unit_number: e.target.value }))}
                    placeholder="E-1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  >
                    {TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Engine 1"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    value={form.year}
                    onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
                    placeholder="2020"
                    type="number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Make</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    value={form.make}
                    onChange={e => setForm(f => ({ ...f, make: e.target.value }))}
                    placeholder="Pierce"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    value={form.model}
                    onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                    placeholder="Enforcer"
                  />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name || !form.unit_number}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Apparatus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
