'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { apiFetch } from '@/lib/api-client';
import { DatePicker } from '@/components/ui/date-picker';
import { PhoneInput } from '@/components/ui/phone-input';
import SportSelect from './sport-select';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  ArrowLeft, Pencil, Trash2, X, Check, TrendingUp, CalendarClock,
  CircleDollarSign, Eye, Upload, RotateCcw, MessageCircle, Info, Power, BadgeCheck,
} from 'lucide-react';

// ── Formateo ────────────────────────────────────────────────────────────────
const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
function formatMiles(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
function parseMiles(f: string) { return parseFloat(f.replace(/\./g, '')) || 0; }

function MoneyInput({ value, onChange, placeholder, style }: {
  value: string; onChange: (v: string) => void; placeholder?: string; style?: React.CSSProperties;
}) {
  return (
    <input type="text" inputMode="numeric" value={value} placeholder={placeholder} style={style}
      onChange={e => { const d = e.target.value.replace(/\D/g, ''); onChange(formatMiles(d)); }} />
  );
}

// ── Tipos ───────────────────────────────────────────────────────────────────
export type TipoPlan = 'MENSUAL' | 'TRIMESTRAL' | 'ANUAL';
type EstadoPago = 'PAID' | 'PENDING' | 'OVERDUE' | 'REFUNDED';

export interface Pago { id: string; concepto: string; monto: number; fecha: string | null; estado: EstadoPago; receiptUrl?: string | null; receiptPublicId?: string | null; }
export interface Suscripcion { id: string; planMonto: number; tipoPlan: TipoPlan; año: number; pagos: Pago[]; }

export interface Member {
  id: string; fullName: string; email: string; phone?: string | null;
  role: 'ADMIN' | 'COACH'; inviteStatus: string;
}
export interface Club {
  id: string; name: string; active: boolean; createdAt: string;
  trialEndsAt?: string | null; deporte?: string | null; logoUrl?: string | null;
  verificationStatus?: 'PENDING' | 'VERIFIED' | 'REJECTED';
  nameFlagged?: boolean;
  city?: string | null; department?: string | null; memberCountApprox?: number | null;
  _count: { members: number };
  users: { email: string; name: string }[];
  suscripcion?: { tipoPlan: string; planMonto: number } | null;
}

// ── Constantes ──────────────────────────────────────────────────────────────
const PLAN_OPTIONS: { value: TipoPlan; label: string; sub: string }[] = [
  { value: 'MENSUAL',    label: 'Mensual',    sub: '×12/año' },
  { value: 'TRIMESTRAL', label: 'Trimestral', sub: '×4/año'  },
  { value: 'ANUAL',      label: 'Anual',      sub: 'único'   },
];
const PLAN_DAYS: Record<TipoPlan, number> = { MENSUAL: 30, TRIMESTRAL: 90, ANUAL: 365 };

function vigencia(pagos: { estado: string; fecha?: string | null }[], tipo: TipoPlan) {
  const dur = PLAN_DAYS[tipo] ?? 30;
  const pagados = pagos.filter(p => p.estado === 'PAID' && p.fecha);
  if (pagados.length === 0) return null;
  const ultimo = pagados.reduce((a, b) => (new Date(a.fecha!) > new Date(b.fecha!) ? a : b));
  const inicio = new Date(ultimo.fecha!);
  const diasPasados   = Math.floor((Date.now() - inicio.getTime()) / 86_400_000);
  const diasRestantes = Math.max(0, dur - diasPasados);
  const pct = Math.max(0, Math.min(100, Math.round((diasRestantes / dur) * 100)));
  return { pct, diasRestantes, vencido: diasRestantes <= 0 };
}
function planSuffix(tipo: TipoPlan) {
  return tipo === 'MENSUAL' ? '/mes' : tipo === 'TRIMESTRAL' ? '/trim.' : '/año';
}

const ESTADO: Record<EstadoPago, { label: string; color: string; bg: string; border: string }> = {
  PAID:    { label: 'Pagado',    color: '#06D6A0', bg: 'rgba(6,214,160,0.10)',  border: 'rgba(6,214,160,0.25)'  },
  PENDING: { label: 'Pendiente', color: '#FFB703', bg: 'rgba(255,183,3,0.10)',  border: 'rgba(255,183,3,0.25)'  },
  OVERDUE: { label: 'Vencido',   color: '#EF476F', bg: 'rgba(239,71,111,0.10)', border: 'rgba(239,71,111,0.25)' },
  REFUNDED:{ label: 'Reembolsado', color: '#8E87A8', bg: 'rgba(142,135,168,0.10)', border: 'rgba(142,135,168,0.25)' },
};
const PLAN_BADGE: Record<TipoPlan, { label: string; color: string; bg: string }> = {
  MENSUAL:    { label: 'Mensual',    color: '#7C3AED', bg: 'rgba(124,58,237,0.12)' },
  TRIMESTRAL: { label: 'Trimestral', color: '#4361EE', bg: 'rgba(67,97,238,0.12)'  },
  ANUAL:      { label: 'Anual',      color: '#06D6A0', bg: 'rgba(6,214,160,0.12)'  },
};
const ROLE_COLOR = { ADMIN: '#FFB703', COACH: '#06D6A0' } as const;
const ROLE_LABEL = { ADMIN: 'Admin', COACH: 'Entrenador' } as const;

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  border: '1.5px solid rgba(120,80,200,0.18)',
  background: '#fff', color: '#1A1028', fontSize: 14, outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit',
};

const EASE    = [0.23, 1, 0.32, 1]  as [number, number, number, number];
const EASE_IN = [0.55, 0, 1, 0.45] as [number, number, number, number];
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.24, ease: EASE } },
};
const stagger: Variants = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.05, delayChildren: 0.03 } },
};
const expandY: Variants = {
  hidden: { opacity: 0, height: 0, overflow: 'hidden' },
  show:   { opacity: 1, height: 'auto', overflow: 'hidden', transition: { duration: 0.28, ease: EASE } },
  exit:   { opacity: 0, height: 0, overflow: 'hidden', transition: { duration: 0.20, ease: EASE_IN } },
};

function trialInfo(createdAt: string, trialEndsAt?: string | null) {
  const end = trialEndsAt
    ? new Date(trialEndsAt)
    : (() => { const d = new Date(createdAt); d.setDate(d.getDate() + 15); return d; })();
  const now = new Date();
  const totalMs = end.getTime() - new Date(createdAt).getTime();
  const remainingMs = end.getTime() - now.getTime();
  const daysLeft = Math.max(0, Math.ceil(remainingMs / 86_400_000));
  const pct = totalMs > 0 ? Math.max(0, Math.min(100, Math.round(remainingMs / totalMs * 100))) : 0;
  const urgent = daysLeft <= 3;
  if (daysLeft === 0) return { daysLeft: 0, pct: 0, label: 'Prueba vencida', color: '#EF476F', bg: 'rgba(239,71,111,0.10)', urgent: true, end };
  if (daysLeft <= 3)  return { daysLeft, pct, label: `Prueba · ${daysLeft}d`, color: '#EF476F', bg: 'rgba(239,71,111,0.10)', urgent, end };
  if (daysLeft <= 7)  return { daysLeft, pct, label: `Prueba · ${daysLeft}d`, color: '#FFB703', bg: 'rgba(255,183,3,0.10)', urgent, end };
  return { daysLeft, pct, label: `Prueba · ${daysLeft}d`, color: '#4361EE', bg: 'rgba(67,97,238,0.10)', urgent, end };
}

// ── Segmented control plan ────────────────────────────────────────────────────
function PlanSelector({ value, onChange }: { value: TipoPlan; onChange: (v: TipoPlan) => void }) {
  return (
    <div style={{ display: 'flex', background: 'rgba(120,80,200,0.07)', borderRadius: 12, padding: 3, gap: 2 }}>
      {PLAN_OPTIONS.map(opt => {
        const active = value === opt.value;
        return (
          <motion.button key={opt.value} onClick={() => onChange(opt.value)}
            whileTap={{ scale: 0.97 }} transition={{ duration: 0.12, ease: EASE }}
            style={{ flex: 1, padding: '7px 4px', border: 'none', borderRadius: 10, cursor: 'pointer',
              background: active ? '#7C3AED' : 'transparent',
              boxShadow: active ? '0 2px 10px rgba(124,58,237,0.28)' : 'none' }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: active ? '#fff' : '#8E87A8', fontFamily: 'inherit' }}>{opt.label}</p>
            <p style={{ margin: 0, fontSize: 9, fontWeight: 500, color: active ? 'rgba(255,255,255,0.70)' : 'rgba(142,135,168,0.70)' }}>{opt.sub}</p>
          </motion.button>
        );
      })}
    </div>
  );
}

// ── RoleToggle ────────────────────────────────────────────────────────────────
function RoleToggle({ value, onChange }: { value: 'ADMIN' | 'COACH'; onChange: (v: 'ADMIN' | 'COACH') => void }) {
  return (
    <div style={{ display: 'flex', background: 'rgba(120,80,200,0.07)', borderRadius: 10, padding: 2, gap: 2 }}>
      {(['ADMIN', 'COACH'] as const).map(r => {
        const active = value === r;
        return (
          <motion.button key={r} onClick={() => onChange(r)} whileTap={{ scale: 0.96 }} transition={{ duration: 0.12, ease: EASE }}
            style={{ flex: 1, padding: '5px 8px', border: 'none', borderRadius: 8, cursor: 'pointer',
              background: active ? '#fff' : 'transparent', boxShadow: active ? '0 1px 4px rgba(0,0,0,0.10)' : 'none' }}>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: active ? ROLE_COLOR[r] : '#8E87A8', fontFamily: 'inherit' }}>{ROLE_LABEL[r]}</p>
          </motion.button>
        );
      })}
    </div>
  );
}

// ── WhatsApp ────────────────────────────────────────────────────────────────
function getWhatsAppUrl(club: Club): string {
  const now = new Date();
  const admin = club.users[0]?.name ?? 'Administrador';
  let msg = '';
  if (club.trialEndsAt) {
    const ends = new Date(club.trialEndsAt);
    const expired = ends < now;
    const daysLeft = expired ? 0 : Math.ceil((ends.getTime() - now.getTime()) / 86_400_000);
    msg = expired
      ? `Hola ${admin} 👋, te escribimos de *VeloClub*.\n\nEl período de prueba gratuita del club *${club.name}* ha vencido.\n\nPara seguir disfrutando de VeloClub, activa tu plan escribiéndonos. ¡Estamos listos para ayudarte! 🚀`
      : `Hola ${admin} 👋, te escribimos de *VeloClub*.\n\nTe recordamos que el período de prueba gratuita del club *${club.name}* vence en *${daysLeft} día${daysLeft !== 1 ? 's' : ''}*.\n\nActiva tu plan antes de que expire para no perder el acceso. ¡Contáctanos! 🙌`;
  } else if (club.suscripcion) {
    const planLabel: Record<string, string> = { MENSUAL: 'Mensual', TRIMESTRAL: 'Trimestral', ANUAL: 'Anual' };
    const tipo = planLabel[club.suscripcion.tipoPlan] ?? club.suscripcion.tipoPlan;
    msg = `Hola ${admin} 👋, te escribimos de *VeloClub*.\n\nTe recordamos que el Plan *${tipo}* del club *${club.name}* está próximo a vencer.\n\nRenueva tu suscripción para mantener el acceso sin interrupciones. ¡Gracias por confiar en VeloClub! 💜`;
  } else {
    msg = `Hola ${admin} 👋, te escribimos de *VeloClub*.\n\nEl club *${club.name}* aún no tiene un plan activo en VeloClub.\n\n¿Te gustaría activar tu suscripción? Cuéntanos y te ayudamos. 🚀`;
  }
  return `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

// ════════════════════════════════════════════════════════════════════════════
//  ClubDetail — vista completa con tabs Información / Finanzas
// ════════════════════════════════════════════════════════════════════════════
interface ClubDetailProps {
  club: Club;
  suscripcion: Suscripcion | null;
  onBack: () => void;
  onReload: () => Promise<void>;
  onDeleted: () => void;
}

export default function ClubDetail({ club, suscripcion, onBack, onReload, onDeleted }: ClubDetailProps) {
  const { getToken } = useAuth();
  const [tab, setTab] = useState<'info' | 'finanzas'>('info');

  // ── Estado: edición de club / trial ─────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ clubName: '', adminName: '', adminEmail: '', adminPhone: '', deporte: '', trialDays: '' });

  // ── Estado: miembros ─────────────────────────────────────────────────────
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberForm, setMemberForm] = useState({ fullName: '', email: '', role: 'COACH' as 'ADMIN' | 'COACH' });
  const [memberSaving, setMemberSaving] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);

  // ── Estado: finanzas ─────────────────────────────────────────────────────
  const [abonoOpen, setAbonoOpen] = useState(false);
  const [abonoForm, setAbonoForm] = useState({ concepto: '', monto: '', fecha: '' });
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [editPagoId, setEditPagoId] = useState<string | null>(null);
  const [editPagoForm, setEditPagoForm] = useState({ concepto: '', monto: '', fecha: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editPlan, setEditPlan] = useState(false);
  const [editPlanMonto, setEditPlanMonto] = useState('');
  const [editTipoPlan, setEditTipoPlan] = useState<TipoPlan>('MENSUAL');
  const [savingPlan, setSavingPlan] = useState(false);
  const [receiptModal, setReceiptModal] = useState<Pago | null>(null);
  const [receiptFile, setReceiptFile] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [deletingReceipt, setDeletingReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  // ── Carga de miembros ────────────────────────────────────────────────────
  async function loadMembers() {
    setMembersLoading(true);
    try {
      const token = await getToken();
      const res = await apiFetch<{ members: Member[] }>(`/superadmin/clubs/${club.id}/miembros`, { token });
      setMembers(res.members);
    } finally { setMembersLoading(false); }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadMembers(); }, [club.id]);

  // ── Info: editar / trial / toggle / delete ───────────────────────────────
  async function startEdit() {
    const token = await getToken();
    const res = await apiFetch<{ members: Member[] }>(`/superadmin/clubs/${club.id}/miembros`, { token });
    const admin = res.members.find(m => m.role === 'ADMIN');
    setEditForm({
      clubName: club.name, adminName: admin?.fullName ?? '', adminEmail: admin?.email ?? '',
      adminPhone: admin?.phone ?? '', deporte: club.deporte ?? '', trialDays: '',
    });
    setEditing(true);
  }
  async function saveEdit() {
    if (!editForm.clubName.trim()) return;
    const token = await getToken();
    const trialDays = editForm.trialDays !== '' ? parseInt(editForm.trialDays) : undefined;
    await apiFetch(`/superadmin/clubs/${club.id}`, {
      method: 'PATCH', token,
      body: JSON.stringify({
        name: editForm.clubName, deporte: editForm.deporte || null,
        adminName: editForm.adminName || undefined, adminEmail: editForm.adminEmail || undefined,
        adminPhone: editForm.adminPhone || '',
        ...(trialDays !== undefined ? { trialDays } : {}),
      }),
    });
    setEditing(false);
    await onReload();
    await loadMembers();
  }
  async function toggleActive() {
    const token = await getToken();
    await apiFetch(`/superadmin/clubs/${club.id}/toggle`, { method: 'PATCH', token });
    await onReload();
  }
  async function verificarClub() {
    const token = await getToken();
    await apiFetch(`/superadmin/clubs/${club.id}/verificar`, { method: 'PATCH', token });
    await onReload();
  }
  async function rechazarClub() {
    const reason = prompt('Motivo del rechazo (opcional):') ?? undefined;
    const token = await getToken();
    await apiFetch(`/superadmin/clubs/${club.id}/rechazar`, { method: 'PATCH', token, body: JSON.stringify({ reason }) });
    await onReload();
  }
  async function deleteClub() {
    if (!confirm('¿Eliminar este club? Esta acción no se puede deshacer.')) return;
    const token = await getToken();
    await apiFetch(`/superadmin/clubs/${club.id}`, { method: 'DELETE', token });
    onDeleted();
  }
  async function addMember() {
    if (!memberForm.fullName || !memberForm.email) return;
    setMemberSaving(true); setMemberError(null);
    try {
      const token = await getToken();
      await apiFetch(`/superadmin/clubs/${club.id}/miembros`, { method: 'POST', token, body: JSON.stringify(memberForm) });
      setShowAddMember(false);
      setMemberForm({ fullName: '', email: '', role: 'COACH' });
      await loadMembers();
      await onReload();
    } catch (e) { setMemberError(e instanceof Error ? e.message : 'Error'); }
    finally { setMemberSaving(false); }
  }
  async function changeRole(memberId: string, role: 'ADMIN' | 'COACH') {
    const token = await getToken();
    await apiFetch(`/superadmin/clubs/${club.id}/miembros/${memberId}`, { method: 'PATCH', token, body: JSON.stringify({ role }) });
    await loadMembers();
  }
  async function removeMember(memberId: string) {
    if (!confirm('¿Quitar este miembro? Perderá acceso a la app.')) return;
    const token = await getToken();
    await apiFetch(`/superadmin/clubs/${club.id}/miembros/${memberId}`, { method: 'DELETE', token });
    await loadMembers();
    await onReload();
  }

  // ── Finanzas ──────────────────────────────────────────────────────────────
  function autoEstado(fecha: string): EstadoPago {
    if (!fecha) return 'PAID';
    const d = new Date(fecha); d.setHours(0, 0, 0, 0);
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    return d > hoy ? 'PENDING' : 'PAID';
  }
  async function registrarAbono() {
    if (!abonoForm.concepto || !abonoForm.monto) return;
    setSaving(true);
    try {
      const token = await getToken();
      await apiFetch(`/superadmin/suscripciones/${club.id}/pagos`, {
        method: 'POST', token,
        body: JSON.stringify({ concepto: abonoForm.concepto, monto: parseMiles(abonoForm.monto), fecha: abonoForm.fecha || undefined, estado: autoEstado(abonoForm.fecha) }),
      });
      setSaveSuccess(true);
      setTimeout(() => { setSaveSuccess(false); setAbonoOpen(false); setAbonoForm({ concepto: '', monto: '', fecha: '' }); }, 1200);
      await onReload();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }
  function startEditPago(p: Pago) {
    setEditPagoId(p.id);
    setEditPagoForm({ concepto: p.concepto, monto: formatMiles(String(Math.round(p.monto))), fecha: p.fecha ? p.fecha.slice(0, 10) : '' });
  }
  async function saveEditPago() {
    if (!editPagoId) return;
    setSavingEdit(true);
    try {
      const token = await getToken();
      await apiFetch(`/superadmin/suscripciones/pagos/${editPagoId}`, {
        method: 'PATCH', token,
        body: JSON.stringify({ concepto: editPagoForm.concepto, monto: parseMiles(editPagoForm.monto), fecha: editPagoForm.fecha || undefined, estado: autoEstado(editPagoForm.fecha) }),
      });
      setEditPagoId(null);
      await onReload();
    } catch (e) { console.error(e); }
    finally { setSavingEdit(false); }
  }
  async function deletePago(pagoId: string) {
    if (!confirm('¿Eliminar este abono?')) return;
    const token = await getToken();
    await apiFetch(`/superadmin/suscripciones/pagos/${pagoId}`, { method: 'DELETE', token });
    await onReload();
  }
  async function savePlanMonto() {
    if (!editPlanMonto) return;
    setSavingPlan(true);
    try {
      const token = await getToken();
      await apiFetch(`/superadmin/suscripciones/${club.id}`, {
        method: 'POST', token,
        body: JSON.stringify({ planMonto: parseMiles(editPlanMonto), tipoPlan: editTipoPlan, año: suscripcion?.año ?? new Date().getFullYear() }),
      });
      setEditPlan(false);
      await onReload();
    } catch (e) { console.error(e); }
    finally { setSavingPlan(false); }
  }
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
      const updated = await apiFetch<{ pago: Pago }>(`/superadmin/suscripciones/pagos/${receiptModal.id}/receipt`, { method: 'POST', token, body: JSON.stringify({ base64: receiptFile }) });
      setReceiptModal(updated.pago); setReceiptFile(null);
      await onReload();
    } catch (e) { setReceiptError(e instanceof Error ? e.message : 'Error al subir'); }
    finally { setUploadingReceipt(false); }
  }
  async function handleDeleteReceipt() {
    if (!receiptModal) return;
    setDeletingReceipt(true); setReceiptError(null);
    try {
      const token = await getToken();
      const updated = await apiFetch<{ pago: Pago }>(`/superadmin/suscripciones/pagos/${receiptModal.id}/receipt`, { method: 'DELETE', token });
      setReceiptModal(updated.pago);
      await onReload();
    } catch (e) { setReceiptError(e instanceof Error ? e.message : 'Error al eliminar'); }
    finally { setDeletingReceipt(false); }
  }

  // ── Derivados ─────────────────────────────────────────────────────────────
  const pagos    = suscripcion?.pagos ?? [];
  const monto    = suscripcion?.planMonto ?? 0;
  const tipo     = suscripcion?.tipoPlan ?? 'MENSUAL';
  const vig      = suscripcion ? vigencia(pagos, tipo) : null;
  const pct      = vig?.pct ?? 0;
  const vencido  = vig?.vencido ?? false;
  const pctColor = vencido ? '#EF476F' : pct >= 50 ? '#06D6A0' : pct >= 20 ? '#FFB703' : '#EF476F';
  const pb       = PLAN_BADGE[tipo];
  const trial    = !suscripcion ? trialInfo(club.createdAt, club.trialEndsAt) : null;
  const admin    = club.users[0];

  return (
    <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.28, ease: EASE }}>
      {/* ── Botón volver ── */}
      <motion.button onClick={onBack} whileTap={{ scale: 0.96 }}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#7C3AED', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: '0 0 12px' }}>
        <ArrowLeft size={16} /> Volver a clubs
      </motion.button>

      {/* ── Encabezado del club ── */}
      <div style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', borderRadius: 20, padding: '18px 16px', marginBottom: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: suscripcion ? pb.bg : trial ? trial.bg : 'rgba(124,58,237,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: suscripcion ? pb.color : trial ? trial.color : '#7C3AED', fontFamily: 'inherit', flexShrink: 0, overflow: 'hidden' }}>
            {club.logoUrl ? <img src={club.logoUrl} alt={club.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : club.name.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: '0 0 5px', fontSize: 18, fontWeight: 600, color: '#1A1028', fontFamily: 'inherit', lineHeight: 1.2, wordBreak: 'break-word' }}>{club.name}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: club.active ? 'rgba(6,214,160,0.12)' : 'rgba(239,71,111,0.12)', color: club.active ? '#06D6A0' : '#EF476F' }}>
                {club.active ? 'Activo' : 'Inactivo'}
              </span>
              {suscripcion && <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: pb.bg, color: pb.color }}>{pb.label}</span>}
              {trial && <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: trial.bg, color: trial.color }}>{trial.label}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 6, background: 'rgba(120,80,200,0.06)', borderRadius: 14, padding: 4, marginBottom: 16 }}>
        {([
          { id: 'info',     label: 'Información', Icon: Info },
          { id: 'finanzas', label: 'Finanzas',   Icon: CircleDollarSign },
        ] as const).map(t => {
          const active = tab === t.id;
          return (
            <motion.button key={t.id} onClick={() => setTab(t.id)} whileTap={{ scale: 0.98 }} transition={{ duration: 0.12 }}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                background: active ? '#fff' : 'transparent', color: active ? '#7C3AED' : '#8E87A8',
                boxShadow: active ? '0 2px 8px rgba(124,58,237,0.12)' : 'none', transition: 'color 0.15s' }}>
              <t.Icon size={15} /> {t.label}
            </motion.button>
          );
        })}
      </div>

      {/* ══════════════ TAB INFORMACIÓN ══════════════ */}
      {tab === 'info' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: EASE }}>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">

          {/* Datos / edición */}
          <div style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', borderRadius: 18, padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#7C3AED', letterSpacing: '0.02em' }}>Datos del club</p>
              {!editing && (
                <motion.button onClick={startEdit} whileTap={{ scale: 0.94 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 10, background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.15)', color: '#7C3AED', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <Pencil size={11} /> Editar
                </motion.button>
              )}
            </div>

            {editing ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {[
                  { label: 'Nombre del club',  key: 'clubName',   type: 'text',  placeholder: 'Ej: Club Patinaje Norte' },
                  { label: 'Nombre del admin', key: 'adminName',  type: 'text',  placeholder: 'Nombre completo' },
                  { label: 'Email del admin',  key: 'adminEmail', type: 'email', placeholder: 'admin@ejemplo.com' },
                ].map(({ label, key, type, placeholder }) => (
                  <div key={key} style={{ marginBottom: 8 }}>
                    <p style={{ margin: '0 0 3px', fontSize: 9, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
                    <input type={type} placeholder={placeholder} value={(editForm as Record<string, string>)[key]}
                      onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))} style={inp} />
                  </div>
                ))}
                <div style={{ marginBottom: 8 }}>
                  <p style={{ margin: '0 0 3px', fontSize: 9, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Teléfono del admin <span style={{ textTransform: 'none', fontWeight: 400 }}>(opcional)</span></p>
                  <PhoneInput value={editForm.adminPhone} onChange={v => setEditForm(f => ({ ...f, adminPhone: v }))} placeholder="300 000 0000" />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <p style={{ margin: '0 0 3px', fontSize: 9, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Deporte principal</p>
                  <SportSelect value={editForm.deporte} onChange={v => setEditForm(f => ({ ...f, deporte: v }))} placeholder="Sin especificar" />
                </div>
                {/* Período de prueba */}
                <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,183,3,0.07)', border: '1px solid rgba(255,183,3,0.20)' }}>
                  <p style={{ margin: '0 0 6px', fontSize: 9, fontWeight: 600, color: '#B88A00', letterSpacing: '0.02em' }}>Período de prueba</p>
                  {(() => {
                    if (!club.trialEndsAt) return <p style={{ margin: '0 0 8px', fontSize: 11, color: '#8E87A8' }}>Sin período de prueba asignado</p>;
                    const ends = new Date(club.trialEndsAt);
                    const expired = ends < new Date();
                    const daysLeft = expired ? 0 : Math.ceil((ends.getTime() - Date.now()) / 86_400_000);
                    return <p style={{ margin: '0 0 8px', fontSize: 11, color: expired ? '#EF476F' : '#B88A00', fontWeight: 600 }}>{expired ? `Vencido el ${ends.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}` : `${daysLeft} días restantes (vence ${ends.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })})`}</p>;
                  })()}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[15, 30, 60].map(d => (
                      <motion.button key={d} onClick={() => setEditForm(f => ({ ...f, trialDays: String(d) }))} whileTap={{ scale: 0.95 }}
                        style={{ padding: '4px 10px', borderRadius: 99, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: editForm.trialDays === String(d) ? 'none' : '1px solid rgba(255,183,3,0.30)', background: editForm.trialDays === String(d) ? '#FFB703' : 'transparent', color: editForm.trialDays === String(d) ? '#fff' : '#B88A00', fontFamily: 'inherit' }}>+{d} días</motion.button>
                    ))}
                    <motion.button onClick={() => setEditForm(f => ({ ...f, trialDays: '0' }))} whileTap={{ scale: 0.95 }}
                      style={{ padding: '4px 10px', borderRadius: 99, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: editForm.trialDays === '0' ? 'none' : '1px solid rgba(239,71,111,0.25)', background: editForm.trialDays === '0' ? '#EF476F' : 'transparent', color: editForm.trialDays === '0' ? '#fff' : '#EF476F', fontFamily: 'inherit' }}>Limpiar trial</motion.button>
                  </div>
                  {editForm.trialDays !== '' && (
                    <p style={{ margin: '6px 0 0', fontSize: 10, color: '#8E87A8' }}>{editForm.trialDays === '0' ? 'Se eliminará el período de prueba al guardar' : `Se asignarán ${editForm.trialDays} días desde hoy al guardar`}</p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <motion.button onClick={() => setEditing(false)} whileTap={{ scale: 0.97 }}
                    style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: '1.5px solid rgba(120,80,200,0.15)', background: 'transparent', color: '#8E87A8', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</motion.button>
                  <motion.button onClick={saveEdit} disabled={!editForm.clubName.trim()} whileTap={{ scale: 0.97 }}
                    style={{ flex: 2, padding: '10px 0', borderRadius: 12, border: 'none', background: '#7C3AED', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 3px 14px rgba(124,58,237,0.28)', opacity: !editForm.clubName.trim() ? 0.6 : 1 }}>Guardar cambios</motion.button>
                </div>
              </motion.div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Administrador', value: admin?.name ?? '—' },
                  { label: 'Email', value: admin?.email ?? '—' },
                  { label: 'Deporte', value: club.deporte ?? 'Sin especificar' },
                  { label: 'Miembros', value: `${club._count.members} miembro${club._count.members !== 1 ? 's' : ''}` },
                  { label: 'Creado', value: new Date(club.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ fontSize: 12, color: '#8E87A8', fontWeight: 500, flexShrink: 0 }}>{row.label}</span>
                    <span style={{ fontSize: 13, color: '#1A1028', fontWeight: 600, textAlign: 'right', wordBreak: 'break-word' }}>{row.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Miembros */}
          <div style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', borderRadius: 18, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid rgba(120,80,200,0.08)' }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#7C3AED', letterSpacing: '0.02em' }}>Admins y entrenadores</p>
              <motion.button onClick={() => { setShowAddMember(v => !v); setMemberError(null); }} whileTap={{ scale: 0.94 }}
                style={{ padding: '5px 12px', borderRadius: 10, background: showAddMember ? 'rgba(239,71,111,0.10)' : '#7C3AED', border: showAddMember ? '1px solid rgba(239,71,111,0.25)' : 'none', color: showAddMember ? '#EF476F' : '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {showAddMember ? '✕ Cerrar' : '+ Agregar'}
              </motion.button>
            </div>

            <AnimatePresence>
              {showAddMember && (
                <motion.div key="add" variants={expandY} initial="hidden" animate="show" exit="exit"
                  style={{ padding: '12px 14px', background: '#FAFAFA', borderBottom: '1px solid rgba(120,80,200,0.07)' }}>
                  <div style={{ marginBottom: 8 }}>
                    <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nombre completo</p>
                    <input type="text" value={memberForm.fullName} placeholder="Nombre completo" onChange={e => setMemberForm(f => ({ ...f, fullName: e.target.value }))} style={{ ...inp, fontSize: 13 }} />
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email</p>
                    <input type="email" value={memberForm.email} placeholder="email@ejemplo.com" onChange={e => setMemberForm(f => ({ ...f, email: e.target.value }))} style={{ ...inp, fontSize: 13 }} />
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <p style={{ margin: '0 0 6px', fontSize: 9, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rol</p>
                    <RoleToggle value={memberForm.role} onChange={r => setMemberForm(f => ({ ...f, role: r }))} />
                  </div>
                  {memberError && <p style={{ fontSize: 11, color: '#EF476F', margin: '0 0 8px' }}>{memberError}</p>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <motion.button onClick={() => { setShowAddMember(false); setMemberError(null); }} whileTap={{ scale: 0.97 }}
                      style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: '1.5px solid rgba(120,80,200,0.15)', background: 'transparent', color: '#8E87A8', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</motion.button>
                    <motion.button onClick={addMember} disabled={memberSaving || !memberForm.fullName || !memberForm.email} whileTap={{ scale: 0.97 }}
                      style={{ flex: 2, padding: '9px 0', borderRadius: 10, border: 'none', background: memberSaving ? '#A855F7' : '#7C3AED', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 2px 10px rgba(124,58,237,0.25)' }}>{memberSaving ? 'Guardando...' : 'Agregar y dar acceso'}</motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {membersLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 0' }}>
                <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#7C3AED', borderTopColor: 'transparent' }} />
              </div>
            ) : members.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '16px 0', margin: 0, fontSize: 12, color: '#8E87A8' }}>Sin admins o entrenadores aún</p>
            ) : (
              members.map((m, i) => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderTop: i > 0 ? '1px solid rgba(120,80,200,0.07)' : 'none' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0, background: m.role === 'ADMIN' ? 'linear-gradient(135deg,#FFB703,#FB8500)' : 'linear-gradient(135deg,#06D6A0,#0CB68D)' }}>
                    {m.fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#1A1028', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.fullName}</p>
                    <p style={{ margin: 0, fontSize: 10, color: '#8E87A8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</p>
                  </div>
                  <RoleToggle value={m.role} onChange={r => changeRole(m.id, r)} />
                  <motion.button onClick={() => removeMember(m.id)} whileTap={{ scale: 0.88 }}
                    style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239,71,111,0.07)', border: '1px solid rgba(239,71,111,0.18)', color: '#EF476F', cursor: 'pointer', flexShrink: 0 }}>
                    <Trash2 size={12} />
                  </motion.button>
                </div>
              ))
            )}
          </div>

          </div>

          {/* Acciones del club */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
            {/* Verificación (cola de clubes auto-registrados) */}
            {club.verificationStatus === 'PENDING' && (
              <div style={{ background: 'rgba(255,183,3,0.08)', border: '1px solid rgba(255,183,3,0.28)', borderRadius: 12, padding: 12 }}>
                <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: '#B88A00' }}>
                  Club por verificar{club.nameFlagged ? ' · nombre parecido a otro' : ''}
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <motion.button onClick={verificarClub} whileTap={{ scale: 0.97 }}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 0', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#06D6A0,#0CB68D)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    <BadgeCheck size={14} /> Verificar
                  </motion.button>
                  <motion.button onClick={rechazarClub} whileTap={{ scale: 0.97 }}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 0', borderRadius: 10, border: '1px solid rgba(239,71,111,0.20)', background: 'rgba(239,71,111,0.05)', color: '#EF476F', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Rechazar
                  </motion.button>
                </div>
              </div>
            )}
            {club.verificationStatus === 'VERIFIED' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 600, color: '#06D6A0' }}>
                <BadgeCheck size={15} /> Club verificado
              </div>
            )}
            {club.verificationStatus === 'REJECTED' && (
              <motion.button onClick={verificarClub} whileTap={{ scale: 0.97 }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 0', borderRadius: 10, border: '1px solid rgba(120,80,200,0.14)', background: 'transparent', color: '#6B6580', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                <BadgeCheck size={14} /> Rechazado — verificar de todos modos
              </motion.button>
            )}
            <motion.a href={getWhatsAppUrl(club)} target="_blank" rel="noopener noreferrer" whileTap={{ scale: 0.98 }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 0', borderRadius: 12, background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.28)', color: '#1BA147', textDecoration: 'none', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
              <MessageCircle size={15} /> Enviar recordatorio por WhatsApp
            </motion.a>
            <div style={{ display: 'flex', gap: 8 }}>
              <motion.button onClick={toggleActive} whileTap={{ scale: 0.97 }}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px 0', borderRadius: 12, border: '1px solid rgba(120,80,200,0.14)', background: 'transparent', color: '#6B6580', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                <Power size={14} /> {club.active ? 'Desactivar' : 'Activar'}
              </motion.button>
              <motion.button onClick={deleteClub} whileTap={{ scale: 0.97 }}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px 0', borderRadius: 12, border: '1px solid rgba(239,71,111,0.20)', background: 'rgba(239,71,111,0.05)', color: '#EF476F', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                <Trash2 size={14} /> Eliminar club
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}

      {/* ══════════════ TAB FINANZAS ══════════════ */}
      {tab === 'finanzas' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: EASE }}>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">

          {/* Plan y vigencia */}
          <div style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', borderRadius: 18, padding: '16px', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: '#7C3AED', letterSpacing: '0.02em' }}>Plan de suscripción</p>
                {editPlan ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <PlanSelector value={editTipoPlan} onChange={setEditTipoPlan} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <div style={{ flex: 1, position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, fontWeight: 600, color: '#8E87A8', pointerEvents: 'none' }}>$</span>
                        <MoneyInput value={editPlanMonto} onChange={setEditPlanMonto} placeholder="0" style={{ ...inp, paddingLeft: 24 }} />
                      </div>
                      <motion.button onClick={savePlanMonto} disabled={savingPlan} whileTap={{ scale: 0.94 }}
                        style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(6,214,160,0.12)', color: '#06D6A0', border: '1.5px solid rgba(6,214,160,0.25)', cursor: 'pointer', flexShrink: 0 }}><Check size={16} /></motion.button>
                      <motion.button onClick={() => setEditPlan(false)} whileTap={{ scale: 0.94 }}
                        style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239,71,111,0.08)', color: '#EF476F', border: '1.5px solid rgba(239,71,111,0.20)', cursor: 'pointer', flexShrink: 0 }}><X size={16} /></motion.button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.button onClick={() => { setEditPlan(true); setEditPlanMonto(formatMiles(String(Math.round(monto)))); setEditTipoPlan(tipo); }} whileTap={{ scale: 0.97 }}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: suscripcion ? '#1A1028' : '#8E87A8', fontFamily: 'inherit' }}>
                      {suscripcion ? `${fmt.format(monto)}` : 'Sin plan'}
                    </span>
                    {suscripcion && <span style={{ fontSize: 12, color: '#8E87A8' }}>{planSuffix(tipo)}</span>}
                    <Pencil size={11} color="#C4BFD8" />
                  </motion.button>
                )}
                {!suscripcion && !editPlan && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#8E87A8' }}>Toca para configurar el plan</p>}
              </div>

              {suscripcion && (
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: pctColor, fontFamily: 'inherit', lineHeight: 1 }}>{pct}%</p>
                  <p style={{ margin: '2px 0 0', fontSize: 9, fontWeight: 600, color: pctColor, whiteSpace: 'nowrap' }}>{vencido ? 'Vencido' : vig ? `${vig.diasRestantes}d restantes` : ''}</p>
                </div>
              )}
            </div>

            {/* Barra vigencia */}
            {suscripcion && (
              <div style={{ marginTop: 14, height: 7, borderRadius: 99, background: 'rgba(120,80,200,0.08)', overflow: 'hidden' }}>
                <motion.div style={{ height: '100%', borderRadius: 99, background: pctColor }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: EASE, delay: 0.15 }} />
              </div>
            )}

            {/* Estado de prueba (sin plan) */}
            {trial && (
              <div style={{ marginTop: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: '#8E87A8', fontWeight: 500 }}>Período de prueba</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: trial.color }}>{trial.daysLeft} días</span>
                </div>
                <div style={{ height: 7, borderRadius: 99, background: 'rgba(120,80,200,0.08)', overflow: 'hidden' }}>
                  <motion.div style={{ height: '100%', borderRadius: 99, background: trial.urgent ? 'linear-gradient(90deg,#EF476F,#F72585)' : trial.daysLeft <= 7 ? 'linear-gradient(90deg,#FFB703,#FB8500)' : 'linear-gradient(90deg,#4361EE,#7C3AED)' }} initial={{ width: 0 }} animate={{ width: `${trial.pct}%` }} transition={{ duration: 0.8, ease: EASE, delay: 0.15 }} />
                </div>
                <p style={{ margin: '8px 0 0', fontSize: 11, color: '#8E87A8' }}>Vence el {trial.end.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
            )}
          </div>

          {/* Historial de abonos */}
          <div style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', borderRadius: 18, padding: '16px', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
            <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 600, color: '#7C3AED', letterSpacing: '0.02em' }}>
              Historial de abonos
            </p>
            {pagos.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '16px 0', margin: 0, fontSize: 12, color: '#8E87A8' }}>Sin abonos registrados aún</p>
            ) : (
              <motion.div variants={stagger} initial="hidden" animate="show" style={{ display: 'flex', flexDirection: 'column' }}>
                {pagos.map((p, i) => {
                  const st = ESTADO[p.estado];
                  return (
                    <motion.div key={p.id} variants={fadeUp}>
                      <AnimatePresence mode="wait">
                        {editPagoId === p.id ? (
                          <motion.div key="edit" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2, ease: EASE }}
                            style={{ background: '#F7F5FF', border: '1.5px solid rgba(124,58,237,0.15)', borderRadius: 14, padding: 14, margin: i > 0 ? '10px 0 0' : 0 }}>
                            <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 600, color: '#7C3AED' }}>Editar abono</p>
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
                                <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fecha pago</p>
                                <DatePicker value={editPagoForm.fecha} onChange={v => setEditPagoForm(f => ({ ...f, fecha: v }))} />
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <motion.button onClick={() => setEditPagoId(null)} whileTap={{ scale: 0.97 }}
                                style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: '1.5px solid rgba(120,80,200,0.15)', background: 'transparent', color: '#8E87A8', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</motion.button>
                              <motion.button onClick={saveEditPago} disabled={savingEdit} whileTap={{ scale: 0.97 }}
                                style={{ flex: 2, padding: '10px 0', borderRadius: 12, border: 'none', background: '#7C3AED', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 3px 12px rgba(124,58,237,0.28)' }}>{savingEdit ? 'Guardando...' : 'Guardar cambios'}</motion.button>
                            </div>
                          </motion.div>
                        ) : (
                          <motion.div key="row" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderTop: i > 0 ? '1px solid rgba(120,80,200,0.08)' : 'none' }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: st.color, flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1A1028', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.concepto}</p>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                                <CalendarClock size={9} color="#8E87A8" />
                                <span style={{ fontSize: 10, color: '#8E87A8' }}>{p.fecha ? new Date(p.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Sin fecha'}</span>
                              </div>
                            </div>
                            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                              <div style={{ textAlign: 'right' }}>
                                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: st.color, fontFamily: 'inherit', lineHeight: 1 }}>{fmt.format(p.monto)}</p>
                                <span style={{ display: 'inline-block', marginTop: 3, fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: st.bg, color: st.color }}>{st.label}</span>
                              </div>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <motion.button onClick={() => { setReceiptModal(p); setReceiptFile(null); setReceiptError(null); }} whileTap={{ scale: 0.88 }} title={p.receiptUrl ? 'Ver comprobante' : 'Subir comprobante'}
                                  style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: p.receiptUrl ? 'rgba(6,214,160,0.10)' : 'rgba(120,80,200,0.07)', border: `1px solid ${p.receiptUrl ? 'rgba(6,214,160,0.28)' : 'rgba(120,80,200,0.15)'}`, color: p.receiptUrl ? '#06D6A0' : '#8E87A8', cursor: 'pointer' }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                                </motion.button>
                                <motion.button onClick={() => startEditPago(p)} whileTap={{ scale: 0.88 }}
                                  style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)', color: '#7C3AED', cursor: 'pointer' }}><Pencil size={11} /></motion.button>
                                <motion.button onClick={() => deletePago(p.id)} whileTap={{ scale: 0.88 }}
                                  style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239,71,111,0.08)', border: '1px solid rgba(239,71,111,0.18)', color: '#EF476F', cursor: 'pointer' }}><Trash2 size={11} /></motion.button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </div>

          </div>

          {/* Registrar abono */}
          <div style={{ marginTop: 14 }} />
          <AnimatePresence mode="wait">
            {abonoOpen ? (
              <motion.div key="form" variants={expandY} initial="hidden" animate="show" exit="exit"
                style={{ background: '#F7F5FF', border: '1.5px solid rgba(124,58,237,0.15)', borderRadius: 16, padding: 16 }}>
                <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 600, color: '#1A1028', fontFamily: 'inherit' }}>Registrar abono</p>
                <div style={{ marginBottom: 10 }}>
                  <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Concepto</p>
                  <input type="text" placeholder="Ej: Cuota Mayo" value={abonoForm.concepto} onChange={e => setAbonoForm(f => ({ ...f, concepto: e.target.value }))} style={inp} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                  <div>
                    <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Monto</p>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#8E87A8', pointerEvents: 'none' }}>$</span>
                      <MoneyInput value={abonoForm.monto} onChange={v => setAbonoForm(f => ({ ...f, monto: v }))} placeholder="0" style={{ ...inp, paddingLeft: 22 }} />
                    </div>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fecha pago</p>
                    <DatePicker value={abonoForm.fecha} onChange={v => setAbonoForm(f => ({ ...f, fecha: v }))} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <motion.button onClick={() => { setAbonoOpen(false); setAbonoForm({ concepto: '', monto: '', fecha: '' }); }} whileTap={{ scale: 0.97 }}
                    style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: '1.5px solid rgba(120,80,200,0.15)', background: 'transparent', color: '#8E87A8', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</motion.button>
                  <motion.button onClick={registrarAbono} disabled={saving || saveSuccess} whileTap={saveSuccess ? {} : { scale: 0.95 }}
                    animate={saveSuccess ? { scale: [1, 1.06, 1], transition: { duration: 0.35 } } : {}}
                    style={{ flex: 2, padding: '11px 0', borderRadius: 12, border: 'none', cursor: saving || saveSuccess ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 12, color: '#fff', boxShadow: saveSuccess ? '0 4px 14px rgba(6,214,160,0.40)' : '0 4px 14px rgba(124,58,237,0.32)', background: saveSuccess ? '#06D6A0' : 'linear-gradient(135deg,#7C3AED,#4361EE)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <AnimatePresence mode="wait" initial={false}>
                      {saveSuccess ? (
                        <motion.span key="ok" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} transition={{ duration: 0.2 }} style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Check size={14} /> ¡Registrado!</motion.span>
                      ) : saving ? (
                        <motion.span key="saving" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>Guardando...</motion.span>
                      ) : (
                        <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>Registrar abono</motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                </div>
              </motion.div>
            ) : (
              <motion.button key="btn" onClick={() => setAbonoOpen(true)} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.97 }} transition={{ duration: 0.14, ease: EASE }}
                style={{ width: '100%', padding: '13px 0', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#7C3AED,#4361EE)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(124,58,237,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <TrendingUp size={14} /> Registrar abono
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ── Modal comprobante ── */}
      <AnimatePresence>
        {receiptModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
              onClick={() => { setReceiptModal(null); setReceiptFile(null); setReceiptError(null); }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(26,16,40,0.55)', zIndex: 100, backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <motion.div onClick={e => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={{ duration: 0.24, ease: EASE }}
              style={{ width: '100%', maxWidth: 440, maxHeight: '85vh', overflowY: 'auto', background: '#fff', borderRadius: 20, padding: '22px 20px', boxShadow: '0 20px 60px rgba(80,40,180,0.25)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#1A1028', fontFamily: 'inherit' }}>Comprobante de pago</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#8E87A8' }}>{receiptModal.concepto}</p>
                </div>
                <motion.button onClick={() => { setReceiptModal(null); setReceiptFile(null); setReceiptError(null); }} whileTap={{ scale: 0.90 }}
                  style={{ width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(120,80,200,0.08)', border: '1px solid rgba(120,80,200,0.15)', color: '#8E87A8', cursor: 'pointer' }}><X size={14} /></motion.button>
              </div>
              {(receiptFile || receiptModal.receiptUrl) && (
                <div style={{ borderRadius: 14, overflow: 'hidden', border: '1.5px solid rgba(124,58,237,0.15)', marginBottom: 12, maxHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F5FF' }}>
                  <img src={receiptFile ?? receiptModal.receiptUrl!} alt="Comprobante" style={{ width: '100%', maxHeight: 220, objectFit: 'contain' }} />
                </div>
              )}
              {!receiptModal.receiptUrl && !receiptFile && (
                <div style={{ borderRadius: 14, border: '2px dashed rgba(124,58,237,0.20)', padding: '28px 16px', textAlign: 'center', marginBottom: 12, background: 'rgba(124,58,237,0.03)' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(124,58,237,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                  <p style={{ margin: 0, fontSize: 12, color: '#8E87A8', fontWeight: 500 }}>Sin comprobante adjunto</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#C4BFD8' }}>Sube una imagen del recibo de pago</p>
                </div>
              )}
              {receiptError && <p style={{ margin: '0 0 10px', fontSize: 11, color: '#EF476F', textAlign: 'center' }}>{receiptError}</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ display: 'block', cursor: 'pointer' }}>
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleReceiptFileChange} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 0', borderRadius: 12, border: '1.5px solid rgba(124,58,237,0.25)', background: 'rgba(124,58,237,0.05)', color: '#7C3AED', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
                    {receiptModal.receiptUrl ? <RotateCcw size={14} /> : <Upload size={14} />}
                    {receiptModal.receiptUrl ? 'Reemplazar comprobante' : 'Seleccionar imagen'}
                  </div>
                </label>
                {receiptFile && (
                  <motion.button onClick={handleUploadReceipt} disabled={uploadingReceipt} whileTap={{ scale: 0.97 }}
                    style={{ width: '100%', padding: '12px 0', borderRadius: 12, border: 'none', background: uploadingReceipt ? '#A855F7' : '#7C3AED', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 3px 14px rgba(124,58,237,0.30)' }}>{uploadingReceipt ? 'Subiendo...' : 'Confirmar y guardar'}</motion.button>
                )}
                {receiptModal.receiptUrl && !receiptFile && (
                  <motion.button onClick={() => window.open(receiptModal.receiptUrl!, '_blank')} whileTap={{ scale: 0.97 }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '11px 0', borderRadius: 12, border: '1.5px solid rgba(6,214,160,0.30)', background: 'rgba(6,214,160,0.07)', color: '#06D6A0', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}><Eye size={14} /> Ver comprobante completo</motion.button>
                )}
                {receiptModal.receiptUrl && !receiptFile && (
                  <motion.button onClick={handleDeleteReceipt} disabled={deletingReceipt} whileTap={{ scale: 0.97 }}
                    style={{ width: '100%', padding: '11px 0', borderRadius: 12, border: '1.5px solid rgba(239,71,111,0.22)', background: 'rgba(239,71,111,0.06)', color: '#EF476F', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{deletingReceipt ? 'Eliminando...' : 'Eliminar comprobante'}</motion.button>
                )}
              </div>
            </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
