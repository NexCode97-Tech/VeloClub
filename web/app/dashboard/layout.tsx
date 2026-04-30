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
  TrendingUp,
  Trophy,
  CalendarDays,
  BarChart2,
  MapPin,
  RefreshCw,
  MoreHorizontal,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ROLE_TABS: Record<string, { href: string; label: string; icon: React.ElementType }[]> = {
  ADMIN: [
    { href: '/dashboard',            label: 'Inicio',     icon: LayoutDashboard },
    { href: '/dashboard/miembros',   label: 'Miembros',   icon: Users },
    { href: '/dashboard/asistencia', label: 'Asistencia', icon: CalendarCheck },
    { href: '/dashboard/pagos',      label: 'Pagos',      icon: CreditCard },
    { href: '/dashboard/mas',        label: 'Mas',        icon: MoreHorizontal },
  ],
  COACH: [
    { href: '/dashboard',            label: 'Inicio',     icon: LayoutDashboard },
    { href: '/dashboard/miembros',   label: 'Miembros',   icon: Users },
    { href: '/dashboard/asistencia', label: 'Asistencia', icon: CalendarCheck },
    { href: '/dashboard/logros',     label: 'Logros',     icon: Trophy },
    { href: '/dashboard/mas',        label: 'Mas',        icon: MoreHorizontal },
  ],
  STUDENT: [
    { href: '/dashboard',            label: 'Inicio',     icon: LayoutDashboard },
    { href: '/dashboard/asistencia', label: 'Asistencia', icon: CalendarCheck },
    { href: '/dashboard/logros',     label: 'Logros',     icon: Trophy },
    { href: '/dashboard/calendario', label: 'Calendario', icon: CalendarDays },
    { href: '/dashboard/mas',        label: 'Mas',        icon: MoreHorizontal },
  ],
};

const ALL_NAV = [
  { href: '/dashboard',            label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/dashboard/miembros',   label: 'Miembros',      icon: Users },
  { href: '/dashboard/sedes',      label: 'Sedes',         icon: MapPin },
  { href: '/dashboard/asistencia', label: 'Asistencia',    icon: CalendarCheck },
  { href: '/dashboard/pagos',      label: 'Pagos',         icon: CreditCard },
  { href: '/dashboard/flujo-caja', label: 'Flujo de Caja', icon: TrendingUp },
  { href: '/dashboard/logros',     label: 'Logros',        icon: Trophy },
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
  const [drawerOpen, setDrawerOpen] = useState(false);

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

      {/* ── Mobile drawer ───────────────────────────────────────────────── */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
        />
      )}
      <div
        className={cn(
          'md:hidden fixed left-0 top-0 bottom-0 w-[78%] max-w-xs z-50 bg-card border-r border-border flex flex-col shadow-2xl transition-transform duration-300',
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-gradient-to-br from-card to-secondary">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold"
              style={{ background: 'linear-gradient(135deg,#4361EE,#7C3AED)', fontFamily: 'var(--font-space-grotesk)' }}
            >
              VC
            </div>
            <div>
              <p className="text-sm font-bold text-foreground" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                VeloClub
              </p>
              {role && (
                <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', roleBadgeStyle[role] ?? 'bg-secondary text-muted-foreground')}>
                  {roleLabels[role] ?? role}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {ALL_NAV.map(({ href, label, icon: Icon }) => {
            const active = href === '/dashboard' ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setDrawerOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-all',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 px-4 py-4 border-t border-border">
          <UserButton />
          <span className="text-sm text-muted-foreground">Mi cuenta</span>
        </div>
      </div>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-card border-b border-border shrink-0">
          <button
            onClick={() => setDrawerOpen(true)}
            className="w-9 h-9 flex flex-col items-center justify-center gap-[5px] rounded-xl bg-secondary"
          >
            <span className="w-4 h-0.5 rounded-full bg-muted-foreground" />
            <span className="w-4 h-0.5 rounded-full bg-muted-foreground" />
            <span className="w-4 h-0.5 rounded-full bg-muted-foreground" />
          </button>
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
