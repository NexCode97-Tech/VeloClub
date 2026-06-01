'use client';

import { useAuth } from '@clerk/nextjs';
import { UserButton, useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import Link from 'next/link';
import { Trophy, CalendarDays, MapPin, BarChart2, HelpCircle, ChevronRight } from 'lucide-react';

const ITEMS_BY_ROLE: Record<string, { label: string; icon: React.ElementType; color: string; href: string }[]> = {
  ADMIN: [
    { label: 'Resultados', icon: Trophy,            color: '#F59E0B', href: '/dashboard/logros' },
    { label: 'Calendario', icon: CalendarDays,      color: '#EF476F', href: '/dashboard/calendario' },
    { label: 'Sedes',      icon: MapPin,            color: '#06D6A0', href: '/dashboard/sedes' },
    { label: 'Reportes',   icon: BarChart2,         color: '#4361EE', href: '/dashboard/reportes' },
    { label: 'Ayuda',      icon: HelpCircle,        color: '#8E87A8', href: '/dashboard/ayuda' },
  ],
  COACH: [
    { label: 'Resultados', icon: Trophy,        color: '#F59E0B', href: '/dashboard/logros' },
    { label: 'Calendario', icon: CalendarDays,  color: '#EF476F', href: '/dashboard/calendario' },
    { label: 'Sedes',      icon: MapPin,        color: '#06D6A0', href: '/dashboard/sedes' },
    { label: 'Ayuda',      icon: HelpCircle,    color: '#8E87A8', href: '/dashboard/ayuda' },
  ],
  STUDENT: [],
};

export default function MasPage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const res = await apiFetch<{ user?: { role: string } }>('/me', { token });
        setRole(res.user?.role ?? 'ADMIN');
      } catch { setRole('ADMIN'); }
    })();
  }, []);

  const items = role ? (ITEMS_BY_ROLE[role] ?? []) : null;

  const roleLabel: Record<string, string> = {
    ADMIN: 'Administrador',
    COACH: 'Entrenador',
    STUDENT: 'Deportista',
  };

  return (
    <div className="min-h-full bg-background px-4 py-4">
      <h1 className="text-lg font-bold text-foreground mb-4" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
        Más opciones
      </h1>

      {/* Tarjeta Mi cuenta — solo para STUDENT (ADMIN y COACH la tienen en el header) */}
      {items !== null && role === 'STUDENT' && (
        <div className="relative bg-white border border-border rounded-2xl px-4 py-3.5 flex items-center gap-3 mb-4 overflow-hidden">
          <div className="w-12 h-12 rounded-full bg-violet-100 shrink-0 flex items-center justify-center overflow-hidden pointer-events-none">
            {user?.imageUrl
              ? <img src={user.imageUrl} alt="avatar" className="w-full h-full object-cover" />
              : <span className="text-violet-500 font-bold text-lg">{(user?.firstName ?? 'U')[0]}</span>
            }
          </div>
          <div className="flex-1 min-w-0 pointer-events-none">
            <p className="text-[14px] font-bold text-foreground truncate" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
              {user?.fullName ?? user?.firstName ?? 'Mi cuenta'}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {user?.primaryEmailAddress?.emailAddress ?? roleLabel[role ?? 'ADMIN']}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 pointer-events-none" />
          <div className="absolute inset-0 flex items-center justify-start px-4 opacity-0">
            <UserButton
              appearance={{
                elements: {
                  avatarBox: { width: '100%', height: '100%', borderRadius: 0 },
                  userButtonTrigger: { width: '100vw', height: '100%', position: 'absolute', inset: 0, borderRadius: 0 },
                },
              }}
            />
          </div>
        </div>
      )}

      {/* ── Ítems según rol ── */}
      {items === null && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="w-full bg-white border border-border rounded-xl px-4 py-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary animate-pulse shrink-0" />
              <div className="flex-1 h-4 rounded bg-secondary animate-pulse" />
            </div>
          ))}
        </div>
      )}
      {items !== null && items.length > 0 && (
        <div className="space-y-2">
          {items.map(({ label, icon: Icon, color, href }) => (
            <Link
              key={href}
              href={href}
              className="w-full bg-white border border-border rounded-xl px-4 py-3.5 flex items-center gap-3 active:bg-secondary transition-colors"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${color}18`, color }}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className="flex-1 text-sm font-semibold text-foreground" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                {label}
              </span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
