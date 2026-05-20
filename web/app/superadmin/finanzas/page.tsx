'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { Pencil, Trash2, X, Check } from 'lucide-react';

const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

// ─── Formato automático de cifras (puntos de miles colombiano) ────────────────
function formatMiles(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
function parseMiles(formatted: string): number {
  return parseFloat(formatted.replace(/\./g, '')) || 0;
}

// ─── Input numérico con auto-formato ─────────────────────────────────────────
function MoneyInput({
  value, onChange, placeholder, style,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '');
    onChange(formatMiles(digits));
  }
  return (
    <input
      type="text"
      inputMode="numeric"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      style={style}
    />
  );
}

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Pago {
  id: string;
  concepto: string;
  monto: number;
  fecha: string | null;
  estado: 'PAID' | 'PENDING' | 'OVERDUE';
}

type TipoPlan = 'MENSUAL' | 'TRIMESTRAL' | 'ANUAL';

interface Suscripcion {
  id: string;
  planMonto: number;
  tipoPlan: TipoPlan;
  año: number;
  pagos: Pago[];
}

interface ClubConSuscripcion {
  id: string;
  name: string;
  active: boolean;
  suscripcion: Suscripcion | null;
}

// ─── Constantes de plan ───────────────────────────────────────────────────────
const PLAN_OPTIONS: { value: TipoPlan; label: string; hint: string; multiplier: number }[] = [
  { value: 'MENSUAL',    label: 'Mensual',    hint: 'Meta anual = monto × 12',  multiplier: 12 },
  { value: 'TRIMESTRAL', label: 'Trimestral', hint: 'Meta anual = monto × 4',   multiplier: 4  },
  { value: 'ANUAL',      label: 'Anual',      hint: 'Pago único — meta = monto', multiplier: 1  },
];
function planMeta(monto: number, tipo: TipoPlan) {
  const opt = PLAN_OPTIONS.find(p => p.value === tipo)!;
  return monto * opt.multiplier;
}
function planLabel(monto: number, tipo: TipoPlan) {
  const opt = PLAN_OPTIONS.find(p => p.value === tipo)!;
  const suffix = tipo === 'MENSUAL' ? '/mes' : tipo === 'TRIMESTRAL' ? '/trimestre' : '/año';
  return `${opt.label} · ${fmt.format(monto)}${suffix}`;
}

// ─── Colores de estado ────────────────────────────────────────────────────────
const ESTADO_COLOR: Record<string, string> = { PAID: '#06D6A0', PENDING: '#FFB703', OVERDUE: '#EF476F' };
const ESTADO_BG:    Record<string, string> = { PAID: 'rgba(6,214,160,0.07)', PENDING: 'rgba(255,183,3,0.07)', OVERDUE: 'rgba(239,71,111,0.07)' };
const ESTADO_LABEL: Record<string, string> = { PAID: 'Pagado', PENDING: 'Pendiente', OVERDUE: 'Vencido' };

// ─── Estilos de input ─────────────────────────────────────────────────────────
const inputBase: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 10,
  border: '1.5px solid rgba(120,80,200,0.18)',
  background: '#fff', color: '#1A1028', fontSize: 14, outline: 'none',
  boxSizing: 'border-box', fontFamily: 'Plus Jakarta Sans, sans-serif',
  transition: 'border-color 0.15s',
};
const selectBase: React.CSSProperties = { ...inputBase, cursor: 'pointer' };

// ─── Componente principal ─────────────────────────────────────────────────────
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

  // Editar plan
  const [editPlanId, setEditPlanId] = useState<string | null>(null);
  const [editPlanMonto, setEditPlanMonto] = useState('');
  const [editTipoPlan, setEditTipoPlan] = useState<TipoPlan>('MENSUAL');
  const [savingPlan, setSavingPlan] = useState(false);

  async function load() {
    try {
      const token = await getToken();
      const res = await apiFetch<{ clubs: ClubConSuscripcion[] }>('/superadmin/suscripciones', { token });
      setClubs(res.clubs);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
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
          monto: parseMiles(abonoForm.monto),
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
      monto: formatMiles(String(Math.round(p.monto))),
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
          monto: parseMiles(editPagoForm.monto),
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

  async function savePlanMonto(clubId: string, año: number) {
    if (!editPlanMonto) return;
    setSavingPlan(true);
    try {
      const token = await getToken();
      await apiFetch(`/superadmin/suscripciones/${clubId}`, {
        method: 'POST', token,
        body: JSON.stringify({ planMonto: parseMiles(editPlanMonto), tipoPlan: editTipoPlan, año }),
      });
      setEditPlanId(null);
      await load();
    } catch (e) { console.error(e); }
    finally { setSavingPlan(false); }
  }

  // ─── Totales globales ───────────────────────────────────────────────────────
  const allPagos      = clubs.flatMap(c => c.suscripcion?.pagos ?? []);
  const totalMeta     = clubs.reduce((a, c) => a + (c.suscripcion ? planMeta(c.suscripcion.planMonto, c.suscripcion.tipoPlan) : 0), 0);
  const totalRecaudado = allPagos.filter(p => p.estado === 'PAID').reduce((a, p) => a + p.monto, 0);
  const totalPendiente = allPagos.filter(p => p.estado !== 'PAID').reduce((a, p) => a + p.monto, 0);
  const pctGlobal     = totalMeta > 0 ? Math.min(100, Math.round(totalRecaudado / totalMeta * 100)) : 0;

  if (loading) return (
    <div style={{ background: '#F7F7FB', minHeight: '100%' }} className="flex items-center justify-center h-40">
      <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#7C3AED', borderTopColor: 'transparent' }} />
    </div>
  );

  return (
    <div style={{ background: '#F7F7FB', minHeight: '100%' }}>
      <div style={{ padding: '12px 16px 100px' }}>

        {/* ── Resumen global ────────────────────────────────────────────── */}
        {totalMeta > 0 && (
          <div className="rounded-2xl mb-4" style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', padding: '16px' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-3 m-0" style={{ color: '#8E87A8' }}>
              Resumen de suscripciones
            </p>
            <div className="flex justify-between mb-3">
              <div>
                <p className="text-[10px] font-semibold m-0 mb-0.5" style={{ color: '#8E87A8' }}>RECAUDADO</p>
                <p className="text-[24px] font-extrabold m-0 leading-none" style={{ color: '#06D6A0', fontFamily: 'Space Grotesk, sans-serif' }}>
                  {fmt.format(totalRecaudado)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold m-0 mb-0.5" style={{ color: '#8E87A8' }}>PENDIENTE</p>
                <p className="text-[24px] font-extrabold m-0 leading-none" style={{ color: '#EF476F', fontFamily: 'Space Grotesk, sans-serif' }}>
                  {fmt.format(totalPendiente)}
                </p>
              </div>
            </div>
            {/* Barra de progreso */}
            <div className="h-2 rounded-full overflow-hidden mb-1.5" style={{ background: 'rgba(120,80,200,0.10)' }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${pctGlobal}%`, background: 'linear-gradient(90deg,#06D6A0,#7C3AED)', transition: 'width 0.6s ease' }}
              />
            </div>
            <div className="flex justify-between">
              <span className="text-[11px] font-bold" style={{ color: '#06D6A0' }}>{pctGlobal}% cobrado</span>
              <span className="text-[11px]" style={{ color: '#8E87A8' }}>Meta: {fmt.format(totalMeta)}</span>
            </div>
          </div>
        )}

        <p className="text-[10px] font-bold uppercase tracking-widest mb-2.5 m-0" style={{ color: '#8E87A8' }}>
          Detalle por club
        </p>

        {clubs.length === 0 && (
          <div className="rounded-2xl p-8 text-center" style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', color: '#8E87A8', fontSize: 13 }}>
            No hay clubs registrados.
          </div>
        )}

        {clubs.map(c => {
          const sus      = c.suscripcion;
          const pagos    = sus?.pagos ?? [];
          const rec      = pagos.filter(p => p.estado === 'PAID').reduce((a, p) => a + p.monto, 0);
          const monto    = sus?.planMonto ?? 0;
          const tipo     = sus?.tipoPlan ?? 'MENSUAL';
          const meta     = planMeta(monto, tipo);
          const pctClub  = meta > 0 ? Math.min(100, Math.round(rec / meta * 100)) : 0;
          const colorPct = pctClub >= 100 ? '#06D6A0' : pctClub > 50 ? '#FFB703' : '#EF476F';

          return (
            <div key={c.id} className="rounded-2xl mb-3" style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', padding: '14px 14px 12px' }}>

              {/* ── Cabecera club ── */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-bold m-0 truncate" style={{ color: '#1A1028', fontFamily: 'Space Grotesk, sans-serif' }}>
                    {c.name}
                  </p>

                  {/* Plan editable */}
                  {editPlanId === c.id ? (
                    <div className="mt-2">
                      {/* Toggle tipo plan */}
                      <div className="flex rounded-xl overflow-hidden mb-2" style={{ border: '1.5px solid rgba(120,80,200,0.18)' }}>
                        {PLAN_OPTIONS.map((opt, i) => (
                          <button key={opt.value} onClick={() => setEditTipoPlan(opt.value)}
                            className="flex-1 text-[10px] font-bold py-2"
                            style={{
                              background: editTipoPlan === opt.value ? '#7C3AED' : '#fff',
                              color: editTipoPlan === opt.value ? '#fff' : '#8E87A8',
                              border: 'none', cursor: 'pointer',
                              borderRight: i < PLAN_OPTIONS.length - 1 ? '1px solid rgba(120,80,200,0.18)' : 'none',
                              transition: 'background 0.15s, color 0.15s',
                            }}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-[9px] m-0 mb-1.5" style={{ color: '#8E87A8' }}>
                        {PLAN_OPTIONS.find(p => p.value === editTipoPlan)?.hint}
                      </p>
                      {/* Input monto con auto-formato */}
                      <div className="flex items-center gap-1.5">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold pointer-events-none" style={{ color: '#8E87A8' }}>$</span>
                          <MoneyInput
                            value={editPlanMonto}
                            onChange={setEditPlanMonto}
                            placeholder="0"
                            style={{ ...inputBase, paddingLeft: 24, fontSize: 14 }}
                          />
                        </div>
                        <button onClick={() => savePlanMonto(c.id, sus?.año ?? new Date().getFullYear())} disabled={savingPlan}
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: 'rgba(6,214,160,0.12)', color: '#06D6A0', border: '1.5px solid rgba(6,214,160,0.25)', cursor: 'pointer' }}>
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditPlanId(null)}
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: 'rgba(239,71,111,0.08)', color: '#EF476F', border: '1.5px solid rgba(239,71,111,0.20)', cursor: 'pointer' }}>
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditPlanId(c.id);
                        setEditPlanMonto(formatMiles(String(Math.round(monto))));
                        setEditTipoPlan(tipo);
                      }}
                      className="flex items-center gap-1 mt-0.5 cursor-pointer"
                      style={{ background: 'none', border: 'none', padding: 0 }}
                    >
                      <p className="text-[11px] m-0" style={{ color: '#8E87A8' }}>
                        {sus ? planLabel(monto, tipo) : 'Sin plan configurado'}
                      </p>
                      <Pencil className="w-2.5 h-2.5 shrink-0" style={{ color: '#C4BFD8' }} />
                    </button>
                  )}
                </div>

                {/* % progreso */}
                {sus && (
                  <div className="text-right shrink-0">
                    <p className="text-[18px] font-extrabold m-0 leading-none" style={{ color: colorPct, fontFamily: 'Space Grotesk, sans-serif' }}>
                      {pctClub}%
                    </p>
                    <p className="text-[10px] m-0 mt-0.5" style={{ color: '#8E87A8' }}>
                      {fmt.format(rec)} / {fmt.format(meta)}
                    </p>
                  </div>
                )}
              </div>

              {sus && (
                <>
                  {/* Barra de progreso club */}
                  <div className="h-[5px] rounded-full overflow-hidden mb-3" style={{ background: 'rgba(120,80,200,0.10)' }}>
                    <div className="h-full rounded-full" style={{ width: `${pctClub}%`, background: 'linear-gradient(90deg,#06D6A0,#7C3AED)', transition: 'width 0.6s ease' }} />
                  </div>

                  {/* ── Pagos registrados ── */}
                  {pagos.length > 0 && (
                    <div className="flex flex-col gap-2 mb-2.5">
                      {pagos.map(p => (
                        <div key={p.id}>
                          {editPagoId === p.id ? (
                            /* Formulario edición inline */
                            <div className="rounded-2xl p-3.5" style={{ background: '#F7F5FF', border: '1.5px solid rgba(124,58,237,0.15)' }}>
                              <p className="text-[10px] font-bold m-0 mb-3" style={{ color: '#7C3AED' }}>Editar abono</p>

                              {/* Concepto */}
                              <div className="mb-2.5">
                                <p className="text-[9px] font-semibold m-0 mb-1" style={{ color: '#8E87A8' }}>CONCEPTO</p>
                                <input type="text" value={editPagoForm.concepto}
                                  onChange={e => setEditPagoForm(f => ({ ...f, concepto: e.target.value }))}
                                  style={inputBase} />
                              </div>

                              {/* Monto + Estado */}
                              <div className="grid grid-cols-2 gap-2 mb-2.5">
                                <div>
                                  <p className="text-[9px] font-semibold m-0 mb-1" style={{ color: '#8E87A8' }}>MONTO</p>
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-semibold pointer-events-none" style={{ color: '#8E87A8' }}>$</span>
                                    <MoneyInput
                                      value={editPagoForm.monto}
                                      onChange={v => setEditPagoForm(f => ({ ...f, monto: v }))}
                                      style={{ ...inputBase, paddingLeft: 22 }}
                                    />
                                  </div>
                                </div>
                                <div>
                                  <p className="text-[9px] font-semibold m-0 mb-1" style={{ color: '#8E87A8' }}>ESTADO</p>
                                  <select value={editPagoForm.estado}
                                    onChange={e => setEditPagoForm(f => ({ ...f, estado: e.target.value }))}
                                    style={selectBase}>
                                    <option value="PAID">Pagado</option>
                                    <option value="PENDING">Pendiente</option>
                                    <option value="OVERDUE">Vencido</option>
                                  </select>
                                </div>
                              </div>

                              {/* Fecha full-width */}
                              <div className="mb-3">
                                <p className="text-[9px] font-semibold m-0 mb-1" style={{ color: '#8E87A8' }}>FECHA</p>
                                <input type="date" value={editPagoForm.fecha}
                                  onChange={e => setEditPagoForm(f => ({ ...f, fecha: e.target.value }))}
                                  style={inputBase} />
                              </div>

                              <div className="flex gap-2">
                                <button onClick={() => setEditPagoId(null)}
                                  className="flex-1 text-[12px] font-semibold py-2.5 rounded-xl cursor-pointer"
                                  style={{ border: '1.5px solid rgba(120,80,200,0.15)', background: 'transparent', color: '#8E87A8' }}>
                                  Cancelar
                                </button>
                                <button onClick={saveEditPago} disabled={savingEdit}
                                  className="flex-[2] text-[12px] font-bold py-2.5 rounded-xl text-white cursor-pointer"
                                  style={{ background: savingEdit ? '#A855F7' : '#7C3AED', border: 'none', boxShadow: '0 3px 12px rgba(124,58,237,0.30)' }}>
                                  {savingEdit ? 'Guardando...' : 'Guardar cambios'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* Fila normal del pago */
                            <div
                              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
                              style={{ background: ESTADO_BG[p.estado], border: `1px solid ${ESTADO_COLOR[p.estado]}25` }}
                            >
                              <div className="w-1 self-stretch rounded-full shrink-0" style={{ background: ESTADO_COLOR[p.estado] }} />
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-bold m-0 truncate" style={{ color: '#1A1028' }}>{p.concepto}</p>
                                <p className="text-[10px] m-0 mt-0.5" style={{ color: '#8E87A8' }}>
                                  {p.fecha
                                    ? new Date(p.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
                                    : 'Sin fecha'}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-0.5 shrink-0">
                                <p className="text-[15px] font-extrabold m-0 leading-none" style={{ color: ESTADO_COLOR[p.estado], fontFamily: 'Space Grotesk, sans-serif' }}>
                                  {fmt.format(p.monto)}
                                </p>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none"
                                  style={{ background: `${ESTADO_COLOR[p.estado]}18`, color: ESTADO_COLOR[p.estado] }}>
                                  {ESTADO_LABEL[p.estado]}
                                </span>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <button onClick={() => startEditPago(p)}
                                  aria-label="Editar abono"
                                  className="w-8 h-8 rounded-xl flex items-center justify-center cursor-pointer"
                                  style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)', color: '#7C3AED' }}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => deletePago(p.id)}
                                  aria-label="Eliminar abono"
                                  className="w-8 h-8 rounded-xl flex items-center justify-center cursor-pointer"
                                  style={{ background: 'rgba(239,71,111,0.08)', border: '1px solid rgba(239,71,111,0.18)', color: '#EF476F' }}>
                                  <Trash2 className="w-3.5 h-3.5" />
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

              {/* ── Formulario registrar abono ── */}
              {abonoOpen === c.id ? (
                <div className="rounded-2xl p-3.5" style={{ background: '#F7F5FF', border: '1.5px solid rgba(124,58,237,0.15)' }}>
                  <p className="text-[11px] font-bold mb-3 m-0" style={{ color: '#1A1028' }}>Registrar abono</p>

                  {/* Concepto */}
                  <div className="mb-2.5">
                    <p className="text-[9px] font-semibold m-0 mb-1" style={{ color: '#8E87A8' }}>CONCEPTO</p>
                    <input type="text" placeholder="Ej: Cuota Marzo" value={abonoForm.concepto}
                      onChange={e => setAbonoForm(f => ({ ...f, concepto: e.target.value }))}
                      style={inputBase} />
                  </div>

                  {/* Monto + Estado */}
                  <div className="grid grid-cols-2 gap-2 mb-2.5">
                    <div>
                      <p className="text-[9px] font-semibold m-0 mb-1" style={{ color: '#8E87A8' }}>MONTO</p>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-semibold pointer-events-none" style={{ color: '#8E87A8' }}>$</span>
                        <MoneyInput
                          value={abonoForm.monto}
                          onChange={v => setAbonoForm(f => ({ ...f, monto: v }))}
                          placeholder="0"
                          style={{ ...inputBase, paddingLeft: 22 }}
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold m-0 mb-1" style={{ color: '#8E87A8' }}>ESTADO</p>
                      <select value={abonoForm.estado}
                        onChange={e => setAbonoForm(f => ({ ...f, estado: e.target.value }))}
                        style={selectBase}>
                        <option value="PAID">Pagado</option>
                        <option value="PENDING">Pendiente</option>
                        <option value="OVERDUE">Vencido</option>
                      </select>
                    </div>
                  </div>

                  {/* Fecha full-width */}
                  <div className="mb-3">
                    <p className="text-[9px] font-semibold m-0 mb-1" style={{ color: '#8E87A8' }}>FECHA</p>
                    <input type="date" value={abonoForm.fecha}
                      onChange={e => setAbonoForm(f => ({ ...f, fecha: e.target.value }))}
                      style={inputBase} />
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => { setAbonoOpen(null); setAbonoForm({ concepto: '', monto: '', fecha: '', estado: 'PAID' }); }}
                      className="flex-1 text-[12px] font-semibold py-2.5 rounded-xl cursor-pointer"
                      style={{ border: '1.5px solid rgba(120,80,200,0.15)', background: 'transparent', color: '#8E87A8' }}>
                      Cancelar
                    </button>
                    <button onClick={() => registrarAbono(c.id)} disabled={saving}
                      className="flex-[2] text-[12px] font-bold py-2.5 rounded-xl text-white cursor-pointer"
                      style={{ background: saving ? '#A855F7' : '#7C3AED', border: 'none', boxShadow: '0 3px 12px rgba(124,58,237,0.30)' }}>
                      {saving ? 'Guardando...' : 'Registrar abono'}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAbonoOpen(c.id)}
                  className="w-full text-[12px] font-bold py-2.5 rounded-xl cursor-pointer"
                  style={{ border: '1.5px solid rgba(124,58,237,0.25)', background: 'rgba(124,58,237,0.06)', color: '#7C3AED' }}>
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
