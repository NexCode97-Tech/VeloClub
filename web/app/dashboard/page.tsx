'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api-client';
import Link from 'next/link';
import {
  Users, CalendarCheck, CreditCard,
  Trophy, CalendarDays, MapPin,
  RefreshCw, Bell,
} from 'lucide-react';

interface MeResponse {
  status: 'ok' | 'superadmin' | 'complete_profile' | 'no_access' | 'inactive';
  user?: { name: string; role: string; club?: { name: string } };
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
  pagosPendientes: number | string;
  totalMiembros: number | string;
  entrenamientosMes: number | string;
}

export default function DashboardPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    asistenciaHoy: '—',
    pagosPendientes: '—',
    totalMiembros: '—',
    entrenamientosMes: '—',
  });

  const fetchStats = useCallback(async (role: string) => {
    try {
      const token = await getToken();
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      if (role === 'ADMIN' || role === 'COACH') {
        const [attRes, membersRes] = await Promise.allSettled([
          apiFetch<{ records: { status: string }[] }>(`/attendance?date=${todayISO()}`, { token }),
          apiFetch<{ members: unknown[] }>('/members', { token }),
        ]);

        const presentCount = attRes.status === 'fulfilled'
          ? attRes.value.records.filter(r => r.status === 'PRESENT').length
          : '—';

        const memberCount = membersRes.status === 'fulfilled'
          ? membersRes.value.members.length
          : '—';

        if (role === 'ADMIN') {
          const paymentsRes = await apiFetch<{ payments: { status: string }[] }>(
            `/payments?year=${year}&month=${month}`, { token }
          ).catch(() => null);

          const pending = paymentsRes
            ? paymentsRes.payments.filter(p => p.status === 'PENDING' || p.status === 'OVERDUE').length
            : '—';

          setStats(s => ({ ...s, asistenciaHoy: presentCount, pagosPendientes: pending, totalMiembros: memberCount }));
        } else {
          const trainingRes = await apiFetch<{ sessions: unknown[] }>(
            `/training?month=${month}&year=${year}`, { token }
          ).catch(() => null);

          setStats(s => ({
            ...s,
            asistenciaHoy: presentCount,
            totalMiembros: memberCount,
            entrenamientosMes: trainingRes ? trainingRes.sessions.length : '—',
          }));
        }
      }
    } catch {
      // silently keep previous values
    }
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { router.push('/sign-in'); return; }
    (async () => {
      try {
        const token = await getToken();
        const res = await apiFetch<MeResponse>('/me', { token });
        if (res.status === 'superadmin')       { router.push('/superadmin');       return; }
        if (res.status === 'no_access')        { router.push('/no-access');        return; }
        if (res.status === 'inactive')         { router.push('/inactivo');         return; }
        if (res.status === 'complete_profile') { router.push('/completar-perfil'); return; }
        setMe(res);
        await fetchStats(res.user?.role ?? 'ADMIN');
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [isLoaded, isSignedIn]);

  // Polling cada 30 segundos
  useEffect(() => {
    if (!me?.user?.role) return;
    const role = me.user.role;
    const interval = setInterval(() => fetchStats(role), 30_000);
    return () => clearInterval(interval);
  }, [me?.user?.role, fetchStats]);

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
      { label: 'Asistencia hoy',    value: stats.asistenciaHoy,    color: '#06D6A0', icon: CalendarCheck, href: '/dashboard/asistencia' },
      { label: 'Pagos pendientes',  value: stats.pagosPendientes,  color: '#FFB703', icon: CreditCard,    href: '/dashboard/finanzas' },
    ],
    COACH: [
      { label: 'Deportistas',       value: stats.totalMiembros,    color: '#7C3AED', icon: Users,         href: '/dashboard/miembros' },
      { label: 'Presentes hoy',     value: stats.asistenciaHoy,    color: '#06D6A0', icon: CalendarCheck, href: '/dashboard/asistencia' },
      { label: 'Entrenam. mes',     value: stats.entrenamientosMes,color: '#FFB703', icon: CalendarDays,  href: '/dashboard/logros' },
      { label: 'Miembros',          value: stats.totalMiembros,    color: '#4361EE', icon: Trophy,        href: '/dashboard/logros' },
    ],
    STUDENT: [
      { label: 'Asistencia',  value: '—', color: '#06D6A0', icon: CalendarCheck, href: '/dashboard/asistencia' },
      { label: 'Logros',      value: '—', color: '#FFB703', icon: Trophy,        href: '/dashboard/logros' },
      { label: 'Eventos',     value: '—', color: '#7C3AED', icon: CalendarDays,  href: '/dashboard/calendario' },
      { label: 'Sedes',       value: '—', color: '#EF476F', icon: MapPin,        href: '/dashboard/sedes' },
    ],
  };

  const cards = statCards[role] ?? statCards.ADMIN;

  return (
    <div className="min-h-full bg-background">

      {/* Hero greeting */}
      <div
        className="px-5 pt-5 pb-4 border-b border-border"
        style={{ background: 'linear-gradient(135deg, #fff 0%, #F0EEF8 100%)' }}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">{todayLabel()}</p>
            <h1
              className="text-[22px] font-extrabold text-foreground leading-tight"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              ¡Hola, {firstName}! 👋
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {user?.club?.name ?? 'VeloClub'}
            </p>
            <span
              className="inline-block mt-2 text-[10px] font-bold px-2.5 py-0.5 rounded-full tracking-wider"
              style={{ background: rc.bg, color: rc.text }}
            >
              {roleLabels[role] ?? role}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={() => fetchStats(role)}
              className="w-9 h-9 rounded-full border border-border bg-white flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="w-[15px] h-[15px]" />
            </button>
            <button className="w-9 h-9 rounded-full border border-border bg-white flex items-center justify-center text-muted-foreground relative">
              <Bell className="w-[15px] h-[15px]" />
            </button>
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

      <div className="px-5 py-4 space-y-5">

        {/* Próximos eventos */}
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Próximos eventos</p>
            <Link href="/dashboard/calendario" className="text-[11px] font-semibold" style={{ color: '#7C3AED' }}>
              Ver calendario
            </Link>
          </div>
          <div className="bg-white border border-border rounded-xl px-4 py-5 text-center">
            <CalendarDays className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-[12px] text-muted-foreground">No hay eventos programados</p>
          </div>
        </section>

        {/* Pagos pendientes — ADMIN only */}
        {(role === 'ADMIN' || role === 'SUPERADMIN') && (
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Pagos pendientes</p>
              <Link href="/dashboard/finanzas" className="text-[11px] font-semibold" style={{ color: '#7C3AED' }}>
                Ver todos
              </Link>
            </div>
            <div className="bg-white border border-border rounded-xl px-4 py-5 text-center">
              <CreditCard className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-[12px] text-muted-foreground">
                {stats.pagosPendientes === '—' || stats.pagosPendientes === 0
                  ? 'Sin pagos pendientes'
                  : `${stats.pagosPendientes} pago${Number(stats.pagosPendientes) !== 1 ? 's' : ''} pendiente${Number(stats.pagosPendientes) !== 1 ? 's' : ''}`
                }
              </p>
            </div>
          </section>
        )}

        {/* Logros — STUDENT only */}
        {role === 'STUDENT' && (
          <section>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">
              Mis logros recientes
            </p>
            <div className="bg-white border border-border rounded-xl px-4 py-5 text-center">
              <Trophy className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-[12px] text-muted-foreground">Sin logros registrados aún</p>
            </div>
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
