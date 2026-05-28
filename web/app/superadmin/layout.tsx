'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useAuth, useSession, UserButton } from '@clerk/nextjs';
import { useEffect, useState, useCallback } from 'react';
import { apiFetch, ApiError } from '@/lib/api-client';
import LoadingScreen from '@/components/ui/loading-screen';
import Link from 'next/link';
import { LayoutDashboard, Building2, CircleDollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Config fue fusionado con Perfil (UserButton) — 3 tabs + UserButton = 4 slots
const TABS = [
  { href: '/superadmin',          label: 'Inicio',    exact: true,  Icon: LayoutDashboard  },
  { href: '/superadmin/clubs',    label: 'Clubs',     exact: false, Icon: Building2        },
  { href: '/superadmin/finanzas', label: 'Finanzas',  exact: false, Icon: CircleDollarSign },
];

const SCREEN_LABELS: Record<string, string> = {
  '/superadmin':          'Inicio',
  '/superadmin/clubs':    'Clubs',
  '/superadmin/finanzas': 'Finanzas',
};

// Ícono SVG por tipo de notificación — sin emojis
function TipoIcono({ tipo }: { tipo: string }) {
  const map: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
    CLUB_CREADO:      {
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
      color: '#7C3AED', bg: 'rgba(124,58,237,0.10)',
    },
    CLUB_DESACTIVADO: {
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/></svg>,
      color: '#FFB703', bg: 'rgba(255,183,3,0.10)',
    },
    PAGO_VENCIDO:     {
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
      color: '#EF476F', bg: 'rgba(239,71,111,0.10)',
    },
    PAGO_REGISTRADO:  {
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
      color: '#06D6A0', bg: 'rgba(6,214,160,0.10)',
    },
  };
  const m = map[tipo] ?? {
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
    color: '#8E87A8', bg: 'rgba(142,135,168,0.10)',
  };
  return (
    <div style={{ width: 34, height: 34, borderRadius: 10, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: m.color, flexShrink: 0 }}>
      {m.icon}
    </div>
  );
}

interface Notif {
  id: string;
  tipo: string;
  titulo: string;
  cuerpo: string;
  leida: boolean;
  createdAt: string;
}

const ACCENT = '#7C3AED';

export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const { isLoaded, isSignedIn, userId, sessionId } = useAuth();
  const { session } = useSession();

  const [checking, setChecking]       = useState(true);
  const [spin, setSpin]               = useState(false);
  const [panelOpen, setPanelOpen]     = useState(false);
  const [notifs, setNotifs]           = useState<Notif[]>([]);
  const [notifsLoading, setNotifsLoading] = useState(false);

  // Auth check — stale flag evita condición de carrera al cambiar sesión activa
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { router.push('/sign-in'); return; }

    let stale = false;
    setChecking(true);

    (async () => {
      try {
        const token = await session?.getToken({ skipCache: true });
        if (stale) return;
        const res = await apiFetch<{ status: string }>('/me', { token });
        if (stale) return;
        if (res.status !== 'superadmin') { router.replace('/dashboard'); return; }
        setChecking(false);
      } catch (err) {
        if (stale) return;
        console.error('Superadmin auth check failed:', err);
        setChecking(false);
      }
    })();

    return () => { stale = true; };
  }, [isLoaded, isSignedIn, userId, sessionId]);

  // Cargar notificaciones
  const loadNotifs = useCallback(async () => {
    if (!isSignedIn) return;
    setNotifsLoading(true);
    try {
      const token = await session?.getToken();
      const res = await apiFetch<{ notificaciones: Notif[] }>('/superadmin/notificaciones', { token });
      setNotifs(res.notificaciones);
    } catch { /* silencioso */ }
    finally { setNotifsLoading(false); }
  }, [isSignedIn, session]);

  // Polling cada 60s
  useEffect(() => {
    if (checking) return;
    loadNotifs();
    const iv = setInterval(loadNotifs, 60000);
    return () => clearInterval(iv);
  }, [checking, loadNotifs]);

  async function marcarLeida(id: string) {
    const token = await session?.getToken();
    await apiFetch(`/superadmin/notificaciones/${id}/leer`, { method: 'PATCH', token });
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n));
  }

  async function marcarTodas() {
    const token = await session?.getToken();
    await apiFetch('/superadmin/notificaciones/leer-todas', { method: 'PATCH', token });
    setNotifs(prev => prev.map(n => ({ ...n, leida: true })));
  }

  if (checking) return <LoadingScreen />;

  const title = SCREEN_LABELS[pathname] ?? 'VeloClub';
  const noLeidas = notifs.filter(n => !n.leida).length;

  return (
    <div className="flex flex-col h-dvh overflow-hidden" style={{ background: '#F7F7FB', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>

      {/* Global Header */}
      <div className="flex items-center gap-2 shrink-0" style={{ padding: '12px 16px 10px', background: '#F7F7FB', borderBottom: '1px solid rgba(120,80,200,0.10)' }}>
        <h2 className="flex-1 m-0 text-[17px] font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: '#1A1028' }}>
          {title}
        </h2>
        {/* Refresh */}
        <motion.button
          onClick={() => { setSpin(true); setTimeout(() => { setSpin(false); window.location.reload(); }, 400); }}
          whileTap={{ scale: 0.9 }}
          transition={{ duration: 0.12, ease: [0.23, 1, 0.32, 1] as [number,number,number,number] }}
          className="w-[34px] h-[34px] rounded-full flex items-center justify-center"
          style={{ background: '#F0EEF8', border: '1px solid rgba(120,80,200,0.10)', color: '#8E87A8', transition: 'transform 0.4s', transform: spin ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
        </motion.button>
        {/* Bell */}
        <motion.button
          onClick={() => { setPanelOpen(true); loadNotifs(); }}
          whileTap={{ scale: 0.9 }}
          transition={{ duration: 0.12, ease: [0.23, 1, 0.32, 1] as [number,number,number,number] }}
          className="w-[34px] h-[34px] rounded-full flex items-center justify-center relative"
          style={{ background: '#F0EEF8', border: '1px solid rgba(120,80,200,0.10)', color: '#8E87A8' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          {noLeidas > 0 && (
            <div className="absolute flex items-center justify-center" style={{ top: 5, right: 5, minWidth: 14, height: 14, borderRadius: 7, background: '#EF476F', border: '1.5px solid #F7F7FB', fontSize: 8, fontWeight: 700, color: '#fff', padding: '0 3px' }}>
              {noLeidas > 9 ? '9+' : noLeidas}
            </div>
          )}
        </motion.button>
      </div>

      {/* Notification Panel */}
      <AnimatePresence>
      {panelOpen && (
        <>
          {/* Overlay */}
          <motion.div
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(15,5,30,0.45)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={() => setPanelOpen(false)}
          />

          {/* Drawer */}
          <motion.div
            className="fixed top-0 right-0 bottom-0 z-50 flex flex-col"
            style={{ width: '88%', maxWidth: 380, background: '#F7F7FB', boxShadow: '-12px 0 48px rgba(15,5,30,0.18)' }}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] as [number,number,number,number] }}
          >
            {/* Header */}
            <div style={{ padding: '16px 16px 14px', background: '#F7F7FB', borderBottom: '1px solid rgba(120,80,200,0.08)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Ícono campana */}
                <div style={{ width: 36, height: 36, borderRadius: 11, background: 'rgba(124,58,237,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7C3AED', flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1A1028', fontFamily: 'Space Grotesk, sans-serif', lineHeight: 1.2 }}>
                    Notificaciones
                  </h3>
                  {noLeidas > 0 && (
                    <p style={{ margin: 0, fontSize: 11, color: '#8E87A8' }}>
                      {noLeidas} sin leer
                    </p>
                  )}
                </div>
                {noLeidas > 0 && (
                  <motion.button
                    onClick={marcarTodas}
                    whileTap={{ scale: 0.95 }}
                    transition={{ duration: 0.12 }}
                    style={{ padding: '5px 10px', borderRadius: 8, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.18)', color: '#7C3AED', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                  >
                    Marcar todas
                  </motion.button>
                )}
                <motion.button
                  onClick={() => setPanelOpen(false)}
                  whileTap={{ scale: 0.90 }}
                  transition={{ duration: 0.12 }}
                  style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(120,80,200,0.07)', border: 'none', cursor: 'pointer', color: '#8E87A8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </motion.button>
              </div>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px 24px' }}>
              {notifsLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120 }}>
                  <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: '#7C3AED', borderTopColor: 'transparent' }} />
                </div>
              ) : notifs.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 180, gap: 10 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(124,58,237,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(142,135,168,0.40)' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#8E87A8' }}>Sin notificaciones</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#C4BFD8' }}>Todo está al día</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {notifs.map((n, i) => (
                    <motion.button
                      key={n.id}
                      onClick={() => marcarLeida(n.id)}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] as [number,number,number,number], delay: i * 0.04 }}
                      whileTap={{ scale: 0.98 }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10,
                        padding: '12px 12px', borderRadius: 16, textAlign: 'left', cursor: 'pointer',
                        background: n.leida ? '#fff' : 'rgba(124,58,237,0.05)',
                        border: n.leida ? '1px solid rgba(120,80,200,0.08)' : '1px solid rgba(124,58,237,0.16)',
                        boxShadow: n.leida ? 'none' : '0 2px 8px rgba(124,58,237,0.06)',
                        transition: 'background 0.15s',
                      }}
                    >
                      <TipoIcono tipo={n.tipo} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1A1028', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                            {n.titulo}
                          </p>
                          {!n.leida && (
                            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#7C3AED', flexShrink: 0 }} />
                          )}
                        </div>
                        <p style={{ margin: 0, fontSize: 11, color: '#8E87A8', lineHeight: 1.4 }}>{n.cuerpo}</p>
                        <p style={{ margin: '4px 0 0', fontSize: 10, color: '#C4BFD8', fontWeight: 500 }}>
                          {new Date(n.createdAt).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
      </AnimatePresence>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        {children}
      </main>

      {/* Bottom Tab Nav — glassmorphism, ancho completo */}
      <div className="shrink-0 flex justify-center" style={{ padding: '10px 16px 20px', background: 'transparent' }}>
        {(() => {
          const activeIdx = TABS.findIndex(t => t.exact ? pathname === t.href : pathname.startsWith(t.href));
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
              }}
            >
              {/* Círculo deslizante — mismo tamaño que el avatar del UserButton */}
              {activeIdx >= 0 && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #7C3AED 0%, #4361EE 55%, #06D6A0 100%)',
                    left: `calc((${activeIdx} + 0.5) / ${TABS.length + 1} * 100% - 22px)`,
                    top: 6,
                    transition: 'left 0.35s cubic-bezier(0.34,1.2,0.64,1)',
                    boxShadow: '0 4px 20px rgba(124,58,237,0.40)',
                  }}
                />
              )}

              {/* Tabs de navegación */}
              {TABS.map((tab) => {
                const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className="flex-1 flex flex-col items-center relative z-10"
                    style={{ gap: 4, paddingBottom: 2 }}
                  >
                    <div className="flex items-center justify-center" style={{ width: 44, height: 44 }}>
                      <tab.Icon
                        size={26}
                        color={active ? '#fff' : '#8E87A8'}
                        strokeWidth={active ? 2.2 : 1.7}
                        style={{ transition: 'color 0.2s' }}
                      />
                    </div>
                    <span
                      className="text-[9px] tracking-wide leading-none"
                      style={{
                        color: active ? '#7C3AED' : '#8E87A8',
                        fontWeight: active ? 700 : 500,
                        transition: 'color 0.2s',
                      }}
                    >
                      {tab.label}
                    </span>
                  </Link>
                );
              })}

              {/* Tab Perfil — UserButton (fusiona Config + Perfil) */}
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
            </div>
          );
        })()}
      </div>
    </div>
  );
}
