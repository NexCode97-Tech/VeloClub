'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { apiFetch } from '@/lib/api-client';
import { useClubStream } from '@/hooks/useClubStream';
import {
  Bell, CheckCheck, DollarSign, UserPlus, Users, Trophy, CalendarDays, Bell as BellIcon,
} from 'lucide-react';

interface Notif {
  id: string; tipo: string; titulo: string; cuerpo: string;
  link?: string | null; leida: boolean; createdAt: string;
}

const ICON_BY_TYPE: Record<string, React.ElementType> = {
  PAYMENT_RECEIVED: DollarSign,
  PAYMENT_DUE:      DollarSign,
  NEW_MEMBER:       Users,
  NEW_FOLLOWER:     UserPlus,
  NEW_COMPETITION:  Trophy,
  NEW_EVENT:        CalendarDays,
};
const COLOR_BY_TYPE: Record<string, string> = {
  PAYMENT_RECEIVED: '#06D6A0',
  PAYMENT_DUE:      '#EF476F',
  NEW_MEMBER:       '#4361EE',
  NEW_FOLLOWER:     '#7C3AED',
  NEW_COMPETITION:  '#F59E0B',
  NEW_EVENT:        '#4361EE',
};

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'ahora';
  const m = Math.floor(s / 60); if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24); if (d < 7) return `hace ${d} d`;
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

export function NotificationsBell() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const data = await apiFetch<{ notifications: Notif[]; unread: number }>('/notifications', { token });
      setItems(data.notifications);
      setUnread(data.unread);
    } catch { /* silencioso */ }
  }, [getToken]);

  const loadCount = useCallback(async () => {
    try {
      const token = await getToken();
      const data = await apiFetch<{ unread: number }>('/notifications/unread-count', { token });
      setUnread(data.unread);
    } catch { /* silencioso */ }
  }, [getToken]);

  // Carga inicial del contador
  useEffect(() => { loadCount(); }, [loadCount]);

  // Tiempo real: al recibir el evento SSE 'notifications', refrescar
  useClubStream((ev) => {
    if (ev === 'notifications') {
      if (open) load(); else loadCount();
    }
  });

  function toggleOpen() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setCoords({ top: r.bottom + 8, right: window.innerWidth - r.right });
      load();
    }
    setOpen(o => !o);
  }

  async function markAll() {
    setUnread(0);
    setItems(prev => prev.map(n => ({ ...n, leida: true })));
    try { const token = await getToken(); await apiFetch('/notifications/read', { token, method: 'PATCH', body: JSON.stringify({}) }); }
    catch { /* silencioso */ }
  }

  async function openItem(n: Notif) {
    setOpen(false);
    if (!n.leida) {
      setUnread(u => Math.max(0, u - 1));
      try { const token = await getToken(); await apiFetch('/notifications/read', { token, method: 'PATCH', body: JSON.stringify({ id: n.id }) }); }
      catch { /* silencioso */ }
    }
    if (n.link) router.push(n.link);
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggleOpen}
        className="relative flex items-center justify-center rounded-lg transition-colors hover:bg-secondary"
        style={{ width: 28, height: 28, color: '#8E87A8' }}
        title="Notificaciones"
      >
        <Bell className="w-[14px] h-[14px]" />
        {unread > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full flex items-center justify-center text-white"
            style={{ background: '#EF476F', fontSize: 9, fontWeight: 800, lineHeight: 1 }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && coords && typeof document !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0" style={{ zIndex: 110 }} onClick={() => setOpen(false)} />
          <div
            className="fixed bg-white rounded-2xl overflow-hidden flex flex-col"
            style={{ top: coords.top, right: coords.right, width: 340, maxHeight: '70dvh', zIndex: 111, boxShadow: '0 16px 50px rgba(0,0,0,0.22)' }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <p className="text-[13px] font-bold text-foreground">Notificaciones</p>
              {unread > 0 && (
                <button onClick={markAll} className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:opacity-80">
                  <CheckCheck className="w-3.5 h-3.5" /> Marcar leídas
                </button>
              )}
            </div>

            <div className="overflow-y-auto">
              {items.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <BellIcon className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-[12px] text-muted-foreground">No tienes notificaciones</p>
                </div>
              ) : items.map(n => {
                const Icon = ICON_BY_TYPE[n.tipo] ?? BellIcon;
                const color = COLOR_BY_TYPE[n.tipo] ?? '#8E87A8';
                return (
                  <button
                    key={n.id}
                    onClick={() => openItem(n)}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50 border-b border-border/60"
                    style={{ background: n.leida ? undefined : 'rgba(124,58,237,0.04)' }}
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${color}1A` }}>
                      <Icon className="w-4 h-4" style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-semibold text-foreground">{n.titulo}</p>
                      <p className="text-[11.5px] text-muted-foreground leading-snug">{n.cuerpo}</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.leida && <span className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: '#7C3AED' }} />}
                  </button>
                );
              })}
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
