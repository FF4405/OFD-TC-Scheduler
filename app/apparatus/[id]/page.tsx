'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

interface CheckItem {
  id: number;
  apparatus_id: number;
  category: string;
  name: string;
  description: string | null;
  sort_order: number;
}

interface Apparatus {
  id: number;
  name: string;
  type: string;
  unit_number: string;
  year: number | null;
  make: string | null;
  model: string | null;
  status: string;
}

export default function ApparatusDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [apparatus, setApparatus] = useState<Apparatus | null>(null);
  const [items, setItems] = useState<CheckItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newItem, setNewItem] = useState({ category: '', name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());

  const fetchData = () => {
    Promise.all([
      fetch(`/api/apparatus/${id}`).then(r => r.json()),
      fetch(`/api/apparatus/${id}/items`).then(r => r.json()),
    ]).then(([app, itms]) => {
      setApparatus(app);
      setItems(itms);
      setLoading(false);
    });
  };

  useEffect(() => { fetchData(); }, [id]);

  const grouped = items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, CheckItem[]>);

  const categories = Object.keys(grouped).sort();

  const toggleCat = (cat: string) => {
    setCollapsedCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handleAddItem = async () => {
    if (!newItem.category || !newItem.name) return;
    setSaving(true);
    await fetch(`/api/apparatus/${id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newItem),
    });
    setSaving(false);
    setNewItem({ category: '', name: '', description: '' });
    setShowForm(false);
    fetchData();
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!confirm('Remove this check item?')) return;
    await fetch(`/api/apparatus/${id}/items?itemId=${itemId}`, { method: 'DELETE' });
    fetchData();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600"></div></div>;
  }

  if (!apparatus) return <div>Apparatus not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{apparatus.name} <span className="text-gray-400 font-normal">({apparatus.unit_number})</span></h1>
          <p className="text-gray-500 text-sm">
            {[apparatus.year, apparatus.make, apparatus.model].filter(Boolean).join(' ')} · {apparatus.type} · {items.length} check items
          </p>
        </div>
        <div className="ml-auto">
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Plus size={16} />
            Add Check Item
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-medium text-gray-900 mb-4">New Check Item</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                list="existing-cats"
                value={newItem.category}
                onChange={e => setNewItem(f => ({ ...f, category: e.target.value }))}
                placeholder="e.g. Cab & Controls"
              />
              <datalist id="existing-cats">
                {categories.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Item Name *</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                value={newItem.name}
                onChange={e => setNewItem(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Fuel Level"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                value={newItem.description}
                onChange={e => setNewItem(f => ({ ...f, description: e.target.value }))}
                placeholder="Check instructions..."
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              Cancel
            </button>
            <button
              onClick={handleAddItem}
              disabled={saving || !newItem.category || !newItem.name}
              className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Adding...' : 'Add Item'}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {categories.map(cat => (
          <div key={cat} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <button
              onClick={() => toggleCat(cat)}
              className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="font-semibold text-gray-800">{cat}</span>
                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{grouped[cat].length}</span>
              </div>
              {collapsedCats.has(cat) ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronUp size={16} className="text-gray-400" />}
            </button>
            {!collapsedCats.has(cat) && (
              <div className="divide-y divide-gray-50">
                {grouped[cat].map(item => (
                  <div key={item.id} className="flex items-start px-5 py-3 hover:bg-gray-50 group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{item.name}</p>
                      {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                    </div>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="ml-3 p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
