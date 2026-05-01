'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api-client';
import LoadingScreen from '@/components/ui/loading-screen';
import Link from 'next/link';

const TABS = [
  {
    href: '/superadmin', label: 'Dashboard', exact: true,
    icon: (c: string) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    href: '/superadmin/clubs', label: 'Clubs', exact: false,
    icon: (c: string) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    href: '/superadmin/finanzas', label: 'Finanzas', exact: false,
    icon: (c: string) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
  },
  {
    href: '/superadmin/configuracion', label: 'Config', exact: false,
    icon: (c: string) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
];

const SCREEN_LABELS: Record<string, string> = {
  '/superadmin':               'Dashboard',
  '/superadmin/clubs':         'Clubs',
  '/superadmin/finanzas':      'Finanzas',
  '/superadmin/configuracion': 'Configuración',
};

const TIPO_ICON: Record<string, string> = {
  CLUB_CREADO:      '🏠',
  CLUB_DESACTIVADO: '⏸',
  PAGO_VENCIDO:     '⚠️',
  PAGO_REGISTRADO:  '💳',
};

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
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const [checking, setChecking]       = useState(true);
  const [spin, setSpin]               = useState(false);
  const [panelOpen, setPanelOpen]     = useState(false);
  const [notifs, setNotifs]           = useState<Notif[]>([]);
  const [notifsLoading, setNotifsLoading] = useState(false);

  // Auth check
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { router.push('/sign-in'); return; }
    (async () => {
      try {
        const token = await getToken();
        const res = await apiFetch<{ status: string }>('/me', { token });
        if (res.status !== 'superadmin') { router.replace('/dashboard'); return; }
        setChecking(false);
      } catch {
        router.replace('/sign-in');
      }
    })();
  }, [isLoaded, isSignedIn]);

  // Cargar notificaciones
  const loadNotifs = useCallback(async () => {
    if (!isSignedIn) return;
    setNotifsLoading(true);
    try {
      const token = await getToken();
      const res = await apiFetch<{ notificaciones: Notif[] }>('/superadmin/notificaciones', { token });
      setNotifs(res.notificaciones);
    } catch { /* silencioso */ }
    finally { setNotifsLoading(false); }
  }, [isSignedIn, getToken]);

  // Polling cada 60s
  useEffect(() => {
    if (checking) return;
    loadNotifs();
    const iv = setInterval(loadNotifs, 60000);
    return () => clearInterval(iv);
  }, [checking, loadNotifs]);

  async function marcarLeida(id: string) {
    const token = await getToken();
    await apiFetch(`/superadmin/notificaciones/${id}/leer`, { method: 'PATCH', token });
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n));
  }

  async function marcarTodas() {
    const token = await getToken();
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
        <button
          onClick={() => { setSpin(true); setTimeout(() => { setSpin(false); window.location.reload(); }, 400); }}
          className="w-[34px] h-[34px] rounded-full flex items-center justify-center"
          style={{ background: '#F0EEF8', border: '1px solid rgba(120,80,200,0.10)', color: '#8E87A8', transition: 'transform 0.4s', transform: spin ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
        </button>
        {/* Bell */}
        <button
          onClick={() => { setPanelOpen(true); loadNotifs(); }}
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
        </button>
      </div>

      {/* Notification Panel Overlay */}
      {panelOpen && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setPanelOpen(false)} />
          <div className="fixed top-0 right-0 bottom-0 z-50 flex flex-col" style={{ width: '85%', maxWidth: 360, background: '#fff', boxShadow: '-8px 0 32px rgba(0,0,0,0.15)' }}>
            {/* Panel header */}
            <div className="flex items-center gap-2 px-4 py-3 shrink-0" style={{ borderBottom: '1px solid rgba(120,80,200,0.10)' }}>
              <h3 className="flex-1 m-0 text-[15px] font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: '#1A1028' }}>
                Notificaciones
              </h3>
              {noLeidas > 0 && (
                <button onClick={marcarTodas} className="text-[11px] font-semibold" style={{ color: '#7C3AED', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Marcar todas
                </button>
              )}
              <button onClick={() => setPanelOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ background: '#F0EEF8', border: 'none', cursor: 'pointer', color: '#8E87A8' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto">
              {notifsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#7C3AED', borderTopColor: 'transparent' }} />
                </div>
              ) : notifs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-2" style={{ color: '#8E87A8' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                  </svg>
                  <p className="text-[13px]">Sin notificaciones</p>
                </div>
              ) : (
                notifs.map(n => (
                  <button
                    key={n.id}
                    onClick={() => marcarLeida(n.id)}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left"
                    style={{ borderBottom: '1px solid rgba(120,80,200,0.07)', background: n.leida ? 'transparent' : 'rgba(124,58,237,0.04)', cursor: 'pointer', border: 'none' }}
                  >
                    <span className="text-xl shrink-0 mt-0.5">{TIPO_ICON[n.tipo] ?? '🔔'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[13px] font-semibold m-0 truncate" style={{ color: '#1A1028' }}>{n.titulo}</p>
                        {!n.leida && <div className="w-2 h-2 rounded-full shrink-0" style={{ background: '#7C3AED' }} />}
                      </div>
                      <p className="text-[11px] m-0 mt-0.5" style={{ color: '#8E87A8' }}>{n.cuerpo}</p>
                      <p className="text-[10px] m-0 mt-1" style={{ color: '#8E87A8' }}>
                        {new Date(n.createdAt).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        {children}
      </main>

      {/* Bottom Tab Nav */}
      <div className="shrink-0" style={{ background: '#FFFFFF', borderTop: '1.5px solid rgba(120,80,200,0.10)', boxShadow: '0 -4px 24px rgba(124,58,237,0.06)' }}>
        <div className="flex items-center pt-1.5 pb-1">
          {TABS.map((tab) => {
            const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
            const color  = active ? ACCENT : '#8E87A8';
            return (
              <Link key={tab.href} href={tab.href} className="flex-1 flex flex-col items-center gap-1 py-1 relative">
                {active && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-11 h-8 rounded-xl" style={{ background: 'rgba(124,58,237,0.08)' }} />
                )}
                <div className="relative z-10">{tab.icon(color)}</div>
                <span className="relative z-10 text-[9.5px] tracking-wide" style={{ color, fontWeight: active ? 700 : 500 }}>
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
        <div className="flex justify-center pb-1.5">
          <div className="w-24 h-1 rounded-full opacity-20" style={{ background: '#8E87A8' }} />
        </div>
      </div>
    </div>
  );
}
