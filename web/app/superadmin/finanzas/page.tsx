'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { Pencil, Trash2, X, Check } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

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
const ESTADO_BG: Record<string, string> = {
  PAID:    'rgba(6,214,160,0.08)',
  PENDING: 'rgba(255,183,3,0.08)',
  OVERDUE: 'rgba(239,71,111,0.08)',
};
const ESTADO_LABEL: Record<string, string> = {
  PAID:    'Pagado',
  PENDING: 'Pendiente',
  OVERDUE: 'Vencido',
};

const inputStyle = {
  width: '100%', padding: '7px 10px', borderRadius: 8,
  border: '1px solid rgba(120,80,200,0.15)',
  background: '#F7F7FB', color: '#1A1028', fontSize: 14, outline: 'none',
  boxSizing: 'border-box' as const, fontFamily: 'Plus Jakarta Sans, sans-serif',
};

export default function FinanzasPage() {
  const { getToken } = useAuth();
  const [clubs, setClubs] = useState<ClubConSuscripcion[]>([]);
  const [loading, setLoading] = useState(true);

  // Nuevo abono
  const [abonoOpen, setAbonoOpen] = useState<string | null>(null);
  const [abonoForm, setAbonoForm] = useState({ concepto: '', monto: '', fecha: '', estado: 'PAID' });
  const [saving, setSaving] = useState(false);

  // Editar abono
  const [editPagoId, setEditPagoId] = useState<string | null>(null);
  const [editPagoForm, setEditPagoForm] = useState({ concepto: '', monto: '', fecha: '', estado: 'PAID' });
  const [savingEdit, setSavingEdit] = useState(false);

  // Editar planMonto
  const [editPlanId, setEditPlanId] = useState<string | null>(null);
  const [editPlanMonto, setEditPlanMonto] = useState('');
  const [savingPlan, setSavingPlan] = useState(false);

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
        method: 'POST', token,
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
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  function startEditPago(p: Pago) {
    setEditPagoId(p.id);
    setEditPagoForm({
      concepto: p.concepto,
      monto: String(p.monto),
      fecha: p.fecha ? p.fecha.slice(0, 10) : '',
      estado: p.estado,
    });
  }

  async function saveEditPago() {
    if (!editPagoId) return;
    setSavingEdit(true);
    try {
      const token = await getToken();
      await apiFetch(`/superadmin/suscripciones/pagos/${editPagoId}`, {
        method: 'PATCH', token,
        body: JSON.stringify({
          concepto: editPagoForm.concepto,
          monto: parseFloat(editPagoForm.monto),
          fecha: editPagoForm.fecha || undefined,
          estado: editPagoForm.estado,
        }),
      });
      setEditPagoId(null);
      await load();
    } catch (e) { console.error(e); }
    finally { setSavingEdit(false); }
  }

  async function deletePago(pagoId: string) {
    if (!confirm('¿Eliminar este abono?')) return;
    const token = await getToken();
    await apiFetch(`/superadmin/suscripciones/pagos/${pagoId}`, { method: 'DELETE', token });
    await load();
  }

  async function savePlanMonto(clubId: string, susId: string | undefined, año: number) {
    if (!editPlanMonto) return;
    setSavingPlan(true);
    try {
      const token = await getToken();
      await apiFetch(`/superadmin/suscripciones/${clubId}`, {
        method: 'POST', token,
        body: JSON.stringify({ planMonto: parseFloat(editPlanMonto), año }),
      });
      setEditPlanId(null);
      await load();
    } catch (e) { console.error(e); }
    finally { setSavingPlan(false); }
  }

  // Totales globales
  const allPagos = clubs.flatMap(c => c.suscripcion?.pagos ?? []);
  const totalPlan = clubs.reduce((a, c) => a + (c.suscripcion?.planMonto ?? 0), 0);
  const totalRecaudado = allPagos.filter(p => p.estado === 'PAID').reduce((a, p) => a + p.monto, 0);
  const totalPendiente = allPagos.filter(p => p.estado !== 'PAID').reduce((a, p) => a + p.monto, 0);
  const pctGlobal = totalPlan > 0 ? Math.round(totalRecaudado / totalPlan * 100) : 0;

  // Gráfica: ingresos mensuales de pagos PAID con fecha
  const monthlyData = MONTH_NAMES.map((name, i) => {
    const total = allPagos
      .filter(p => p.estado === 'PAID' && p.fecha)
      .filter(p => new Date(p.fecha!).getMonth() === i)
      .reduce((a, p) => a + p.monto, 0);
    return { name, total };
  });
  const maxMonthly = Math.max(...monthlyData.map(d => d.total), 1);
  const hasMonthlyData = monthlyData.some(d => d.total > 0);

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
            <div className="flex justify-between">
              <span className="text-[10px] font-semibold" style={{ color: '#06D6A0' }}>{pctGlobal}% cobrado</span>
              <span className="text-[10px]" style={{ color: '#8E87A8' }}>Meta: {fmt.format(totalPlan)}</span>
            </div>
          </div>
        )}

        {/* Gráfica ingresos mensuales */}
        <div className="rounded-2xl mb-3" style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', padding: 14 }}>
          <p className="text-[11px] font-semibold uppercase mb-3 m-0" style={{ color: '#8E87A8', letterSpacing: '0.8px' }}>
            Ingresos mensuales
          </p>
          {!hasMonthlyData ? (
            <div className="flex flex-col items-center py-4 gap-1">
              <p className="text-[12px] m-0" style={{ color: '#8E87A8' }}>Sin ingresos registrados aún</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={monthlyData} barCategoryGap="20%" margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#8E87A8', fontWeight: 600 }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 9, fill: '#C4C2CF' }}
                  axisLine={false} tickLine={false}
                  tickFormatter={v => v > 0 ? `${(v/1000).toFixed(0)}k` : '0'}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(124,58,237,0.06)' }}
                  contentStyle={{ borderRadius: 10, border: '1px solid #E8E6F0', fontSize: 12, padding: '4px 10px' }}
                  formatter={(v) => [fmt.format(Number(v ?? 0)), 'Recaudado']}
                />
                <Bar dataKey="total" radius={[5, 5, 0, 0]}>
                  {monthlyData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.total === maxMonthly && entry.total > 0 ? '#7C3AED' : '#C4C2CF'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {clubs.length === 0 && (
          <div className="rounded-2xl p-8 text-center" style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', color: '#8E87A8', fontSize: 13 }}>
            No hay clubs registrados.
          </div>
        )}

        <p className="text-[11px] font-semibold uppercase mb-2 m-0" style={{ color: '#8E87A8', letterSpacing: '0.8px' }}>
          Detalle por club
        </p>

        {clubs.map(c => {
          const sus = c.suscripcion;
          const pagos = sus?.pagos ?? [];
          const rec = pagos.filter(p => p.estado === 'PAID').reduce((a, p) => a + p.monto, 0);
          const plan = sus?.planMonto ?? 0;
          const pctClub = plan > 0 ? Math.round(rec / plan * 100) : 0;
          const colorPct = pctClub >= 100 ? '#06D6A0' : pctClub > 50 ? '#FFB703' : '#EF476F';

          return (
            <div key={c.id} className="rounded-2xl mb-2.5" style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', padding: 14 }}>

              {/* Cabecera club */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold m-0 truncate" style={{ color: '#1A1028' }}>{c.name}</p>
                  {/* Plan editable */}
                  {editPlanId === c.id ? (
                    <div className="flex items-center gap-1.5 mt-1">
                      <input
                        type="number"
                        value={editPlanMonto}
                        onChange={e => setEditPlanMonto(e.target.value)}
                        style={{ ...inputStyle, width: 130, fontSize: 12, padding: '5px 8px' }}
                        autoFocus
                      />
                      <button onClick={() => savePlanMonto(c.id, sus?.id, sus?.año ?? new Date().getFullYear())} disabled={savingPlan}
                        className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(6,214,160,0.12)', color: '#06D6A0', border: 'none', cursor: 'pointer' }}>
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setEditPlanId(null)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(239,71,111,0.08)', color: '#EF476F', border: 'none', cursor: 'pointer' }}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditPlanId(c.id); setEditPlanMonto(String(plan || '')); }}
                      className="flex items-center gap-1 mt-0.5"
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                    >
                      <p className="text-[11px] m-0" style={{ color: '#8E87A8' }}>
                        {sus ? `Plan anual · ${fmt.format(plan)}` : 'Sin plan configurado'}
                      </p>
                      <Pencil className="w-2.5 h-2.5" style={{ color: '#8E87A8' }} />
                    </button>
                  )}
                </div>
                {sus && (
                  <div className="text-right shrink-0 ml-3">
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
                    <div className="flex flex-col gap-1.5 mb-2">
                      {pagos.map(p => (
                        <div key={p.id}>
                          {editPagoId === p.id ? (
                            /* Formulario edición inline */
                            <div className="rounded-xl p-2.5" style={{ background: '#F0EEF8', border: '1px solid rgba(124,58,237,0.15)' }}>
                              <p className="text-[10px] font-bold m-0 mb-2" style={{ color: '#7C3AED' }}>Editar abono</p>
                              <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                                <div>
                                  <p className="text-[9px] font-semibold m-0 mb-0.5" style={{ color: '#8E87A8' }}>Concepto</p>
                                  <input type="text" value={editPagoForm.concepto}
                                    onChange={e => setEditPagoForm(f => ({ ...f, concepto: e.target.value }))} style={{ ...inputStyle, fontSize: 12 }} />
                                </div>
                                <div>
                                  <p className="text-[9px] font-semibold m-0 mb-0.5" style={{ color: '#8E87A8' }}>Monto</p>
                                  <input type="number" value={editPagoForm.monto}
                                    onChange={e => setEditPagoForm(f => ({ ...f, monto: e.target.value }))} style={{ ...inputStyle, fontSize: 12 }} />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-1.5 mb-2">
                                <div>
                                  <p className="text-[9px] font-semibold m-0 mb-0.5" style={{ color: '#8E87A8' }}>Fecha</p>
                                  <input type="date" value={editPagoForm.fecha}
                                    onChange={e => setEditPagoForm(f => ({ ...f, fecha: e.target.value }))} style={{ ...inputStyle, fontSize: 12 }} />
                                </div>
                                <div>
                                  <p className="text-[9px] font-semibold m-0 mb-0.5" style={{ color: '#8E87A8' }}>Estado</p>
                                  <select value={editPagoForm.estado}
                                    onChange={e => setEditPagoForm(f => ({ ...f, estado: e.target.value }))} style={{ ...inputStyle, fontSize: 12 }}>
                                    <option value="PAID">Pagado</option>
                                    <option value="PENDING">Pendiente</option>
                                    <option value="OVERDUE">Vencido</option>
                                  </select>
                                </div>
                              </div>
                              <div className="flex gap-1.5">
                                <button onClick={() => setEditPagoId(null)}
                                  className="flex-1 text-[11px] font-semibold py-1.5 rounded-xl"
                                  style={{ border: '1px solid rgba(120,80,200,0.10)', background: 'transparent', color: '#8E87A8', cursor: 'pointer' }}>
                                  Cancelar
                                </button>
                                <button onClick={saveEditPago} disabled={savingEdit}
                                  className="flex-[2] text-[11px] font-bold py-1.5 rounded-xl text-white"
                                  style={{ background: savingEdit ? '#A855F7' : '#7C3AED', border: 'none', cursor: 'pointer' }}>
                                  {savingEdit ? 'Guardando...' : 'Guardar cambios'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* Fila normal del pago */
                            <div
                              className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                              style={{ background: ESTADO_BG[p.estado], border: `1px solid ${ESTADO_COLOR[p.estado]}30` }}
                            >
                              {/* Indicador color */}
                              <div className="w-1 self-stretch rounded-full shrink-0" style={{ background: ESTADO_COLOR[p.estado] }} />

                              {/* Info izquierda */}
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-bold m-0 truncate" style={{ color: '#1A1028' }}>{p.concepto}</p>
                                <p className="text-[10px] m-0 mt-0.5" style={{ color: '#8E87A8' }}>
                                  {p.fecha ? new Date(p.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Sin fecha'}
                                </p>
                              </div>

                              {/* Monto + badge */}
                              <div className="flex flex-col items-end gap-0.5 shrink-0">
                                <p className="text-[14px] font-extrabold m-0 leading-none" style={{ color: ESTADO_COLOR[p.estado], fontFamily: 'Space Grotesk, sans-serif' }}>
                                  {fmt.format(p.monto)}
                                </p>
                                <span
                                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none"
                                  style={{ background: `${ESTADO_COLOR[p.estado]}20`, color: ESTADO_COLOR[p.estado] }}
                                >
                                  {ESTADO_LABEL[p.estado]}
                                </span>
                              </div>

                              {/* Acciones */}
                              <div className="flex gap-1 shrink-0">
                                <button onClick={() => startEditPago(p)}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                                  style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)', color: '#7C3AED', cursor: 'pointer' }}>
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button onClick={() => deletePago(p.id)}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                                  style={{ background: 'rgba(239,71,111,0.08)', border: '1px solid rgba(239,71,111,0.20)', color: '#EF476F', cursor: 'pointer' }}>
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
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
