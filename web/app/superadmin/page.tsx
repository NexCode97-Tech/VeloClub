'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import Link from 'next/link';
import { Users, Building2, CircleDollarSign, ChevronRight, CheckCircle2, XCircle } from 'lucide-react';
import { motion, type Variants } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell,
} from 'recharts';

const fmt      = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const fmtShort = (v: number) => v >= 1_000_000 ? `$${(v/1_000_000).toFixed(1)}M` : v >= 1_000 ? `$${(v/1_000).toFixed(0)}K` : `$${v}`;
const MONTH_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

// ── Easing ────────────────────────────────────────────────────────────────────
const EASE = [0.23, 1, 0.32, 1] as [number,number,number,number];

// ── Variantes ─────────────────────────────────────────────────────────────────
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0,  transition: { duration: 0.28, ease: EASE } },
};
const stagger: Variants = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};
const rowVariant: Variants = {
  hidden: { opacity: 0, x: -8 },
  show:   { opacity: 1, x: 0, transition: { duration: 0.22, ease: EASE } },
};
const cardVariant: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.98 },
  show:   { opacity: 1, y: 0,  scale: 1, transition: { duration: 0.22, ease: EASE } },
};

// ── Interfaces ────────────────────────────────────────────────────────────────
interface Pago { id: string; estado: string; monto: number; fecha?: string | null; }
interface Suscripcion { planMonto: number; pagos: Pago[]; }
interface Club {
  id: string; name: string; active: boolean;
  createdAt: string; _count: { members: number };
  suscripcion?: Suscripcion | null;
}

function todayLabel() {
  const d = new Date();
  const day  = d.toLocaleDateString('es-CO', { weekday: 'long' });
  const rest = d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
  return `${day.charAt(0).toUpperCase() + day.slice(1)}, ${rest}`;
}

export default function SuperadminDashboard() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { router.push('/sign-in'); return; }
    (async () => {
      try {
        const token = await getToken();
        const res = await apiFetch<{ clubs: Club[] }>('/superadmin/suscripciones', { token });
        setClubs(res.clubs);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [isLoaded, isSignedIn]);

  // ── Métricas ─────────────────────────────────────────────────────────────────
  const total          = clubs.length;
  const activos        = clubs.filter(c => c.active).length;
  const inactivos      = clubs.filter(c => !c.active).length;
  const totalMiembros  = clubs.reduce((s, c) => s + (c._count?.members ?? 0), 0);
  const allPagos       = clubs.flatMap(c => c.suscripcion?.pagos ?? []);
  const totalRecaudado = allPagos.filter(p => p.estado === 'PAID').reduce((a, p) => a + p.monto, 0);
  const totalPendiente = allPagos.filter(p => p.estado !== 'PAID').reduce((a, p) => a + p.monto, 0);
  const totalPlan      = clubs.reduce((a, c) => a + (c.suscripcion?.planMonto ?? 0), 0);
  const totalMeta      = totalPlan;
  const pctRecaudado   = totalMeta > 0 ? Math.min(100, Math.round(totalRecaudado / totalMeta * 100)) : 0;
  const clubsConSus    = clubs.filter(c => c.suscripcion).length;
  const donutData      = [
    { name: 'Cobrado',   value: totalRecaudado || 0.001 },
    { name: 'Pendiente', value: Math.max(totalMeta - totalRecaudado, 0) || (totalMeta === 0 ? 0.999 : 0) },
  ];

  // ── Gráfica 1: Ingresos acumulados ─────────────────────────────────────────
  const currentYear = new Date().getFullYear();
  const monthlyIncome = MONTH_SHORT.map((name, i) => {
    const total = allPagos
      .filter(p => p.estado === 'PAID' && p.fecha)
      .filter(p => { const d = new Date(p.fecha!); return d.getFullYear() === currentYear && d.getMonth() === i; })
      .reduce((a, p) => a + p.monto, 0);
    return { name, total };
  });
  let acc = 0;
  const incomeData = monthlyIncome.map(d => { acc += d.total; return { name: d.name, total: acc }; });
  const nowMonth = new Date().getMonth();
  const incomeDataTrimmed = incomeData.slice(0, nowMonth + 1);
  const hasIncomeData = incomeDataTrimmed.some(d => d.total > 0);

  // ── Gráfica 2: Clubs por mes ────────────────────────────────────────────────
  const clubsByMonth = MONTH_SHORT.map((name, i) => ({
    name,
    clubs: clubs.filter(c => {
      const d = new Date(c.createdAt);
      return d.getFullYear() === currentYear && d.getMonth() === i;
    }).length,
  })).slice(0, nowMonth + 1);
  const hasClubsData = clubsByMonth.some(d => d.clubs > 0);

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: '#7C3AED', borderTopColor: 'transparent' }} />
    </div>
  );

  return (
    <div style={{ background: '#F7F7FB', minHeight: '100%' }}>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: EASE }}
        style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(120,80,200,0.08)' }}
      >
        <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {todayLabel()}
        </p>
        <h1 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 800, color: '#1A1028', lineHeight: 1.1, fontFamily: 'Space Grotesk, sans-serif' }}>
          Panel Global
        </h1>
        <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: 'rgba(239,71,111,0.10)', color: '#EF476F', letterSpacing: '0.07em' }}>
          SUPERADMIN
        </span>
      </motion.div>

      <div style={{ padding: '16px 16px 100px' }}>

        {/* ── Stats — lista horizontal, no grid de tarjetas ──────────────── */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', borderRadius: 20, marginBottom: 20, overflow: 'hidden' }}
        >
          {[
            { label: 'Total clubs',     value: total,         color: '#7C3AED', Icon: Building2,    sub: `${activos} activos` },
            { label: 'Clubs activos',   value: activos,       color: '#06D6A0', Icon: CheckCircle2, sub: `de ${total} total` },
            { label: 'Total miembros',  value: totalMiembros, color: '#FFB703', Icon: Users,        sub: 'en todos los clubs' },
            { label: 'Clubs inactivos', value: inactivos,     color: '#EF476F', Icon: XCircle,      sub: 'sin actividad' },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              variants={rowVariant}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
                borderBottom: i < 3 ? '1px solid rgba(120,80,200,0.07)' : 'none',
              }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 11, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <s.Icon size={16} color={s.color} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1A1028', lineHeight: 1.2 }}>{s.label}</p>
                <p style={{ margin: 0, fontSize: 10, color: '#8E87A8', marginTop: 1 }}>{s.sub}</p>
              </div>
              <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: s.color, fontFamily: 'Space Grotesk, sans-serif', lineHeight: 1 }}>
                {s.value}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Resumen financiero — 3 tarjetas + donut ─────────────────────── */}
        {totalMeta > 0 && (
          <motion.section variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Resumen financiero
              </p>
              <motion.div whileTap={{ scale: 0.95 }} style={{ display: 'inline-block' }}>
                <Link href="/superadmin/finanzas" style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', textDecoration: 'none' }}>
                  Ver detalle →
                </Link>
              </motion.div>
            </div>

            {/* 3 tarjetas de métricas */}
            <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}
            >
              {[
                { label: 'Recaudado',  value: totalRecaudado, color: '#06D6A0', bg: 'rgba(6,214,160,0.08)',   border: 'rgba(6,214,160,0.18)'   },
                { label: 'Pendiente',  value: totalPendiente, color: '#EF476F', bg: 'rgba(239,71,111,0.08)',  border: 'rgba(239,71,111,0.18)'  },
                { label: 'Meta anual', value: totalMeta,      color: '#7C3AED', bg: 'rgba(124,58,237,0.07)', border: 'rgba(124,58,237,0.18)'  },
              ].map(s => (
                <motion.div key={s.label} variants={cardVariant}
                  style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 16, padding: '12px 10px' }}
                >
                  <p style={{ margin: '0 0 6px', fontSize: 9, fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {s.label}
                  </p>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: s.color, fontFamily: 'Space Grotesk, sans-serif', lineHeight: 1.1 }}>
                    {fmtShort(s.value)}
                  </p>
                </motion.div>
              ))}
            </motion.div>

            {/* Donut + leyenda */}
            <motion.div variants={cardVariant} initial="hidden" whileInView="show" viewport={{ once: true }}
              style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', borderRadius: 20, padding: '16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 0 }}
            >
              {/* Donut */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <ResponsiveContainer width={110} height={110}>
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%" cy="50%"
                      innerRadius={36} outerRadius={50}
                      startAngle={90} endAngle={-270}
                      paddingAngle={donutData[1].value > 0.001 ? 3 : 0}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      <Cell fill="#06D6A0" />
                      <Cell fill="rgba(239,71,111,0.18)" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* % centrado */}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: pctRecaudado >= 100 ? '#06D6A0' : '#1A1028', fontFamily: 'Space Grotesk, sans-serif', lineHeight: 1 }}>
                    {pctRecaudado}%
                  </p>
                </div>
              </div>

              {/* Leyenda */}
              <div style={{ flex: 1, paddingLeft: 16 }}>
                <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#1A1028', fontFamily: 'Space Grotesk, sans-serif' }}>
                  Progreso de cobro
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { label: 'Cobrado',   color: '#06D6A0', value: totalRecaudado },
                    { label: 'Pendiente', color: '#EF476F', value: totalPendiente },
                  ].map(l => (
                    <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color, flexShrink: 0 }} />
                      <p style={{ margin: 0, fontSize: 11, color: '#8E87A8', flex: 1 }}>{l.label}</p>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: l.color }}>{fmtShort(l.value)}</p>
                    </div>
                  ))}
                  <div style={{ marginTop: 2, paddingTop: 6, borderTop: '1px solid rgba(120,80,200,0.07)' }}>
                    <p style={{ margin: 0, fontSize: 10, color: '#8E87A8' }}>
                      {clubsConSus} club{clubsConSus !== 1 ? 's' : ''} con suscripción activa
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.section>
        )}

        {/* ── Clubs por mes ───────────────────────────────────────────────── */}
        <motion.section variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-40px' }}>
          <p style={{ margin: '0 0 10px', fontSize: 10, fontWeight: 700, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Nuevos clubs por mes
          </p>
          <div style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', borderRadius: 20, padding: '14px 16px', marginBottom: 20 }}>
            <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700, color: '#1A1028', fontFamily: 'Space Grotesk, sans-serif' }}>
              Registros {currentYear}
            </p>
            <p style={{ margin: '0 0 12px', fontSize: 10, color: '#8E87A8' }}>Clubs creados por mes</p>
            {!hasClubsData ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 80 }}>
                <p style={{ fontSize: 12, color: '#8E87A8', margin: 0 }}>Sin registros en {currentYear}</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={clubsByMonth} barCategoryGap="28%" margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="clubGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"  stopColor="#06D6A0" stopOpacity={1} />
                      <stop offset="100%" stopColor="#0CB68D" stopOpacity={0.75} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(0,0,0,0.04)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#8E87A8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 9, fill: '#8E87A8' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: '1px solid #E8E6F0', fontSize: 12, padding: '6px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                    formatter={(v) => [Number(v ?? 0), 'Clubs']}
                    labelStyle={{ fontWeight: 700, color: '#1A1028' }}
                  />
                  <Bar dataKey="clubs" fill="url(#clubGrad)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.section>

        {/* ── Lista de clubs ──────────────────────────────────────────────── */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Clubs registrados
            </p>
            <motion.div whileTap={{ scale: 0.95 }} style={{ display: 'inline-block' }}>
              <Link href="/superadmin/clubs" style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', textDecoration: 'none' }}>
                Gestionar →
              </Link>
            </motion.div>
          </div>

          {clubs.length === 0 ? (
            <div style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', borderRadius: 20, padding: '32px 16px', textAlign: 'center' }}>
              <Building2 size={28} style={{ color: 'rgba(142,135,168,0.30)', margin: '0 auto 8px', display: 'block' }} />
              <p style={{ margin: 0, fontSize: 12, color: '#8E87A8' }}>No hay clubs registrados aún</p>
            </div>
          ) : (
            <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-20px' }}
              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              {clubs.map(club => {
                const recaudado = (club.suscripcion?.pagos ?? []).filter(p => p.estado === 'PAID').reduce((a, p) => a + p.monto, 0);
                return (
                  <motion.div key={club.id} variants={cardVariant}>
                    <Link href="/superadmin/clubs" style={{ textDecoration: 'none' }}>
                      <motion.div
                        whileTap={{ scale: 0.98 }}
                        transition={{ duration: 0.12, ease: EASE }}
                        style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: 'pointer' }}
                      >
                        <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(124,58,237,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: '#7C3AED', fontFamily: 'Space Grotesk, sans-serif', flexShrink: 0 }}>
                          {club.name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1A1028', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {club.name}
                            </p>
                            <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 99, background: club.active ? 'rgba(6,214,160,0.12)' : 'rgba(239,71,111,0.12)', color: club.active ? '#06D6A0' : '#EF476F' }}>
                              {club.active ? 'Activo' : 'Inactivo'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 11, color: '#8E87A8', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Users size={11} /> {club._count?.members ?? 0}
                            </span>
                            {recaudado > 0 && (
                              <span style={{ fontSize: 11, color: '#8E87A8', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <CircleDollarSign size={11} /> {fmt.format(recaudado)}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight size={15} style={{ color: 'rgba(142,135,168,0.35)', flexShrink: 0 }} />
                      </motion.div>
                    </Link>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </section>

      </div>
    </div>
  );
}
