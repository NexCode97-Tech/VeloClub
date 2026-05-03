'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import Link from 'next/link';
import {
  Users, CalendarCheck, CreditCard, TrendingUp,
  Trophy, CalendarDays, BarChart2, MapPin,
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

type StatCard = { label: string; value: string | number; color: string; icon: React.ElementType; href: string };

const STATS_BY_ROLE: Record<string, StatCard[]> = {
  ADMIN: [
    { label: 'Miembros',    value: '-', color: '#7C3AED', icon: Users,         href: '/dashboard/miembros' },
    { label: 'Asistencia',  value: '-', color: '#06D6A0', icon: CalendarCheck, href: '/dashboard/asistencia' },
    { label: 'Pagos pend.', value: '-', color: '#FFB703', icon: CreditCard,    href: '/dashboard/pagos' },
    { label: 'Flujo',       value: '-', color: '#EF476F', icon: TrendingUp,    href: '/dashboard/flujo-caja' },
  ],
  COACH: [
    { label: 'Deportistas',     value: '-', color: '#7C3AED', icon: Users,         href: '/dashboard/miembros' },
    { label: 'Hoy asisten',     value: '-', color: '#06D6A0', icon: CalendarCheck, href: '/dashboard/asistencia' },
    { label: 'Entrenamientos',  value: '-', color: '#FFB703', icon: CalendarDays,  href: '/dashboard/calendario' },
    { label: 'Logros mes',      value: '-', color: '#4361EE', icon: Trophy,        href: '/dashboard/logros' },
  ],
  STUDENT: [
    { label: 'Asistencia', value: '-', color: '#06D6A0', icon: CalendarCheck, href: '/dashboard/asistencia' },
    { label: 'Logros',     value: '-', color: '#FFB703', icon: Trophy,        href: '/dashboard/logros' },
    { label: 'Eventos',    value: '-', color: '#7C3AED', icon: CalendarDays,  href: '/dashboard/calendario' },
    { label: 'Sedes',      value: '-', color: '#EF476F', icon: MapPin,        href: '/dashboard/sedes' },
  ],
};

const QUICK_BY_ROLE: Record<string, { label: string; color: string; icon: React.ElementType; href: string }[]> = {
  ADMIN: [
    { label: 'Asistencia', color: '#06D6A0', icon: CalendarCheck, href: '/dashboard/asistencia' },
    { label: 'Pagos',      color: '#FFB703', icon: CreditCard,    href: '/dashboard/pagos' },
    { label: 'Logros',     color: '#7C3AED', icon: Trophy,        href: '/dashboard/logros' },
    { label: 'Reportes',   color: '#EF476F', icon: BarChart2,     href: '/dashboard/reportes' },
  ],
  COACH: [
    { label: 'Asistencia', color: '#06D6A0', icon: CalendarCheck, href: '/dashboard/asistencia' },
    { label: 'Miembros',   color: '#7C3AED', icon: Users,         href: '/dashboard/miembros' },
    { label: 'Logros',     color: '#FFB703', icon: Trophy,        href: '/dashboard/logros' },
    { label: 'Calendario', color: '#4361EE', icon: CalendarDays,  href: '/dashboard/calendario' },
  ],
  STUDENT: [
    { label: 'Asistencia', color: '#06D6A0', icon: CalendarCheck, href: '/dashboard/asistencia' },
    { label: 'Logros',     color: '#FFB703', icon: Trophy,        href: '/dashboard/logros' },
    { label: 'Calendario', color: '#7C3AED', icon: CalendarDays,  href: '/dashboard/calendario' },
    { label: 'Sedes',      color: '#EF476F', icon: MapPin,        href: '/dashboard/sedes' },
  ],
};

function todayLabel() {
  const d = new Date();
  const day = d.toLocaleDateString('es-CO', { weekday: 'long' });
  const rest = d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
  return `${day.charAt(0).toUpperCase() + day.slice(1)}, ${rest}`;
}

export default function DashboardPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

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
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [isLoaded, isSignedIn, getToken, router]);

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
  const stats = STATS_BY_ROLE[role] ?? STATS_BY_ROLE.ADMIN;
  const quickLinks = QUICK_BY_ROLE[role] ?? QUICK_BY_ROLE.ADMIN;

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
              onClick={() => window.location.reload()}
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
        <div className="grid grid-cols-4 gap-2">
          {stats.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className="bg-white border border-border rounded-xl p-2.5 text-center active:scale-95 transition-transform"
            >
              <div className="flex justify-center mb-1" style={{ color: s.color }}>
                <s.icon className="w-[17px] h-[17px]" />
              </div>
              <div
                className="text-base font-extrabold text-foreground leading-none mb-0.5"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                {s.value}
              </div>
              <div className="text-[9px] text-muted-foreground leading-tight">{s.label}</div>
            </Link>
          ))}
        </div>
      </div>

      <div className="px-5 py-4 space-y-5">

        {/* Accesos rápidos */}
        <section>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">
            Accesos rápidos
          </p>
          <div className="grid grid-cols-4 gap-2">
            {quickLinks.map((q) => (
              <Link
                key={q.label}
                href={q.href}
                className="bg-white border border-border rounded-xl py-3 flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: `${q.color}18`, color: q.color }}
                >
                  <q.icon className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-semibold text-muted-foreground text-center leading-tight">
                  {q.label}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Próximos eventos — vacío hasta que haya API */}
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
              <Link href="/dashboard/pagos" className="text-[11px] font-semibold" style={{ color: '#7C3AED' }}>
                Ver todos
              </Link>
            </div>
            <div className="bg-white border border-border rounded-xl px-4 py-5 text-center">
              <CreditCard className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-[12px] text-muted-foreground">Sin pagos pendientes</p>
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
