'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import Link from 'next/link';
import { Users, Building2, CircleDollarSign, ChevronRight, ArrowUpRight } from 'lucide-react';
import { motion, type Variants, useReducedMotion } from 'framer-motion';
import { stagger, cardVariant } from '@/lib/page-animations';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

// ── Formateo ──────────────────────────────────────────────────────────────────
const fmt      = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const MONTH_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function fmtHero(v: number): { main: string; suffix: string } {
  if (v >= 1_000_000) return { main: `$${(v / 1_000_000).toFixed(1)}`, suffix: 'M' };
  if (v >= 1_000)     return { main: `$${(v / 1_000).toFixed(0)}`,     suffix: 'K' };
  return { main: `$${v}`, suffix: '' };
}
function todayLabel() {
  const d = new Date();
  const day  = d.toLocaleDateString('es-CO', { weekday: 'long' });
  const rest = d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
  return `${day.charAt(0).toUpperCase() + day.slice(1)}, ${rest}`;
}

// ── Easing ────────────────────────────────────────────────────────────────────
const EASE = [0.23, 1, 0.32, 1] as [number,number,number,number];

// ── barVariant (exclusivo del mini chart) ─────────────────────────────────────
const barVariant: Variants = {
  hidden: { scaleY: 0, opacity: 0 },
  show:   { scaleY: 1, opacity: 1, transition: { duration: 0.40, ease: EASE } },
};

// ── Interfaces ────────────────────────────────────────────────────────────────
interface Pago { id: string; estado: string; monto: number; fecha?: string | null; }
interface Suscripcion { planMonto: number; pagos: Pago[]; }
interface Club {
  id: string; name: string; active: boolean;
  createdAt: string; trialEndsAt?: string | null;
  logoUrl?: string | null;
  _count: { members: number };
  suscripcion?: Suscripcion | null;
}

// ── Mini bar chart (custom, no recharts) ──────────────────────────────────────
function MiniBarChart({ data }: { data: number[] }) {
  const shouldReduceMotion = useReducedMotion();
  const max = Math.max(...data, 1);
  const nowIdx = data.length - 1;

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 44 }}
    >
      {data.map((v, i) => {
        const h = Math.max(6, Math.round((v / max) * 44));
        const isRecent = i >= nowIdx - 2;
        return (
          <motion.div
            key={i}
            variants={shouldReduceMotion ? {} : barVariant}
            custom={i}
            style={{
              flex: 1,
              height: h,
              borderRadius: 4,
              background: isRecent
                ? '#7C3AED'
                : `rgba(124,58,237,${0.15 + (i / data.length) * 0.25})`,
              transformOrigin: 'bottom',
            }}
          />
        );
      })}
    </motion.div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function SuperadminDashboard() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
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

  // ── Métricas ──────────────────────────────────────────────────────────────
  const now             = new Date();
  const currentMonth    = now.getMonth();
  const currentYear     = now.getFullYear();
  const total           = clubs.length;
  const activos         = clubs.filter(c => c.active).length;
  const totalMiembros   = clubs.reduce((s, c) => s + (c._count?.members ?? 0), 0);
  const allPagos        = clubs.flatMap(c => c.suscripcion?.pagos ?? []);

  // Recaudado este mes vs mes anterior
  const recaudadoEsteMes = allPagos
    .filter(p => p.estado === 'PAID' && p.fecha)
    .filter(p => { const d = new Date(p.fecha!); return d.getFullYear() === currentYear && d.getMonth() === currentMonth; })
    .reduce((a, p) => a + p.monto, 0);

  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear  = currentMonth === 0 ? currentYear - 1 : currentYear;
  const recaudadoMesAnterior = allPagos
    .filter(p => p.estado === 'PAID' && p.fecha)
    .filter(p => { const d = new Date(p.fecha!); return d.getFullYear() === prevYear && d.getMonth() === prevMonth; })
    .reduce((a, p) => a + p.monto, 0);

  const pctCambio = recaudadoMesAnterior > 0
    ? Math.round(((recaudadoEsteMes - recaudadoMesAnterior) / recaudadoMesAnterior) * 100)
    : recaudadoEsteMes > 0 ? 100 : 0;

  // Clubs en prueba — usa trialEndsAt si existe, si no asume createdAt+15d
  const enPrueba = clubs.filter(c => {
    if (c.suscripcion) return false; // ya tiene plan pagado
    const end = c.trialEndsAt
      ? new Date(c.trialEndsAt)
      : (() => { const d = new Date(c.createdAt); d.setDate(d.getDate() + 15); return d; })();
    return end >= now;
  }).length;

  // Días de trial restante
  const trialDays = clubs
    .filter(c => !c.suscripcion)
    .map(c => {
      const end = c.trialEndsAt
        ? new Date(c.trialEndsAt)
        : (() => { const d = new Date(c.createdAt); d.setDate(d.getDate() + 15); return d; })();
      return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86_400_000));
    })
    .filter(d => d > 0);
  const maxTrialDays = trialDays.length > 0 ? Math.max(...trialDays) : 0;

  // Recaudado total y data para el chart histórico
  const totalRecaudado = allPagos.filter(p => p.estado === 'PAID').reduce((a, p) => a + p.monto, 0);

  // Barras del mini chart — últimos 12 meses (o menos si no hay data)
  const monthlyBars = MONTH_SHORT.map((_, i) => {
    return allPagos
      .filter(p => p.estado === 'PAID' && p.fecha)
      .filter(p => { const d = new Date(p.fecha!); return d.getFullYear() === currentYear && d.getMonth() === i; })
      .reduce((a, p) => a + p.monto, 0);
  }).slice(0, currentMonth + 1);

  // Data chart área
  const monthlyIncome = MONTH_SHORT.map((name, i) => ({
    name,
    total: allPagos
      .filter(p => p.estado === 'PAID' && p.fecha)
      .filter(p => { const d = new Date(p.fecha!); return d.getFullYear() === currentYear && d.getMonth() === i; })
      .reduce((a, p) => a + p.monto, 0),
  })).slice(0, currentMonth + 1);
  const hasIncomeData = monthlyIncome.some(d => d.total > 0);

  const heroFmt    = fmtHero(recaudadoEsteMes);
  const isPositive = pctCambio >= 0;

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 300, background: '#F7F7FB' }}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
        style={{ width: 24, height: 24, borderRadius: '50%', border: '2.5px solid #7C3AED', borderTopColor: 'transparent' }}
      />
    </div>
  );

  return (
    <div style={{ background: '#F7F7FB', minHeight: '100%' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ padding: '20px 20px 14px' }}>
        <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {todayLabel()}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1A1028', lineHeight: 1.1, fontFamily: 'Open Sans, sans-serif' }}>
            Panel Global
          </h1>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: 'rgba(239,71,111,0.10)', color: '#EF476F', letterSpacing: '0.07em' }}>
            SUPERADMIN
          </span>
        </div>
      </div>

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        style={{ padding: '0 16px 100px' }}
      >
        {/* ── Hero card — RECAUDADO ESTE MES ─────────────────────────────── */}
        <motion.div
          variants={cardVariant}
          style={{ background: '#fff', borderRadius: 24, padding: '20px 20px 18px', marginBottom: 10, border: '1px solid rgba(120,80,200,0.10)', boxShadow: '0 2px 20px rgba(124,58,237,0.06)', position: 'relative', overflow: 'hidden' }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.10em' }}>
              Recaudado · Este mes
            </p>
            <motion.div whileTap={{ scale: shouldReduceMotion ? 1 : 0.88 }} transition={{ duration: 0.12, ease: EASE }}>
              <Link href="/superadmin/finanzas" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: '50%', background: '#7C3AED', boxShadow: '0 4px 14px rgba(124,58,237,0.38)' }}>
                <ArrowUpRight size={16} color="#fff" strokeWidth={2.5} />
              </Link>
            </motion.div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 6 }}>
            <span style={{ fontSize: 48, fontWeight: 800, color: '#1A1028', fontFamily: 'Open Sans, sans-serif', lineHeight: 1 }}>
              {heroFmt.main}
            </span>
            {heroFmt.suffix && (
              <span style={{ fontSize: 36, fontWeight: 700, color: '#C4BFD8', fontFamily: 'Open Sans, sans-serif', lineHeight: 1 }}>
                {heroFmt.suffix}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: isPositive ? '#06D6A0' : '#EF476F' }}>
              {isPositive ? '+' : ''}{pctCambio}%
            </span>
            <span style={{ fontSize: 11, color: '#8E87A8' }}>vs mes anterior</span>
          </div>
          {monthlyBars.length > 0 && <MiniBarChart data={monthlyBars} />}
        </motion.div>

        {/* ── Dos cards pequeñas ──────────────────────────────────────────── */}
        <motion.div
          variants={cardVariant}
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}
        >
          <div style={{ background: '#fff', borderRadius: 20, padding: '16px 14px', border: '1px solid rgba(120,80,200,0.10)', boxShadow: '0 2px 12px rgba(124,58,237,0.05)' }}>
            <p style={{ margin: '0 0 10px', fontSize: 9, fontWeight: 700, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.10em' }}>Clubs activos</p>
            <p style={{ margin: '0 0 4px', fontSize: 44, fontWeight: 800, color: '#1A1028', fontFamily: 'Open Sans, sans-serif', lineHeight: 1 }}>
              {String(activos).padStart(2, '0')}
            </p>
            <p style={{ margin: 0, fontSize: 11, color: '#8E87A8' }}>de {total} totales</p>
          </div>
          <div style={{ background: '#fff', borderRadius: 20, padding: '16px 14px', border: '1px solid rgba(120,80,200,0.10)', boxShadow: '0 2px 12px rgba(124,58,237,0.05)' }}>
            <p style={{ margin: '0 0 10px', fontSize: 9, fontWeight: 700, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.10em' }}>En prueba</p>
            <p style={{ margin: '0 0 4px', fontSize: 44, fontWeight: 800, color: '#1A1028', fontFamily: 'Open Sans, sans-serif', lineHeight: 1 }}>
              {String(enPrueba).padStart(2, '0')}
            </p>
            {enPrueba > 0
              ? <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#B88A00' }}>Trial {maxTrialDays}d</p>
              : <p style={{ margin: 0, fontSize: 11, color: '#8E87A8' }}>sin trials activos</p>
            }
          </div>
        </motion.div>

        {/* ── Stats secundarias ────────────────────────────────────────────── */}
        <motion.div
          variants={cardVariant}
          style={{ background: '#fff', borderRadius: 20, border: '1px solid rgba(120,80,200,0.10)', overflow: 'hidden', marginBottom: 20 }}
        >
          {[
            { label: 'Total recaudado', value: totalRecaudado > 0 ? fmtHero(totalRecaudado).main + fmtHero(totalRecaudado).suffix : '$0', color: '#06D6A0', sub: 'histórico' },
            { label: 'Total miembros',  value: String(totalMiembros), color: '#7C3AED', sub: 'en todos los clubs' },
            { label: 'Total clubs',     value: String(total),         color: '#FFB703', sub: `${activos} activos` },
          ].map((s, i) => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: i < 2 ? '1px solid rgba(120,80,200,0.07)' : 'none' }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1A1028' }}>{s.label}</p>
                <p style={{ margin: '1px 0 0', fontSize: 10, color: '#8E87A8' }}>{s.sub}</p>
              </div>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: s.color, fontFamily: 'Open Sans, sans-serif', lineHeight: 1 }}>{s.value}</p>
            </div>
          ))}
        </motion.div>

        {/* ── Gráfica de ingresos por mes ──────────────────────────────────── */}
        {hasIncomeData && (
          <motion.div
            variants={cardVariant}
            style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', borderRadius: 20, overflow: 'hidden', marginBottom: 20 }}
          >
            <div style={{ padding: '16px 16px 0' }}>
              <p style={{ margin: '0 0 1px', fontSize: 13, fontWeight: 700, color: '#1A1028', fontFamily: 'Open Sans, sans-serif' }}>Ingresos por mes</p>
              <p style={{ margin: '0 0 12px', fontSize: 10, color: '#8E87A8' }}>{currentYear}</p>
            </div>
            <ResponsiveContainer width="100%" height={150}>
              <AreaChart data={monthlyIncome} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#7C3AED" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(0,0,0,0.04)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#8E87A8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#8E87A8' }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1_000_000 ? `${(v/1_000_000).toFixed(0)}M` : v >= 1_000 ? `${(v/1_000).toFixed(0)}K` : `${v}`} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid rgba(120,80,200,0.15)', fontSize: 12, padding: '8px 14px', boxShadow: '0 6px 20px rgba(0,0,0,0.08)' }}
                  formatter={(v) => [fmt.format(Number(v ?? 0)), 'Recaudado']}
                  labelStyle={{ fontWeight: 700, color: '#1A1028' }}
                />
                <Area type="monotone" dataKey="total" stroke="#7C3AED" strokeWidth={2.4}
                  fill="url(#incomeGrad)" dot={false}
                  activeDot={{ r: 5, fill: '#7C3AED', stroke: '#fff', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* ── Lista rápida de clubs ────────────────────────────────────────── */}
        <motion.div variants={cardVariant}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Clubs registrados
            </p>
            <Link href="/superadmin/clubs" style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', textDecoration: 'none' }}>
              Gestionar →
            </Link>
          </div>
          {clubs.length === 0 ? (
            <div style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', borderRadius: 20, padding: '32px 16px', textAlign: 'center' }}>
              <Building2 size={28} style={{ color: 'rgba(142,135,168,0.30)', margin: '0 auto 8px', display: 'block' }} />
              <p style={{ margin: 0, fontSize: 12, color: '#8E87A8' }}>No hay clubs registrados aún</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {clubs.map(club => {
                const recaudado = (club.suscripcion?.pagos ?? []).filter(p => p.estado === 'PAID').reduce((a, p) => a + p.monto, 0);
                return (
                  <Link key={club.id} href="/superadmin/clubs" style={{ textDecoration: 'none' }}>
                    <div style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: 'pointer' }}>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(124,58,237,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#7C3AED', fontFamily: 'Open Sans, sans-serif', flexShrink: 0, overflow: 'hidden' }}>
                        {club.logoUrl
                          ? <img src={club.logoUrl} alt={club.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : club.name.charAt(0).toUpperCase()
                        }
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
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </motion.div>

      </motion.div>
    </div>
  );
}
