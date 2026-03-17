'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format, parseISO, addWeeks } from 'date-fns';
import { Plus, CheckCircle2, Calendar, ChevronRight } from 'lucide-react';

interface Period {
  id: number;
  name: string;
  start_date: string;
  week_count: number;
  is_current: number;
  slot_count: number;
  total_completions: number;
}

export default function PeriodsPage() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/periods').then(r => r.json()).then((d: Period[]) => {
      setPeriods(d);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" /></div>;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Periods</h1>
          <p className="text-sm text-gray-500 mt-1">Monthly assignment periods</p>
        </div>
        <Link href="/periods/new"
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
          <Plus size={16} /> New Period
        </Link>
      </div>

      {periods.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <Calendar className="mx-auto text-gray-300 mb-3" size={48} />
          <h3 className="font-semibold text-gray-700">No periods yet</h3>
          <p className="text-sm text-gray-500 mt-1 mb-4">Create your first period to get started.</p>
          <Link href="/periods/new" className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm">
            <Plus size={14} /> Create Period
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
          {periods.map(p => {
            const endDate = addWeeks(parseISO(p.start_date), p.week_count - 1);
            const completionRate = p.slot_count > 0
              ? Math.round((p.total_completions / (p.slot_count * p.week_count)) * 100)
              : 0;
            return (
              <div key={p.id} className="flex items-center px-5 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{p.name}</span>
                    {p.is_current === 1 && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Current</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {format(parseISO(p.start_date), 'MMM d')} – {format(endDate, 'MMM d, yyyy')} · {p.week_count} weeks · {p.slot_count} slots
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="w-32 bg-gray-100 rounded-full h-1.5">
                      <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${completionRate}%` }} />
                    </div>
                    <span className="text-xs text-gray-500">{completionRate}% complete</span>
                  </div>
                </div>
                <Link href={`/periods/${p.id}`}
                  className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700 font-medium ml-4">
                  Manage <ChevronRight size={14} />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
