'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Flame, LayoutDashboard, Truck, CalendarCheck, ClipboardList, AlertTriangle } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/apparatus', label: 'Apparatus', icon: Truck },
  { href: '/schedules', label: 'Schedules', icon: CalendarCheck },
  { href: '/checks', label: 'Run Check', icon: ClipboardList },
  { href: '/history', label: 'History', icon: AlertTriangle },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="bg-gray-900 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center h-16">
          <div className="flex items-center gap-2 mr-8">
            <Flame className="text-red-500" size={28} />
            <span className="font-bold text-lg tracking-wide">OFD Equipment Tracker</span>
          </div>
          <div className="flex gap-1">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || (href !== '/' && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    active
                      ? 'bg-red-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
