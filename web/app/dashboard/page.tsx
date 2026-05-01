'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import Link from 'next/link';
import {
  Users, CalendarCheck, CreditCard, TrendingUp,
  Trophy, CalendarDays, BarChart2, MapPin,
  RefreshCw, Bell, ChevronRight,
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
    { label: 'Alumnos',        value: '-', color: '#7C3AED', icon: Users,         href: '/dashboard/miembros' },
    { label: 'Hoy asisten',    value: '-', color: '#06D6A0', icon: CalendarCheck, href: '/dashboard/asistencia' },
    { label: 'Entrenamientos', value: '-', color: '#FFB703', icon: CalendarDays,  href: '/dashboard/calendario' },
    { label: 'Logros mes',     value: '-', color: '#4361EE', icon: Trophy,        href: '/dashboard/logros' },
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
              <span className="absolute top-[9px] right-[9px] w-1.5 h-1.5 rounded-full bg-destructive" />
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

        {/* Upcoming events */}
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Proximos eventos</p>
            <Link href="/dashboard/calendario" className="text-[11px] font-semibold" style={{ color: '#7C3AED' }}>
              Ver todos
            </Link>
          </div>
          <div className="space-y-2">
            {[
              { title: 'Entrenamiento Juvenil A', time: '07:00', sede: 'Sede Norte', type: 'training' as const },
              { title: 'Copa Regional Patinaje',  time: '09:00', sede: 'Estadio Sur', type: 'competition' as const },
            ].map((ev) => {
              const typeColor = ev.type === 'competition' ? '#EF476F' : '#4361EE';
              const typeLabel = ev.type === 'competition' ? 'Competencia' : 'Entreno';
              return (
                <div
                  key={ev.title}
                  className="bg-white border border-border rounded-xl px-3 py-2.5 flex items-center gap-3"
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${typeColor}18`, color: typeColor }}
                  >
                    <CalendarDays className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-foreground truncate">{ev.title}</p>
                    <p className="text-[11px] text-muted-foreground">{ev.time} · {ev.sede}</p>
                  </div>
                  <span
                    className="text-[9px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                    style={{ background: `${typeColor}18`, color: typeColor }}
                  >
                    {typeLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Pending payments — ADMIN only */}
        {(role === 'ADMIN' || role === 'SUPERADMIN') && (
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Pagos pendientes</p>
              <Link href="/dashboard/pagos" className="text-[11px] font-semibold" style={{ color: '#7C3AED' }}>
                Ver todos
              </Link>
            </div>
            <div className="bg-white border border-border rounded-xl overflow-hidden">
              {[
                { name: 'Santiago Mora',  concept: 'Mensualidad Abril', amount: '$120.000', status: 'Pendiente', sc: '#FFB703' },
                { name: 'Mateo Gonzalez', concept: 'Mensualidad Marzo', amount: '$120.000', status: 'Vencido',   sc: '#EF476F' },
              ].map((p, i) => (
                <div key={p.name} className={`flex items-center gap-3 px-3 py-2.5 ${i > 0 ? 'border-t border-border' : ''}`}>
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                    style={{ background: 'linear-gradient(135deg,#7C3AED,#A855F7)' }}
                  >
                    {p.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-foreground">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">{p.concept}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[13px] font-bold text-foreground" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                      {p.amount}
                    </p>
                    <span
                      className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{ background: `${p.sc}18`, color: p.sc }}
                    >
                      {p.status}
                    </span>
                  </div>
                </div>
              ))}
              <Link
                href="/dashboard/pagos"
                className="flex items-center justify-center gap-1 py-2.5 text-[11px] font-semibold border-t border-border"
                style={{ color: '#7C3AED' }}
              >
                Ver todos los pagos <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </section>
        )}

        {/* Achievements — STUDENT only */}
        {role === 'STUDENT' && (
          <section>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">
              Mis logros recientes
            </p>
            <div className="bg-white border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-3 py-3">
                <div className="w-8 h-8 text-2xl flex items-center justify-center shrink-0">🥇</div>
                <div className="flex-1">
                  <p className="text-[13px] font-semibold text-foreground">Copa Regional</p>
                  <p className="text-[11px] text-muted-foreground">Juvenil A · 2026-03-15</p>
                </div>
                <div
                  className="text-lg font-black"
                  style={{ color: '#FFD700', fontFamily: 'var(--font-space-grotesk)' }}
                >
                  #1
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Today attendance — COACH only */}
        {role === 'COACH' && (
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Asistencia de hoy</p>
              <Link href="/dashboard/asistencia" className="text-[11px] font-semibold" style={{ color: '#7C3AED' }}>
                Ver todos
              </Link>
            </div>
            <div className="bg-white border border-border rounded-xl overflow-hidden">
              {[
                { name: 'Valentina Rios',   cat: 'Juvenil A',  status: 'Presente', sc: '#06D6A0' },
                { name: 'Santiago Mora',    cat: 'Infantil B', status: 'Tarde',    sc: '#FFB703' },
                { name: 'Isabella Castro',  cat: 'Juvenil A',  status: 'Presente', sc: '#06D6A0' },
              ].map((m, i) => (
                <div key={m.name} className={`flex items-center gap-3 px-3 py-2.5 ${i > 0 ? 'border-t border-border' : ''}`}>
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                    style={{ background: 'linear-gradient(135deg,#7C3AED,#A855F7)' }}
                  >
                    {m.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold text-foreground">{m.name}</p>
                    <p className="text-[11px] text-muted-foreground">{m.cat}</p>
                  </div>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: `${m.sc}18`, color: m.sc }}
                  >
                    {m.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
