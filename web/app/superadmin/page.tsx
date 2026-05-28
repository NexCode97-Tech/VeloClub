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
  CartesianGrid,
} from 'recharts';

const fmt      = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const fmtShort = (v: number) => v >= 1_000_000 ? `$${(v/1_000_000).toFixed(1)}M` : v >= 1_000 ? `$${(v/1_000).toFixed(0)}K` : `$${v}`;
const MONTH_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

// ── Variantes Emil Kowalski ────────────────────────────────────────────────────
const EASE = [0.23, 1, 0.32, 1] as [number,number,number,number];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0,  transition: { duration: 0.28, ease: EASE } },
};
const stagger: Variants = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const cardVariant: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  show:   { opacity: 1, y: 0,  scale: 1, transition: { duration: 0.24, ease: EASE } },
};

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
  const totalPlan      = clubs.reduce((a, c) => a + (c.suscripcion?.planMonto ?? 0), 0);
  const pctRecaudado   = totalPlan > 0 ? Math.round(totalRecaudado / totalPlan * 100) : 0;

  // ── Gráfica 1: Ingresos mensuales acumulado ───────────────────────────────────
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

  // ── Gráfica 2: Clubs por mes ───────────────────────────────────────────────────
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
      <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="min-h-full bg-background">

      {/* Hero con entrada suave */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
        className="px-5 pt-5 pb-4 border-b border-border"
        style={{ background: 'linear-gradient(135deg,#fff 0%,#F0EEF8 100%)' }}
      >
        <p className="text-xs text-muted-foreground mb-0.5">{todayLabel()}</p>
        <h1 className="text-[22px] font-extrabold text-foreground leading-tight mb-0.5" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
          Panel de Control
        </h1>
        <p className="text-[13px] font-semibold text-foreground/60 mb-2">VeloClub · Sistema</p>
        <span className="inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full tracking-wider mb-4"
          style={{ background: 'rgba(239,71,111,0.12)', color: '#EF476F' }}>
          SUPER ADMIN
        </span>

        {/* Stats 2x2 con stagger */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 gap-3"
        >
          {[
            { label: 'Total Clubs',     value: total,         color: '#7C3AED', icon: Building2 },
            { label: 'Clubs Activos',   value: activos,       color: '#06D6A0', icon: CheckCircle2 },
            { label: 'Total Miembros',  value: totalMiembros, color: '#FFB703', icon: Users },
            { label: 'Clubs Inactivos', value: inactivos,     color: '#EF476F', icon: XCircle },
          ].map(s => (
            <motion.div
              key={s.label}
              variants={cardVariant}
              className="bg-white border border-border rounded-xl p-4 text-center"
            >
              <div className="flex justify-center mb-2" style={{ color: s.color }}>
                <s.icon className="w-5 h-5" />
              </div>
              <div className="text-2xl font-extrabold leading-none mb-1"
                style={{ color: s.color, fontFamily: 'var(--font-space-grotesk)' }}>
                {s.value}
              </div>
              <div className="text-[10px] text-muted-foreground">{s.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      <div className="px-5 py-4 space-y-5">

        {/* Finanzas */}
        {totalPlan > 0 && (
          <motion.section variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-40px' }}>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Resumen de finanzas</p>
              <motion.div whileTap={{ scale: 0.95 }} style={{ display: 'inline-block' }}>
                <Link href="/superadmin/finanzas" className="text-[11px] font-semibold" style={{ color: '#7C3AED' }}>Ver detalle</Link>
              </motion.div>
            </div>
            <div className="bg-white border border-border rounded-xl overflow-hidden">
              <div className="px-4 pt-4 pb-2">
                <p className="text-[13px] font-bold text-foreground mb-0.5" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                  Tendencia · <span style={{ color: '#7C3AED' }}>Total facturado</span>
                </p>
                <p className="text-[10px] text-muted-foreground mb-3">{currentYear} · acumulado mensual</p>
                {!hasIncomeData ? (
                  <div className="flex items-center justify-center py-8">
                    <p className="text-[12px] text-muted-foreground">Sin ingresos registrados aún</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={incomeDataTrimmed} margin={{ top: 8, right: 4, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#7C3AED" stopOpacity={0.18} />
                          <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" stroke="rgba(0,0,0,0.05)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#8E87A8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: '#8E87A8' }} axisLine={false} tickLine={false} tickFormatter={fmtShort} />
                      <Tooltip
                        contentStyle={{ borderRadius: 10, border: '1px solid #E8E6F0', fontSize: 12, padding: '6px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                        formatter={(v) => [fmt.format(Number(v ?? 0)), 'Facturado']}
                        labelStyle={{ fontWeight: 700, color: '#1A1028' }}
                      />
                      <Area type="monotone" dataKey="total" stroke="#7C3AED" strokeWidth={2.5}
                        fill="url(#incomeGrad)" dot={false} activeDot={{ r: 5, fill: '#7C3AED', stroke: '#fff', strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div style={{ height: 1, background: 'rgba(120,80,200,0.08)', margin: '0 16px' }} />
              <div className="px-4 py-4">
                <div className="flex justify-between mb-3">
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">RECAUDADO</p>
                    <p className="text-[18px] font-extrabold" style={{ color: '#06D6A0', fontFamily: 'var(--font-space-grotesk)' }}>{fmt.format(totalRecaudado)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">PENDIENTE</p>
                    <p className="text-[18px] font-extrabold" style={{ color: '#EF476F', fontFamily: 'var(--font-space-grotesk)' }}>{fmt.format(totalPlan - totalRecaudado)}</p>
                  </div>
                </div>
                <div className="h-[6px] rounded-full overflow-hidden mb-1.5 bg-border">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg,#06D6A0,#7C3AED)' }}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${pctRecaudado}%` }}
                    transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
                    viewport={{ once: true }}
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] font-semibold" style={{ color: '#06D6A0' }}>{pctRecaudado}% cobrado</span>
                  <span className="text-[10px] text-muted-foreground">Meta: {fmt.format(totalPlan)}</span>
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {/* Clubs por mes */}
        <motion.section variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-40px' }}>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">Clubs registrados por mes</p>
          <div className="bg-white border border-border rounded-xl p-4">
            <p className="text-[13px] font-bold text-foreground mb-0.5" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
              Nuevos clubs · <span style={{ color: '#06D6A0' }}>{currentYear}</span>
            </p>
            <p className="text-[10px] text-muted-foreground mb-3">Registros por mes</p>
            {!hasClubsData ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-[12px] text-muted-foreground">Sin registros en {currentYear}</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={clubsByMonth} barCategoryGap="25%" margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="clubGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"  stopColor="#06D6A0" stopOpacity={1} />
                      <stop offset="100%" stopColor="#0CB68D" stopOpacity={0.7} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(0,0,0,0.05)" vertical={false} />
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

        {/* Lista de clubs con stagger */}
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Clubs registrados</p>
            <motion.div whileTap={{ scale: 0.95 }} style={{ display: 'inline-block' }}>
              <Link href="/superadmin/clubs" className="text-[11px] font-semibold" style={{ color: '#7C3AED' }}>Gestionar</Link>
            </motion.div>
          </div>
          {clubs.length === 0 ? (
            <div className="bg-white border border-border rounded-xl px-4 py-8 text-center">
              <Building2 className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-[12px] text-muted-foreground">No hay clubs registrados aún</p>
            </div>
          ) : (
            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-20px' }}
              className="space-y-2"
            >
              {clubs.map(club => {
                const recaudado = (club.suscripcion?.pagos ?? []).filter(p => p.estado === 'PAID').reduce((a, p) => a + p.monto, 0);
                return (
                  <motion.div key={club.id} variants={cardVariant}>
                    <Link href="/superadmin/clubs">
                      <motion.div
                        className="bg-white border border-border rounded-xl flex items-center gap-3 px-4 py-3 cursor-pointer"
                        whileTap={{ scale: 0.98 }}
                        transition={{ duration: 0.12, ease: EASE }}
                      >
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-[15px] font-extrabold"
                          style={{ background: 'rgba(124,58,237,0.10)', color: '#7C3AED', fontFamily: 'var(--font-space-grotesk)' }}>
                          {club.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <p className="text-[13px] font-bold text-foreground truncate">{club.name}</p>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                              style={{ background: club.active ? 'rgba(6,214,160,0.12)' : 'rgba(239,71,111,0.12)', color: club.active ? '#06D6A0' : '#EF476F' }}>
                              {club.active ? 'Activo' : 'Inactivo'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Users className="w-3 h-3" />{club._count?.members ?? 0} miembros
                            </span>
                            {recaudado > 0 && (
                              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <CircleDollarSign className="w-3 h-3" />{fmt.format(recaudado)}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
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
