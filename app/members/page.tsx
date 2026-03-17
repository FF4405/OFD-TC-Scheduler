'use client';

import { useEffect, useState } from 'react';
import { UserPlus, Edit2, Trash2, Mail, AlertTriangle } from 'lucide-react';

interface Member {
  id: number;
  line_number: string | null;
  name: string;
  email: string | null;
  status: string;
  remarks: string | null;
  active: number;
}

const STATUS_OPTS = [
  { value: 'active',   label: 'Active',      color: 'bg-green-100 text-green-800' },
  { value: 'officer',  label: 'Officer',     color: 'bg-blue-100 text-blue-800' },
  { value: '50yr',     label: '50-Year',     color: 'bg-purple-100 text-purple-800' },
  { value: 'inactive', label: 'Inactive',    color: 'bg-gray-100 text-gray-600' },
  { value: 'retired',  label: 'Retired',     color: 'bg-red-100 text-red-700' },
];

const statusColor = (s: string) =>
  STATUS_OPTS.find(o => o.value === s)?.color ?? 'bg-gray-100 text-gray-600';
const statusLabel = (s: string) =>
  STATUS_OPTS.find(o => o.value === s)?.label ?? s;

const EMPTY = { line_number: '', name: '', email: '', status: 'active', remarks: '', active: true };

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () =>
    fetch('/api/members').then(r => r.json()).then((d: Member[]) => { setMembers(d); setLoading(false); });

  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(EMPTY); setEditing(null); setError(''); setShowForm(true); };
  const openEdit = (m: Member) => {
    setForm({ line_number: m.line_number ?? '', name: m.name, email: m.email ?? '',
      status: m.status, remarks: m.remarks ?? '', active: m.active === 1 });
    setEditing(m);
    setError('');
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setError('');
    const payload = { ...form, active: form.active ? 1 : 0 };
    const url = editing ? `/api/members/${editing.id}` : '/api/members';
    const method = editing ? 'PATCH' : 'POST';
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setSaving(false);
    setShowForm(false);
    load();
  };

  const remove = async (m: Member) => {
    if (!confirm(`Remove ${m.name} from the roster?`)) return;
    const res = await fetch(`/api/members/${m.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error || 'Cannot delete this member.');
      return;
    }
    load();
  };

  const filtered = members.filter(m => {
    const matchSearch = search === '' ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (m.line_number || '').includes(search);
    const matchStatus = filterStatus === 'all' || m.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const active = filtered.filter(m => m.active && m.status !== 'retired');
  const inactive = filtered.filter(m => !m.active || m.status === 'retired');

  if (loading) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" /></div>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Members</h1>
          <p className="text-gray-500 text-sm mt-1">{members.filter(m => m.active && m.status !== 'retired').length} active members</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
          <UserPlus size={16} /> Add Member
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 w-56"
          placeholder="Search name, email, line #…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="all">All statuses</option>
          {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <MemberTable members={active} onEdit={openEdit} onDelete={remove} title="Active Roster" />
      {inactive.length > 0 && (
        <MemberTable members={inactive} onEdit={openEdit} onDelete={remove} title="Inactive / Retired" dim />
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{editing ? 'Edit Member' : 'Add Member'}</h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <AlertTriangle size={14} /> {error}
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Line #</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    value={form.line_number} onChange={e => setForm(f => ({ ...f, line_number: e.target.value }))}
                    placeholder="43" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="J. Koth III" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="jkoth@oradellfire.org" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Remarks</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                    placeholder="P&A, etc." />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.active}
                  onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                  className="accent-red-600 w-4 h-4" />
                <span className="text-sm text-gray-700">Active member</span>
              </label>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={save} disabled={saving || !form.name.trim()}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50">
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MemberTable({ members, onEdit, onDelete, title, dim }: {
  members: Member[];
  onEdit: (m: Member) => void;
  onDelete: (m: Member) => void;
  title: string;
  dim?: boolean;
}) {
  if (members.length === 0) return null;
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ${dim ? 'opacity-70' : ''}`}>
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
        <h3 className="font-semibold text-gray-700 text-sm">{title} <span className="text-gray-400 font-normal">({members.length})</span></h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-xs text-gray-500 font-medium">
            <th className="px-4 py-2.5 text-left w-16">Line #</th>
            <th className="px-4 py-2.5 text-left">Name</th>
            <th className="px-4 py-2.5 text-left">Email</th>
            <th className="px-4 py-2.5 text-left w-24">Status</th>
            <th className="px-4 py-2.5 text-left w-20">Remarks</th>
            <th className="px-4 py-2.5 w-20"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {members.map(m => (
            <tr key={m.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-2.5 text-gray-400 font-mono text-xs">{m.line_number || '—'}</td>
              <td className="px-4 py-2.5 font-medium text-gray-900">{m.name}</td>
              <td className="px-4 py-2.5">
                {m.email ? (
                  <a href={`mailto:${m.email}`} className="flex items-center gap-1 text-blue-500 hover:underline">
                    <Mail size={12} /> {m.email}
                  </a>
                ) : <span className="text-gray-300">—</span>}
              </td>
              <td className="px-4 py-2.5">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(m.status)}`}>
                  {statusLabel(m.status)}
                </span>
              </td>
              <td className="px-4 py-2.5 text-xs text-gray-500">{m.remarks || '—'}</td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-1 justify-end">
                  <button onClick={() => onEdit(m)}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => onDelete(m)}
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
