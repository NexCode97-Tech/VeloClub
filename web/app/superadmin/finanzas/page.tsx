'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

interface Pago {
  id: string;
  concepto: string;
  monto: number;
  fecha: string | null;
  estado: 'PAID' | 'PENDING' | 'OVERDUE';
}

interface Suscripcion {
  id: string;
  planMonto: number;
  año: number;
  pagos: Pago[];
}

interface ClubConSuscripcion {
  id: string;
  name: string;
  active: boolean;
  suscripcion: Suscripcion | null;
}

const ESTADO_COLOR: Record<string, string> = {
  PAID:    '#06D6A0',
  PENDING: '#FFB703',
  OVERDUE: '#EF476F',
};
const ESTADO_LABEL: Record<string, string> = {
  PAID:    'Pagado',
  PENDING: 'Pendiente',
  OVERDUE: 'Vencido',
};

export default function FinanzasPage() {
  const { getToken } = useAuth();
  const [clubs, setClubs] = useState<ClubConSuscripcion[]>([]);
  const [loading, setLoading] = useState(true);
  const [abonoOpen, setAbonoOpen] = useState<string | null>(null);
  const [abonoForm, setAbonoForm] = useState({ concepto: '', monto: '', fecha: '', estado: 'PAID' });
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const token = await getToken();
      const res = await apiFetch<{ clubs: ClubConSuscripcion[] }>('/superadmin/suscripciones', { token });
      setClubs(res.clubs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function registrarAbono(clubId: string) {
    if (!abonoForm.concepto || !abonoForm.monto) return;
    setSaving(true);
    try {
      const token = await getToken();
      await apiFetch(`/superadmin/suscripciones/${clubId}/pagos`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          concepto: abonoForm.concepto,
          monto: parseFloat(abonoForm.monto),
          fecha: abonoForm.fecha || undefined,
          estado: abonoForm.estado,
        }),
      });
      setAbonoOpen(null);
      setAbonoForm({ concepto: '', monto: '', fecha: '', estado: 'PAID' });
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function toggleEstado(pagoId: string, estadoActual: string) {
    const siguiente = estadoActual === 'PAID' ? 'PENDING' : 'PAID';
    const token = await getToken();
    await apiFetch(`/superadmin/suscripciones/pagos/${pagoId}`, {
      method: 'PATCH', token, body: JSON.stringify({ estado: siguiente }),
    });
    await load();
  }

  // Totales globales
  const allPagos = clubs.flatMap(c => c.suscripcion?.pagos ?? []);
  const totalPlan = clubs.reduce((a, c) => a + (c.suscripcion?.planMonto ?? 0), 0);
  const totalRecaudado = allPagos.filter(p => p.estado === 'PAID').reduce((a, p) => a + p.monto, 0);
  const totalPendiente = allPagos.filter(p => p.estado !== 'PAID').reduce((a, p) => a + p.monto, 0);
  const pctGlobal = totalPlan > 0 ? Math.round(totalRecaudado / totalPlan * 100) : 0;

  const inputStyle = {
    width: '100%', padding: '7px 10px', borderRadius: 8,
    border: '1px solid rgba(120,80,200,0.10)',
    background: '#F7F7FB', color: '#1A1028', fontSize: 12, outline: 'none',
    boxSizing: 'border-box' as const, fontFamily: 'Plus Jakarta Sans, sans-serif',
  };

  if (loading) {
    return (
      <div style={{ background: '#F7F7FB', minHeight: '100%' }} className="flex items-center justify-center h-40">
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#7C3AED', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div style={{ background: '#F7F7FB', minHeight: '100%' }}>
      <div style={{ padding: '12px 16px 80px' }}>

        {/* Resumen global */}
        {totalPlan > 0 && (
          <div className="rounded-2xl mb-3" style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', padding: 14 }}>
            <p className="text-[11px] font-semibold uppercase mb-2.5 m-0" style={{ color: '#8E87A8', letterSpacing: '0.8px' }}>
              Resumen de suscripciones
            </p>
            <div className="flex justify-between mb-3">
              <div>
                <p className="text-[10px] font-semibold m-0" style={{ color: '#8E87A8' }}>RECAUDADO</p>
                <p className="text-[22px] font-extrabold m-0" style={{ color: '#06D6A0', fontFamily: 'Space Grotesk, sans-serif' }}>
                  {fmt.format(totalRecaudado)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold m-0" style={{ color: '#8E87A8' }}>PENDIENTE</p>
                <p className="text-[22px] font-extrabold m-0" style={{ color: '#EF476F', fontFamily: 'Space Grotesk, sans-serif' }}>
                  {fmt.format(totalPendiente)}
                </p>
              </div>
            </div>
            <div className="h-2 rounded-full overflow-hidden mb-1.5" style={{ background: 'rgba(120,80,200,0.10)' }}>
              <div className="h-full rounded-full" style={{ width: `${pctGlobal}%`, background: 'linear-gradient(90deg,#06D6A0,#7C3AED)' }} />
            </div>
            <div className="flex justify-between mb-3.5">
              <span className="text-[10px] font-semibold" style={{ color: '#06D6A0' }}>{pctGlobal}% cobrado</span>
              <span className="text-[10px]" style={{ color: '#8E87A8' }}>Meta: {fmt.format(totalPlan)}</span>
            </div>
            {/* Bar chart por club */}
            <div className="flex gap-2 items-end" style={{ height: 60 }}>
              {clubs.filter(c => c.suscripcion).map(c => {
                const rec = (c.suscripcion?.pagos ?? []).filter(p => p.estado === 'PAID').reduce((a, p) => a + p.monto, 0);
                const plan = c.suscripcion?.planMonto ?? 1;
                const p = rec / plan;
                return (
                  <div key={c.id} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t-[4px]"
                      style={{ height: `${Math.max(p * 44, 4)}px`, background: 'linear-gradient(180deg,#7C3AED,#A855F7)', opacity: p > 0 ? 1 : 0.2 }}
                    />
                    <p className="text-[9px] text-center m-0 truncate w-full" style={{ color: '#8E87A8' }}>
                      {c.name.split(' ')[0]}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Sin datos aún */}
        {clubs.length === 0 && (
          <div className="rounded-2xl p-8 text-center" style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', color: '#8E87A8', fontSize: 13 }}>
            No hay clubs registrados.
          </div>
        )}

        <p className="text-[11px] font-semibold uppercase mb-2 m-0" style={{ color: '#8E87A8', letterSpacing: '0.8px' }}>
          Detalle por club
        </p>

        {/* Tarjeta por club */}
        {clubs.map(c => {
          const sus = c.suscripcion;
          const pagos = sus?.pagos ?? [];
          const rec = pagos.filter(p => p.estado === 'PAID').reduce((a, p) => a + p.monto, 0);
          const plan = sus?.planMonto ?? 0;
          const pctClub = plan > 0 ? Math.round(rec / plan * 100) : 0;
          const colorPct = pctClub >= 100 ? '#06D6A0' : pctClub > 50 ? '#FFB703' : '#EF476F';

          return (
            <div key={c.id} className="rounded-2xl mb-2.5" style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', padding: 14 }}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-[14px] font-bold m-0" style={{ color: '#1A1028' }}>{c.name}</p>
                  <p className="text-[11px] m-0 mt-0.5" style={{ color: '#8E87A8' }}>
                    {sus ? `Plan anual · ${fmt.format(plan)}` : 'Sin plan configurado'}
                  </p>
                </div>
                {sus && (
                  <div className="text-right">
                    <p className="text-[16px] font-extrabold m-0" style={{ color: colorPct, fontFamily: 'Space Grotesk, sans-serif' }}>
                      {pctClub}%
                    </p>
                    <p className="text-[10px] m-0" style={{ color: '#8E87A8' }}>{fmt.format(rec)}</p>
                  </div>
                )}
              </div>

              {sus && (
                <>
                  <div className="h-[5px] rounded-full overflow-hidden mb-2" style={{ background: 'rgba(120,80,200,0.10)' }}>
                    <div className="h-full rounded-full" style={{ width: `${pctClub}%`, background: 'linear-gradient(90deg,#06D6A0,#7C3AED)' }} />
                  </div>

                  {/* Pagos registrados */}
                  {pagos.length > 0 && (
                    <div className="flex flex-col gap-1 mb-2">
                      {pagos.map(p => (
                        <button
                          key={p.id}
                          onClick={() => toggleEstado(p.id, p.estado)}
                          className="flex items-center justify-between rounded-xl px-3 py-2 text-left w-full"
                          style={{ background: `${ESTADO_COLOR[p.estado]}10`, border: `1px solid ${ESTADO_COLOR[p.estado]}30` }}
                        >
                          <div>
                            <p className="text-[12px] font-semibold m-0" style={{ color: '#1A1028' }}>{p.concepto}</p>
                            <p className="text-[10px] m-0" style={{ color: '#8E87A8' }}>
                              {p.fecha ? new Date(p.fecha).toLocaleDateString('es-CO') : 'Sin fecha'}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[13px] font-bold m-0" style={{ color: ESTADO_COLOR[p.estado], fontFamily: 'Space Grotesk, sans-serif' }}>
                              {fmt.format(p.monto)}
                            </p>
                            <span className="text-[9px] font-semibold" style={{ color: ESTADO_COLOR[p.estado] }}>
                              {ESTADO_LABEL[p.estado]}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Formulario de abono */}
              {abonoOpen === c.id ? (
                <div className="rounded-xl p-2.5" style={{ background: '#F0EEF8' }}>
                  <p className="text-[11px] font-bold mb-2 m-0" style={{ color: '#1A1028' }}>Registrar abono</p>
                  <div className="mb-1.5">
                    <p className="text-[10px] font-semibold m-0 mb-0.5" style={{ color: '#8E87A8' }}>Concepto</p>
                    <input type="text" placeholder="Ej: Cuota Marzo" value={abonoForm.concepto}
                      onChange={e => setAbonoForm(f => ({ ...f, concepto: e.target.value }))} style={inputStyle} />
                  </div>
                  <div className="mb-1.5">
                    <p className="text-[10px] font-semibold m-0 mb-0.5" style={{ color: '#8E87A8' }}>Monto</p>
                    <input type="number" placeholder="112500" value={abonoForm.monto}
                      onChange={e => setAbonoForm(f => ({ ...f, monto: e.target.value }))} style={inputStyle} />
                  </div>
                  <div className="mb-1.5">
                    <p className="text-[10px] font-semibold m-0 mb-0.5" style={{ color: '#8E87A8' }}>Fecha</p>
                    <input type="date" value={abonoForm.fecha}
                      onChange={e => setAbonoForm(f => ({ ...f, fecha: e.target.value }))} style={inputStyle} />
                  </div>
                  <div className="mb-2">
                    <p className="text-[10px] font-semibold m-0 mb-0.5" style={{ color: '#8E87A8' }}>Estado</p>
                    <select value={abonoForm.estado} onChange={e => setAbonoForm(f => ({ ...f, estado: e.target.value }))} style={inputStyle}>
                      <option value="PAID">Pagado</option>
                      <option value="PENDING">Pendiente</option>
                      <option value="OVERDUE">Vencido</option>
                    </select>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => { setAbonoOpen(null); setAbonoForm({ concepto: '', monto: '', fecha: '', estado: 'PAID' }); }}
                      className="flex-1 text-[11px] font-semibold py-1.5 rounded-xl"
                      style={{ border: '1px solid rgba(120,80,200,0.10)', background: 'transparent', color: '#8E87A8', cursor: 'pointer' }}>
                      Cancelar
                    </button>
                    <button onClick={() => registrarAbono(c.id)} disabled={saving}
                      className="flex-[2] text-[11px] font-bold py-1.5 rounded-xl text-white"
                      style={{ background: saving ? '#A855F7' : '#7C3AED', border: 'none', cursor: 'pointer' }}>
                      {saving ? 'Guardando...' : 'Registrar'}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAbonoOpen(c.id)}
                  className="w-full text-[11px] font-bold py-1.5 rounded-xl"
                  style={{ border: '1px solid rgba(124,58,237,0.30)', background: 'rgba(124,58,237,0.08)', color: '#7C3AED', cursor: 'pointer' }}>
                  + Registrar abono
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
