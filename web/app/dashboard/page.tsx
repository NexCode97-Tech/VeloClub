'use client';

import { useAuth, useSession } from '@clerk/nextjs';
import { useClubStream } from '@/hooks/useClubStream';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import { apiFetch } from '@/lib/api-client';
import { parseLocalDate } from '@/lib/utils';
import Link from 'next/link';
import {
  Users, CalendarCheck, CreditCard,
  Trophy, CalendarDays, MapPin,
  RefreshCw, Bell, BellOff, Dumbbell,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

interface MeResponse {
  status: 'ok' | 'superadmin' | 'complete_profile' | 'no_access' | 'inactive' | 'trial_expired';
  user?: { name: string; role: string; club?: { name: string; logoUrl?: string } };
  trial?: { daysLeft: number; endsAt: string } | null;
}

const roleLabels: Record<string, string> = {
  SUPERADMIN: 'SUPER ADMIN',
  ADMIN:      'ADMINISTRADOR',
  COACH:      'ENTRENADOR',
  STUDENT:    'DEPORTISTA',
};

const roleColors: Record<string, { text: string; bg: string }> = {
  SUPERADMIN: { text: '#EF476F', bg: 'rgba(239,71,111,0.12)' },
  ADMIN:      { text: '#FFB703', bg: 'rgba(255,183,3,0.12)' },
  COACH:      { text: '#06D6A0', bg: 'rgba(6,214,160,0.12)' },
  STUDENT:    { text: '#7C3AED', bg: 'rgba(124,58,237,0.10)' },
};

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function todayLabel() {
  const d = new Date();
  const day = d.toLocaleDateString('es-CO', { weekday: 'long' });
  const rest = d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
  return `${day.charAt(0).toUpperCase() + day.slice(1)}, ${rest}`;
}

interface Stats {
  asistenciaHoy: number | string;
  totalMensualidades: number | string;
  totalMiembros: number | string;
  entrenamientosMes: number | string;
  weekdayCounts: number[];
}

interface LogroReciente {
  id: string;
  tipo: 'COMPETENCIA' | 'ENTRENAMIENTO';
  titulo: string;
  fecha: string;
  position?: number | null;
  categoria?: string | null;
  observaciones?: string | null;
}

const EMPTY_WEEKDAY = [0, 0, 0, 0, 0, 0, 0];

export default function DashboardPage() {
  const { isLoaded, isSignedIn, userId, sessionId } = useAuth();
  const { session } = useSession();
  const router = useRouter();
  const [me, setMe]           = useState<MeResponse | null>(null);
  const [trial, setTrial]     = useState<{ daysLeft: number; endsAt: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning]   = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const [notifs, setNotifs] = useState<{
    type: 'overdue' | 'due_soon';
    memberName: string; memberId: string; paymentId: string;
    daysLate?: number; daysLeft?: number;
  }[]>([]);
  const [stats, setStats] = useState<Stats>({
    asistenciaHoy: '—',
    totalMensualidades: '—',
    totalMiembros: '—',
    entrenamientosMes: '—',
    weekdayCounts: EMPTY_WEEKDAY,
  });
  const [logros, setLogros]         = useState<LogroReciente[]>([]);
  const [logrosLoading, setLogrosLoading] = useState(false);
  const [proximosEventos, setProximosEventos] = useState<{ id: string; titulo: string; tipo: 'COMPETITION' | 'TRAINING'; fecha: Date; lugar?: string | null }[]>([]);

  // Close notif panel when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const fetchStats = useCallback(async (role: string) => {
    const token = await session?.getToken();
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const [weekdayRes, attRes, membersRes, paymentsRes, trainingRes, notifRes] = await Promise.allSettled([
      apiFetch<{ counts: number[] }>('/attendance/weekday-stats', { token }),
      apiFetch<{ records: { status: string }[] }>(`/attendance?date=${todayISO()}`, { token }),
      apiFetch<{ members: unknown[] }>('/members', { token }),
      apiFetch<{ payments: { status: string; amount: number }[] }>(`/payments?year=${year}&month=${month}`, { token }),
      apiFetch<{ sessions: unknown[] }>(`/training?month=${month}&year=${year}`, { token }),
      apiFetch<{ notifications: typeof notifs }>('/payments/notifications', { token }),
    ]);

    const weekdayCounts = weekdayRes.status === 'fulfilled' ? weekdayRes.value.counts : EMPTY_WEEKDAY;
    const presentCount  = attRes.status === 'fulfilled' ? attRes.value.records.filter(r => r.status === 'PRESENT').length : '—';
    const memberCount   = membersRes.status === 'fulfilled' ? membersRes.value.members.length : '—';
    const totalMensualidades = paymentsRes.status === 'fulfilled'
      ? paymentsRes.value.payments.filter(p => p.status === 'PAID').reduce((s, p) => s + p.amount, 0)
      : '—';
    const entrenamientosMes = trainingRes.status === 'fulfilled' ? trainingRes.value.sessions.length : '—';

    if (role === 'ADMIN' && notifRes.status === 'fulfilled') setNotifs(notifRes.value.notifications);

    setStats(s => ({
      ...s,
      weekdayCounts,
      asistenciaHoy: presentCount,
      totalMiembros: memberCount,
      totalMensualidades,
      entrenamientosMes,
    }));
  }, [session]);

  function handleRefresh() {
    setSpinning(true);
    setTimeout(() => window.location.reload(), 400);
  }

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { router.push('/sign-in'); return; }

    setMe(null);
    setLogros([]);
    setLoading(true);

    (async () => {
      try {
        // Un solo token para todas las llamadas
        const token = await session?.getToken();
        const now = new Date();
        const month = now.getMonth() + 1;
        const year  = now.getFullYear();

        // /me + todas las llamadas de datos en paralelo
        const [
          meRes, weekdayRes, attRes, membersRes,
          paymentsRes, trainingRes, notifRes, compRes, memberMeRes,
        ] = await Promise.allSettled([
          apiFetch<MeResponse>('/me', { token }),
          apiFetch<{ counts: number[] }>('/attendance/weekday-stats', { token }),
          apiFetch<{ records: { status: string }[] }>(`/attendance?date=${todayISO()}`, { token }),
          apiFetch<{ members: unknown[] }>('/members', { token }),
          apiFetch<{ payments: { status: string; amount: number }[] }>(`/payments?year=${year}&month=${month}`, { token }),
          apiFetch<{ sessions: { id: string; title: string; date: string; location?: { name: string } | null }[] }>(`/training?month=${month}&year=${year}`, { token }),
          apiFetch<{ notifications: typeof notifs }>('/payments/notifications', { token }),
          apiFetch<{
            competitions: {
              id: string; name: string; date: string; place?: string | null;
              events: { results: { member: { id: string }; position?: number | null; category?: string | null; observations?: string | null }[] }[];
            }[];
          }>('/competitions', { token }),
          apiFetch<{ member: { id: string } }>('/members/me', { token }),
        ]);

        if (meRes.status === 'rejected') return;
        const res = meRes.value;
        if (res.status === 'superadmin')       { router.push('/superadmin');       return; }
        if (res.status === 'no_access')        { router.push('/no-access');        return; }
        if (res.status === 'inactive')         { router.push('/inactivo');         return; }
        if (res.status === 'trial_expired')    { router.push('/trial-expirado');   return; }
        if (res.status === 'complete_profile') { router.push('/completar-perfil'); return; }
        setMe(res);
        setTrial(res.trial ?? null);

        const role = res.user?.role ?? 'ADMIN';
        const weekdayCounts   = weekdayRes.status === 'fulfilled'  ? weekdayRes.value.counts   : EMPTY_WEEKDAY;
        const presentCount    = attRes.status === 'fulfilled'      ? attRes.value.records.filter(r => r.status === 'PRESENT').length : '—';
        const memberCount     = membersRes.status === 'fulfilled'  ? membersRes.value.members.length : '—';
        const totalMensualidades = paymentsRes.status === 'fulfilled'
          ? paymentsRes.value.payments.filter(p => p.status === 'PAID').reduce((s, p) => s + p.amount, 0)
          : '—';
        const entrenamientosMes = trainingRes.status === 'fulfilled' ? trainingRes.value.sessions.length : '—';

        if (role === 'ADMIN' && notifRes.status === 'fulfilled') setNotifs(notifRes.value.notifications);

        setStats({
          weekdayCounts,
          asistenciaHoy: presentCount,
          totalMiembros: memberCount,
          totalMensualidades,
          entrenamientosMes,
        });

        // Logros recientes — STUDENT
        if (role === 'STUDENT') {
          setLogrosLoading(true);
          try {
            const memberId = memberMeRes.status === 'fulfilled' ? memberMeRes.value.member.id : null;
            const comps    = compRes.status === 'fulfilled' ? compRes.value.competitions : [];
            if (memberId) {
              const resultados: LogroReciente[] = [];
              for (const c of comps) {
                for (const ev of c.events) {
                  for (const r of ev.results) {
                    if (r.member.id === memberId) {
                      resultados.push({ id: `${c.id}-${memberId}`, tipo: 'COMPETENCIA', titulo: c.name, fecha: c.date, position: r.position, categoria: r.category, observaciones: r.observations });
                    }
                  }
                }
              }
              resultados.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
              setLogros(resultados.slice(0, 5));
            }
          } finally { setLogrosLoading(false); }
        }

        // Próximos eventos (todos los roles)
        const comps2  = compRes.status === 'fulfilled' ? compRes.value.competitions : [];
        const trains2 = trainingRes.status === 'fulfilled' ? trainingRes.value.sessions : [];
        const futuros = [
          ...comps2.map(c  => ({ id: c.id,  titulo: c.name, tipo: 'COMPETITION' as const, fecha: parseLocalDate(c.date), lugar: c.place ?? null })),
          ...trains2.map(s => ({ id: s.id,  titulo: s.title,           tipo: 'TRAINING'     as const, fecha: parseLocalDate(s.date), lugar: s.location?.name ?? null })),
        ]
          .filter(e => e.fecha >= now)
          .sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
          .slice(0, 3);
        setProximosEventos(futuros);

      } catch { /* silencioso */ } finally {
        setLoading(false);
      }
    })();
  }, [isLoaded, isSignedIn, userId, sessionId]);

  // Tiempo real: SSE push desde el servidor
  useClubStream((ev) => {
    if (!me?.user?.role) return;
    if (['members', 'payments', 'attendance'].includes(ev)) {
      fetchStats(me.user.role).catch(() => {});
    }
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const user = me?.user;
  const role = user?.role ?? 'ADMIN';
  const firstName = user?.name?.split(' ')[0] ?? '';
  const rc = roleColors[role] ?? roleColors.ADMIN;

  type StatCard = { label: string; value: string | number; color: string; icon: React.ElementType; href: string };

  const statCards: Record<string, StatCard[]> = {
    ADMIN: [
      { label: 'Asistencia hoy',   value: stats.asistenciaHoy,   color: '#06D6A0', icon: CalendarCheck, href: '/dashboard/asistencia' },
      { label: 'Mensualidades', value: typeof stats.totalMensualidades === 'number' ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(stats.totalMensualidades) : stats.totalMensualidades, color: '#FFB703', icon: CreditCard, href: '/dashboard/finanzas' },
    ],
    COACH: [
      { label: 'Deportistas',   value: stats.totalMiembros,     color: '#7C3AED', icon: Users,        href: '/dashboard/miembros' },
      { label: 'Presentes hoy', value: stats.asistenciaHoy,     color: '#06D6A0', icon: CalendarCheck, href: '/dashboard/asistencia' },
      { label: 'Entrenam. mes', value: stats.entrenamientosMes, color: '#FFB703', icon: CalendarDays,  href: '/dashboard/logros' },
      { label: 'Miembros',      value: stats.totalMiembros,     color: '#4361EE', icon: Trophy,        href: '/dashboard/logros' },
    ],
    STUDENT: [
      { label: 'Resultados', value: '—', color: '#FFB703', icon: Trophy,       href: '/dashboard/logros' },
      { label: 'Calendario', value: '—', color: '#7C3AED', icon: CalendarDays, href: '/dashboard/calendario' },
      { label: 'Mis Pagos',  value: '—', color: '#06D6A0', icon: CreditCard,   href: '/dashboard/pagos' },
    ],
  };

  const cards = statCards[role] ?? statCards.ADMIN;
  const maxCount = Math.max(...stats.weekdayCounts, 1);
  const chartData = DAY_LABELS.map((day, i) => ({ day, presentes: stats.weekdayCounts[i] }));
  const showChart = role === 'ADMIN' || role === 'COACH';
  const hasData = stats.weekdayCounts.some(c => c > 0);

  return (
    <div className="min-h-full bg-background">

      {/* Hero greeting */}
      <div
        className="px-5 pt-5 pb-4 border-b border-border"
        style={{ background: 'linear-gradient(135deg, #fff 0%, #F0EEF8 100%)' }}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">{todayLabel()}</p>
              <div className="flex items-center gap-3">
                {/* Logo — altura del saludo + nombre del club */}
                <div className="w-14 h-14 rounded-2xl border border-border bg-secondary overflow-hidden flex items-center justify-center shrink-0" style={{ boxShadow: '0 4px 12px rgba(67,97,238,0.15)' }}>
                  {user?.club?.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.club.logoUrl} alt="Logo" className="w-full h-full" style={{ objectFit: 'cover' }} />
                  ) : (
                    <span className="text-[18px] font-extrabold text-primary" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                      {(user?.club?.name ?? 'V').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <h1
                    className="text-[22px] font-extrabold text-foreground leading-tight"
                    style={{ fontFamily: 'var(--font-space-grotesk)' }}
                  >
                    ¡Hola, {firstName}! 👋
                  </h1>
                  <p className="text-[14px] font-semibold text-foreground/70 mt-0.5">
                    {user?.club?.name ?? 'VeloClub'}
                  </p>
                </div>
              </div>
              <span
                className="inline-block mt-2 text-[10px] font-bold px-2.5 py-0.5 rounded-full tracking-wider"
                style={{ background: rc.bg, color: rc.text }}
              >
                {roleLabels[role] ?? role}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-1">
            {/* Refresh */}
            <button
              onClick={handleRefresh}
              className="w-9 h-9 rounded-full border border-border bg-white flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground active:scale-90 transition-all"
            >
              <RefreshCw className={`w-[15px] h-[15px] transition-transform duration-500 ${spinning ? 'animate-spin' : ''}`} />
            </button>

            {/* Notifications — solo ADMIN */}
            {role === 'ADMIN' && <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(o => !o)}
                className={`w-9 h-9 rounded-full border border-border bg-white flex items-center justify-center transition-all active:scale-90 relative ${notifOpen ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
              >
                <Bell className="w-[15px] h-[15px]" />
                {notifs.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {notifs.length > 9 ? '9+' : notifs.length}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-11 w-72 bg-white border border-border rounded-2xl shadow-xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <p className="text-[13px] font-bold text-foreground">Notificaciones</p>
                    {notifs.length > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-500">{notifs.length} alerta{notifs.length !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                  {notifs.length === 0 ? (
                    <div className="flex flex-col items-center py-8 px-4 text-center">
                      <BellOff className="w-8 h-8 mb-2 text-muted-foreground/30" />
                      <p className="text-[12px] font-semibold text-muted-foreground">Sin notificaciones</p>
                      <p className="text-[11px] text-muted-foreground/60 mt-0.5">Todo está al día</p>
                    </div>
                  ) : (
                    <div className="max-h-72 overflow-y-auto divide-y divide-border">
                      {notifs.map((n, i) => (
                        <Link
                          key={i}
                          href="/dashboard/finanzas"
                          onClick={() => setNotifOpen(false)}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-secondary transition-colors"
                        >
                          <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.type === 'overdue' ? 'bg-red-500' : 'bg-amber-400'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-foreground truncate">{n.memberName}</p>
                            <p className={`text-[11px] mt-0.5 ${n.type === 'overdue' ? 'text-red-500' : 'text-amber-500'}`}>
                              {n.type === 'overdue'
                                ? `Vencido hace ${n.daysLate} día${n.daysLate !== 1 ? 's' : ''}`
                                : n.daysLeft === 0 ? 'Vence hoy'
                                : `Vence en ${n.daysLeft} día${n.daysLeft !== 1 ? 's' : ''}`
                              }
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>}
          </div>
        </div>

        {/* Stats grid */}
        <div className={`grid gap-3 ${cards.length === 2 ? 'grid-cols-2' : 'grid-cols-4'}`}>
          {cards.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className={`bg-white border border-border rounded-xl text-center active:scale-95 transition-transform ${cards.length === 2 ? 'p-5' : 'p-2.5'}`}
            >
              <div className={`flex justify-center ${cards.length === 2 ? 'mb-2' : 'mb-1'}`} style={{ color: s.color }}>
                <s.icon className={cards.length === 2 ? 'w-6 h-6' : 'w-[17px] h-[17px]'} />
              </div>
              <div
                className={`font-extrabold text-foreground leading-none mb-1 ${cards.length === 2 ? 'text-2xl' : 'text-base'}`}
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                {s.value}
              </div>
              <div className={`text-muted-foreground leading-tight ${cards.length === 2 ? 'text-[11px]' : 'text-[9px]'}`}>{s.label}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Banner período de prueba ───────────────────────────────────────── */}
      {trial !== null && (
        <div
          className="mx-4 mt-3 rounded-2xl px-4 py-3 flex items-center gap-3"
          style={{
            background: trial.daysLeft <= 3 ? 'rgba(239,71,111,0.08)' : 'rgba(255,183,3,0.09)',
            border: `1px solid ${trial.daysLeft <= 3 ? 'rgba(239,71,111,0.20)' : 'rgba(255,183,3,0.25)'}`,
          }}
        >
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-[14px]"
            style={{ background: trial.daysLeft <= 3 ? 'rgba(239,71,111,0.12)' : 'rgba(255,183,3,0.15)' }}
          >
            {trial.daysLeft <= 3 ? '⚠️' : '🧪'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold" style={{ color: trial.daysLeft <= 3 ? '#EF476F' : '#B88A00' }}>
              {trial.daysLeft === 0
                ? 'Tu período de prueba vence hoy'
                : `Período de prueba · ${trial.daysLeft} día${trial.daysLeft !== 1 ? 's' : ''} restante${trial.daysLeft !== 1 ? 's' : ''}`}
            </p>
            {trial.daysLeft <= 3 && (
              <p className="text-[11px] mt-0.5" style={{ color: '#EF476F', opacity: 0.8 }}>
                Contacta a NexCode97 para activar tu plan
              </p>
            )}
          </div>
        </div>
      )}

      <div className="px-5 py-4 space-y-5">

        {/* Próximos eventos */}
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Próximos eventos</p>
            <Link href="/dashboard/calendario" className="text-[11px] font-semibold" style={{ color: '#7C3AED' }}>
              Ver calendario
            </Link>
          </div>
          {proximosEventos.length === 0 ? (
            <div className="bg-white border border-border rounded-xl px-4 py-5 text-center">
              <CalendarDays className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-[12px] text-muted-foreground">No hay eventos próximos</p>
            </div>
          ) : (
            <div className="bg-white border border-border rounded-xl overflow-hidden divide-y divide-border">
              {proximosEventos.map(ev => {
                const isComp = ev.tipo === 'COMPETITION';
                const color  = isComp ? '#EF476F' : '#4361EE';
                const d = ev.fecha;
                const dia = d.toLocaleDateString('es-CO', { weekday: 'short' });
                const fecha = d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
                return (
                  <div key={ev.id} className="flex items-center gap-3 px-4 py-3">
                    {/* Ícono tipo */}
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
                      {isComp
                        ? <Trophy className="w-4 h-4" style={{ color }} />
                        : <Dumbbell className="w-4 h-4" style={{ color }} />
                      }
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-foreground truncate">{ev.titulo}</p>
                      {ev.lugar && <p className="text-[11px] text-muted-foreground truncate">{ev.lugar}</p>}
                    </div>
                    {/* Fecha */}
                    <div className="text-right shrink-0">
                      <p className="text-[12px] font-bold" style={{ color }}>{fecha}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">{dia}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Gráfica asistencia por día — ADMIN y COACH */}
        {showChart && (
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Asistencia por día</p>
              <p className="text-[10px] text-muted-foreground">Últimas 8 semanas</p>
            </div>
            <div className="bg-white border border-border rounded-xl p-4">
              {!hasData ? (
                <div className="flex flex-col items-center py-4">
                  <CalendarCheck className="w-8 h-8 mb-2 text-muted-foreground/30" />
                  <p className="text-[12px] text-muted-foreground">Sin datos de asistencia aún</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={chartData} barCategoryGap="20%" margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 11, fill: '#8E87A8', fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 10, fill: '#C4C2CF' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(67,97,238,0.06)' }}
                      contentStyle={{ borderRadius: 10, border: '1px solid #E8E6F0', fontSize: 12, padding: '4px 10px' }}
                      formatter={(v) => [Number(v ?? 0), 'Presentes']}
                    />
                    <Bar dataKey="presentes" radius={[6, 6, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.presentes === maxCount && entry.presentes > 0 ? '#4361EE' : '#C4C2CF'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>
        )}

        {/* Logros recientes — STUDENT */}
        {role === 'STUDENT' && (
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Mis logros recientes</p>
              <Link href="/dashboard/logros" className="text-[11px] font-semibold" style={{ color: '#7C3AED' }}>Ver todos</Link>
            </div>

            {logrosLoading ? (
              <div className="flex justify-center py-6">
                <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: '#7C3AED', borderTopColor: 'transparent' }} />
              </div>
            ) : logros.length === 0 ? (
              <div className="bg-white border border-border rounded-xl px-4 py-5 text-center">
                <Trophy className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-[12px] text-muted-foreground">Sin logros registrados aún</p>
              </div>
            ) : (
              <div className="space-y-2">
                {logros.map((l) => {
                  const isPodio = l.position && l.position <= 3;
                  const medalColor = l.position === 1 ? '#FFB703' : l.position === 2 ? '#8E87A8' : '#CD7F32';
                  const medal = l.position === 1 ? '🥇' : l.position === 2 ? '🥈' : l.position === 3 ? '🥉' : null;
                  const fecha = new Date(l.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
                  return (
                    <div key={l.id} className="bg-white border border-border rounded-xl px-4 py-3 flex items-start gap-3">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-[18px]"
                        style={{ background: isPodio ? `${medalColor}18` : 'rgba(124,58,237,0.08)' }}
                      >
                        {medal ?? <Trophy className="w-4 h-4" style={{ color: '#7C3AED' }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          {l.position && (
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{ background: `${medalColor}18`, color: medalColor }}
                            >
                              {l.position}° lugar
                            </span>
                          )}
                          {l.categoria && (
                            <span className="text-[10px] font-semibold text-muted-foreground">{l.categoria}</span>
                          )}
                        </div>
                        <p className="text-[13px] font-semibold text-foreground truncate">{l.titulo}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{fecha}</p>
                        {l.observaciones && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{l.observaciones}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Asistencia de hoy — COACH only */}
        {role === 'COACH' && (
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Asistencia de hoy</p>
              <Link href="/dashboard/asistencia" className="text-[11px] font-semibold" style={{ color: '#7C3AED' }}>
                Registrar
              </Link>
            </div>
            <div className="bg-white border border-border rounded-xl px-4 py-5 text-center">
              <CalendarCheck className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-[12px] text-muted-foreground">Ve a Asistencia para registrar el día de hoy</p>
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
