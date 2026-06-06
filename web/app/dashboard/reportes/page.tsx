'use client';
import { motion } from 'framer-motion';
import { stagger, cardVariant } from '@/lib/page-animations';

import { useAuth, useSession } from '@clerk/nextjs';
import { useClubStream } from '@/hooks/useClubStream';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { Users, CalendarCheck, CreditCard, Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MONTH_NAMES_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAY_LABELS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

const ACCENT = '#4361EE';
const GREEN  = '#06D6A0';
const YELLOW = '#FFB703';
const RED    = '#EF476F';
const PURPLE = '#7C3AED';

interface MonthlyAttendance { month: string; presentes: number }
interface PaymentDist { name: string; value: number; color: string }

export default function ReportesPage() {
  const { isSignedIn } = useAuth();
  const { session } = useSession();

  const [loading, setLoading] = useState(true);

  async function loadReportes() {
    if (!isSignedIn) return;
    setLoading(true);
    try {
      const token = await session?.getToken({ skipCache: true });
      const now   = new Date();
      const month = now.getMonth() + 1;
      const year  = now.getFullYear();
      const todayISO = `${year}-${String(month).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

      const [membersRes, attTodayRes, paymentsRes, compsRes, attMonthlyRes, weekdayRes] = await Promise.allSettled([
        apiFetch<{ members: { id: string }[] }>('/members', { token }),
        apiFetch<{ records: { status: string }[] }>(`/attendance?date=${todayISO}`, { token }),
        apiFetch<{ payments: { status: string; amount: number; month: number; year: number }[] }>(`/payments?year=${year}`, { token }),
        apiFetch<{ competitions: { id: string; events: { results: { id: string }[] }[] }[] }>('/competitions', { token }),
        apiFetch<{ months: { month: number; year: number; presentes: number }[] }>('/attendance/monthly-stats', { token }),
        apiFetch<{ counts: number[] }>('/attendance/weekday-stats', { token }),
      ]);

      if (membersRes.status === 'fulfilled') setTotalMembers(membersRes.value.members.length);
      if (attTodayRes.status === 'fulfilled') {
        setAsistenciaHoy(attTodayRes.value.records.filter(r => r.status === 'PRESENT').length);
      }
      if (paymentsRes.status === 'fulfilled') {
        const payments = paymentsRes.value.payments;
        const ingMes = payments
          .filter(p => p.status === 'PAID' && p.month === month && p.year === year)
          .reduce((s, p) => s + p.amount, 0);
        setIngresosMes(ingMes);
        const totalMes   = payments.filter(p => p.month === month && p.year === year).length;
        const pagadosMes = payments.filter(p => p.status === 'PAID' && p.month === month && p.year === year).length;
        setPagosAlDia(totalMes > 0 ? Math.round((pagadosMes / totalMes) * 100) : 0);
        const dist: Record<string, number> = { PAID: 0, PENDING: 0, OVERDUE: 0 };
        payments.filter(p => p.month === month && p.year === year).forEach(p => {
          if (dist[p.status] !== undefined) dist[p.status]++;
        });
        setPaymentDist([
          { name: 'Pagado',    value: dist.PAID,    color: GREEN  },
          { name: 'Pendiente', value: dist.PENDING, color: YELLOW },
          { name: 'Vencido',   value: dist.OVERDUE, color: RED    },
        ].filter(d => d.value > 0));
      }
      if (compsRes.status === 'fulfilled') {
        const total = compsRes.value.competitions.reduce(
          (s, c) => s + c.events.reduce((es, ev) => es + ev.results.length, 0), 0
        );
        setTotalLogros(total);
      }
      if (attMonthlyRes.status === 'fulfilled') {
        const attMonths: MonthlyAttendance[] = attMonthlyRes.value.months.map(m => ({
          month: MONTH_NAMES[m.month - 1],
          presentes: m.presentes,
        }));
        setAsistenciaMes(attMonths[attMonths.length - 1]?.presentes ?? 0);
        setMonthlyAtt(attMonths);
      }
      if (weekdayRes.status === 'fulfilled') {
        setWeekdayCounts(weekdayRes.value.counts);
      }
    } catch { /* silencioso */ } finally {
      setLoading(false);
    }
  }

  // KPIs
  const [totalMembers, setTotalMembers]       = useState<number | null>(null);
  const [asistenciaHoy, setAsistenciaHoy]     = useState<number | null>(null);
  const [asistenciaMes, setAsistenciaMes]     = useState<number | null>(null);
  const [ingresosMes, setIngresosMes]         = useState<number | null>(null);
  const [pagosAlDia, setPagosAlDia]           = useState<number | null>(null);
  const [totalLogros, setTotalLogros]         = useState<number | null>(null);

  // Gráficas
  const [monthlyAtt, setMonthlyAtt]           = useState<MonthlyAttendance[]>([]);
  const [weekdayCounts, setWeekdayCounts]     = useState<number[]>([0,0,0,0,0,0,0]);
  const [paymentDist, setPaymentDist]         = useState<PaymentDist[]>([]);

  useEffect(() => { loadReportes(); }, [isSignedIn, session]);

  // Tiempo real: SSE push desde el servidor
  useClubStream((ev) => {
    if (['members', 'payments', 'attendance', 'competitions', 'training'].includes(ev)) {
      loadReportes();
    }
  });

  function fmt(n: number) {
    return n >= 1_000_000
      ? `$${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
      ? `$${(n / 1_000).toFixed(0)}k`
      : `$${n}`;
  }

  const kpis = [
    {
      label: 'Total miembros',
      value: totalMembers !== null ? String(totalMembers) : '—',
      sub: 'Activos en el club',
      color: ACCENT,
      icon: Users,
    },
    {
      label: 'Asistencia hoy',
      value: asistenciaHoy !== null ? String(asistenciaHoy) : '—',
      sub: 'Presentes registrados',
      color: GREEN,
      icon: CalendarCheck,
    },
    {
      label: 'Ingresos mes',
      value: ingresosMes !== null ? fmt(ingresosMes) : '—',
      sub: MONTH_NAMES_FULL[new Date().getMonth()],
      color: YELLOW,
      icon: CreditCard,
    },
    {
      label: 'Pagos al día',
      value: pagosAlDia !== null ? `${pagosAlDia}%` : '—',
      sub: 'Del mes actual',
      color: pagosAlDia !== null && pagosAlDia >= 80 ? GREEN : pagosAlDia !== null && pagosAlDia >= 50 ? YELLOW : RED,
      icon: pagosAlDia !== null && pagosAlDia >= 80 ? TrendingUp : pagosAlDia !== null && pagosAlDia >= 50 ? Minus : TrendingDown,
    },
    {
      label: 'Resultados',
      value: totalLogros !== null ? String(totalLogros) : '—',
      sub: 'En competencias',
      color: PURPLE,
      icon: Trophy,
    },
    {
      label: 'Asistencia mes',
      value: asistenciaMes !== null ? String(asistenciaMes) : '—',
      sub: 'Presentes este mes',
      color: ACCENT,
      icon: CalendarCheck,
    },
  ];


  return (
    <div className="min-h-full bg-background pb-8">
      {/* Header */}
      <div className="px-5 py-3 bg-background border-b border-border">
        <h1 className="text-[22px] font-extrabold text-foreground uppercase" style={{ fontFamily: 'Space Grotesk, sans-serif', lineHeight: 1.1 }}>
          Reportes
        </h1>
        <p className="text-[11px] text-muted-foreground mt-0.5">{MONTH_NAMES_FULL[new Date().getMonth()]} {new Date().getFullYear()}</p>
      </div>

      <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col gap-4 px-4 py-4">

        {/* KPIs */}
        <motion.div variants={cardVariant} className="grid grid-cols-2 gap-3">
          {kpis.map((k) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className="bg-white border border-border rounded-xl px-4 py-3.5">
                <div className="flex items-center justify-between mb-1">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${k.color}18` }}>
                    <Icon className="w-4 h-4" style={{ color: k.color }} />
                  </div>
                  {loading && <div className="w-3 h-3 rounded-full border border-t-transparent animate-spin" style={{ borderColor: k.color, borderTopColor: 'transparent' }} />}
                </div>
                <p className="text-2xl font-extrabold mt-1.5" style={{ fontFamily: 'var(--font-space-grotesk)', color: k.color }}>
                  {loading ? '—' : k.value}
                </p>
                <p className="text-[12px] font-semibold text-foreground leading-tight">{k.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{k.sub}</p>
              </div>
            );
          })}
        </motion.div>

        {/* Gráfica asistencia mensual */}
        <motion.div variants={cardVariant} className="bg-white border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <p style={{ fontSize: 11, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Asistencia últimos 6 meses
            </p>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-[120px]">
              <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: ACCENT, borderTopColor: 'transparent' }} />
            </div>
          ) : monthlyAtt.every(m => m.presentes === 0) ? (
            <div className="flex flex-col items-center py-6 gap-2">
              <CalendarCheck className="w-8 h-8 text-muted-foreground/30" />
              <p className="text-[12px] text-muted-foreground">Sin registros de asistencia</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={monthlyAtt} barCategoryGap="25%" margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8E87A8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#C4C2CF' }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(67,97,238,0.06)' }}
                  contentStyle={{ borderRadius: 10, border: '1px solid #E8E6F0', fontSize: 12, padding: '4px 10px' }}
                  formatter={(v) => [Number(v ?? 0), 'Presentes']}
                />
                <Bar dataKey="presentes" radius={[6, 6, 0, 0]}>
                  {monthlyAtt.map((_, i) => (
                    <Cell key={i} fill={i === monthlyAtt.length - 1 ? ACCENT : `${ACCENT}55`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Gráfica asistencia por día de la semana */}
        <motion.div variants={cardVariant} className="bg-white border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-1">
            <p style={{ fontSize: 11, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Asistencia por día
            </p>
            <p className="text-[10px] text-muted-foreground">Últimas 8 semanas</p>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-[120px]">
              <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: ACCENT, borderTopColor: 'transparent' }} />
            </div>
          ) : weekdayCounts.every(c => c === 0) ? (
            <div className="flex flex-col items-center py-6 gap-2">
              <CalendarCheck className="w-8 h-8 text-muted-foreground/30" />
              <p className="text-[12px] text-muted-foreground">Sin datos de asistencia</p>
            </div>
          ) : (() => {
            const maxCount = Math.max(...weekdayCounts, 1);
            const chartData = DAY_LABELS.map((day, i) => ({ day, presentes: weekdayCounts[i] }));
            return (
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={chartData} barCategoryGap="20%" margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#8E87A8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#C4C2CF' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(67,97,238,0.06)' }}
                    contentStyle={{ borderRadius: 10, border: '1px solid #E8E6F0', fontSize: 12, padding: '4px 10px' }}
                    formatter={(v) => [Number(v ?? 0), 'Presentes']}
                  />
                  <Bar dataKey="presentes" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.presentes === maxCount && entry.presentes > 0 ? ACCENT : `${ACCENT}55`}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            );
          })()}
        </motion.div>

        {/* Distribución de pagos */}
        <motion.div variants={cardVariant} className="bg-white border border-border rounded-xl p-4">
          <p style={{ fontSize: 11, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
            Estado de pagos — {MONTH_NAMES_FULL[new Date().getMonth()]}
          </p>
          {loading ? (
            <div className="flex items-center justify-center h-[120px]">
              <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: YELLOW, borderTopColor: 'transparent' }} />
            </div>
          ) : paymentDist.length === 0 ? (
            <div className="flex flex-col items-center py-6 gap-2">
              <CreditCard className="w-8 h-8 text-muted-foreground/30" />
              <p className="text-[12px] text-muted-foreground">Sin registros de pagos este mes</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={paymentDist}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={68}
                    paddingAngle={3}
                  >
                    {paymentDist.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(v) => <span style={{ fontSize: 11, color: '#8E87A8' }}>{v}</span>}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: '1px solid #E8E6F0', fontSize: 12, padding: '4px 10px' }}
                    formatter={(v) => [Number(v ?? 0), 'pagos']}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Resumen numérico */}
              <div className="flex gap-2 mt-2">
                {paymentDist.map(d => (
                  <div key={d.name} className="flex-1 rounded-xl px-3 py-2 text-center" style={{ background: `${d.color}12` }}>
                    <p className="text-[18px] font-extrabold" style={{ color: d.color, fontFamily: 'var(--font-space-grotesk)' }}>{d.value}</p>
                    <p className="text-[10px] font-semibold" style={{ color: d.color }}>{d.name}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>

      </motion.div>
    </div>
  );
}
