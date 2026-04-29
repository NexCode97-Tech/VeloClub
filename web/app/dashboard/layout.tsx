'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { UserButton, useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CreditCard,
  TrendingUp,
  Trophy,
  CalendarDays,
  BarChart2,
  MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/miembros', label: 'Miembros', icon: Users },
  { href: '/dashboard/sedes', label: 'Sedes', icon: MapPin },
  { href: '/dashboard/asistencia', label: 'Asistencia', icon: CalendarCheck },
  { href: '/dashboard/pagos', label: 'Pagos', icon: CreditCard },
  { href: '/dashboard/flujo-caja', label: 'Flujo de Caja', icon: TrendingUp },
  { href: '/dashboard/logros', label: 'Logros', icon: Trophy },
  { href: '/dashboard/calendario', label: 'Calendario', icon: CalendarDays },
  { href: '/dashboard/reportes', label: 'Reportes', icon: BarChart2 },
];

const roleLabels: Record<string, string> = {
  ADMIN: 'Administrador',
  COACH: 'Entrenador',
  STUDENT: 'Deportista',
};

const roleColors: Record<string, string> = {
  ADMIN: 'bg-blue-100 text-blue-700',
  COACH: 'bg-green-100 text-green-700',
  STUDENT: 'bg-slate-100 text-slate-600',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    (async () => {
      try {
        const token = await getToken();
        const res = await apiFetch<{ user?: { role: string } }>('/me', { token });
        setRole(res.user?.role ?? null);
      } catch {}
    })();
  }, [isLoaded, isSignedIn]);

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        {/* Logo */}
        <div className="px-6 py-4 border-b border-slate-200">
          <Image src="/logo.png" alt="VeloClub" width={130} height={36} className="object-contain" />
        </div>

        {/* Role badge */}
        {role && (
          <div className="px-4 py-3 border-b border-slate-100">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${roleColors[role] ?? 'bg-slate-100 text-slate-600'}`}>
              {roleLabels[role] ?? role}
            </span>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-4 py-4 border-t border-slate-200 flex items-center gap-3 cursor-pointer">
          <UserButton />
          <span className="text-sm text-slate-600 truncate">Mi cuenta</span>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
