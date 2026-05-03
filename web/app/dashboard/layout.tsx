'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { UserButton, useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import LoadingScreen from '@/components/ui/loading-screen';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CreditCard,
  Trophy,
  CalendarDays,
  BarChart2,
  MapPin,
  RefreshCw,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ROLE_TABS: Record<string, { href: string; label: string; icon: React.ElementType }[]> = {
  ADMIN: [
    { href: '/dashboard',             label: 'Inicio',        icon: LayoutDashboard },
    { href: '/dashboard/miembros',    label: 'Miembros',      icon: Users },
    { href: '/dashboard/asistencia',  label: 'Asistencia',    icon: CalendarCheck },
    { href: '/dashboard/finanzas',    label: 'Finanzas',      icon: CreditCard },
    { href: '/dashboard/mas',         label: 'Mas',           icon: MoreHorizontal },
  ],
  COACH: [
    { href: '/dashboard',             label: 'Inicio',        icon: LayoutDashboard },
    { href: '/dashboard/miembros',    label: 'Miembros',      icon: Users },
    { href: '/dashboard/asistencia',  label: 'Asistencia',    icon: CalendarCheck },
    { href: '/dashboard/logros',      label: 'Competencias',  icon: Trophy },
    { href: '/dashboard/mas',         label: 'Mas',           icon: MoreHorizontal },
  ],
  STUDENT: [
    { href: '/dashboard',             label: 'Inicio',        icon: LayoutDashboard },
    { href: '/dashboard/asistencia',  label: 'Asistencia',    icon: CalendarCheck },
    { href: '/dashboard/logros',      label: 'Competencias',  icon: Trophy },
    { href: '/dashboard/calendario',  label: 'Calendario',    icon: CalendarDays },
    { href: '/dashboard/mas',         label: 'Mas',           icon: MoreHorizontal },
  ],
};

const ALL_NAV = [
  { href: '/dashboard',            label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/dashboard/miembros',   label: 'Miembros',      icon: Users },
  { href: '/dashboard/sedes',      label: 'Sedes',         icon: MapPin },
  { href: '/dashboard/asistencia', label: 'Asistencia',    icon: CalendarCheck },
  { href: '/dashboard/finanzas',   label: 'Finanzas',      icon: CreditCard },
  { href: '/dashboard/logros',     label: 'Competencias',  icon: Trophy },
  { href: '/dashboard/calendario', label: 'Calendario',    icon: CalendarDays },
  { href: '/dashboard/reportes',   label: 'Reportes',      icon: BarChart2 },
];

const roleLabels: Record<string, string> = {
  ADMIN: 'Administrador',
  COACH: 'Entrenador',
  STUDENT: 'Deportista',
};

const roleBadgeStyle: Record<string, string> = {
  ADMIN:   'bg-amber-100 text-amber-700',
  COACH:   'bg-emerald-100 text-emerald-700',
  STUDENT: 'bg-violet-100 text-violet-700',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { router.push('/sign-in'); return; }
    (async () => {
      try {
        const token = await getToken();
        const res = await apiFetch<{ status: string; user?: { role: string } }>('/me', { token });
        if (res.status === 'no_access')        { router.replace('/no-access');       return; }
        if (res.status === 'inactive')         { router.replace('/inactivo');         return; }
        if (res.status === 'superadmin')       { router.replace('/superadmin');       return; }
        if (res.status === 'complete_profile') { router.replace('/completar-perfil'); return; }
        setRole(res.user?.role ?? null);
        setChecking(false);
      } catch {
        router.replace('/no-access');
      }
    })();
  }, [isLoaded, isSignedIn]);

  if (checking) return <LoadingScreen />;

  const tabItems = role ? (ROLE_TABS[role] ?? ROLE_TABS.ADMIN) : ROLE_TABS.ADMIN;
  const tabHrefs = new Set(tabItems.map((t) => t.href));
  const isOnExtra =
    !tabHrefs.has(pathname) && pathname !== '/dashboard' && pathname.startsWith('/dashboard/');

  function isTabActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard';
    if (href === '/dashboard/mas') return isOnExtra;
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background">

      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <aside className="hidden md:flex w-64 bg-card border-r border-border flex-col shrink-0">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border min-h-[60px]">
          <Image src="/logo.png" alt="VeloClub" width={96} height={28} className="object-contain" />
          <button
            onClick={() => window.location.reload()}
            title="Actualizar"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {role && (
          <div className="px-4 py-3 border-b border-border">
            <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', roleBadgeStyle[role] ?? 'bg-secondary text-muted-foreground')}>
              {roleLabels[role] ?? role}
            </span>
          </div>
        )}

        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {ALL_NAV.map(({ href, label, icon: Icon }) => {
            const active = href === '/dashboard' ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 px-4 py-4 border-t border-border shrink-0">
          <UserButton />
          <span className="text-sm text-muted-foreground truncate">Mi cuenta</span>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-card border-b border-border shrink-0">
          <Image src="/favicon.png" alt="VeloClub" width={28} height={28} className="rounded-lg object-contain" />
          <UserButton />
        </header>

        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {children}
        </main>

        {/* Mobile bottom tab bar */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-border">
          <div className="flex items-stretch">
            {tabItems.map(({ href, label, icon: Icon }) => {
              const active = isTabActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex-1 flex flex-col items-center gap-1 pt-2 pb-3 relative transition-colors',
                    active ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  {active && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-11 h-8 rounded-xl bg-primary opacity-10" />
                  )}
                  <Icon
                    className="w-[22px] h-[22px] relative z-10"
                    strokeWidth={active ? 2.5 : 2}
                  />
                  <span className={cn('text-[9.5px] tracking-wide relative z-10', active ? 'font-bold' : 'font-medium')}>
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>
          <div className="h-1" />
        </nav>
      </div>
    </div>
  );
}
