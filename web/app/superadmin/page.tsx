'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import Link from 'next/link';

const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

interface Club {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  _count: { members: number };
}

// Suscripciones mock — reemplazar con API cuando exista
const MOCK_SUSCRIPCIONES = [
  { clubId: 'c1', club: 'Club Velo Bogotá', plan: 450000, pagos: [
    { id: 'p1', estado: 'PAID', monto: 225000 },
    { id: 'p2', estado: 'PAID', monto: 112500 },
    { id: 'p3', estado: 'PENDING', monto: 112500 },
  ]},
  { clubId: 'c2', club: 'Patines Medellín', plan: 450000, pagos: [
    { id: 'p4', estado: 'PAID', monto: 225000 },
    { id: 'p5', estado: 'PAID', monto: 112500 },
    { id: 'p6', estado: 'OVERDUE', monto: 112500 },
  ]},
  { clubId: 'c3', club: 'Speed Cali', plan: 450000, pagos: [
    { id: 'p7', estado: 'PENDING', monto: 225000 },
    { id: 'p8', estado: 'PENDING', monto: 112500 },
    { id: 'p9', estado: 'PENDING', monto: 112500 },
  ]},
];

function SAHeader({ title }: { title: string }) {
  const [spin, setSpin] = useState(false);
  return (
    <div
      className="px-4 flex items-center gap-2 shrink-0"
      style={{ padding: '12px 16px 10px', background: '#F7F7FB', borderBottom: '1px solid rgba(120,80,200,0.10)' }}
    >
      <h2
        className="flex-1 text-[17px] font-bold m-0"
        style={{ fontFamily: 'Space Grotesk, sans-serif', color: '#1A1028' }}
      >
        {title}
      </h2>
      <button
        onClick={() => { setSpin(true); setTimeout(() => { setSpin(false); window.location.reload(); }, 400); }}
        className="w-[34px] h-[34px] rounded-full flex items-center justify-center transition-transform"
        style={{
          background: '#F0EEF8', border: '1px solid rgba(120,80,200,0.10)', color: '#8E87A8',
          transform: spin ? 'rotate(180deg)' : 'rotate(0deg)',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
      </button>
      <button
        className="w-[34px] h-[34px] rounded-full flex items-center justify-center relative"
        style={{ background: '#F0EEF8', border: '1px solid rgba(120,80,200,0.10)', color: '#8E87A8' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        <div className="absolute w-[7px] h-[7px] rounded-full" style={{ top: 7, right: 8, background: '#EF476F', border: '1.5px solid #F7F7FB' }} />
      </button>
    </div>
  );
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
        const res = await apiFetch<{ clubs: Club[] }>('/superadmin/clubs', { token });
        setClubs(res.clubs);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [isLoaded, isSignedIn]);

  const total = clubs.length;
  const activos = clubs.filter(c => c.active).length;
  const inactivos = clubs.filter(c => !c.active).length;
  const totalMiembros = clubs.reduce((sum, c) => sum + c._count.members, 0);

  const totalRecaudado = MOCK_SUSCRIPCIONES.flatMap(s => s.pagos).filter(p => p.estado === 'PAID').reduce((a, p) => a + p.monto, 0);
  const totalPlan = MOCK_SUSCRIPCIONES.reduce((a, s) => a + s.plan, 0);
  const pctRecaudado = Math.round(totalRecaudado / totalPlan * 100);

  const stats = [
    { label: 'Total Clubs',     value: total,         color: '#7C3AED' },
    { label: 'Clubs Activos',   value: activos,       color: '#06D6A0' },
    { label: 'Clubs Inactivos', value: inactivos,     color: '#EF476F' },
    { label: 'Total Miembros',  value: totalMiembros, color: '#FFB703' },
  ];

  if (loading) {
    return (
      <div style={{ background: '#F7F7FB', minHeight: '100%' }}>
        <SAHeader title="Dashboard" />
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#7C3AED', borderTopColor: 'transparent' }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#F7F7FB', minHeight: '100%' }}>
      <SAHeader title="Dashboard" />

      <div style={{ padding: '12px 16px 80px' }}>

        {/* Hero */}
        <div
          className="rounded-2xl p-4 mb-3.5 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg,#7C3AED,#A855F7)' }}
        >
          <div className="absolute rounded-full" style={{ right: -20, top: -20, width: 80, height: 80, background: 'rgba(255,255,255,0.07)' }} />
          <p className="text-[11px] mb-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>SUPER ADMIN</p>
          <p className="text-[16px] font-extrabold m-0" style={{ color: '#fff', fontFamily: 'Space Grotesk, sans-serif' }}>
            Panel de Control
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>
            Sistema VeloClub · {activos} club{activos !== 1 ? 's' : ''} activo{activos !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Stats 2x2 */}
        <div className="grid grid-cols-2 gap-2 mb-3.5">
          {stats.map(s => (
            <div
              key={s.label}
              className="rounded-2xl"
              style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', padding: '12px 14px' }}
            >
              <p className="text-[10px] font-semibold mb-1" style={{ color: '#8E87A8' }}>{s.label}</p>
              <p
                className="text-[26px] font-extrabold m-0 leading-none"
                style={{ color: s.color, fontFamily: 'Space Grotesk, sans-serif' }}
              >
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* Resumen finanzas */}
        <p className="text-[11px] font-semibold uppercase mb-2" style={{ color: '#8E87A8', letterSpacing: '0.8px' }}>
          Resumen de finanzas
        </p>
        <div
          className="rounded-2xl mb-3"
          style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', padding: 14 }}
        >
          <div className="flex justify-between mb-2.5">
            <div>
              <p className="text-[10px] font-semibold m-0" style={{ color: '#8E87A8' }}>RECAUDADO</p>
              <p className="text-[20px] font-extrabold m-0" style={{ color: '#06D6A0', fontFamily: 'Space Grotesk, sans-serif' }}>
                {fmt.format(totalRecaudado)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold m-0" style={{ color: '#8E87A8' }}>PENDIENTE</p>
              <p className="text-[20px] font-extrabold m-0" style={{ color: '#EF476F', fontFamily: 'Space Grotesk, sans-serif' }}>
                {fmt.format(totalPlan - totalRecaudado)}
              </p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-[7px] rounded-full overflow-hidden mb-1.5" style={{ background: 'rgba(120,80,200,0.10)' }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${pctRecaudado}%`, background: 'linear-gradient(90deg,#06D6A0,#7C3AED)' }}
            />
          </div>
          <div className="flex justify-between mb-3">
            <span className="text-[10px] font-semibold" style={{ color: '#06D6A0' }}>{pctRecaudado}% cobrado</span>
            <span className="text-[10px]" style={{ color: '#8E87A8' }}>Meta: {fmt.format(totalPlan)}</span>
          </div>
          {/* Mini bar chart */}
          <div className="flex gap-2 items-end" style={{ height: 56 }}>
            {MOCK_SUSCRIPCIONES.map(s => {
              const rec = s.pagos.filter(p => p.estado === 'PAID').reduce((a, p) => a + p.monto, 0);
              const pct = rec / s.plan;
              return (
                <div key={s.clubId} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-[4px]"
                    style={{
                      height: `${Math.max(pct * 40, 4)}px`,
                      background: 'linear-gradient(180deg,#7C3AED,#A855F7)',
                      opacity: pct > 0 ? 1 : 0.2,
                    }}
                  />
                  <p className="text-[9px] text-center leading-tight m-0 truncate w-full" style={{ color: '#8E87A8' }}>
                    {s.club.split(' ')[0]}
                  </p>
                </div>
              );
            })}
          </div>
          <Link
            href="/superadmin/finanzas"
            className="flex items-center justify-center w-full mt-2.5 text-[11px] font-bold"
            style={{ padding: 7, borderRadius: 8, border: '1px solid rgba(124,58,237,0.25)', background: 'rgba(124,58,237,0.07)', color: '#7C3AED' }}
          >
            Ver detalle completo →
          </Link>
        </div>

        {/* Clubs registrados */}
        <p className="text-[11px] font-semibold uppercase mb-2" style={{ color: '#8E87A8', letterSpacing: '0.8px' }}>
          Clubs registrados
        </p>
        {clubs.length === 0 && (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', color: '#8E87A8', fontSize: 13 }}
          >
            No hay clubs registrados aún.
          </div>
        )}
        {clubs.map(club => (
          <div
            key={club.id}
            className="rounded-xl flex items-center gap-2.5 mb-2"
            style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', padding: '10px 12px' }}
          >
            <div
              className="w-9 h-9 rounded-[9px] flex items-center justify-center shrink-0"
              style={{ background: 'rgba(124,58,237,0.10)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-[13px] font-bold m-0 truncate" style={{ color: '#1A1028' }}>{club.name}</p>
                <span
                  className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                  style={{
                    background: club.active ? 'rgba(6,214,160,0.12)' : 'rgba(239,71,111,0.12)',
                    color: club.active ? '#06D6A0' : '#EF476F',
                  }}
                >
                  {club.active ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <p className="text-[11px] m-0 mt-0.5" style={{ color: '#8E87A8' }}>{club._count.members} miembros</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
