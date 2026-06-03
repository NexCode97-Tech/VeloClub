'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { Pencil, Trash2, X, Check, TrendingUp, CalendarClock, CircleDollarSign, Eye, Upload, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { stagger as pageStagger, cardVariant as pageCard } from '@/lib/page-animations';

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

interface Pago { id: string; concepto: string; monto: number; fecha: string | null; estado: EstadoPago; receiptUrl?: string | null; receiptPublicId?: string | null; }
interface Suscripcion { id: string; planMonto: number; tipoPlan: TipoPlan; año: number; pagos: Pago[]; }
interface ClubConSuscripcion { id: string; name: string; active: boolean; logoUrl?: string | null; suscripcion: Suscripcion | null; }

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

const PLAN_BADGE: Record<TipoPlan, { label: string; color: string; bg: string }> = {
  MENSUAL:    { label: 'Mensual',    color: '#7C3AED', bg: 'rgba(124,58,237,0.10)' },
  TRIMESTRAL: { label: 'Trimestral', color: '#4361EE', bg: 'rgba(67,97,238,0.10)'  },
  ANUAL:      { label: 'Anual',      color: '#06D6A0', bg: 'rgba(6,214,160,0.10)'  },
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

  // Comprobante
  const [receiptModal,    setReceiptModal]    = useState<Pago | null>(null);
  const [receiptFile,     setReceiptFile]     = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [deletingReceipt,  setDeletingReceipt]  = useState(false);
  const [receiptError,    setReceiptError]    = useState<string | null>(null);

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

  // ── Comprobante ───────────────────────────────────────────────────────────
  function handleReceiptFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setReceiptFile(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleUploadReceipt() {
    if (!receiptModal || !receiptFile) return;
    setUploadingReceipt(true); setReceiptError(null);
    try {
      const token = await getToken();
      const updated = await apiFetch<{ pago: Pago }>(
        `/superadmin/suscripciones/pagos/${receiptModal.id}/receipt`,
        { method: 'POST', token, body: JSON.stringify({ base64: receiptFile }) }
      );
      setReceiptModal(updated.pago);
      setReceiptFile(null);
      await load();
    } catch (e) { setReceiptError(e instanceof Error ? e.message : 'Error al subir'); }
    finally { setUploadingReceipt(false); }
  }

  async function handleDeleteReceipt() {
    if (!receiptModal) return;
    setDeletingReceipt(true); setReceiptError(null);
    try {
      const token = await getToken();
      const updated = await apiFetch<{ pago: Pago }>(
        `/superadmin/suscripciones/pagos/${receiptModal.id}/receipt`,
        { method: 'DELETE', token }
      );
      setReceiptModal(updated.pago);
      await load();
    } catch (e) { setReceiptError(e instanceof Error ? e.message : 'Error al eliminar'); }
    finally { setDeletingReceipt(false); }
  }

  // ── Métricas globales ──────────────────────────────────────────────────────
  // ── Métricas globales ──────────────────────────────────────────────────────
  const totalRecaudado = clubs.reduce((a, c) => {
    return a + (c.suscripcion?.pagos ?? []).filter(p => p.estado === 'PAID').reduce((s, p) => s + p.monto, 0);
  }, 0);
  const totalPendiente = clubs.reduce((a, c) => {
    return a + (c.suscripcion?.pagos ?? []).filter(p => p.estado !== 'PAID').reduce((s, p) => s + p.monto, 0);
  }, 0);
  const clubsConPlan = clubs.filter(c => c.suscripcion).length;

  if (loading) return (
    <div style={{ background: '#F7F7FB', minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(124,58,237,0.15)', borderTopColor: '#7C3AED', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  return (
    <div style={{ background: '#F7F7FB', minHeight: '100%' }}>
      <div style={{ padding: '16px 16px 100px' }}>

        {/* ── Tarjetas resumen globales ────────────────────────────────────── */}
        <motion.div
          variants={stagger} initial="hidden" animate="show"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}
        >
          {[
            { label: 'Recaudado', value: fmt.format(totalRecaudado), color: '#06D6A0', bg: 'rgba(6,214,160,0.10)', icon: <TrendingUp size={16} color="#06D6A0" /> },
            { label: 'Pendiente', value: fmt.format(totalPendiente), color: '#FFB703', bg: 'rgba(255,183,3,0.10)', icon: <CalendarClock size={16} color="#FFB703" /> },
            { label: 'Con plan',  value: String(clubsConPlan),       color: '#7C3AED', bg: 'rgba(124,58,237,0.10)', icon: <CircleDollarSign size={16} color="#7C3AED" /> },
          ].map(s => (
            <motion.div key={s.label} variants={fadeUp}
              style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.09)', borderRadius: 16, padding: '12px 10px', textAlign: 'center', boxShadow: '0 2px 10px rgba(124,58,237,0.05)' }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
                {s.icon}
              </div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: s.color, fontFamily: 'Space Grotesk, sans-serif', lineHeight: 1 }}>{s.value}</p>
              <p style={{ margin: '4px 0 0', fontSize: 9, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Label sección ────────────────────────────────────────────────── */}
        <p style={{ margin: '0 0 12px', fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', color: '#8E87A8', textTransform: 'uppercase' }}>
          Detalle por club
        </p>

        {/* ── Empty state ──────────────────────────────────────────────────── */}
        {clubs.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: EASE }}
            style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', borderRadius: 20, padding: '48px 16px', textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(124,58,237,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <CircleDollarSign size={24} color="#7C3AED" />
            </div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1A1028', fontFamily: 'Space Grotesk, sans-serif' }}>Sin clubs registrados</p>
            <p style={{ margin: '6px 0 0', fontSize: 12, color: '#8E87A8' }}>Crea clubs desde el módulo de Clubs</p>
          </motion.div>
        )}

        {/* ── Lista de clubs ────────────────────────────────────────────────── */}
        <motion.div variants={stagger} initial="hidden" animate="show" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {clubs.map(c => {
            const sus     = c.suscripcion;
            const pagos   = sus?.pagos ?? [];
            const rec     = pagos.filter(p => p.estado === 'PAID').reduce((a, p) => a + p.monto, 0);
            const monto   = sus?.planMonto ?? 0;
            const tipo    = sus?.tipoPlan ?? 'MENSUAL';
            const meta    = planMeta(monto, tipo);
            const pct     = meta > 0 ? Math.min(100, Math.round(rec / meta * 100)) : 0;
            const pctColor = pct >= 100 ? '#06D6A0' : pct > 50 ? '#FFB703' : '#EF476F';
            const pb       = PLAN_BADGE[tipo];

            return (
              <motion.div key={c.id} variants={fadeUp}
                whileHover={{ y: -2, boxShadow: '0 10px 32px rgba(124,58,237,0.12)', transition: { duration: 0.22, ease: EASE } }}
                style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.09)', borderRadius: 22, overflow: 'hidden', boxShadow: '0 2px 12px rgba(124,58,237,0.05)' }}
              >
                {/* ── Cabecera con gradiente según plan ── */}
                <div style={{
                  padding: '14px 14px 12px',
                  background: sus ? `linear-gradient(135deg, ${pb.bg} 0%, rgba(255,255,255,0) 60%)` : 'rgba(142,135,168,0.05)',
                  borderBottom: '1px solid rgba(120,80,200,0.07)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Avatar */}
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: sus ? pb.bg : 'rgba(142,135,168,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: sus ? pb.color : '#8E87A8', fontFamily: 'Space Grotesk, sans-serif', flexShrink: 0, overflow: 'hidden' }}>
                      {c.logoUrl
                        ? <img src={c.logoUrl} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : c.name.charAt(0).toUpperCase()
                      }
                    </div>

                    {/* Nombre + plan */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1A1028', fontFamily: 'Space Grotesk, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.name}
                        </p>
                        {sus && (
                          <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: pb.bg, color: pb.color }}>
                            {pb.label}
                          </span>
                        )}
                      </div>

                      {/* Plan editable */}
                      {editPlanId === c.id ? (
                        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                          <PlanSelector value={editTipoPlan} onChange={setEditTipoPlan} />
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <div style={{ flex: 1, position: 'relative' }}>
                              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, fontWeight: 600, color: '#8E87A8', pointerEvents: 'none' }}>$</span>
                              <MoneyInput value={editPlanMonto} onChange={setEditPlanMonto} placeholder="0" style={{ ...inp, paddingLeft: 24, fontSize: 14 }} />
                            </div>
                            <motion.button onClick={() => savePlanMonto(c.id, sus?.año ?? new Date().getFullYear())} disabled={savingPlan}
                              whileTap={{ scale: 0.94 }} transition={{ duration: 0.12 }}
                              style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(6,214,160,0.12)', color: '#06D6A0', border: '1.5px solid rgba(6,214,160,0.25)', cursor: 'pointer', flexShrink: 0 }}>
                              <Check size={16} />
                            </motion.button>
                            <motion.button onClick={() => setEditPlanId(null)} whileTap={{ scale: 0.94 }} transition={{ duration: 0.12 }}
                              style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239,71,111,0.08)', color: '#EF476F', border: '1.5px solid rgba(239,71,111,0.20)', cursor: 'pointer', flexShrink: 0 }}>
                              <X size={16} />
                            </motion.button>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.button
                          onClick={() => { setEditPlanId(c.id); setEditPlanMonto(formatMiles(String(Math.round(monto)))); setEditTipoPlan(tipo); }}
                          whileTap={{ scale: 0.97 }}
                          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                        >
                          <span style={{ fontSize: 12, color: sus ? '#5A5278' : '#8E87A8', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                            {sus ? `${fmt.format(monto)}${planSuffix(tipo)}` : 'Sin plan — toca para configurar'}
                          </span>
                          <Pencil size={10} color="#C4BFD8" />
                        </motion.button>
                      )}
                    </div>

                    {/* % recaudado */}
                    {sus && (
                      <div style={{ textAlign: 'center', flexShrink: 0 }}>
                        <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: pctColor, fontFamily: 'Space Grotesk, sans-serif', lineHeight: 1 }}>{pct}%</p>
                        <p style={{ margin: '2px 0 0', fontSize: 9, color: '#8E87A8', whiteSpace: 'nowrap' }}>{fmt.format(rec)}</p>
                      </div>
                    )}
                  </div>

                  {/* Barra de progreso */}
                  {sus && (
                    <div style={{ marginTop: 12, height: 6, borderRadius: 99, background: 'rgba(120,80,200,0.08)', overflow: 'hidden' }}>
                      <motion.div
                        style={{ height: '100%', borderRadius: 99, background: `linear-gradient(90deg, ${pctColor}, ${pct >= 100 ? '#7C3AED' : pct > 50 ? '#FB8500' : '#F72585'})` }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: EASE, delay: 0.2 }}
                      />
                    </div>
                  )}
                </div>

                {/* ── Abonos registrados ── */}
                <AnimatePresence initial={false}>
                  {pagos.length > 0 && (
                    <motion.div variants={stagger} initial="hidden" animate="show"
                      style={{ display: 'flex', flexDirection: 'column', gap: 1, borderBottom: '1px solid rgba(120,80,200,0.06)' }}>
                      {pagos.map(p => {
                        const st = ESTADO[p.estado];
                        return (
                          <motion.div key={p.id} variants={fadeUp}>
                            <AnimatePresence mode="wait">
                              {editPagoId === p.id ? (
                                <motion.div key="edit"
                                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                                  transition={{ duration: 0.2, ease: EASE }}
                                  style={{ background: '#F7F5FF', border: '1.5px solid rgba(124,58,237,0.15)', borderRadius: 14, padding: 14, margin: '8px 10px' }}
                                >
                                  <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: '#7C3AED' }}>Editar abono</p>
                                  <div style={{ marginBottom: 10 }}>
                                    <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Concepto</p>
                                    <input type="text" value={editPagoForm.concepto} onChange={e => setEditPagoForm(f => ({ ...f, concepto: e.target.value }))} style={inp} />
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
                                      <input type="date" value={editPagoForm.fecha} onChange={e => setEditPagoForm(f => ({ ...f, fecha: e.target.value }))} style={inp} />
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
                                      style={{ flex: 2, padding: '10px 0', borderRadius: 12, border: 'none', background: '#7C3AED', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', boxShadow: '0 3px 12px rgba(124,58,237,0.28)' }}>
                                      {savingEdit ? 'Guardando...' : 'Guardar cambios'}
                                    </motion.button>
                                  </div>
                                </motion.div>
                              ) : (
                                /* Fila de pago */
                                <motion.div key="row"
                                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                  transition={{ duration: 0.15 }}
                                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderLeft: `3px solid ${st.color}`, background: `${st.color}07` }}
                                >
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1A1028', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.concepto}</p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                                      <CalendarClock size={9} color="#8E87A8" />
                                      <span style={{ fontSize: 10, color: '#8E87A8' }}>
                                        {p.fecha ? new Date(p.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Sin fecha'}
                                      </span>
                                    </div>
                                  </div>
                                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                                    <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: st.color, fontFamily: 'Space Grotesk, sans-serif', lineHeight: 1 }}>{fmt.format(p.monto)}</p>
                                    <span style={{ display: 'inline-block', marginTop: 3, fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: st.bg, color: st.color }}>
                                      {st.label}
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                    <motion.button onClick={() => { setReceiptModal(p); setReceiptFile(null); setReceiptError(null); }}
                                      whileTap={{ scale: 0.88 }} transition={{ duration: 0.12 }}
                                      title={p.receiptUrl ? 'Ver comprobante' : 'Subir comprobante'}
                                      style={{ width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: p.receiptUrl ? 'rgba(6,214,160,0.10)' : 'rgba(120,80,200,0.07)', border: `1px solid ${p.receiptUrl ? 'rgba(6,214,160,0.28)' : 'rgba(120,80,200,0.15)'}`, color: p.receiptUrl ? '#06D6A0' : '#8E87A8', cursor: 'pointer' }}>
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                                    </motion.button>
                                    <motion.button onClick={() => startEditPago(p)} whileTap={{ scale: 0.88 }} transition={{ duration: 0.12 }}
                                      style={{ width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)', color: '#7C3AED', cursor: 'pointer' }}>
                                      <Pencil size={12} />
                                    </motion.button>
                                    <motion.button onClick={() => deletePago(p.id)} whileTap={{ scale: 0.88 }} transition={{ duration: 0.12 }}
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

                {/* ── Botón / Formulario registrar abono ── */}
                <div style={{ padding: '12px 14px' }}>
                  <AnimatePresence mode="wait">
                    {abonoOpen === c.id ? (
                      <motion.div key="form"
                        variants={expandY} initial="hidden" animate="show" exit="exit"
                        style={{ background: '#F7F5FF', border: '1.5px solid rgba(124,58,237,0.15)', borderRadius: 16, padding: 14 }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1A1028', fontFamily: 'Space Grotesk, sans-serif' }}>Registrar abono</p>
                          <span style={{ fontSize: 10, fontWeight: 600, color: '#7C3AED', background: 'rgba(124,58,237,0.10)', padding: '3px 8px', borderRadius: 99 }}>{c.name}</span>
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
                            <input type="date" value={abonoForm.fecha} onChange={e => setAbonoForm(f => ({ ...f, fecha: e.target.value }))} style={inp} />
                          </div>
                        </div>
                        <div style={{ marginBottom: 14 }}>
                          <p style={{ margin: '0 0 6px', fontSize: 9, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Estado</p>
                          <EstadoSelector value={abonoForm.estado} onChange={v => setAbonoForm(f => ({ ...f, estado: v }))} />
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <motion.button onClick={() => { setAbonoOpen(null); setAbonoForm({ concepto: '', monto: '', fecha: '', estado: 'PAID' }); }}
                            whileTap={{ scale: 0.97 }}
                            style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: '1.5px solid rgba(120,80,200,0.15)', background: 'transparent', color: '#8E87A8', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                            Cancelar
                          </motion.button>
                          <motion.button onClick={() => registrarAbono(c.id)} disabled={saving}
                            whileTap={{ scale: 0.97 }}
                            style={{ flex: 2, padding: '11px 0', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#7C3AED,#4361EE)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', boxShadow: '0 4px 14px rgba(124,58,237,0.32)', opacity: saving ? 0.7 : 1 }}>
                            {saving ? 'Guardando...' : 'Registrar abono'}
                          </motion.button>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.button key="btn"
                        onClick={() => setAbonoOpen(c.id)}
                        whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.97 }}
                        transition={{ duration: 0.14, ease: EASE }}
                        style={{ width: '100%', padding: '12px 0', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#7C3AED,#4361EE)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', boxShadow: '0 4px 16px rgba(124,58,237,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <TrendingUp size={14} /> Registrar abono
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>

              </motion.div>
            );
          })}
        </motion.div>

      </div>

      {/* ── Modal comprobante ───────────────────────────────────────────── */}
      <AnimatePresence>
        {receiptModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => { setReceiptModal(null); setReceiptFile(null); setReceiptError(null); }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(26,16,40,0.55)', zIndex: 100, backdropFilter: 'blur(4px)' }}
            />
            {/* Sheet */}
            <motion.div
              initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
              transition={{ duration: 0.28, ease: EASE }}
              style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 101, background: '#fff', borderRadius: '20px 20px 0 0', padding: '20px 16px 40px', boxShadow: '0 -8px 40px rgba(80,40,180,0.16)' }}
            >
              {/* Handle */}
              <div style={{ width: 36, height: 4, borderRadius: 99, background: 'rgba(120,80,200,0.18)', margin: '0 auto 16px' }} />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1A1028', fontFamily: 'Space Grotesk, sans-serif' }}>
                    Comprobante de pago
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#8E87A8' }}>{receiptModal.concepto}</p>
                </div>
                <motion.button
                  onClick={() => { setReceiptModal(null); setReceiptFile(null); setReceiptError(null); }}
                  whileTap={{ scale: 0.90 }}
                  style={{ width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(120,80,200,0.08)', border: '1px solid rgba(120,80,200,0.15)', color: '#8E87A8', cursor: 'pointer' }}
                >
                  <X size={14} />
                </motion.button>
              </div>

              {/* Preview */}
              {(receiptFile || receiptModal.receiptUrl) && (
                <div style={{ borderRadius: 14, overflow: 'hidden', border: '1.5px solid rgba(124,58,237,0.15)', marginBottom: 12, maxHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F5FF' }}>
                  <img
                    src={receiptFile ?? receiptModal.receiptUrl!}
                    alt="Comprobante"
                    style={{ width: '100%', maxHeight: 220, objectFit: 'contain' }}
                  />
                </div>
              )}

              {/* Sin comprobante */}
              {!receiptModal.receiptUrl && !receiptFile && (
                <div style={{ borderRadius: 14, border: '2px dashed rgba(124,58,237,0.20)', padding: '28px 16px', textAlign: 'center', marginBottom: 12, background: 'rgba(124,58,237,0.03)' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(124,58,237,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                  <p style={{ margin: 0, fontSize: 12, color: '#8E87A8', fontWeight: 500 }}>Sin comprobante adjunto</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#C4BFD8' }}>Sube una imagen del recibo de pago</p>
                </div>
              )}

              {receiptError && (
                <p style={{ margin: '0 0 10px', fontSize: 11, color: '#EF476F', textAlign: 'center' }}>{receiptError}</p>
              )}

              {/* Acciones */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Seleccionar / Reemplazar archivo */}
                <label style={{ display: 'block', cursor: 'pointer' }}>
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleReceiptFileChange} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 0', borderRadius: 12, border: '1.5px solid rgba(124,58,237,0.25)', background: 'rgba(124,58,237,0.05)', color: '#7C3AED', fontSize: 12, fontWeight: 700, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                    {receiptModal.receiptUrl ? <RotateCcw size={14} /> : <Upload size={14} />}
                    {receiptModal.receiptUrl ? 'Reemplazar comprobante' : 'Seleccionar imagen'}
                  </div>
                </label>

                {/* Subir */}
                {receiptFile && (
                  <motion.button
                    onClick={handleUploadReceipt} disabled={uploadingReceipt}
                    whileTap={{ scale: 0.97 }}
                    style={{ width: '100%', padding: '12px 0', borderRadius: 12, border: 'none', background: uploadingReceipt ? '#A855F7' : '#7C3AED', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', boxShadow: '0 3px 14px rgba(124,58,237,0.30)' }}
                  >
                    {uploadingReceipt ? 'Subiendo...' : 'Confirmar y guardar'}
                  </motion.button>
                )}

                {/* Ver a tamaño completo */}
                {receiptModal.receiptUrl && !receiptFile && (
                  <motion.button
                    onClick={() => window.open(receiptModal.receiptUrl!, '_blank')}
                    whileTap={{ scale: 0.97 }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '11px 0', borderRadius: 12, border: '1.5px solid rgba(6,214,160,0.30)', background: 'rgba(6,214,160,0.07)', color: '#06D6A0', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                  >
                    <Eye size={14} />
                    Ver comprobante completo
                  </motion.button>
                )}

                {/* Eliminar */}
                {receiptModal.receiptUrl && !receiptFile && (
                  <motion.button
                    onClick={handleDeleteReceipt} disabled={deletingReceipt}
                    whileTap={{ scale: 0.97 }}
                    style={{ width: '100%', padding: '11px 0', borderRadius: 12, border: '1.5px solid rgba(239,71,111,0.22)', background: 'rgba(239,71,111,0.06)', color: '#EF476F', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                  >
                    {deletingReceipt ? 'Eliminando...' : 'Eliminar comprobante'}
                  </motion.button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
