'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import Link from 'next/link';
import { Users, Building2, CircleDollarSign, ChevronRight, CheckCircle2, XCircle } from 'lucide-react';

const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

interface Pago { id: string; estado: string; monto: number; }
interface Suscripcion { planMonto: number; pagos: Pago[]; }
interface Club {
  id: string; name: string; active: boolean;
  createdAt: string; _count: { members: number };
  suscripcion?: Suscripcion | null;
}

function todayLabel() {
  const d = new Date();
  const day = d.toLocaleDateString('es-CO', { weekday: 'long' });
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
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [isLoaded, isSignedIn]);

  const total         = clubs.length;
  const activos       = clubs.filter(c => c.active).length;
  const inactivos     = clubs.filter(c => !c.active).length;
  const totalMiembros = clubs.reduce((sum, c) => sum + (c._count?.members ?? 0), 0);

  const allPagos       = clubs.flatMap(c => c.suscripcion?.pagos ?? []);
  const totalRecaudado = allPagos.filter(p => p.estado === 'PAID').reduce((a, p) => a + p.monto, 0);
  const totalPlan      = clubs.reduce((a, c) => a + (c.suscripcion?.planMonto ?? 0), 0);
  const pctRecaudado   = totalPlan > 0 ? Math.round(totalRecaudado / totalPlan * 100) : 0;

  if (loading) return (
    <div className="flex items-center justify-center h-40 bg-background">
      <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );

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
              Panel de Control
            </h1>
            <p className="text-[14px] font-semibold text-foreground/70 mt-0.5">VeloClub · Sistema</p>
            <span
              className="inline-block mt-2 text-[10px] font-bold px-2.5 py-0.5 rounded-full tracking-wider"
              style={{ background: 'rgba(239,71,111,0.12)', color: '#EF476F' }}
            >
              SUPER ADMIN
            </span>
          </div>
        </div>

        {/* Stats 2x2 */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Total Clubs',     value: total,         color: '#7C3AED', icon: Building2 },
            { label: 'Clubs Activos',   value: activos,       color: '#06D6A0', icon: CheckCircle2 },
            { label: 'Total Miembros',  value: totalMiembros, color: '#FFB703', icon: Users },
            { label: 'Clubs Inactivos', value: inactivos,     color: '#EF476F', icon: XCircle },
          ].map(s => (
            <div key={s.label} className="bg-white border border-border rounded-xl p-4 text-center">
              <div className="flex justify-center mb-2" style={{ color: s.color }}>
                <s.icon className="w-5 h-5" />
              </div>
              <div
                className="text-2xl font-extrabold leading-none mb-1"
                style={{ color: s.color, fontFamily: 'var(--font-space-grotesk)' }}
              >
                {s.value}
              </div>
              <div className="text-[10px] text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 py-4 space-y-5">

        {/* Resumen finanzas */}
        {totalPlan > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Resumen de finanzas</p>
              <Link href="/superadmin/finanzas" className="text-[11px] font-semibold" style={{ color: '#7C3AED' }}>
                Ver detalle
              </Link>
            </div>
            <div className="bg-white border border-border rounded-xl p-4">
              <div className="flex justify-between mb-3">
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">RECAUDADO</p>
                  <p className="text-[18px] font-extrabold" style={{ color: '#06D6A0', fontFamily: 'var(--font-space-grotesk)' }}>
                    {fmt.format(totalRecaudado)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">PENDIENTE</p>
                  <p className="text-[18px] font-extrabold" style={{ color: '#EF476F', fontFamily: 'var(--font-space-grotesk)' }}>
                    {fmt.format(totalPlan - totalRecaudado)}
                  </p>
                </div>
              </div>
              <div className="h-[6px] rounded-full overflow-hidden mb-1.5 bg-border">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pctRecaudado}%`, background: 'linear-gradient(90deg, #06D6A0, #7C3AED)' }}
                />
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] font-semibold" style={{ color: '#06D6A0' }}>{pctRecaudado}% cobrado</span>
                <span className="text-[10px] text-muted-foreground">Meta: {fmt.format(totalPlan)}</span>
              </div>
            </div>
          </section>
        )}

        {/* Clubs registrados */}
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Clubs registrados</p>
            <Link href="/superadmin/clubs" className="text-[11px] font-semibold" style={{ color: '#7C3AED' }}>
              Gestionar
            </Link>
          </div>

          {clubs.length === 0 ? (
            <div className="bg-white border border-border rounded-xl px-4 py-8 text-center">
              <Building2 className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-[12px] text-muted-foreground">No hay clubs registrados aún</p>
            </div>
          ) : (
            <div className="space-y-2">
              {clubs.map(club => {
                const recaudado = (club.suscripcion?.pagos ?? []).filter(p => p.estado === 'PAID').reduce((a, p) => a + p.monto, 0);
                return (
                  <Link
                    key={club.id}
                    href="/superadmin/clubs"
                    className="bg-white border border-border rounded-xl flex items-center gap-3 px-4 py-3 active:scale-[0.99] transition-transform"
                  >
                    {/* Avatar */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-[15px] font-extrabold"
                      style={{ background: 'rgba(124,58,237,0.10)', color: '#7C3AED', fontFamily: 'var(--font-space-grotesk)' }}
                    >
                      {club.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <p className="text-[13px] font-bold text-foreground truncate">{club.name}</p>
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                          style={{
                            background: club.active ? 'rgba(6,214,160,0.12)' : 'rgba(239,71,111,0.12)',
                            color: club.active ? '#06D6A0' : '#EF476F',
                          }}
                        >
                          {club.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {club._count?.members ?? 0} miembros
                        </span>
                        {recaudado > 0 && (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <CircleDollarSign className="w-3 h-3" />
                            {fmt.format(recaudado)}
                          </span>
                        )}
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
