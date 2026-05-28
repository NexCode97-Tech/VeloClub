'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { Pencil, Trash2, X, Check, TrendingUp, CalendarClock, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';

// ── Formateo ──────────────────────────────────────────────────────────────────
const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
function formatMiles(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
function parseMiles(f: string) { return parseFloat(f.replace(/\./g, '')) || 0; }

// ── MoneyInput ─────────────────────────────────────────────────────────────────
function MoneyInput({ value, onChange, placeholder, style }: {
  value: string; onChange: (v: string) => void; placeholder?: string; style?: React.CSSProperties;
}) {
  return (
    <input type="text" inputMode="numeric" value={value} placeholder={placeholder} style={style}
      onChange={e => { const d = e.target.value.replace(/\D/g, ''); onChange(formatMiles(d)); }} />
  );
}

// ── Tipos ─────────────────────────────────────────────────────────────────────
type TipoPlan = 'MENSUAL' | 'TRIMESTRAL' | 'ANUAL';
type EstadoPago = 'PAID' | 'PENDING' | 'OVERDUE';

interface Pago { id: string; concepto: string; monto: number; fecha: string | null; estado: EstadoPago; }
interface Suscripcion { id: string; planMonto: number; tipoPlan: TipoPlan; año: number; pagos: Pago[]; }
interface ClubConSuscripcion { id: string; name: string; active: boolean; suscripcion: Suscripcion | null; }

// ── Constantes ────────────────────────────────────────────────────────────────
const PLAN_OPTIONS: { value: TipoPlan; label: string; sub: string; multiplier: number }[] = [
  { value: 'MENSUAL',    label: 'Mensual',    sub: '×12/año',  multiplier: 12 },
  { value: 'TRIMESTRAL', label: 'Trimestral', sub: '×4/año',   multiplier: 4  },
  { value: 'ANUAL',      label: 'Anual',      sub: 'único',    multiplier: 1  },
];
function planMeta(monto: number, tipo: TipoPlan) {
  return monto * (PLAN_OPTIONS.find(p => p.value === tipo)?.multiplier ?? 12);
}
function planSuffix(tipo: TipoPlan) {
  return tipo === 'MENSUAL' ? '/mes' : tipo === 'TRIMESTRAL' ? '/trim.' : '/año';
}

const ESTADO: Record<EstadoPago, { label: string; color: string; bg: string; border: string }> = {
  PAID:    { label: 'Pagado',    color: '#06D6A0', bg: 'rgba(6,214,160,0.10)',   border: 'rgba(6,214,160,0.25)'   },
  PENDING: { label: 'Pendiente', color: '#FFB703', bg: 'rgba(255,183,3,0.10)',   border: 'rgba(255,183,3,0.25)'   },
  OVERDUE: { label: 'Vencido',   color: '#EF476F', bg: 'rgba(239,71,111,0.10)',  border: 'rgba(239,71,111,0.25)'  },
};

// ── Input base ────────────────────────────────────────────────────────────────
const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  border: '1.5px solid rgba(120,80,200,0.18)',
  background: '#fff', color: '#1A1028', fontSize: 14, outline: 'none',
  boxSizing: 'border-box', fontFamily: 'Plus Jakarta Sans, sans-serif',
};

// ── Variantes de animación ────────────────────────────────────────────────────
const EASE     = [0.23, 1, 0.32, 1]  as [number,number,number,number];
const EASE_IN  = [0.55, 0, 1, 0.45] as [number,number,number,number];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.26, ease: EASE } },
};
const stagger: Variants = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};
const expandY: Variants = {
  hidden: { opacity: 0, height: 0, overflow: 'hidden' },
  show:   { opacity: 1, height: 'auto', overflow: 'hidden', transition: { duration: 0.28, ease: EASE } },
  exit:   { opacity: 0, height: 0, overflow: 'hidden', transition: { duration: 0.20, ease: EASE_IN } },
};

// ── Segmented control plan ────────────────────────────────────────────────────
function PlanSelector({ value, onChange }: { value: TipoPlan; onChange: (v: TipoPlan) => void }) {
  return (
    <div style={{ display: 'flex', background: 'rgba(120,80,200,0.07)', borderRadius: 12, padding: 3, gap: 2 }}>
      {PLAN_OPTIONS.map(opt => {
        const active = value === opt.value;
        return (
          <motion.button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.12, ease: EASE }}
            style={{
              flex: 1, padding: '7px 4px', border: 'none', borderRadius: 10, cursor: 'pointer',
              background: active ? '#7C3AED' : 'transparent',
              transition: 'background 0.18s, box-shadow 0.18s',
              boxShadow: active ? '0 2px 10px rgba(124,58,237,0.28)' : 'none',
            }}
          >
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: active ? '#fff' : '#8E87A8', fontFamily: 'Plus Jakarta Sans, sans-serif', transition: 'color 0.18s' }}>
              {opt.label}
            </p>
            <p style={{ margin: 0, fontSize: 9, fontWeight: 500, color: active ? 'rgba(255,255,255,0.70)' : 'rgba(142,135,168,0.70)', transition: 'color 0.18s' }}>
              {opt.sub}
            </p>
          </motion.button>
        );
      })}
    </div>
  );
}

// ── Selector de estado ────────────────────────────────────────────────────────
function EstadoSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {(Object.entries(ESTADO) as [EstadoPago, typeof ESTADO[EstadoPago]][]).map(([k, s]) => {
        const active = value === k;
        return (
          <motion.button
            key={k}
            onClick={() => onChange(k)}
            whileTap={{ scale: 0.96 }}
            transition={{ duration: 0.12 }}
            style={{
              flex: 1, padding: '7px 4px', borderRadius: 10, cursor: 'pointer',
              border: `1.5px solid ${active ? s.color : 'rgba(120,80,200,0.12)'}`,
              background: active ? s.bg : 'transparent',
              transition: 'all 0.15s',
            }}
          >
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: active ? s.color : '#8E87A8', transition: 'color 0.15s', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              {s.label}
            </p>
          </motion.button>
        );
      })}
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function FinanzasPage() {
  const { getToken } = useAuth();
  const [clubs, setClubs] = useState<ClubConSuscripcion[]>([]);
  const [loading, setLoading] = useState(true);

  const [abonoOpen,   setAbonoOpen]   = useState<string | null>(null);
  const [abonoForm,   setAbonoForm]   = useState({ concepto: '', monto: '', fecha: '', estado: 'PAID' });
  const [saving,      setSaving]      = useState(false);

  const [editPagoId,   setEditPagoId]   = useState<string | null>(null);
  const [editPagoForm, setEditPagoForm] = useState({ concepto: '', monto: '', fecha: '', estado: 'PAID' });
  const [savingEdit,   setSavingEdit]   = useState(false);

  const [editPlanId,    setEditPlanId]    = useState<string | null>(null);
  const [editPlanMonto, setEditPlanMonto] = useState('');
  const [editTipoPlan,  setEditTipoPlan]  = useState<TipoPlan>('MENSUAL');
  const [savingPlan,    setSavingPlan]    = useState(false);

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
        body: JSON.stringify({ concepto: abonoForm.concepto, monto: parseMiles(abonoForm.monto), fecha: abonoForm.fecha || undefined, estado: abonoForm.estado }),
      });
      setAbonoOpen(null);
      setAbonoForm({ concepto: '', monto: '', fecha: '', estado: 'PAID' });
      await load();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  function startEditPago(p: Pago) {
    setEditPagoId(p.id);
    setEditPagoForm({ concepto: p.concepto, monto: formatMiles(String(Math.round(p.monto))), fecha: p.fecha ? p.fecha.slice(0, 10) : '', estado: p.estado });
  }

  async function saveEditPago() {
    if (!editPagoId) return;
    setSavingEdit(true);
    try {
      const token = await getToken();
      await apiFetch(`/superadmin/suscripciones/pagos/${editPagoId}`, {
        method: 'PATCH', token,
        body: JSON.stringify({ concepto: editPagoForm.concepto, monto: parseMiles(editPagoForm.monto), fecha: editPagoForm.fecha || undefined, estado: editPagoForm.estado }),
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

  // ── Métricas globales ──────────────────────────────────────────────────────
  const allPagos       = clubs.flatMap(c => c.suscripcion?.pagos ?? []);
  const totalMeta      = clubs.reduce((a, c) => a + (c.suscripcion ? planMeta(c.suscripcion.planMonto, c.suscripcion.tipoPlan) : 0), 0);
  const totalRecaudado = allPagos.filter(p => p.estado === 'PAID').reduce((a, p) => a + p.monto, 0);
  const totalPendiente = allPagos.filter(p => p.estado !== 'PAID').reduce((a, p) => a + p.monto, 0);
  const pctGlobal      = totalMeta > 0 ? Math.min(100, Math.round(totalRecaudado / totalMeta * 100)) : 0;

  if (loading) return (
    <div className="flex items-center justify-center h-40" style={{ background: '#F7F7FB' }}>
      <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#7C3AED', borderTopColor: 'transparent' }} />
    </div>
  );

  return (
    <div style={{ background: '#F7F7FB', minHeight: '100%' }}>
      <div style={{ padding: '12px 16px 100px' }}>

        {/* ── Resumen global ─────────────────────────────────────────────── */}
        {totalMeta > 0 && (
          <motion.div variants={fadeUp} initial="hidden" animate="show"
            style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', borderRadius: 20, padding: '16px 16px 14px', marginBottom: 16 }}>

            <div className="flex items-center justify-between mb-3">
              <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#8E87A8', textTransform: 'uppercase' }}>
                Resumen de suscripciones
              </p>
              <motion.button
                onClick={load}
                whileTap={{ scale: 0.90, rotate: 180 }}
                transition={{ duration: 0.35, ease: EASE }}
                style={{ background: 'rgba(120,80,200,0.07)', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#8E87A8' }}
              >
                <RefreshCw size={13} />
              </motion.button>
            </div>

            {/* Tres métricas en fila */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr 1px 1fr', gap: 0, marginBottom: 14 }}>
              <div style={{ textAlign: 'center', padding: '4px 0' }}>
                <p style={{ margin: 0, fontSize: 9, fontWeight: 600, color: '#8E87A8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>Recaudado</p>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#06D6A0', fontFamily: 'Space Grotesk, sans-serif', lineHeight: 1 }}>
                  {fmt.format(totalRecaudado)}
                </p>
              </div>
              <div style={{ background: 'rgba(120,80,200,0.10)', width: 1 }} />
              <div style={{ textAlign: 'center', padding: '4px 0' }}>
                <p style={{ margin: 0, fontSize: 9, fontWeight: 600, color: '#8E87A8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>Pendiente</p>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#EF476F', fontFamily: 'Space Grotesk, sans-serif', lineHeight: 1 }}>
                  {fmt.format(totalPendiente)}
                </p>
              </div>
              <div style={{ background: 'rgba(120,80,200,0.10)', width: 1 }} />
              <div style={{ textAlign: 'center', padding: '4px 0' }}>
                <p style={{ margin: 0, fontSize: 9, fontWeight: 600, color: '#8E87A8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>Meta anual</p>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#7C3AED', fontFamily: 'Space Grotesk, sans-serif', lineHeight: 1 }}>
                  {fmt.format(totalMeta)}
                </p>
              </div>
            </div>

            {/* Barra de progreso animada */}
            <div style={{ height: 6, borderRadius: 99, background: 'rgba(120,80,200,0.10)', overflow: 'hidden', marginBottom: 6 }}>
              <motion.div
                style={{ height: '100%', borderRadius: 99, background: 'linear-gradient(90deg, #06D6A0, #7C3AED)' }}
                initial={{ width: 0 }}
                animate={{ width: `${pctGlobal}%` }}
                transition={{ duration: 0.8, ease: EASE, delay: 0.2 }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: pctGlobal >= 100 ? '#06D6A0' : '#7C3AED' }}>{pctGlobal}% cobrado</span>
              <span style={{ fontSize: 11, color: '#8E87A8' }}>{clubs.filter(c => c.suscripcion).length} clubs activos</span>
            </div>
          </motion.div>
        )}

        {/* ── Detalle por club ───────────────────────────────────────────── */}
        <p style={{ margin: '0 0 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#8E87A8', textTransform: 'uppercase' }}>
          Detalle por club
        </p>

        {clubs.length === 0 && (
          <div style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', borderRadius: 20, padding: '40px 16px', textAlign: 'center', color: '#8E87A8', fontSize: 13 }}>
            No hay clubs registrados.
          </div>
        )}

        <motion.div variants={stagger} initial="hidden" animate="show">
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
              <motion.div key={c.id} variants={fadeUp}
                style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', borderRadius: 20, padding: '14px 14px 12px', marginBottom: 12 }}>

                {/* Cabecera: nombre + progreso */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(124,58,237,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#7C3AED', fontFamily: 'Space Grotesk, sans-serif', flexShrink: 0 }}>
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1A1028', fontFamily: 'Space Grotesk, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.name}
                      </p>
                    </div>

                    {/* Plan editable */}
                    {editPlanId === c.id ? (
                      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} style={{ marginTop: 8 }}>
                        <PlanSelector value={editTipoPlan} onChange={setEditTipoPlan} />
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <div style={{ flex: 1, position: 'relative' }}>
                            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, fontWeight: 600, color: '#8E87A8', pointerEvents: 'none' }}>$</span>
                            <MoneyInput value={editPlanMonto} onChange={setEditPlanMonto} placeholder="0"
                              style={{ ...inp, paddingLeft: 24, fontSize: 14 }} />
                          </div>
                          <motion.button onClick={() => savePlanMonto(c.id, sus?.año ?? new Date().getFullYear())} disabled={savingPlan}
                            whileTap={{ scale: 0.94 }} transition={{ duration: 0.12 }}
                            style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(6,214,160,0.12)', color: '#06D6A0', border: '1.5px solid rgba(6,214,160,0.25)', cursor: 'pointer', flexShrink: 0 }}>
                            <Check size={16} />
                          </motion.button>
                          <motion.button onClick={() => setEditPlanId(null)}
                            whileTap={{ scale: 0.94 }} transition={{ duration: 0.12 }}
                            style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239,71,111,0.08)', color: '#EF476F', border: '1.5px solid rgba(239,71,111,0.20)', cursor: 'pointer', flexShrink: 0 }}>
                            <X size={16} />
                          </motion.button>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.button
                        onClick={() => { setEditPlanId(c.id); setEditPlanMonto(formatMiles(String(Math.round(monto)))); setEditTipoPlan(tipo); }}
                        whileTap={{ scale: 0.97 }}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}
                      >
                        <span style={{ fontSize: 11, color: '#8E87A8', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                          {sus ? `${fmt.format(monto)}${planSuffix(tipo)}` : 'Sin plan — toca para configurar'}
                        </span>
                        <Pencil size={10} color="#C4BFD8" />
                      </motion.button>
                    )}
                  </div>

                  {/* Porcentaje */}
                  {sus && (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: colorPct, fontFamily: 'Space Grotesk, sans-serif', lineHeight: 1 }}>
                        {pctClub}%
                      </p>
                      <p style={{ margin: '3px 0 0', fontSize: 9, color: '#8E87A8' }}>
                        {fmt.format(rec)} / {fmt.format(meta)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Barra de progreso del club */}
                {sus && (
                  <div style={{ height: 4, borderRadius: 99, background: 'rgba(120,80,200,0.10)', overflow: 'hidden', marginBottom: 12 }}>
                    <motion.div
                      style={{ height: '100%', borderRadius: 99, background: `linear-gradient(90deg, ${colorPct === '#06D6A0' ? '#06D6A0, #7C3AED' : colorPct === '#FFB703' ? '#FFB703, #FB8500' : '#EF476F, #F72585'})` }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pctClub}%` }}
                      transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
                    />
                  </div>
                )}

                {/* Abonos registrados */}
                <AnimatePresence initial={false}>
                  {pagos.length > 0 && (
                    <motion.div variants={stagger} initial="hidden" animate="show" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                      {pagos.map(p => {
                        const st = ESTADO[p.estado];
                        return (
                          <motion.div key={p.id} variants={fadeUp}>
                            <AnimatePresence mode="wait">
                              {editPagoId === p.id ? (
                                /* Edición inline */
                                <motion.div key="edit"
                                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                                  transition={{ duration: 0.2, ease: EASE }}
                                  style={{ background: '#F7F5FF', border: '1.5px solid rgba(124,58,237,0.15)', borderRadius: 14, padding: 14 }}
                                >
                                  <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: '#7C3AED' }}>Editar abono</p>
                                  <div style={{ marginBottom: 10 }}>
                                    <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Concepto</p>
                                    <input type="text" value={editPagoForm.concepto}
                                      onChange={e => setEditPagoForm(f => ({ ...f, concepto: e.target.value }))} style={inp} />
                                  </div>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                                    <div>
                                      <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Monto</p>
                                      <div style={{ position: 'relative' }}>
                                        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#8E87A8', pointerEvents: 'none' }}>$</span>
                                        <MoneyInput value={editPagoForm.monto} onChange={v => setEditPagoForm(f => ({ ...f, monto: v }))} style={{ ...inp, paddingLeft: 22 }} />
                                      </div>
                                    </div>
                                    <div>
                                      <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fecha</p>
                                      <input type="date" value={editPagoForm.fecha}
                                        onChange={e => setEditPagoForm(f => ({ ...f, fecha: e.target.value }))} style={inp} />
                                    </div>
                                  </div>
                                  <div style={{ marginBottom: 12 }}>
                                    <p style={{ margin: '0 0 6px', fontSize: 9, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Estado</p>
                                    <EstadoSelector value={editPagoForm.estado} onChange={v => setEditPagoForm(f => ({ ...f, estado: v }))} />
                                  </div>
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    <motion.button onClick={() => setEditPagoId(null)} whileTap={{ scale: 0.97 }}
                                      style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: '1.5px solid rgba(120,80,200,0.15)', background: 'transparent', color: '#8E87A8', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                                      Cancelar
                                    </motion.button>
                                    <motion.button onClick={saveEditPago} disabled={savingEdit} whileTap={{ scale: 0.97 }}
                                      style={{ flex: 2, padding: '10px 0', borderRadius: 12, border: 'none', background: savingEdit ? '#A855F7' : '#7C3AED', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', boxShadow: '0 3px 12px rgba(124,58,237,0.28)' }}>
                                      {savingEdit ? 'Guardando...' : 'Guardar cambios'}
                                    </motion.button>
                                  </div>
                                </motion.div>
                              ) : (
                                /* Fila de pago */
                                <motion.div key="row"
                                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                  transition={{ duration: 0.15 }}
                                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: st.bg, border: `1px solid ${st.border}` }}
                                >
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1A1028', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.concepto}</p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <CalendarClock size={10} color="#8E87A8" />
                                      <p style={{ margin: 0, fontSize: 10, color: '#8E87A8' }}>
                                        {p.fecha ? new Date(p.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Sin fecha'}
                                      </p>
                                    </div>
                                  </div>
                                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                                    <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: st.color, fontFamily: 'Space Grotesk, sans-serif', lineHeight: 1 }}>{fmt.format(p.monto)}</p>
                                    <span style={{ display: 'inline-block', marginTop: 3, fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: `${st.color}18`, color: st.color }}>
                                      {st.label}
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                                    <motion.button onClick={() => startEditPago(p)} whileTap={{ scale: 0.90 }} transition={{ duration: 0.12 }}
                                      style={{ width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)', color: '#7C3AED', cursor: 'pointer' }}>
                                      <Pencil size={12} />
                                    </motion.button>
                                    <motion.button onClick={() => deletePago(p.id)} whileTap={{ scale: 0.90 }} transition={{ duration: 0.12 }}
                                      style={{ width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239,71,111,0.08)', border: '1px solid rgba(239,71,111,0.18)', color: '#EF476F', cursor: 'pointer' }}>
                                      <Trash2 size={12} />
                                    </motion.button>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Formulario registrar abono */}
                <AnimatePresence mode="wait">
                  {abonoOpen === c.id ? (
                    <motion.div key="form"
                      variants={expandY} initial="hidden" animate="show" exit="exit"
                      style={{ background: '#F7F5FF', border: '1.5px solid rgba(124,58,237,0.15)', borderRadius: 14, padding: 14 }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#1A1028', fontFamily: 'Space Grotesk, sans-serif' }}>Registrar abono</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <TrendingUp size={12} color="#7C3AED" />
                          <span style={{ fontSize: 10, fontWeight: 600, color: '#7C3AED' }}>{c.name}</span>
                        </div>
                      </div>

                      <div style={{ marginBottom: 10 }}>
                        <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Concepto</p>
                        <input type="text" placeholder="Ej: Cuota Mayo" value={abonoForm.concepto}
                          onChange={e => setAbonoForm(f => ({ ...f, concepto: e.target.value }))} style={inp} />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                        <div>
                          <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Monto</p>
                          <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#8E87A8', pointerEvents: 'none' }}>$</span>
                            <MoneyInput value={abonoForm.monto} onChange={v => setAbonoForm(f => ({ ...f, monto: v }))} placeholder="0" style={{ ...inp, paddingLeft: 22 }} />
                          </div>
                        </div>
                        <div>
                          <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fecha</p>
                          <input type="date" value={abonoForm.fecha}
                            onChange={e => setAbonoForm(f => ({ ...f, fecha: e.target.value }))} style={inp} />
                        </div>
                      </div>

                      <div style={{ marginBottom: 14 }}>
                        <p style={{ margin: '0 0 6px', fontSize: 9, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Estado</p>
                        <EstadoSelector value={abonoForm.estado} onChange={v => setAbonoForm(f => ({ ...f, estado: v }))} />
                      </div>

                      <div style={{ display: 'flex', gap: 8 }}>
                        <motion.button
                          onClick={() => { setAbonoOpen(null); setAbonoForm({ concepto: '', monto: '', fecha: '', estado: 'PAID' }); }}
                          whileTap={{ scale: 0.97 }}
                          style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: '1.5px solid rgba(120,80,200,0.15)', background: 'transparent', color: '#8E87A8', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                          Cancelar
                        </motion.button>
                        <motion.button
                          onClick={() => registrarAbono(c.id)} disabled={saving}
                          whileTap={{ scale: 0.97 }}
                          style={{ flex: 2, padding: '11px 0', borderRadius: 12, border: 'none', background: saving ? '#A855F7' : '#7C3AED', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', boxShadow: '0 3px 14px rgba(124,58,237,0.30)' }}>
                          {saving ? 'Guardando...' : 'Registrar abono'}
                        </motion.button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.button key="btn"
                      onClick={() => setAbonoOpen(c.id)}
                      whileTap={{ scale: 0.97 }}
                      transition={{ duration: 0.12, ease: EASE }}
                      style={{ width: '100%', padding: '11px 0', borderRadius: 12, border: '1.5px solid rgba(124,58,237,0.22)', background: 'rgba(124,58,237,0.05)', color: '#7C3AED', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                      + Registrar abono
                    </motion.button>
                  )}
                </AnimatePresence>

              </motion.div>
            );
          })}
        </motion.div>

      </div>
    </div>
  );
}
