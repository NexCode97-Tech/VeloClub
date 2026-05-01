'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import Link from 'next/link';

const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

interface Pago { id: string; estado: string; monto: number; }
interface Suscripcion { planMonto: number; pagos: Pago[]; }
interface Club {
  id: string; name: string; active: boolean;
  createdAt: string; _count: { members: number };
  suscripcion?: Suscripcion | null;
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
        // Traemos clubs con suscripciones en una sola llamada
        const res = await apiFetch<{ clubs: Club[] }>('/superadmin/suscripciones', { token });
        setClubs(res.clubs);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [isLoaded, isSignedIn]);

  const total        = clubs.length;
  const activos      = clubs.filter(c => c.active).length;
  const inactivos    = clubs.filter(c => !c.active).length;
  const totalMiembros = clubs.reduce((sum, c) => sum + (c._count?.members ?? 0), 0);

  // Finanzas reales
  const clubsConPlan    = clubs.filter(c => c.suscripcion);
  const totalPlan       = clubsConPlan.reduce((a, c) => a + (c.suscripcion?.planMonto ?? 0), 0);
  const allPagos        = clubsConPlan.flatMap(c => c.suscripcion?.pagos ?? []);
  const totalRecaudado  = allPagos.filter(p => p.estado === 'PAID').reduce((a, p) => a + p.monto, 0);
  const pctRecaudado    = totalPlan > 0 ? Math.round(totalRecaudado / totalPlan * 100) : 0;

  const stats = [
    { label: 'Total Clubs',     value: total,         color: '#7C3AED' },
    { label: 'Clubs Activos',   value: activos,       color: '#06D6A0' },
    { label: 'Clubs Inactivos', value: inactivos,     color: '#EF476F' },
    { label: 'Total Miembros',  value: totalMiembros, color: '#FFB703' },
  ];

  if (loading) return (
    <div style={{ background: '#F7F7FB', minHeight: '100%' }} className="flex items-center justify-center h-40">
      <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#7C3AED', borderTopColor: 'transparent' }} />
    </div>
  );

  return (
    <div style={{ background: '#F7F7FB', minHeight: '100%' }}>
      <div style={{ padding: '12px 16px 80px' }}>

        {/* Hero */}
        <div className="rounded-2xl p-4 mb-3.5 relative overflow-hidden" style={{ background: 'linear-gradient(135deg,#7C3AED,#A855F7)' }}>
          <div className="absolute rounded-full" style={{ right: -20, top: -20, width: 80, height: 80, background: 'rgba(255,255,255,0.07)' }} />
          <p className="text-[11px] mb-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>SUPER ADMIN</p>
          <p className="text-[16px] font-extrabold m-0" style={{ color: '#fff', fontFamily: 'Space Grotesk, sans-serif' }}>Panel de Control</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>
            Sistema VeloClub · {activos} club{activos !== 1 ? 's' : ''} activo{activos !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Stats 2x2 */}
        <div className="grid grid-cols-2 gap-2 mb-3.5">
          {stats.map(s => (
            <div key={s.label} className="rounded-2xl" style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', padding: '12px 14px' }}>
              <p className="text-[10px] font-semibold mb-1" style={{ color: '#8E87A8' }}>{s.label}</p>
              <p className="text-[26px] font-extrabold m-0 leading-none" style={{ color: s.color, fontFamily: 'Space Grotesk, sans-serif' }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Resumen finanzas — solo si hay datos reales */}
        {totalPlan > 0 && (
          <>
            <p className="text-[11px] font-semibold uppercase mb-2" style={{ color: '#8E87A8', letterSpacing: '0.8px' }}>Resumen de finanzas</p>
            <div className="rounded-2xl mb-3" style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', padding: 14 }}>
              <div className="flex justify-between mb-2.5">
                <div>
                  <p className="text-[10px] font-semibold m-0" style={{ color: '#8E87A8' }}>RECAUDADO</p>
                  <p className="text-[20px] font-extrabold m-0" style={{ color: '#06D6A0', fontFamily: 'Space Grotesk, sans-serif' }}>{fmt.format(totalRecaudado)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-semibold m-0" style={{ color: '#8E87A8' }}>PENDIENTE</p>
                  <p className="text-[20px] font-extrabold m-0" style={{ color: '#EF476F', fontFamily: 'Space Grotesk, sans-serif' }}>{fmt.format(totalPlan - totalRecaudado)}</p>
                </div>
              </div>
              <div className="h-[7px] rounded-full overflow-hidden mb-1.5" style={{ background: 'rgba(120,80,200,0.10)' }}>
                <div className="h-full rounded-full" style={{ width: `${pctRecaudado}%`, background: 'linear-gradient(90deg,#06D6A0,#7C3AED)' }} />
              </div>
              <div className="flex justify-between mb-3">
                <span className="text-[10px] font-semibold" style={{ color: '#06D6A0' }}>{pctRecaudado}% cobrado</span>
                <span className="text-[10px]" style={{ color: '#8E87A8' }}>Meta: {fmt.format(totalPlan)}</span>
              </div>
              {/* Bar chart por club */}
              <div className="flex gap-2 items-end" style={{ height: 56 }}>
                {clubsConPlan.map(c => {
                  const rec = (c.suscripcion?.pagos ?? []).filter(p => p.estado === 'PAID').reduce((a, p) => a + p.monto, 0);
                  const p   = rec / (c.suscripcion?.planMonto ?? 1);
                  return (
                    <div key={c.id} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full rounded-t-[4px]" style={{ height: `${Math.max(p * 40, 4)}px`, background: 'linear-gradient(180deg,#7C3AED,#A855F7)', opacity: p > 0 ? 1 : 0.2 }} />
                      <p className="text-[9px] text-center leading-tight m-0 truncate w-full" style={{ color: '#8E87A8' }}>{c.name.split(' ')[0]}</p>
                    </div>
                  );
                })}
              </div>
              <Link href="/superadmin/finanzas" className="flex items-center justify-center w-full mt-2.5 text-[11px] font-bold"
                style={{ padding: 7, borderRadius: 8, border: '1px solid rgba(124,58,237,0.25)', background: 'rgba(124,58,237,0.07)', color: '#7C3AED' }}>
                Ver detalle completo →
              </Link>
            </div>
          </>
        )}

        {/* Clubs registrados */}
        <p className="text-[11px] font-semibold uppercase mb-2" style={{ color: '#8E87A8', letterSpacing: '0.8px' }}>Clubs registrados</p>
        {clubs.length === 0 && (
          <div className="rounded-2xl p-8 text-center" style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', color: '#8E87A8', fontSize: 13 }}>
            No hay clubs registrados aún.
          </div>
        )}
        {clubs.map(club => (
          <div key={club.id} className="rounded-xl flex items-center gap-2.5 mb-2" style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', padding: '10px 12px' }}>
            <div className="w-9 h-9 rounded-[9px] flex items-center justify-center shrink-0" style={{ background: 'rgba(124,58,237,0.10)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-[13px] font-bold m-0 truncate" style={{ color: '#1A1028' }}>{club.name}</p>
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                  style={{ background: club.active ? 'rgba(6,214,160,0.12)' : 'rgba(239,71,111,0.12)', color: club.active ? '#06D6A0' : '#EF476F' }}>
                  {club.active ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <p className="text-[11px] m-0 mt-0.5" style={{ color: '#8E87A8' }}>{club._count?.members ?? 0} miembros</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
