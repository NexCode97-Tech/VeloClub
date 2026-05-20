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
  Trophy,
  CalendarDays,
  BarChart2,
  MapPin,
  CreditCard,
  RefreshCw,
  MoreHorizontal,
} from 'lucide-react';

function FinanzasIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      <circle cx="12" cy="14" r="2" />
      <path d="M12 12v0M12 16v0" />
    </svg>
  );
}
import { cn } from '@/lib/utils';

const ROLE_TABS: Record<string, { href: string; label: string; icon: React.ElementType }[]> = {
  ADMIN: [
    { href: '/dashboard',             label: 'Inicio',        icon: LayoutDashboard },
    { href: '/dashboard/miembros',    label: 'Miembros',      icon: Users },
    { href: '/dashboard/asistencia',  label: 'Asistencia',    icon: CalendarCheck },
    { href: '/dashboard/finanzas',    label: 'Finanzas',      icon: FinanzasIcon },
    { href: '/dashboard/mas',         label: 'Mas',           icon: MoreHorizontal },
  ],
  COACH: [
    { href: '/dashboard',             label: 'Inicio',        icon: LayoutDashboard },
    { href: '/dashboard/miembros',    label: 'Miembros',      icon: Users },
    { href: '/dashboard/asistencia',  label: 'Asistencia',    icon: CalendarCheck },
    { href: '/dashboard/logros',      label: 'Resultados',    icon: Trophy },
    { href: '/dashboard/mas',         label: 'Mas',           icon: MoreHorizontal },
  ],
  STUDENT: [
    { href: '/dashboard',             label: 'Inicio',        icon: LayoutDashboard },
    { href: '/dashboard/logros',      label: 'Resultados',    icon: Trophy },
    { href: '/dashboard/calendario',  label: 'Calendario',    icon: CalendarDays },
    { href: '/dashboard/pagos',       label: 'Mis Pagos',     icon: CreditCard },
  ],
};

const ADMIN_NAV = [
  { href: '/dashboard',            label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/dashboard/miembros',   label: 'Miembros',      icon: Users },
  { href: '/dashboard/sedes',      label: 'Sedes',         icon: MapPin },
  { href: '/dashboard/asistencia', label: 'Asistencia',    icon: CalendarCheck },
  { href: '/dashboard/finanzas',   label: 'Finanzas',      icon: FinanzasIcon },
  { href: '/dashboard/logros',     label: 'Resultados',    icon: Trophy },
  { href: '/dashboard/calendario', label: 'Calendario',    icon: CalendarDays },
  { href: '/dashboard/reportes',   label: 'Reportes',      icon: BarChart2 },
];

const COACH_NAV = [
  { href: '/dashboard',            label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/dashboard/miembros',   label: 'Miembros',      icon: Users },
  { href: '/dashboard/sedes',      label: 'Sedes',         icon: MapPin },
  { href: '/dashboard/asistencia', label: 'Asistencia',    icon: CalendarCheck },
  { href: '/dashboard/logros',     label: 'Resultados',    icon: Trophy },
  { href: '/dashboard/calendario', label: 'Calendario',    icon: CalendarDays },
];

const STUDENT_NAV = [
  { href: '/dashboard',            label: 'Inicio',        icon: LayoutDashboard },
  { href: '/dashboard/logros',     label: 'Resultados',    icon: Trophy },
  { href: '/dashboard/calendario', label: 'Calendario',    icon: CalendarDays },
  { href: '/dashboard/pagos',      label: 'Mis Pagos',     icon: CreditCard },
];

const ROLE_NAV: Record<string, typeof ADMIN_NAV> = {
  ADMIN:   ADMIN_NAV,
  COACH:   COACH_NAV,
  STUDENT: STUDENT_NAV,
};

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
        const userRole = res.user?.role ?? null;
        setRole(userRole);

        // Proteger rutas por rol — redirigir si el STUDENT intenta acceder a módulos de admin
        if (userRole === 'STUDENT') {
          const STUDENT_ALLOWED = ['/dashboard', '/dashboard/logros', '/dashboard/calendario', '/dashboard/pagos', '/dashboard/mas', '/dashboard/ajustes'];
          const allowed = STUDENT_ALLOWED.some(r => pathname === r || pathname.startsWith(r + '/'));
          if (!allowed) { router.replace('/dashboard'); return; }
        }
        if (userRole === 'COACH') {
          const COACH_BLOCKED = ['/dashboard/finanzas', '/dashboard/reportes', '/dashboard/pagos', '/dashboard/flujo-caja'];
          const blocked = COACH_BLOCKED.some(r => pathname === r || pathname.startsWith(r + '/'));
          if (blocked) { router.replace('/dashboard'); return; }
        }

        setChecking(false);
      } catch (err) {
        // Solo redirigir a /no-access si es un error real de acceso (401/403)
        // Un 429 o error de red no debe cerrar la sesión del usuario
        const { ApiError } = await import('@/lib/api-client');
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          router.replace('/no-access');
        } else {
          // Error temporal (rate limit, red) — dejar pasar, Clerk ya validó la sesión
          setChecking(false);
        }
      }
    })();
  }, [isLoaded, isSignedIn]);

  if (checking) return <LoadingScreen />;

  const tabItems   = role ? (ROLE_TABS[role] ?? ROLE_TABS.ADMIN) : ROLE_TABS.ADMIN;
  const sideNavItems = (ROLE_NAV[role ?? 'ADMIN'] ?? ADMIN_NAV);
  const tabHrefs   = new Set(tabItems.map((t) => t.href));
  const isOnExtra  = !tabHrefs.has(pathname) && pathname !== '/dashboard' && pathname.startsWith('/dashboard/');

  function isTabActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard';
    if (href === '/dashboard/mas') return isOnExtra;
    return pathname === href || pathname.startsWith(href + '/');
  }

  function isSideActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname === href || pathname.startsWith(href + '/');
  }

  // Índice activo para el pill deslizante del bottom bar
  const activeTabIndex = tabItems.findIndex(t => isTabActive(t.href));
  const activeSideIndex = sideNavItems.findIndex(t => isSideActive(t.href));

  // Color de acento según rol
  const accentColor = role === 'COACH' ? '#06D6A0' : role === 'STUDENT' ? '#7C3AED' : '#4361EE';
  const accentBg    = role === 'COACH' ? 'rgba(6,214,160,0.12)' : role === 'STUDENT' ? 'rgba(124,58,237,0.12)' : 'rgba(67,97,238,0.12)';

  return (
    <div className="flex h-dvh overflow-hidden bg-background">

      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <aside className="hidden md:flex w-60 flex-col shrink-0" style={{ background: '#fff', borderRight: '1px solid rgba(0,0,0,0.07)' }}>
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-4 shrink-0" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <Image src="/logo-full.jpg" alt="VeloClub" width={100} height={30} className="object-contain" />
          <button
            onClick={() => window.location.reload()}
            title="Actualizar"
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: '#8E87A8' }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Rol badge */}
        {role && (
          <div className="px-4 py-2.5 shrink-0" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <span
              className="text-[10px] font-bold px-2.5 py-1 rounded-full tracking-wider"
              style={{ background: accentBg, color: accentColor }}
            >
              {roleLabels[role] ?? role}
            </span>
          </div>
        )}

        {/* Nav items con pill deslizante */}
        <nav className="flex-1 px-2 py-2 overflow-y-auto relative">
          {/* Pill deslizante */}
          {activeSideIndex >= 0 && (
            <div
              className="absolute left-2 right-2 rounded-xl pointer-events-none"
              style={{
                height: 44,
                top: `calc(${activeSideIndex} * 48px + 8px)`,
                background: accentBg,
                transition: 'top 0.25s cubic-bezier(0.34,1.2,0.64,1)',
              }}
            />
          )}
          <div className="space-y-1 relative">
            {sideNavItems.map(({ href, label, icon: Icon }) => {
              const active = isSideActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 px-3 rounded-xl text-sm font-semibold transition-colors relative z-10"
                  style={{
                    height: 44,
                    color: active ? accentColor : '#8E87A8',
                  }}
                >
                  <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={active ? 2.5 : 2} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User */}
        <div
          className="flex items-center gap-3 px-4 py-3 shrink-0"
          style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}
        >
          <UserButton />
          <span className="text-[12px] font-semibold truncate" style={{ color: '#8E87A8' }}>Mi cuenta</span>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-card border-b border-border shrink-0">
          <Image src="/logo-full.jpg" alt="VeloClub" width={90} height={28} className="object-contain" />
          <UserButton appearance={{ elements: { avatarBox: { width: 44, height: 44 } } }} />
        </header>

        <main className="flex-1 overflow-y-auto pb-28 md:pb-0">
          {children}
        </main>

        {/* ── Mobile bottom tab bar — glassmorphism, círculo degradado ── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30" style={{ padding: '10px 16px 20px', pointerEvents: 'none' }}>
          {(() => {
            const isStudent = role === 'STUDENT';
            const totalSlots = isStudent ? tabItems.length + 1 : tabItems.length;
            return (
              <div
                className="relative flex w-full"
                style={{
                  background: 'rgba(255,255,255,0.82)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  borderRadius: 40,
                  padding: '6px 0',
                  border: '1px solid rgba(124,58,237,0.14)',
                  boxShadow: '0 8px 32px rgba(124,58,237,0.13), 0 2px 8px rgba(0,0,0,0.06)',
                  pointerEvents: 'auto',
                }}
              >
                {/* Círculo deslizante — mismo tamaño que el avatar del UserButton */}
                {activeTabIndex >= 0 && (
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #7C3AED 0%, #4361EE 55%, #06D6A0 100%)',
                      left: `calc((${activeTabIndex} + 0.5) / ${totalSlots} * 100% - 22px)`,
                      top: 6,
                      transition: 'left 0.35s cubic-bezier(0.34,1.2,0.64,1)',
                      boxShadow: '0 4px 20px rgba(124,58,237,0.40)',
                    }}
                  />
                )}

                {tabItems.map(({ href, label, icon: Icon }) => {
                  const active = isTabActive(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className="flex-1 flex flex-col items-center relative z-10"
                      style={{ gap: 4, paddingBottom: 2 }}
                    >
                      <div className="flex items-center justify-center" style={{ width: 44, height: 44 }}>
                        <Icon
                          className="w-[26px] h-[26px]"
                          strokeWidth={active ? 2.2 : 1.7}
                          style={{ color: active ? '#fff' : '#8E87A8', transition: 'color 0.2s' }}
                        />
                      </div>
                      <span
                        className="text-[9px] tracking-wide leading-none"
                        style={{
                          color: active ? accentColor : '#8E87A8',
                          fontWeight: active ? 700 : 500,
                          transition: 'color 0.2s',
                        }}
                      >
                        {label}
                      </span>
                    </Link>
                  );
                })}

                {/* Tab Perfil para STUDENT: Clerk UserButton — mismo tamaño 44px */}
                {isStudent && (
                  <div
                    className="flex-1 flex flex-col items-center relative z-10"
                    style={{ gap: 4, paddingBottom: 2 }}
                  >
                    <div className="flex items-center justify-center" style={{ width: 44, height: 44 }}>
                      <UserButton
                        appearance={{
                          elements: {
                            avatarBox: { width: 38, height: 38, borderRadius: '50%' },
                            userButtonPopoverCard: { borderRadius: 16 },
                          },
                        }}
                      />
                    </div>
                    <span className="text-[9px] tracking-wide leading-none" style={{ color: '#8E87A8', fontWeight: 500 }}>
                      Perfil
                    </span>
                  </div>
                )}
              </div>
            );
          })()}
        </nav>
      </div>
    </div>
  );
}
