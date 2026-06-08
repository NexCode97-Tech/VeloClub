'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { UserButton, useAuth, useSession } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { apiFetch } from '@/lib/api-client';
import LoadingScreen from '@/components/ui/loading-screen';
import { BottomCircleMenu } from '@/components/ui/bottom-circle-menu';
import {
  Home,
  Users,
  CalendarCheck,
  Trophy,
  CalendarDays,
  BarChart2,
  MapPin,
  CreditCard,
  CircleDollarSign,
  Settings,
  UserCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// "Más" va en el índice 2 (centro del bottom bar) para ADMIN y COACH
// El href '/dashboard/mas' es el centinela — no navega, activa el CircleMenu
const ROLE_TABS: Record<string, { href: string; label: string; icon: React.ElementType }[]> = {
  ADMIN: [
    { href: '/dashboard',             label: 'Inicio',      icon: Home},
    { href: '/dashboard/miembros',    label: 'Miembros',    icon: Users },
    { href: '/dashboard/mas',         label: 'Más',         icon: Home}, // reemplazado por CircleMenu
    { href: '/dashboard/asistencia',  label: 'Asistencia',  icon: CalendarCheck },
    { href: '/dashboard/finanzas',    label: 'Finanzas',    icon: CircleDollarSign },
  ],
  COACH: [
    { href: '/dashboard',             label: 'Inicio',      icon: Home},
    { href: '/dashboard/miembros',    label: 'Miembros',    icon: Users },
    { href: '/dashboard/mas',         label: 'Más',         icon: Home}, // reemplazado por CircleMenu
    { href: '/dashboard/asistencia',  label: 'Asistencia',  icon: CalendarCheck },
    { href: '/dashboard/logros',      label: 'Resultados',  icon: Trophy },
  ],
  STUDENT: [
    { href: '/dashboard',             label: 'Inicio',      icon: Home},
    { href: '/dashboard/logros',      label: 'Resultados',  icon: Trophy },
    { href: '/dashboard/calendario',  label: 'Calendario',  icon: CalendarDays },
    { href: '/dashboard/pagos',       label: 'Mis Pagos',   icon: CreditCard },
  ],
};

// Ítems del CircleMenu por rol
const ROLE_MAS_ITEMS: Record<string, { label: string; icon: React.ElementType; href: string; color: string }[]> = {
  ADMIN: [
    { label: 'Resultados', icon: Trophy,       href: '/dashboard/logros',     color: '#F59E0B' },
    { label: 'Calendario', icon: CalendarDays, href: '/dashboard/calendario', color: '#EF476F' },
    { label: 'Sedes',      icon: MapPin,       href: '/dashboard/sedes',      color: '#06D6A0' },
    { label: 'Reportes',   icon: BarChart2,    href: '/dashboard/reportes',   color: '#4361EE' },
  ],
  COACH: [
    { label: 'Resultados', icon: Trophy,       href: '/dashboard/logros',     color: '#F59E0B' },
    { label: 'Calendario', icon: CalendarDays, href: '/dashboard/calendario', color: '#EF476F' },
    { label: 'Sedes',      icon: MapPin,       href: '/dashboard/sedes',      color: '#06D6A0' },
  ],
};

const ADMIN_NAV = [
  { href: '/dashboard',            label: 'Inicio',        icon: Home},
  { href: '/dashboard/miembros',   label: 'Miembros',      icon: Users },
  { href: '/dashboard/sedes',      label: 'Sedes',         icon: MapPin },
  { href: '/dashboard/asistencia', label: 'Asistencia',    icon: CalendarCheck },
  { href: '/dashboard/finanzas',   label: 'Finanzas',      icon: CircleDollarSign },
  { href: '/dashboard/logros',     label: 'Resultados',    icon: Trophy },
  { href: '/dashboard/calendario', label: 'Calendario',    icon: CalendarDays },
  { href: '/dashboard/reportes',   label: 'Reportes',      icon: BarChart2 },
  { href: '/dashboard/perfil',     label: 'Mi Perfil',     icon: UserCircle },
  { href: '/dashboard/ajustes',    label: 'Ajustes',       icon: Settings },
];

const COACH_NAV = [
  { href: '/dashboard',            label: 'Inicio',        icon: Home},
  { href: '/dashboard/miembros',   label: 'Miembros',      icon: Users },
  { href: '/dashboard/sedes',      label: 'Sedes',         icon: MapPin },
  { href: '/dashboard/asistencia', label: 'Asistencia',    icon: CalendarCheck },
  { href: '/dashboard/logros',     label: 'Resultados',    icon: Trophy },
  { href: '/dashboard/calendario', label: 'Calendario',    icon: CalendarDays },
  { href: '/dashboard/perfil',     label: 'Mi Perfil',     icon: UserCircle },
  { href: '/dashboard/ajustes',    label: 'Ajustes',       icon: Settings },
];

const STUDENT_NAV = [
  { href: '/dashboard',            label: 'Inicio',        icon: Home},
  { href: '/dashboard/logros',     label: 'Resultados',    icon: Trophy },
  { href: '/dashboard/calendario', label: 'Calendario',    icon: CalendarDays },
  { href: '/dashboard/pagos',      label: 'Mis Pagos',     icon: CreditCard },
  { href: '/dashboard/perfil',     label: 'Mi Perfil',     icon: UserCircle },
  { href: '/dashboard/ajustes',    label: 'Ajustes',       icon: Settings },
];

const ROLE_NAV: Record<string, typeof ADMIN_NAV> = {
  ADMIN:   ADMIN_NAV,
  COACH:   COACH_NAV,
  STUDENT: STUDENT_NAV,
};



export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoaded, isSignedIn, userId, sessionId } = useAuth();
  const { session } = useSession();
  const [role, setRole] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [masMenuOpen, setMasMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [clubLogoUrl, setClubLogoUrl] = useState<string | null>(null);
  const [clubName, setClubName] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar-collapsed') === 'true';
    }
    return false;
  });

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { router.push('/sign-in'); return; }

    // Flag para cancelar operaciones async si el userId cambia antes de que terminen
    let stale = false;

    setChecking(true);

    (async () => {
      try {
        const token = await session?.getToken({ skipCache: true });
        if (stale) return;

        let res: { status: string; user?: { role: string; name?: string; club?: { name?: string; logoUrl?: string } } } | null = null;
        let attempts = 0;
        while (attempts < 3) {
          try {
            res = await apiFetch<{ status: string; user?: { role: string; name?: string; club?: { name?: string; logoUrl?: string } } }>('/me', { token });
            break;
          } catch (err) {
            const { ApiError } = await import('@/lib/api-client');
            if (err instanceof ApiError && err.status === 429) {
              attempts++;
              await new Promise(r => setTimeout(r, 1500 * attempts));
              continue;
            }
            throw err;
          }
        }

        if (!res || stale) return;
        if (res.status === 'no_access')        { router.replace('/no-access');       return; }
        if (res.status === 'inactive')         { router.replace('/inactivo');         return; }
        if (res.status === 'superadmin')       { router.replace('/superadmin');       return; }
        if (res.status === 'complete_profile') { router.replace('/completar-perfil'); return; }
        const userRole = res.user?.role ?? null;
        setRole(userRole);
        setClubLogoUrl(res.user?.club?.logoUrl ?? null);
        setClubName(res.user?.club?.name ?? null);
        setUserName(res.user?.name ?? null);

        if (userRole === 'STUDENT') {
          const STUDENT_ALLOWED = ['/dashboard', '/dashboard/logros', '/dashboard/calendario', '/dashboard/pagos', '/dashboard/mas', '/dashboard/perfil', '/dashboard/ajustes'];
          const allowed = STUDENT_ALLOWED.some(r => pathname === r || pathname.startsWith(r + '/'));
          if (!allowed) { router.replace('/dashboard'); return; }
        }
        if (userRole === 'COACH') {
          const COACH_BLOCKED = ['/dashboard/finanzas', '/dashboard/reportes', '/dashboard/pagos'];
          const blocked = COACH_BLOCKED.some(r => pathname === r || pathname.startsWith(r + '/'));
          if (blocked) { router.replace('/dashboard'); return; }
        }

        setChecking(false);
      } catch (err) {
        if (stale) return;
        const { ApiError } = await import('@/lib/api-client');
        if (err instanceof ApiError && err.status === 401) {
          router.replace('/sign-in');
        } else if (err instanceof ApiError && err.status === 403) {
          router.replace('/no-access');
        } else {
          setChecking(false);
        }
      }
    })();

    // Cleanup: marcar como stale para que la async no aplique resultados viejos
    return () => { stale = true; };
  }, [isLoaded, isSignedIn, userId, sessionId]);

  if (checking) return <LoadingScreen />;

  const tabItems   = role ? (ROLE_TABS[role] ?? ROLE_TABS.ADMIN) : ROLE_TABS.ADMIN;
  const sideNavItems = (ROLE_NAV[role ?? 'ADMIN'] ?? ADMIN_NAV);
  const tabHrefs   = new Set(tabItems.map((t) => t.href));
  const isOnExtra  = !tabHrefs.has(pathname) && pathname !== '/dashboard' && pathname.startsWith('/dashboard/');

  function isTabActive(href: string) {
    if (href === '/dashboard/mas') return false; // el CircleMenu maneja su propio estado
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname === href || pathname.startsWith(href + '/');
  }

  function isSideActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname === href || pathname.startsWith(href + '/');
  }

  // Índice activo para el pill deslizante del bottom bar
  const activeTabIndex = tabItems.findIndex(t => isTabActive(t.href));
  const activeSideIndex = sideNavItems.findIndex(t => isSideActive(t.href));

  // Color de acento — uniforme para todos los roles
  const accentColor = '#4361EE';
  const accentBg    = 'rgba(67,97,238,0.12)';

  // Sidebar colapsable
  function toggleSidebar() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar-collapsed', String(next));
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background">

      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 240 }}
        transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
        className="hidden md:flex flex-col shrink-0 overflow-hidden"
        style={{ background: '#fff', borderRight: '1px solid rgba(0,0,0,0.07)' }}
      >
        {/* Logo + toggle */}
        <div className="flex items-center justify-between px-3 py-4 shrink-0" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', minHeight: 58 }}>
          {!collapsed && (
            <Image src="/logo-full.jpg" alt="VeloClub" width={100} height={30} className="object-contain" />
          )}
          <button
            onClick={toggleSidebar}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-secondary shrink-0"
            style={{ color: '#8E87A8', marginLeft: collapsed ? 'auto' : undefined, marginRight: collapsed ? 'auto' : undefined }}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-2 py-2 overflow-y-auto relative">
          {!collapsed && activeSideIndex >= 0 && (
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
                  className="flex items-center rounded-xl text-sm font-semibold transition-colors relative z-10"
                  style={{
                    height: 44,
                    color: active ? accentColor : '#8E87A8',
                    gap: collapsed ? 0 : 12,
                    paddingLeft: collapsed ? 0 : 12,
                    paddingRight: collapsed ? 0 : 12,
                    justifyContent: collapsed ? 'center' : undefined,
                    background: collapsed && active ? accentBg : undefined,
                  }}
                  title={collapsed ? label : undefined}
                >
                  <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={active ? 2.5 : 2} />
                  {!collapsed && <span>{label}</span>}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User */}
        <div
          className="flex items-center shrink-0 py-3"
          style={{
            borderTop: '1px solid rgba(0,0,0,0.06)',
            gap: collapsed ? 0 : 12,
            paddingLeft: collapsed ? 0 : 16,
            paddingRight: collapsed ? 0 : 16,
            justifyContent: collapsed ? 'center' : undefined,
          }}
        >
          <UserButton />
          {!collapsed && <span className="text-[12px] font-semibold truncate" style={{ color: '#8E87A8' }}>Mi cuenta</span>}
        </div>
      </motion.aside>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* ── Mobile header — solo en home ── */}
        <header className={`md:hidden flex items-center justify-between px-4 py-3 shrink-0 bg-background ${pathname !== '/dashboard' ? 'hidden' : ''}`}>
          {/* Logo del club + saludo */}
          <div className="flex items-center gap-2.5 min-w-0">
            {clubLogoUrl ? (
              <div className="shrink-0" style={{ width: 38, height: 38, borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(124,58,237,0.18)' }}>
                <Image
                  src={clubLogoUrl}
                  alt={clubName ?? 'Club'}
                  width={38}
                  height={38}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div
                className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-sm font-bold"
                style={{ background: 'rgba(124,58,237,0.10)', color: '#7C3AED' }}
              >
                {clubName?.charAt(0)?.toUpperCase() ?? 'V'}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest truncate" style={{ color: '#8E87A8' }}>
                Bienvenido
              </p>
              <p className="text-[13px] font-bold leading-tight truncate" style={{ color: '#1A1028', fontFamily: 'inherit' }}>
                {userName ?? clubName ?? 'VeloClub'}
              </p>
            </div>
          </div>
          {/* Acciones rápidas */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => {
                setRefreshing(true);
                setTimeout(() => { window.location.reload(); }, 300);
              }}
              className="w-9 h-9 flex items-center justify-center rounded-full transition-colors"
              style={{ color: '#8E87A8', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(0,0,0,0.06)' }}
            >
              <RefreshCw
                size={18}
                strokeWidth={2}
                style={{
                  transition: 'transform 0.5s ease',
                  transform: refreshing ? 'rotate(360deg)' : 'rotate(0deg)',
                }}
              />
            </button>
            <Link
              href="/dashboard/perfil"
              className="w-9 h-9 flex items-center justify-center rounded-full transition-colors"
              style={{ color: '#8E87A8', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(0,0,0,0.06)' }}
            >
              <UserCircle size={22} strokeWidth={1.8} />
            </Link>
            <Link
              href="/dashboard/ajustes"
              className="w-9 h-9 flex items-center justify-center rounded-full transition-colors"
              style={{ color: '#8E87A8', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(0,0,0,0.06)' }}
            >
              <Settings size={20} strokeWidth={1.8} />
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-28 md:pb-0">
          {children}
        </main>

        {/* ── Overlay oscuro cuando el megamenú "Más" está abierto ── */}
        <AnimatePresence>
          {masMenuOpen && (
            <motion.div
              key="mas-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
              className="md:hidden fixed inset-0"
              style={{ background: 'rgba(15,10,30,0.48)', zIndex: 29, backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }}
              onClick={() => setMasMenuOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* ── Mobile bottom tab bar ── */}
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 z-30"
          style={{ padding: '0 16px 20px', pointerEvents: 'none' }}
        >
          {(() => {
            const isStudent = role === 'STUDENT';
            const totalSlots = isStudent ? tabItems.length + 1 : tabItems.length;
            const hasNotch = role !== 'STUDENT';
            return (
              /* Wrapper con drop-shadow — la sombra sigue la silueta visual de bar + bump */
              <div style={{
                filter: 'drop-shadow(0 -2px 6px rgba(124,58,237,0.08)) drop-shadow(0 4px 12px rgba(124,58,237,0.10))',
                pointerEvents: 'auto',
              }}>
                {/* Bar — pill blanco, overflow visible para que el bump salga por arriba */}
                <div
                  className="relative flex w-full"
                  style={{
                    background: '#FFFFFF',
                    borderRadius: 40,
                    padding: '6px 0',
                    overflow: 'visible',
                  }}
                >
                  {/* Bump — hijo del bar, misma superficie blanca, sin borde */}
                  {hasNotch && (
                    <div
                      style={{
                        position: 'absolute',
                        width: 76,
                        height: 76,
                        borderRadius: '50%',
                        background: '#FFFFFF',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        top: -18,
                        zIndex: 0,
                        pointerEvents: 'none',
                      }}
                    />
                  )}

                  {/* Círculo deslizante */}
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
                        zIndex: 1,
                      }}
                    />
                  )}

                  {tabItems.map(({ href, label, icon: Icon }) => {
                    if (href === '/dashboard/mas') {
                      const masItems = ROLE_MAS_ITEMS[role ?? 'ADMIN'] ?? [];
                      return (
                        <div
                          key="mas-circle"
                          className="flex-1 flex flex-col items-center relative z-[41]"
                          style={{ marginTop: -16 }}
                        >
                          <BottomCircleMenu
                            items={masItems}
                            pathname={pathname}
                            isOpen={masMenuOpen}
                            onToggle={() => setMasMenuOpen(v => !v)}
                            onClose={() => setMasMenuOpen(false)}
                          />
                          <span
                            className="text-[9px] tracking-wide leading-none mt-1"
                            style={{ color: '#8E87A8', fontWeight: 500 }}
                          >
                            Más
                          </span>
                        </div>
                      );
                    }

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
              </div>
            );
          })()}
        </nav>
      </div>
    </div>
  );
}
