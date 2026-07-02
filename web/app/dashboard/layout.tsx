'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, useSession, useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { apiFetch } from '@/lib/api-client';
import LoadingScreen from '@/components/ui/loading-screen';
import { BottomCircleMenu } from '@/components/ui/bottom-circle-menu';
import {
  Settings,
  UserCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Bell,
  Search,
} from 'lucide-react';
import { IconHome, IconUsers, IconCalendar, IconStatistics, IconClub, IconFinanzas, IconUbicacion, IconAsistencias, IconResultados, IconAjustes, IconMisPagos } from '@/components/ui/custom-icons';

// ── Colores por rol (sidebar footer) ─────────────────────────────────────────
const SIDEBAR_ROLE_LABEL: Record<string, string> = {
  SUPERADMIN: 'Superadmin',
  ADMIN:      'Admin',
  COACH:      'Coach',
  STUDENT:    'Deportista',
};
const SIDEBAR_ROLE_COLOR: Record<string, string> = {
  SUPERADMIN: '#EF476F',
  ADMIN:      '#FFB703',
  COACH:      '#06D6A0',
  STUDENT:    '#7C3AED',
};
const SIDEBAR_ROLE_GRADIENT: Record<string, string> = {
  SUPERADMIN: 'linear-gradient(135deg,#EF476F,#C1121F)',
  ADMIN:      'linear-gradient(135deg,#FFB703,#FB8500)',
  COACH:      'linear-gradient(135deg,#06D6A0,#0CB68D)',
  STUDENT:    'linear-gradient(135deg,#7C3AED,#A855F7)',
};
import { cn } from '@/lib/utils';

// "Más" va en el índice 2 (centro del bottom bar) para ADMIN y COACH
// El href '/dashboard/mas' es el centinela — no navega, activa el CircleMenu
const ROLE_TABS: Record<string, { href: string; label: string; icon: React.ElementType }[]> = {
  ADMIN: [
    { href: '/dashboard',             label: 'Inicio',      icon: IconHome},
    { href: '/dashboard/miembros',    label: 'Miembros',    icon: IconUsers },
    { href: '/dashboard/mas',         label: 'Más',         icon: IconHome}, // reemplazado por CircleMenu
    { href: '/dashboard/asistencia',  label: 'Asistencia',  icon: IconAsistencias },
    { href: '/dashboard/finanzas',    label: 'Finanzas',    icon: IconFinanzas },
  ],
  COACH: [
    { href: '/dashboard',             label: 'Inicio',      icon: IconHome},
    { href: '/dashboard/miembros',    label: 'Miembros',    icon: IconUsers },
    { href: '/dashboard/mas',         label: 'Más',         icon: IconHome}, // reemplazado por CircleMenu
    { href: '/dashboard/asistencia',  label: 'Asistencia',  icon: IconAsistencias },
    { href: '/dashboard/logros',      label: 'Resultados',  icon: IconResultados },
  ],
  STUDENT: [
    { href: '/dashboard',             label: 'Inicio',      icon: IconHome},
    { href: '/dashboard/logros',      label: 'Resultados',  icon: IconResultados },
    { href: '/dashboard/mas',         label: 'Más',         icon: IconHome}, // reemplazado por CircleMenu
    { href: '/dashboard/calendario',  label: 'Calendario',  icon: IconCalendar },
    { href: '/dashboard/pagos',       label: 'Mis Pagos',   icon: IconMisPagos},
  ],
};

// Ítems del CircleMenu por rol
const ROLE_MAS_ITEMS: Record<string, { label: string; icon: React.ElementType; href: string; color: string }[]> = {
  ADMIN: [
    { label: 'Resultados', icon: IconResultados,   href: '/dashboard/logros',     color: '#F59E0B' },
    { label: 'Calendario', icon: IconCalendar,     href: '/dashboard/calendario', color: '#EF476F' },
    { label: 'Sedes',      icon: IconUbicacion,    href: '/dashboard/sedes',      color: '#06D6A0' },
    { label: 'Reportes',   icon: IconStatistics,   href: '/dashboard/reportes',   color: '#4361EE' },
    { label: 'Club',       icon: IconClub,         href: '/dashboard/club',       color: '#7C3AED' },
  ],
  COACH: [
    { label: 'Resultados', icon: IconResultados,   href: '/dashboard/logros',     color: '#F59E0B' },
    { label: 'Calendario', icon: IconCalendar,     href: '/dashboard/calendario', color: '#EF476F' },
    { label: 'Sedes',      icon: IconUbicacion,    href: '/dashboard/sedes',      color: '#06D6A0' },
    { label: 'Club',       icon: IconClub,         href: '/dashboard/club',       color: '#7C3AED' },
  ],
  STUDENT: [
    { label: 'Club',  icon: IconClub,      href: '/dashboard/club',  color: '#06D6A0' },
    { label: 'Sedes', icon: IconUbicacion, href: '/dashboard/sedes', color: '#4361EE' },
  ],
};

const ADMIN_NAV = [
  { href: '/dashboard',            label: 'Inicio',        icon: IconHome},
  { href: '/dashboard/miembros',   label: 'Miembros',      icon: IconUsers },
  { href: '/dashboard/sedes',      label: 'Sedes',         icon: IconUbicacion },
  { href: '/dashboard/asistencia', label: 'Asistencia',    icon: IconAsistencias },
  { href: '/dashboard/finanzas',   label: 'Finanzas',      icon: IconFinanzas },
  { href: '/dashboard/logros',     label: 'Resultados',    icon: IconResultados },
  { href: '/dashboard/calendario', label: 'Calendario',    icon: IconCalendar },
  { href: '/dashboard/reportes',   label: 'Reportes',      icon: IconStatistics },
  { href: '/dashboard/club',       label: 'Club',          icon: IconClub },
  { href: '/dashboard/perfil',     label: 'Mi Perfil',     icon: UserCircle },
  { href: '/dashboard/ajustes',    label: 'Ajustes',       icon: IconAjustes},
];

const COACH_NAV = [
  { href: '/dashboard',            label: 'Inicio',        icon: IconHome},
  { href: '/dashboard/miembros',   label: 'Miembros',      icon: IconUsers },
  { href: '/dashboard/sedes',      label: 'Sedes',         icon: IconUbicacion },
  { href: '/dashboard/asistencia', label: 'Asistencia',    icon: IconAsistencias },
  { href: '/dashboard/logros',     label: 'Resultados',    icon: IconResultados },
  { href: '/dashboard/calendario', label: 'Calendario',    icon: IconCalendar },
  { href: '/dashboard/club',       label: 'Club',          icon: IconClub },
  { href: '/dashboard/perfil',     label: 'Mi Perfil',     icon: UserCircle },
  { href: '/dashboard/ajustes',    label: 'Ajustes',       icon: IconAjustes},
];

const STUDENT_NAV = [
  { href: '/dashboard',            label: 'Inicio',        icon: IconHome},
  { href: '/dashboard/logros',     label: 'Resultados',    icon: IconResultados },
  { href: '/dashboard/calendario', label: 'Calendario',    icon: IconCalendar },
  { href: '/dashboard/sedes',      label: 'Sedes',         icon: IconUbicacion },
  { href: '/dashboard/club',       label: 'Club',          icon: IconClub },
  { href: '/dashboard/pagos',      label: 'Mis Pagos',     icon: IconMisPagos},
  { href: '/dashboard/perfil',     label: 'Mi Perfil',     icon: UserCircle },
  { href: '/dashboard/ajustes',    label: 'Ajustes',       icon: IconAjustes},
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
  const { user: clerkUser } = useUser();
  const [role, setRole] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [masMenuOpen, setMasMenuOpen] = useState(false);
  // Tooltip del sidebar colapsado (etiqueta con el nombre del módulo al hacer hover)
  const [navTip, setNavTip] = useState<{ label: string; top: number; left: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [clubLogoUrl, setClubLogoUrl] = useState<string | null>(null);
  const [clubName, setClubName] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userPicture, setUserPicture] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar-collapsed') === 'true';
    }
    return false;
  });

  // Ocultar el tooltip si el sidebar deja de estar colapsado
  useEffect(() => { if (!collapsed) setNavTip(null); }, [collapsed]);

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

        let res: { status: string; user?: { role: string; name?: string; picture?: string | null; club?: { name?: string; logoUrl?: string } } } | null = null;
        let attempts = 0;
        while (attempts < 3) {
          try {
            res = await apiFetch<{ status: string; user?: { role: string; name?: string; picture?: string | null; club?: { name?: string; logoUrl?: string } } }>('/me', { token });
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
        setUserPicture(res.user?.picture ?? null);

        if (userRole === 'STUDENT') {
          const STUDENT_ALLOWED = ['/dashboard', '/dashboard/logros', '/dashboard/calendario', '/dashboard/sedes', '/dashboard/club', '/dashboard/pagos', '/dashboard/mas', '/dashboard/perfil', '/dashboard/ajustes'];
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
  // Cuando el sidebar está expandido, Ajustes está oculto — no mostrar su pill activo
  const activeSideIndex = sideNavItems.findIndex(t => {
    if (!collapsed && t.href === '/dashboard/ajustes') return false;
    if (!collapsed && t.href === '/dashboard/perfil') return false;
    return isSideActive(t.href);
  });

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
        animate={{ width: collapsed ? 64 : 210 }}
        transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
        className="hidden md:flex flex-col shrink-0 relative"
        style={{ background: '#fff', borderRight: '1px solid rgba(0,0,0,0.07)', overflow: 'visible' }}
      >
        {/* Botón toggle — flotante en el borde derecho, centrado verticalmente */}
        <button
          onClick={toggleSidebar}
          className="absolute z-20 flex items-center justify-center transition-all hover:scale-110"
          style={{
            top: '50%',
            right: -13,
            transform: 'translateY(-50%)',
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: '#fff',
            border: '1px solid rgba(0,0,0,0.10)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
            color: '#7C3AED',
            cursor: 'pointer',
          }}
        >
          {collapsed
            ? <ChevronRight className="w-3.5 h-3.5" />
            : <ChevronLeft className="w-3.5 h-3.5" />
          }
        </button>

        {/* Logo */}
        <div
          className="flex items-center shrink-0"
          style={{
            borderBottom: '1px solid rgba(0,0,0,0.06)',
            minHeight: 58,
            padding: '0 12px',
            gap: 8,
          }}
        >
          <Image
            src="/logo.png"
            alt="VeloClub"
            width={28}
            height={28}
            className="object-contain shrink-0"
            style={{ borderRadius: 7 }}
          />
          {!collapsed && (
            <div className="flex items-center gap-1 ml-auto">
              <button
                className="flex items-center justify-center rounded-lg transition-colors hover:bg-secondary"
                style={{ width: 28, height: 28, color: '#8E87A8' }}
                title="Buscar"
              >
                <Search className="w-[14px] h-[14px]" />
              </button>
              <button
                className="relative flex items-center justify-center rounded-lg transition-colors hover:bg-secondary"
                style={{ width: 28, height: 28, color: '#8E87A8' }}
                title="Notificaciones"
              >
                <Bell className="w-[14px] h-[14px]" />
              </button>
            </div>
          )}
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
              // Ajustes y Mi Perfil se ocultan cuando el sidebar está expandido (ya aparecen en el footer)
              if (href === '/dashboard/ajustes' && !collapsed) return null;
              if (href === '/dashboard/perfil') return null;
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
                  onMouseEnter={collapsed ? (e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    setNavTip({ label, top: r.top + r.height / 2, left: r.right + 10 });
                  } : undefined}
                  onMouseLeave={collapsed ? () => setNavTip(null) : undefined}
                >
                  <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={active ? 2.5 : 2} />
                  {!collapsed && <span>{label}</span>}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer — usuario */}
        <div
          className="flex items-center shrink-0"
          style={{
            borderTop: '1px solid rgba(0,0,0,0.06)',
            padding: collapsed ? '10px 0' : '10px 12px',
            gap: collapsed ? 0 : 10,
            justifyContent: collapsed ? 'center' : undefined,
          }}
        >
          {/* Avatar — fuente: foto app > foto Google OAuth > imageUrl Clerk */}
          <Link href="/dashboard/perfil" className="shrink-0" title="Mi Perfil">
            {(() => {
              const googlePhoto = clerkUser?.externalAccounts?.find(a => a.provider === 'google')?.imageUrl;
              const src = userPicture || googlePhoto || clerkUser?.imageUrl || null;
              if (src) return (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt={userName ?? 'Perfil'}
                  style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '2px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                />
              );
              return (
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: SIDEBAR_ROLE_GRADIENT[role ?? 'ADMIN'] ?? SIDEBAR_ROLE_GRADIENT.ADMIN, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', border: '2px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', flexShrink: 0 }}>
                  {userName?.charAt(0)?.toUpperCase() ?? 'U'}
                </div>
              );
            })()}
          </Link>

          {/* Nombre + rol (solo expandido) */}
          {!collapsed && (
            <Link href="/dashboard/perfil" className="flex-1 min-w-0">
              <div className="text-[12px] font-bold truncate" style={{ color: '#1a1028' }}>
                {userName ?? 'Usuario'}
              </div>
              <div className="text-[9px] font-bold tracking-wide" style={{ color: SIDEBAR_ROLE_COLOR[role ?? 'ADMIN'] ?? '#8E87A8' }}>
                {SIDEBAR_ROLE_LABEL[role ?? 'ADMIN'] ?? role}
              </div>
            </Link>
          )}

          {/* Ícono de ajustes (solo expandido) */}
          {!collapsed && (
            <Link
              href="/dashboard/ajustes"
              title="Ajustes"
              className="shrink-0 flex items-center justify-center transition-colors hover:bg-secondary rounded-lg"
              style={{ width: 26, height: 26, color: '#8E87A8' }}
            >
              <IconAjustes className="w-[14px] h-[14px]" />
            </Link>
          )}
        </div>
      </motion.aside>

      {/* Tooltip del sidebar colapsado — etiqueta con el nombre del módulo */}
      {navTip && typeof document !== 'undefined' && createPortal(
        <div
          className="hidden md:block pointer-events-none"
          style={{ position: 'fixed', top: navTip.top, left: navTip.left, transform: 'translateY(-50%)', zIndex: 60 }}
        >
          <div
            className="relative text-white text-[12px] font-semibold rounded-lg whitespace-nowrap"
            style={{ background: '#1A1028', padding: '6px 10px', boxShadow: '0 6px 20px rgba(0,0,0,0.22)' }}
          >
            {navTip.label}
            {/* Flechita apuntando al ícono */}
            <span
              style={{
                position: 'absolute', top: '50%', left: -4, transform: 'translateY(-50%) rotate(45deg)',
                width: 8, height: 8, background: '#1A1028', borderRadius: 1,
              }}
            />
          </div>
        </div>,
        document.body
      )}

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

        <main className="flex-1 overflow-y-auto pb-28 md:pb-0" style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain' }}>
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
              style={{ background: 'rgba(15,10,30,0.52)', zIndex: 29 }}
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
            const totalSlots = tabItems.length;
            const hasNotch = true;
            return (
              /* box-shadow en lugar de filter:drop-shadow — mucho más eficiente en móvil */
              <div style={{ pointerEvents: 'auto' }}>
                {/* Bar — pill blanco, overflow visible para que el bump salga por arriba */}
                <div
                  className="relative flex w-full"
                  style={{
                    background: '#FFFFFF',
                    borderRadius: 40,
                    padding: '6px 0',
                    overflow: 'visible',
                    boxShadow: '0 -2px 12px rgba(124,58,237,0.08), 0 4px 16px rgba(124,58,237,0.10)',
                    transform: 'translateZ(0)', /* forzar capa GPU */
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

                  {/* Círculo deslizante — will-change para promoción GPU anticipada */}
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
                        willChange: 'left',
                        transform: 'translateZ(0)',
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

                </div>
              </div>
            );
          })()}
        </nav>
      </div>
    </div>
  );
}
