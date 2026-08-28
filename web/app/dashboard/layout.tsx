'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth, useSession, useUser } from '@clerk/nextjs';
import { useEffect, useState, useRef, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { apiFetch } from '@/lib/api-client';
import LoadingScreen, { LoadingCurtain, CURTAIN_MS, esperarPantallaCarga } from '@/components/ui/loading-screen';
import { BottomCircleMenu } from '@/components/ui/bottom-circle-menu';
import { SearchModal } from '@/components/ui/search-modal';
import { NotificationsBell } from '@/components/ui/notifications-bell';
import TermsGateModal from '@/components/ui/terms-gate-modal';
import { Settings, ChevronLeft, ChevronRight, ArrowLeft, Trophy, ClipboardList } from 'lucide-react';
import { IconHome, IconUsers, IconCalendar, IconStatistics, IconClub, IconFinanzas, IconUbicacion, IconAsistencias, IconResultados, IconAjustes, IconMisPagos, IconPerfil, IconSuscripcion, IconBuscar } from '@/components/ui/custom-icons';

// Modal de aceptación de Términos y Política de Datos — desactivado hasta
// completar razón social/NIT en docs/legal. Cambiar a true para publicar.
const TERMS_GATE_ENABLED = false;

// ── Colores por rol (sidebar footer) ─────────────────────────────────────────
const SIDEBAR_ROLE_LABEL: Record<string, string> = {
  SUPERADMIN: 'Superadmin',
  ADMIN:      'Admin',
  ENTRENADOR: 'Entrenador',
  DEPORTISTA: 'Deportista',
};
const SIDEBAR_ROLE_COLOR: Record<string, string> = {
  SUPERADMIN: '#EF476F',
  ADMIN:      '#FFB703',
  ENTRENADOR:      '#06D6A0',
  DEPORTISTA:    '#381DA0',
};
const SIDEBAR_ROLE_GRADIENT: Record<string, string> = {
  SUPERADMIN: 'linear-gradient(135deg,#EF476F,#C1121F)',
  ADMIN:      'linear-gradient(135deg,#FFB703,#FB8500)',
  ENTRENADOR:      'linear-gradient(135deg,#06D6A0,#0CB68D)',
  DEPORTISTA:    '#381DA0',
};
import { cn } from '@/lib/utils';
import * as Sentry from '@sentry/nextjs';

// "Más" va en el índice 2 (centro del bottom bar) para ADMIN y ENTRENADOR
// El href '/dashboard/mas' es el centinela — no navega, activa el CircleMenu
const ROLE_TABS: Record<string, { href: string; label: string; icon: React.ElementType }[]> = {
  ADMIN: [
    { href: '/dashboard',             label: 'Inicio',      icon: IconHome},
    { href: '/dashboard/asistencia',  label: 'Asistencia',  icon: IconAsistencias },
    { href: '/dashboard/mas',         label: 'Más',         icon: IconHome}, // reemplazado por CircleMenu
    { href: '/dashboard/miembros',    label: 'Miembros',    icon: IconUsers },
    { href: '/dashboard/finanzas',    label: 'Finanzas',    icon: IconFinanzas },
  ],
  ENTRENADOR: [
    { href: '/dashboard',             label: 'Inicio',      icon: IconHome},
    { href: '/dashboard/asistencia',  label: 'Asistencia',  icon: IconAsistencias },
    { href: '/dashboard/mas',         label: 'Más',         icon: IconHome}, // reemplazado por CircleMenu
    { href: '/dashboard/miembros',    label: 'Miembros',    icon: IconUsers },
    { href: '/dashboard/logros',      label: 'Rendimiento',  icon: IconResultados },
  ],
  DEPORTISTA: [
    { href: '/dashboard',             label: 'Inicio',      icon: IconHome},
    { href: '/dashboard/calendario',  label: 'Calendario',  icon: IconCalendar },
    { href: '/dashboard/mas',         label: 'Más',         icon: IconHome}, // reemplazado por CircleMenu
    { href: '/dashboard/logros',      label: 'Rendimiento',  icon: IconResultados },
    { href: '/dashboard/pagos',       label: 'Mis pagos',   icon: IconMisPagos},
  ],
};

// Ítems del CircleMenu por rol
const ROLE_MAS_ITEMS: Record<string, { label: string; icon: React.ElementType; href: string; color: string }[]> = {
  ADMIN: [
    { label: 'Calendario', icon: IconCalendar,     href: '/dashboard/calendario', color: '#EF476F' },
    { label: 'Rendimiento', icon: IconResultados,   href: '/dashboard/logros',     color: '#F59E0B' },
    { label: 'Analíticas', icon: IconStatistics,   href: '/dashboard/reportes',   color: '#4361EE' },
    { label: 'Sedes',      icon: IconUbicacion,    href: '/dashboard/sedes',      color: '#06D6A0' },
    { label: 'Club',       icon: IconClub,         href: '/dashboard/club',       color: '#381DA0' },
  ],
  ENTRENADOR: [
    { label: 'Calendario', icon: IconCalendar,     href: '/dashboard/calendario', color: '#EF476F' },
    { label: 'Rendimiento', icon: IconResultados,   href: '/dashboard/logros',     color: '#F59E0B' },
    { label: 'Sedes',      icon: IconUbicacion,    href: '/dashboard/sedes',      color: '#06D6A0' },
    { label: 'Club',       icon: IconClub,         href: '/dashboard/club',       color: '#381DA0' },
  ],
  DEPORTISTA: [
    { label: 'Sedes', icon: IconUbicacion, href: '/dashboard/sedes', color: '#4361EE' },
    { label: 'Club',  icon: IconClub,      href: '/dashboard/club',  color: '#06D6A0' },
  ],
};

// El orden es por frecuencia de uso, no por jerarquia: arriba lo que se abre
// a diario, abajo lo que se configura una vez. Sedes estaba tercera y es
// justamente lo contrario —una sede se crea, se corrige alguna vez y no se
// vuelve a tocar en meses—, asi que le quitaba el mejor puesto de la lista a
// Asistencia, que el entrenador abre cada dia de entrenamiento. La linea
// divisoria antes de Sedes separa lo que se opera de lo que se configura.
const ADMIN_NAV = [
  { href: '/dashboard',            label: 'Inicio',        icon: IconHome},
  { href: '/dashboard/asistencia', label: 'Asistencia',    icon: IconAsistencias },
  { href: '/dashboard/miembros',   label: 'Miembros',      icon: IconUsers },
  { href: '/dashboard/calendario', label: 'Calendario',    icon: IconCalendar },
  { href: '/dashboard/finanzas',   label: 'Finanzas',      icon: IconFinanzas },
  { href: '/dashboard/logros',     label: 'Rendimiento',    icon: IconResultados },
  { href: '/dashboard/reportes',   label: 'Analíticas',    icon: IconStatistics },
  { href: '/dashboard/sedes',      label: 'Sedes',         icon: IconUbicacion },
  { href: '/dashboard/club',       label: 'Club',          icon: IconClub },
  { href: '/dashboard/perfil',     label: 'Mi perfil',     icon: IconPerfil },
  { href: '/dashboard/ajustes',    label: 'Ajustes',       icon: IconAjustes},
];

const ENTRENADOR_NAV = [
  { href: '/dashboard',            label: 'Inicio',        icon: IconHome},
  { href: '/dashboard/asistencia', label: 'Asistencia',    icon: IconAsistencias },
  { href: '/dashboard/miembros',   label: 'Miembros',      icon: IconUsers },
  { href: '/dashboard/calendario', label: 'Calendario',    icon: IconCalendar },
  { href: '/dashboard/logros',     label: 'Rendimiento',    icon: IconResultados },
  { href: '/dashboard/sedes',      label: 'Sedes',         icon: IconUbicacion },
  { href: '/dashboard/club',       label: 'Club',          icon: IconClub },
  { href: '/dashboard/perfil',     label: 'Mi perfil',     icon: IconPerfil },
  { href: '/dashboard/ajustes',    label: 'Ajustes',       icon: IconAjustes},
];

const DEPORTISTA_NAV = [
  { href: '/dashboard',            label: 'Inicio',        icon: IconHome},
  { href: '/dashboard/calendario', label: 'Calendario',    icon: IconCalendar },
  { href: '/dashboard/logros',     label: 'Rendimiento',    icon: IconResultados },
  { href: '/dashboard/pagos',      label: 'Mis pagos',     icon: IconMisPagos},
  { href: '/dashboard/sedes',      label: 'Sedes',         icon: IconUbicacion },
  { href: '/dashboard/club',       label: 'Club',          icon: IconClub },
  { href: '/dashboard/perfil',     label: 'Mi perfil',     icon: IconPerfil },
  { href: '/dashboard/ajustes',    label: 'Ajustes',       icon: IconAjustes},
];

const ROLE_NAV: Record<string, typeof ADMIN_NAV> = {
  ADMIN:   ADMIN_NAV,
  ENTRENADOR:   ENTRENADOR_NAV,
  DEPORTISTA: DEPORTISTA_NAV,
};

// Deslizamiento del sidebar al entrar/salir de un sub-menú (Ajustes,
// Rendimiento). d > 0 entra al sub-menú (desde la derecha); d < 0 vuelve.
const NAV_SLIDE = {
  enter:  (d: number) => ({ x: d * 22, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:   (d: number) => ({ x: d * -22, opacity: 0 }),
};



export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoaded, isSignedIn, userId, sessionId } = useAuth();
  const { session } = useSession();
  const { user: clerkUser } = useUser();
  const [role, setRole] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  // Aviso de servidor saturado durante el arranque
  const [retrying, setRetrying] = useState(false);
  // Cortina de salida: se retira hacia la derecha dejando ver el dashboard ya montado
  const [curtain, setCurtain] = useState(true);
  const mountedAtRef = useRef(Date.now());
  // La espera de la pantalla de carga ocurre una sola vez, en el arranque.
  // Con un ref (y no con meRefresh) queda garantizada aunque el efecto se
  // vuelva a ejecutar por cualquier motivo.
  const esperaHechaRef = useRef(false);
  const [masMenuOpen, setMasMenuOpen] = useState(false);
  // La barra inferior se retira mientras se baja y vuelve al subir o al parar.
  const [navOculta, setNavOculta] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  // Tooltip del sidebar colapsado (etiqueta con el nombre del módulo al hacer hover)
  const [navTip, setNavTip] = useState<{ label: string; top: number; left: number } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [clubName, setClubName] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userPicture, setUserPicture] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(true);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar-collapsed') === 'true';
    }
    return false;
  });

  // Retirar la cortina cuando termina de correrse
  useEffect(() => {
    if (checking) return;
    const t = setTimeout(() => setCurtain(false), CURTAIN_MS);
    return () => clearTimeout(t);
  }, [checking]);

  // ── Barra inferior que se retira al bajar ─────────────────────────────────
  // El scroll no ocurre en la ventana sino dentro de <main>, que tiene su
  // propio desbordamiento: escuchar el scroll de window aqui no haria nada.
  //
  // Se retira al bajar y vuelve en tres casos: al subir, al detenerse el
  // scroll, y en los dos extremos del recorrido. Asi nunca se queda escondida
  // esperando un gesto concreto.
  //
  // Depende de `checking`: mientras esta en true el layout devuelve la pantalla
  // de carga y <main> todavia no existe, asi que en el primer montaje la
  // referencia esta vacia. Sin esta dependencia el efecto no se volvia a
  // ejecutar nunca y el detector no llegaba a conectarse.
  useEffect(() => {
    const cont = mainRef.current;
    if (!cont) return;

    // Margen para que un temblor del dedo no dispare el cambio, y una zona
    // inicial donde la barra no se mueve: en una lista corta, esconderla a los
    // pocos pixeles se siente como un parpadeo.
    const UMBRAL = 6;
    const DESDE = 40;
    // Algo mas que la animacion de salida (700 ms). Con una espera mas corta,
    // frenar de golpe traia la barra de vuelta antes de que terminara de irse y
    // parecia que nunca alcanzaba a esconderse.
    const PARADA_MS = 800;

    let previo = cont.scrollTop;
    let parada: ReturnType<typeof setTimeout> | undefined;

    const alHacerScroll = () => {
      const y = cont.scrollTop;
      const delta = y - previo;
      previo = y;

      const alFinal = y + cont.clientHeight >= cont.scrollHeight - 10;
      if (y <= 8 || alFinal) setNavOculta(false);
      else if (delta > UMBRAL && y > DESDE) setNavOculta(true);
      else if (delta < -UMBRAL) setNavOculta(false);

      // El scroll por inercia sigue emitiendo eventos, asi que el temporizador
      // se reinicia solo hasta que el movimiento se detiene de verdad.
      clearTimeout(parada);
      parada = setTimeout(() => setNavOculta(false), PARADA_MS);
    };

    cont.addEventListener('scroll', alHacerScroll, { passive: true });
    return () => {
      cont.removeEventListener('scroll', alHacerScroll);
      clearTimeout(parada);
    };
  }, [checking]);

  // Con el megamenu abierto la barra es parte del menu: no puede irse.
  useEffect(() => { if (masMenuOpen) setNavOculta(false); }, [masMenuOpen]);

  // Cada modulo arranca desde arriba, con la barra a la vista.
  useEffect(() => { setNavOculta(false); }, [pathname]);

  // Ocultar el tooltip si el sidebar deja de estar colapsado
  useEffect(() => { if (!collapsed) setNavTip(null); }, [collapsed]);
  // Limpiar el tooltip al navegar — evita que quede pegado si el onMouseLeave
  // no se dispara porque el contenido del sidebar cambió.
  useEffect(() => { setNavTip(null); }, [pathname]);

  // Refresco en vivo de nombre/foto/logo en toda la página, sin recargar:
  // 1) el evento global 'vc:me-updated' (lo disparan Ajustes y otros al guardar)
  // 2) cambios reactivos del usuario de Clerk (foto/nombre editados en su modal)
  const [meRefresh, setMeRefresh] = useState(0);
  useEffect(() => {
    const onUpd = () => setMeRefresh(k => k + 1);
    window.addEventListener('vc:me-updated', onUpd);
    return () => window.removeEventListener('vc:me-updated', onUpd);
  }, []);
  const clerkImage = clerkUser?.imageUrl ?? null;
  const clerkFullName = clerkUser?.fullName ?? null;
  const clerkSnapshotRef = useRef<string | null>(null);
  useEffect(() => {
    // Durante el arranque no cuenta como cambio: Clerk hidrata el usuario
    // después del primer render y eso disparaba un refresco que reejecutaba la
    // verificación saltándose la espera, cortando la pantalla de carga.
    if (checking) return;
    const snapshot = `${clerkImage}|${clerkFullName}`;
    if (clerkSnapshotRef.current !== null && clerkSnapshotRef.current !== snapshot) {
      setMeRefresh(k => k + 1);
    }
    clerkSnapshotRef.current = snapshot;
  }, [clerkImage, clerkFullName, checking]);

  // Rastrea la profundidad de navegación del sidebar (0 = nav principal,
  // 1 = sub-menú de un módulo) para animar la dirección del deslizamiento.
  // Debe declararse antes de cualquier return temprano (reglas de hooks).
  // Depende solo de la ruta (no de collapsed) — expandir/contraer el sidebar
  // nunca debe disparar la animación de deslizamiento del sub-menú.
  const navDepthNow = (pathname.startsWith('/dashboard/ajustes') || pathname.startsWith('/dashboard/logros')) ? 1 : 0;
  const prevNavDepthRef = useRef(navDepthNow);
  useEffect(() => { prevNavDepthRef.current = navDepthNow; }, [navDepthNow]);

  // Atajo de teclado para abrir el buscador (Ctrl/Cmd + K)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { router.push('/sign-in'); return; }

    // Flag para cancelar operaciones async si el userId cambia antes de que terminen
    let stale = false;

    // Solo mostrar pantalla de carga en el primer chequeo — los refrescos en vivo
    // (meRefresh > 0) actualizan nombre/foto en silencio, sin parpadeo.
    if (meRefresh === 0) setChecking(true);

    (async () => {
      try {
        const token = await session?.getToken({ skipCache: true });
        if (stale) return;

        let res: { status: string; user?: { role: string; name?: string; picture?: string | null; club?: { name?: string; logoUrl?: string; verified?: boolean }; termsAcceptedAt?: string | null } } | null = null;
        let attempts = 0;
        while (attempts < 3) {
          try {
            res = await apiFetch<{ status: string; user?: { role: string; name?: string; picture?: string | null; club?: { name?: string; logoUrl?: string; verified?: boolean }; termsAcceptedAt?: string | null } }>('/me', { token });
            break;
          } catch (err) {
            const { ApiError } = await import('@/lib/api-client');
            if (err instanceof ApiError && err.status === 429) {
              attempts++;
              if (meRefresh === 0) setRetrying(true);
              await new Promise(r => setTimeout(r, 1500 * attempts));
              continue;
            }
            throw err;
          }
        }

        if (!res || stale) return;
        if (meRefresh === 0) setRetrying(false);
        if (res.status === 'needs_onboarding'){ router.replace('/onboarding');       return; }
        if (res.status === 'no_access')        { router.replace('/no-access');       return; }
        if (res.status === 'inactive')         { router.replace('/inactivo');         return; }
        if (res.status === 'member_inactive')  { router.replace('/cuenta-pausada');   return; }
        if (res.status === 'superadmin')       { router.replace('/superadmin');       return; }
        if (res.status === 'complete_profile') { router.replace('/completar-perfil'); return; }
        const userRole = res.user?.role ?? null;
        setRole(userRole);

        // Sin esto todos los errores de Sentry salian con cero usuarios
        // afectados y no habia forma de saber si algo le pasaba a una persona o
        // a un club entero. Va solo el id de Clerk, el rol y el club: ni nombre,
        // ni correo, ni nada que identifique a un deportista, que en su mayoria
        // son menores de edad. El rol permite ver de un vistazo si algo le pasa
        // a los entrenadores y no a los admin, que es la pregunta que mas se
        // repite al mirar un error.
        Sentry.setUser(userId ? { id: userId } : null);
        Sentry.setTag('rol', userRole ?? 'desconocido');
        setClubName(res.user?.club?.name ?? null);
        setUserName(res.user?.name ?? null);
        setUserPicture(res.user?.picture ?? null);
        setTermsAccepted(!!res.user?.termsAcceptedAt);

        if (userRole === 'DEPORTISTA') {
          const DEPORTISTA_PERMITIDO = ['/dashboard', '/dashboard/logros', '/dashboard/calendario', '/dashboard/sedes', '/dashboard/club', '/dashboard/pagos', '/dashboard/mas', '/dashboard/perfil', '/dashboard/ajustes'];
          const allowed = DEPORTISTA_PERMITIDO.some(r => pathname === r || pathname.startsWith(r + '/'));
          if (!allowed) { router.replace('/dashboard'); return; }
        }
        if (userRole === 'ENTRENADOR') {
          const ENTRENADOR_BLOQUEADO = ['/dashboard/finanzas', '/dashboard/reportes', '/dashboard/pagos'];
          const blocked = ENTRENADOR_BLOQUEADO.some(r => pathname === r || pathname.startsWith(r + '/'));
          if (blocked) { router.replace('/dashboard'); return; }
        }

        // Sostener la pantalla de carga hasta que la secuencia termine
        if (!esperaHechaRef.current) {
          esperaHechaRef.current = true;
          await esperarPantallaCarga(mountedAtRef.current);
        }
        if (stale) return;
        setChecking(false);
      } catch (err) {
        if (stale) return;
        const { ApiError } = await import('@/lib/api-client');
        if (err instanceof ApiError && err.status === 401) {
          router.replace('/sign-in');
        } else if (err instanceof ApiError && err.status === 403) {
          router.replace('/no-access');
        } else {
          // Falla cerrado: sin rol confirmado no se renderiza el dashboard. Antes
          // se mostraba con role null, que caía al menú de ADMIN por defecto.
          router.replace('/sign-in');
        }
      }
    })();

    // Cleanup: marcar como stale para que la async no aplique resultados viejos
    return () => { stale = true; };
  }, [isLoaded, isSignedIn, userId, sessionId, meRefresh]);

  // El panel ocupa exactamente el alto de la ventana (h-dvh) y hace scroll por
  // dentro, en <main>. Aun asi aparecia una segunda barra, la de la pagina
  // completa, pegada a la del contenido. Se bloquea el scroll del documento
  // mientras el panel esta montado: la unica barra que debe existir aqui es la
  // de adentro. Se restaura al salir, porque la landing y el inicio de sesion
  // si necesitan desplazarse.
  useEffect(() => {
    const html = document.documentElement;
    const previoHtml = html.style.overflow;
    const previoBody = document.body.style.overflow;
    html.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = previoHtml;
      document.body.style.overflow = previoBody;
    };
  }, []);

  if (checking) return <LoadingScreen retrying={retrying} />;

  async function handleAcceptTerms() {
    const token = await session?.getToken();
    await apiFetch('/me/accept-terms', { method: 'PATCH', token });
    setTermsAccepted(true);
  }

  // Sin rol confirmado se usa el menú de menor privilegio, no el de ADMIN: así un
  // fallo al resolver el rol nunca deja a la vista los módulos de administración.
  const tabItems   = role ? (ROLE_TABS[role] ?? ROLE_TABS.DEPORTISTA) : ROLE_TABS.DEPORTISTA;
  const sideNavItems = role ? (ROLE_NAV[role] ?? ROLE_NAV.DEPORTISTA) : ROLE_NAV.DEPORTISTA;
  const tabHrefs   = new Set(tabItems.map((t) => t.href));
  const isOnExtra  = !tabHrefs.has(pathname) && pathname !== '/dashboard' && pathname.startsWith('/dashboard/');

  function isTabActive(href: string) {
    if (href === '/dashboard/mas') return false; // el CircleMenu maneja su propio estado
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname === href || pathname.startsWith(href + '/');
  }

  function isSideActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard';
    // El módulo "Club" solo se activa en la ruta exacta; /dashboard/club/[id] es la
    // vista pública de un club de la comunidad y no debe marcar el módulo.
    if (href === '/dashboard/club') return pathname === '/dashboard/club';
    return pathname === href || pathname.startsWith(href + '/');
  }

  // Sub-menú de Ajustes en el sidebar expandido — reemplaza la nav principal
  // mientras se está dentro de /dashboard/ajustes (Mi perfil / Mi club / Mi suscripción).
  const onAjustes = pathname.startsWith('/dashboard/ajustes');
  const isAdmin = role === 'ADMIN';
  const AJUSTES_SUBNAV = [
    { key: 'perfil',      label: 'Mi perfil',      icon: IconPerfil, adminOnly: false },
    { key: 'club',        label: 'Mi club',        icon: IconClub,   adminOnly: true },
    { key: 'suscripcion', label: 'Mi suscripción', icon: IconSuscripcion, adminOnly: true },
  ].filter(item => !item.adminOnly || isAdmin);

  // Sub-menú de Rendimiento en el sidebar expandido — igual que Ajustes.
  // Dentro de /dashboard/logros muestra Competencias / Entrenamientos (?tab=).
  const onLogros = pathname.startsWith('/dashboard/logros');
  const LOGROS_SUBNAV = [
    { key: 'comp',  label: 'Competencias',   icon: Trophy },
    // Planilla y no mancuerna: la mancuerna ahora significa gimnasio, y este
    // menú cubre los dos escenarios (pista y gimnasio).
    { key: 'train', label: 'Entrenamientos', icon: ClipboardList },
  ];

  // Vista actual del sidebar y dirección del deslizamiento (main → sub-menú
  // desliza hacia adentro; Volver desliza de regreso). El ref y el efecto que
  // rastrean la dirección viven arriba (antes del return temprano) para no
  // romper el orden de los hooks.
  // El sub-menu se muestra tambien con el sidebar comprimido, en iconos. Antes
  // solo aparecia expandido, asi que quien trabajaba con el sidebar angosto no
  // tenia por donde llegar a Mi club ni a Mi suscripcion: las secciones
  // desaparecian de la navegacion segun como tuviera el sidebar.
  const navView: 'ajustes' | 'logros' | 'main' =
    onAjustes ? 'ajustes' : onLogros ? 'logros' : 'main';
  const navDepth = navView === 'main' ? 0 : 1;
  const navDir = navDepth >= prevNavDepthRef.current ? 1 : -1;

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
    <>
    {/* La cortina va encima del dashboard ya montado y se corre a la derecha */}
    {curtain && <LoadingCurtain />}
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
            color: '#381DA0',
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
            src="/logo-vc.png"
            alt="VeloClub"
            width={28}
            height={28}
            className="object-contain shrink-0"
            style={{ borderRadius: 7 }}
          />
          {!collapsed && (
            <div className="flex items-center gap-1 ml-auto">
              <button
                onClick={() => setSearchOpen(true)}
                className="flex items-center justify-center rounded-lg transition-colors hover:bg-secondary"
                style={{ width: 28, height: 28, color: '#8E87A8' }}
                title="Buscar (Ctrl+K)"
              >
                <IconBuscar className="w-[14px] h-[14px]" />
              </button>
              <NotificationsBell />
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-2 py-2 overflow-y-auto overflow-x-hidden relative">
          <AnimatePresence mode="wait" custom={navDir} initial={false}>
            <motion.div
              key={navView}
              custom={navDir}
              variants={NAV_SLIDE}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            >
              {navView === 'ajustes' ? (
                <div>
                  <Link
                    href="/dashboard"
                    className="flex items-center rounded-xl text-sm font-semibold transition-colors hover:bg-secondary mb-2"
                    style={{
                      height: 40, color: '#8E87A8',
                      gap: collapsed ? 0 : 12,
                      paddingLeft: collapsed ? 0 : 12,
                      paddingRight: collapsed ? 0 : 12,
                      justifyContent: collapsed ? 'center' : undefined,
                    }}
                    onMouseEnter={collapsed ? (e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      setNavTip({ label: 'Volver', top: r.top + r.height / 2, left: r.right + 3 });
                    } : undefined}
                    onMouseLeave={collapsed ? () => setNavTip(null) : undefined}
                  >
                    <ArrowLeft className="w-[16px] h-[16px] shrink-0" />
                    {!collapsed && <span>Volver</span>}
                  </Link>
                  <Suspense fallback={null}>
                    <AjustesSubNavLinks items={AJUSTES_SUBNAV} accentColor={accentColor} accentBg={accentBg} collapsed={collapsed} onTip={setNavTip} />
                  </Suspense>
                </div>
              ) : navView === 'logros' ? (
                <div>
                  <Link
                    href="/dashboard"
                    className="flex items-center rounded-xl text-sm font-semibold transition-colors hover:bg-secondary mb-2"
                    style={{
                      height: 40, color: '#8E87A8',
                      gap: collapsed ? 0 : 12,
                      paddingLeft: collapsed ? 0 : 12,
                      paddingRight: collapsed ? 0 : 12,
                      justifyContent: collapsed ? 'center' : undefined,
                    }}
                    onMouseEnter={collapsed ? (e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      setNavTip({ label: 'Volver', top: r.top + r.height / 2, left: r.right + 3 });
                    } : undefined}
                    onMouseLeave={collapsed ? () => setNavTip(null) : undefined}
                  >
                    <ArrowLeft className="w-[16px] h-[16px] shrink-0" />
                    {!collapsed && <span>Volver</span>}
                  </Link>
                  <Suspense fallback={null}>
                    <LogrosSubNavLinks items={LOGROS_SUBNAV} accentColor={accentColor} accentBg={accentBg} collapsed={collapsed} onTip={setNavTip} />
                  </Suspense>
                </div>
              ) : (
                <div className="space-y-1 relative">
                  {!collapsed && activeSideIndex >= 0 && (
                    <div
                      className="absolute left-0 right-0 rounded-xl pointer-events-none"
                      style={{
                        height: 44,
                        top: `calc(${activeSideIndex} * 48px)`,
                        background: accentBg,
                        transition: 'top 0.25s cubic-bezier(0.34,1.2,0.64,1)',
                      }}
                    />
                  )}
                  {sideNavItems.map(({ href, label, icon: Icon }) => {
                    // Ajustes y Mi Perfil viven en el footer (ícono de ajustes sobre el avatar)
                    if (href === '/dashboard/ajustes') return null;
                    if (href === '/dashboard/perfil') return null;
                    const active = isSideActive(href);
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={`flex items-center rounded-xl text-sm font-semibold transition-colors relative z-10 ${active ? '' : 'hover:bg-secondary'}`}
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
                          setNavTip({ label, top: r.top + r.height / 2, left: r.right + 3 });
                        } : undefined}
                        onMouseLeave={collapsed ? () => setNavTip(null) : undefined}
                      >
                        {/* Separa lo que se opera de lo que se configura. Va
                            absoluta y no como un elemento de la lista: el
                            resaltado del activo se posiciona con el indice por
                            48px, asi que cualquier cosa que ocupe alto en el
                            flujo lo dejaria corrido de ahi para abajo. */}
                        {href === '/dashboard/sedes' && (
                          <span
                            aria-hidden
                            className="absolute left-0 right-0"
                            style={{ top: -2, borderTop: '1px solid rgba(0,0,0,0.06)' }}
                          />
                        )}
                        <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={active ? 2.5 : 2} />
                        {!collapsed && <span>{label}</span>}
                        {!collapsed && href === '/dashboard/logros' && (
                          <ChevronRight className="w-4 h-4 ml-auto shrink-0" style={{ opacity: 0.7 }} />
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </nav>

        {/* Footer — usuario */}
        <div
          className="flex items-center shrink-0"
          style={{
            borderTop: '1px solid rgba(0,0,0,0.06)',
            padding: collapsed ? '12px 0' : '10px 12px',
            gap: collapsed ? 10 : 10,
            flexDirection: collapsed ? 'column' : 'row',
            justifyContent: collapsed ? 'center' : undefined,
          }}
        >
          {/* Ícono de ajustes — colapsado: encima del avatar */}
          {collapsed && (() => {
            const active = isSideActive('/dashboard/ajustes');
            return (
              <Link
                href="/dashboard/ajustes"
                className="shrink-0 flex items-center justify-center rounded-xl transition-colors"
                style={{ width: 40, height: 40, color: active ? accentColor : '#8E87A8', background: active ? accentBg : undefined }}
                onMouseEnter={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setNavTip({ label: 'Ajustes', top: r.top + r.height / 2, left: r.right + 3 });
                }}
                onMouseLeave={() => setNavTip(null)}
              >
                <IconAjustes className="w-[18px] h-[18px]" strokeWidth={active ? 2.5 : 2} />
              </Link>
            );
          })()}

          {/* Avatar — fuente: foto app > foto Google OAuth > imageUrl Clerk */}
          <Link
            href="/dashboard/perfil"
            className="shrink-0"
            title={collapsed ? undefined : 'Mi perfil'}
            onMouseEnter={collapsed ? (e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setNavTip({ label: 'Mi perfil', top: r.top + r.height / 2, left: r.right + 3 });
            } : undefined}
            onMouseLeave={collapsed ? () => setNavTip(null) : undefined}
          >
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
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: SIDEBAR_ROLE_GRADIENT[role ?? 'ADMIN'] ?? SIDEBAR_ROLE_GRADIENT.ADMIN, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: '#fff', border: '2px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', flexShrink: 0 }}>
                  {userName?.charAt(0)?.toUpperCase() ?? 'U'}
                </div>
              );
            })()}
          </Link>

          {/* Nombre + rol (solo expandido) */}
          {!collapsed && (
            <Link href="/dashboard/perfil" className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold truncate" style={{ color: '#1a1028' }}>
                {userName ?? 'Usuario'}
              </div>
              <div className="text-[9px] font-semibold tracking-wide" style={{ color: SIDEBAR_ROLE_COLOR[role ?? 'ADMIN'] ?? '#8E87A8' }}>
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

      {/* Buscador de comunidad (clubes / deportistas / entrenadores) */}
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Bloqueo de aceptación de Términos y Política de Datos —
          desactivado temporalmente hasta completar razón social/NIT en los
          documentos legales. Reactivar cambiando TERMS_GATE_ENABLED a true. */}
      <TermsGateModal open={TERMS_GATE_ENABLED && !termsAccepted} onAccept={handleAcceptTerms} />

      {/* Tooltip del sidebar colapsado — etiqueta con el nombre del módulo.
          Solo se renderiza cuando el sidebar está colapsado, así nunca queda
          pegado si un onMouseLeave no alcanza a dispararse al navegar. */}
      {collapsed && navTip && typeof document !== 'undefined' && createPortal(
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

        {/* En movil el unico encabezado es el de Inicio, que lo pinta la propia
            pagina. Los demas modulos no llevan barra superior: cada uno ya trae
            su fila de titulo con sus acciones, y sumar otra encima dejaba dos
            filas de chrome antes del contenido en la pantalla donde el alto es
            lo mas escaso. El buscador y las notificaciones viven en Inicio (y
            en el sidebar en escritorio). */}

        <main ref={mainRef} className="flex-1 overflow-y-auto pb-28 md:pb-0" style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain' }}>
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
        <motion.nav
          className="md:hidden fixed bottom-0 left-0 right-0 z-30"
          style={{ padding: '0 16px 20px', pointerEvents: 'none' }}
          animate={{ y: navOculta ? '150%' : '0%' }}
          initial={false}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
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
                    boxShadow: '0 -2px 12px rgba(56,29,160,0.08), 0 4px 16px rgba(56,29,160,0.10)',
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
                        background: '#381DA0',
                        left: `calc((${activeTabIndex} + 0.5) / ${totalSlots} * 100% - 22px)`,
                        top: 6,
                        transition: 'left 0.35s cubic-bezier(0.34,1.2,0.64,1)',
                        boxShadow: '0 4px 20px rgba(56,29,160,0.40)',
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
        </motion.nav>
      </div>
    </div>
    </>
  );
}

// Lee el tab activo (?tab=) para resaltar el link correcto del sub-menú de
// Ajustes. Aislado en su propio componente porque useSearchParams() exige un
// límite <Suspense> alrededor cuando se usa dentro de un layout.
function AjustesSubNavLinks({ items, accentColor, accentBg, collapsed, onTip }: {
  items: { key: string; label: string; icon: React.ElementType }[];
  accentColor: string;
  accentBg: string;
  collapsed: boolean;
  onTip: (t: { label: string; top: number; left: number } | null) => void;
}) {
  const searchParams = useSearchParams();
  const ajustesTab = searchParams.get('tab') ?? 'perfil';
  const activeIndex = items.findIndex(item => item.key === ajustesTab);

  return (
    <div className="space-y-1 relative">
      {/* Comprimido el fondo lo pinta cada item: la barra deslizante ocupa todo
          el ancho y en 64px se ve como una franja, no como un boton. */}
      {!collapsed && activeIndex >= 0 && (
        <div
          className="absolute left-0 right-0 rounded-xl pointer-events-none"
          style={{
            height: 44,
            top: `calc(${activeIndex} * 48px)`,
            background: accentBg,
            transition: 'top 0.25s cubic-bezier(0.34,1.2,0.64,1)',
          }}
        />
      )}
      {items.map(({ key, label, icon: Icon }) => {
        const active = ajustesTab === key;
        return (
          <Link
            key={key}
            href={`/dashboard/ajustes?tab=${key}`}
            className={`flex items-center rounded-xl text-sm font-semibold transition-colors relative z-10 ${active ? '' : 'hover:bg-secondary'}`}
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
              onTip({ label, top: r.top + r.height / 2, left: r.right + 3 });
            } : undefined}
            onMouseLeave={collapsed ? () => onTip(null) : undefined}
          >
            <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={active ? 2.5 : 2} />
            {!collapsed && <span>{label}</span>}
          </Link>
        );
      })}
    </div>
  );
}

// Sub-menú de Rendimiento (Competencias / Entrenamientos) para el sidebar
// expandido. Lee ?tab= para resaltar el link activo, igual que Ajustes.
function LogrosSubNavLinks({ items, accentColor, accentBg, collapsed, onTip }: {
  items: { key: string; label: string; icon: React.ElementType }[];
  accentColor: string;
  accentBg: string;
  collapsed: boolean;
  onTip: (t: { label: string; top: number; left: number } | null) => void;
}) {
  const searchParams = useSearchParams();
  const pathname     = usePathname();

  // El detalle de un entrenamiento vive en /logros/entrenamiento/[id] y no lleva
  // ?tab=, asi que el submenu caia en el valor por defecto y resaltaba
  // Competencias estando dentro de un entrenamiento. La ruta manda cuando la hay.
  const logrosTab = pathname.startsWith('/dashboard/logros/entrenamiento')
    ? 'train'
    : (searchParams.get('tab') ?? 'comp');
  const activeIndex = items.findIndex(item => item.key === logrosTab);

  return (
    <div className="space-y-1 relative">
      {/* Comprimido el fondo lo pinta cada item: la barra deslizante ocupa todo
          el ancho y en 64px se ve como una franja, no como un boton. */}
      {!collapsed && activeIndex >= 0 && (
        <div
          className="absolute left-0 right-0 rounded-xl pointer-events-none"
          style={{
            height: 44,
            top: `calc(${activeIndex} * 48px)`,
            background: accentBg,
            transition: 'top 0.25s cubic-bezier(0.34,1.2,0.64,1)',
          }}
        />
      )}
      {items.map(({ key, label, icon: Icon }) => {
        const active = logrosTab === key;
        return (
          <Link
            key={key}
            href={`/dashboard/logros?tab=${key}`}
            className={`flex items-center rounded-xl text-sm font-semibold transition-colors relative z-10 ${active ? '' : 'hover:bg-secondary'}`}
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
              onTip({ label, top: r.top + r.height / 2, left: r.right + 3 });
            } : undefined}
            onMouseLeave={collapsed ? () => onTip(null) : undefined}
          >
            <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={active ? 2.5 : 2} />
            {!collapsed && <span>{label}</span>}
          </Link>
        );
      })}
    </div>
  );
}
