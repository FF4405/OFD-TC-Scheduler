'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Flame, LayoutGrid, Users, ClipboardList, Calendar } from 'lucide-react';

const navItems = [
  { href: '/',        label: 'Schedule',  icon: LayoutGrid   },
  { href: '/members', label: 'Members',   icon: Users        },
  { href: '/slots',   label: 'Slots',     icon: ClipboardList },
  { href: '/periods', label: 'Periods',   icon: Calendar     },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="bg-gray-900 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center h-16 gap-6">
          <div className="flex items-center gap-2 mr-4">
            <Flame className="text-red-500" size={26} />
            <div className="leading-tight">
              <div className="font-bold text-sm tracking-wide">Oradell FD</div>
              <div className="text-xs text-gray-400 leading-none">Check Tracker</div>
            </div>
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
                  <Icon size={15} />
                  {label}
                </Link>
              );
            })}
          </div>
          <div className="ml-auto text-xs text-gray-500">
            Due by 7PM every Monday
          </div>
        </div>
      </div>
    </nav>
  );
}
