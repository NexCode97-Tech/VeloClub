'use client';

import { useAuth } from '@clerk/nextjs';
import { useClubStream } from '@/hooks/useClubStream';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useMemo } from 'react';
import { apiFetch } from '@/lib/api-client';
import { QK } from '@/hooks/useVeloQuery';
import {
  CreditCard, Plus, Trash2, CheckCircle2, Clock, AlertCircle,
  TrendingUp, TrendingDown, Wallet, Download, MessageCircle, Check,
  PhoneOff, Settings, Zap, ChevronUp, Pencil,
} from 'lucide-react';
import { downloadInvoicePDF } from '@/lib/pdf';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion';

const fmt = new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0,
});

const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

const STATUS_LABELS: Record<string, string> = {
  PAID: 'Pagado', PENDING: 'Pendiente', OVERDUE: 'Vencido', REFUNDED: 'Reembolsado',
};
const STATUS_COLORS: Record<string, { text: string; bg: string; icon: React.ElementType }> = {
  PAID:     { text: '#06D6A0', bg: 'rgba(6,214,160,0.12)',   icon: CheckCircle2 },
  PENDING:  { text: '#FFB703', bg: 'rgba(255,183,3,0.12)',   icon: Clock },
  OVERDUE:  { text: '#EF476F', bg: 'rgba(239,71,111,0.12)',  icon: AlertCircle },
  REFUNDED: { text: '#8E87A8', bg: 'rgba(142,135,168,0.12)', icon: CreditCard },
};

const listVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.02 } },
};
const rowVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.23, 1, 0.32, 1] as [number,number,number,number] } },
};
const EASE_OUT: [number,number,number,number] = [0.23, 1, 0.32, 1];

function buildWhatsAppUrl(phone: string, memberName: string, amount: number, month: number, year: number, clubName: string) {
  const clean = phone.replace(/\D/g, '');
  const normalized = clean.startsWith('57') ? clean : `57${clean}`;
  const text = encodeURIComponent(
    `Hola, soy del ${clubName}. Le recordamos que la mensualidad de ${memberName} de ${MONTH_NAMES[month - 1]} ${year} por ${fmt.format(amount)} está pendiente. Por favor comuníquese con nosotros. ¡Gracias!`
  );
  return `https://wa.me/${normalized}?text=${text}`;
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

interface Member {
  id: string; fullName: string; role: string;
  phone?: string; emergencyPhone?: string;
  monthlyFee?: number | null; paymentDueDay?: number | null;
}
interface Payment {
  id: string; memberId: string; amount: number;
  month: number; year: number; status: string;
  paidAt?: string; notes?: string;
  member: { id: string; fullName: string; email?: string; phone?: string };
}
interface CashEntry {
  id: string; type: 'INCOME' | 'EXPENSE'; amount: number;
  description: string; date: string; paymentId?: string | null;
}

const now = new Date();

// ─── Componente de fila con inline config ─────────────────────────────────────
interface StudentRowProps {
  member: Member;
  payment: Payment | null;
  clubName: string;
  filterMonth: number;
  filterYear: number;
  reducedMotion: boolean | null;
  sentWa: Set<string>;
  onSentWa: (key: string) => void;
  onMarkPaid: (id: string) => void;
  onGenerate: (memberId: string, amount: number) => void;
  onDeletePay: (id: string) => void;
  generating: boolean;
  deleting: boolean;
  marking: boolean;
  onConfigSave: (memberId: string, fullName: string, monthlyFee: number, paymentDueDay: number) => void;
  configSaving: boolean;
}

function StudentRow({
  member: m, payment, clubName, filterMonth, filterYear,
  reducedMotion, sentWa, onSentWa, onMarkPaid, onGenerate, onDeletePay,
  generating, deleting, marking, onConfigSave, configSaving,
}: StudentRowProps) {
  const configured = !!(m.monthlyFee && m.paymentDueDay);
  const [configOpen, setConfigOpen] = useState(false);
  const [feeInput, setFeeInput] = useState('');
  const [dayInput, setDayInput] = useState('');

  const sc = payment ? (STATUS_COLORS[payment.status] ?? STATUS_COLORS.PENDING) : null;
  const StatusIcon = sc?.icon;
  const isPendingOrOverdue = payment && payment.status !== 'PAID' && payment.status !== 'REFUNDED';
  const contactPhone = m.emergencyPhone || m.phone;
  const waKey = `${m.id}-${filterMonth}-${filterYear}`;
  const wasSent = sentWa.has(waKey);
  const avatarColor = sc ? sc.text : '#8E87A8';

  function openConfig() {
    setFeeInput(m.monthlyFee ? String(m.monthlyFee) : '');
    setDayInput(m.paymentDueDay ? String(m.paymentDueDay) : '');
    setConfigOpen(v => !v);
  }

  function handleSaveConfig() {
    const fee = parseFloat(feeInput.replace(/\./g, '').replace(',', '.'));
    const day = parseInt(dayInput);
    if (!fee || !day || day < 1 || day > 31) return;
    onConfigSave(m.id, m.fullName, fee, day);
    setConfigOpen(false);
  }

  return (
    <motion.div variants={reducedMotion ? undefined : rowVariants} layout>
      {/* Fila principal — dos filas internas para evitar que el chip se parta */}
      <div className="bg-white border border-border rounded-xl px-4 py-3">
        {/* Fila superior: avatar + nombre + botones icono */}
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-[11px] shrink-0"
            style={{ background: avatarColor }}
          >
            {getInitials(m.fullName)}
          </div>

          {/* Nombre */}
          <p className="text-[13px] font-bold text-foreground truncate flex-1 min-w-0">{m.fullName}</p>

          {/* Botones icono + texto compactos */}
          <div className="flex items-center gap-1 shrink-0">
            {/* WhatsApp */}
            {isPendingOrOverdue && (
              <motion.button
                onClick={() => contactPhone && (window.open(buildWhatsAppUrl(contactPhone, m.fullName, payment!.amount, filterMonth, filterYear, clubName), '_blank'), onSentWa(waKey))}
                disabled={!contactPhone}
                whileTap={contactPhone && !reducedMotion ? { scale: 0.95 } : {}}
                transition={{ duration: 0.12, ease: EASE_OUT }}
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                title={contactPhone ? 'Recordar por WhatsApp' : 'Sin número de contacto'}
                style={{
                  background: !contactPhone ? 'rgba(142,135,168,0.10)' : wasSent ? 'rgba(6,214,160,0.15)' : 'rgba(37,211,102,0.12)',
                  cursor: contactPhone ? 'pointer' : 'not-allowed',
                }}
              >
                <AnimatePresence mode="wait">
                  {wasSent
                    ? <motion.span key="ok" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ duration: 0.15 }}><Check className="w-3.5 h-3.5" style={{ color: '#06D6A0' }} /></motion.span>
                    : contactPhone
                    ? <motion.span key="wa" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ duration: 0.15 }}><MessageCircle className="w-3.5 h-3.5" style={{ color: '#25D366' }} /></motion.span>
                    : <motion.span key="no"><PhoneOff className="w-3.5 h-3.5" style={{ color: '#8E87A8' }} /></motion.span>
                  }
                </AnimatePresence>
              </motion.button>
            )}

            {/* Descargar factura */}
            {payment && (
              <button
                onClick={() => downloadInvoicePDF({ ...payment, memberName: m.fullName }, clubName)}
                className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground cursor-pointer"
                title="Descargar factura"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Eliminar pago */}
            {payment && (
              <button
                onClick={() => onDeletePay(payment.id)}
                disabled={deleting}
                className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-red-400 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Configurar tarifa */}
            <button
              onClick={openConfig}
              className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer"
              title="Configurar tarifa"
              style={{ background: configOpen ? 'rgba(124,58,237,0.12)' : 'rgba(142,135,168,0.08)' }}
            >
              {configOpen
                ? <ChevronUp className="w-3.5 h-3.5" style={{ color: '#7C3AED' }} />
                : <Settings className="w-3.5 h-3.5" style={{ color: '#8E87A8' }} />
              }
            </button>
          </div>
        </div>

        {/* Fila 2: fecha de cobro */}
        {configured && m.paymentDueDay && (
          <p className="text-[10px] font-semibold text-muted-foreground mt-1.5 ml-12">
            Cobro el día {m.paymentDueDay} de cada mes
          </p>
        )}

        {/* Fila 3: chip de estado + botón Cobrar/Pagado */}
        <div className="flex items-center gap-2 mt-1.5 ml-12">
          <div className="flex-1 min-w-0">
            {payment && sc && StatusIcon ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap" style={{ background: sc.bg, color: sc.text }}>
                <StatusIcon className="w-2.5 h-2.5 shrink-0" />
                {STATUS_LABELS[payment.status]} · {fmt.format(payment.amount)}
              </span>
            ) : configured ? (
              <span className="inline-block text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap" style={{ background: 'rgba(142,135,168,0.10)', color: '#8E87A8' }}>
                Sin cobro · {fmt.format(m.monthlyFee!)}
              </span>
            ) : (
              <span className="inline-block text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: 'rgba(142,135,168,0.08)', color: '#8E87A8' }}>
                Sin configurar
              </span>
            )}
          </div>

          {/* Flujo: Sin pago → Cobrar (crea PENDING) → Pagado (marca PAID) */}
          {payment?.status === 'PAID' ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0" style={{ background: 'rgba(6,214,160,0.12)', color: '#06D6A0' }}>
              <Check className="w-3 h-3" /> Pagado
            </span>
          ) : isPendingOrOverdue ? (
            <button
              onClick={() => !marking && onMarkPaid(payment!.id)}
              disabled={marking}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer disabled:opacity-50 shrink-0"
              style={{ background: 'rgba(67,97,238,0.12)', color: '#4361EE' }}
            >
              {marking ? '...' : 'Pagado'}
            </button>
          ) : configured && !payment ? (
            <button
              onClick={() => !generating && onGenerate(m.id, m.monthlyFee!)}
              disabled={generating}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer disabled:opacity-50 shrink-0"
              style={{ background: 'rgba(6,214,160,0.12)', color: '#06D6A0' }}
            >
              {generating ? '...' : 'Cobrar'}
            </button>
          ) : null}
        </div>
      </div>

      {/* Panel inline de configuración */}
      <AnimatePresence>
        {configOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <div
              className="mx-1 mb-1 px-4 py-3 rounded-b-xl flex items-end gap-3 flex-wrap"
              style={{ background: 'rgba(124,58,237,0.04)', border: '1px solid rgba(124,58,237,0.10)', borderTop: 'none' }}
            >
              <div className="flex-1 min-w-[120px]">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground block mb-1">Tarifa mensual</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-bold" style={{ color: '#7C3AED' }}>$</span>
                  <input
                    className="w-full pl-6 pr-3 h-9 rounded-lg border border-border text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
                    placeholder="0"
                    value={feeInput ? Number(feeInput).toLocaleString('es-CO') : ''}
                    onChange={e => setFeeInput(e.target.value.replace(/\./g, '').replace(/\D/g, ''))}
                  />
                </div>
              </div>
              <div className="w-24">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground block mb-1">Día de cobro</label>
                <input
                  type="number" min={1} max={31}
                  className="w-full px-3 h-9 rounded-lg border border-border text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
                  placeholder="ej. 5"
                  value={dayInput}
                  onChange={e => setDayInput(e.target.value)}
                />
              </div>
              <button
                onClick={handleSaveConfig}
                disabled={configSaving || !feeInput || !dayInput}
                className="h-9 px-4 rounded-lg text-[12px] font-bold text-white cursor-pointer disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#7C3AED,#4361EE)' }}
              >
                {configSaving ? '...' : 'Guardar'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function FinanzasPage() {
  const { getToken } = useAuth();
  const reducedMotion = useReducedMotion();
  const qc = useQueryClient();

  const [tab, setTab]             = useState<'mensualidades' | 'flujo'>('mensualidades');
  const [clubName, setClubName]   = useState('VeloClub');
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear]   = useState(now.getFullYear());
  const [sentWa, setSentWa]       = useState<Set<string>>(new Set());

  // UI state
  const [generatingMonth, setGeneratingMonth] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL'|'PAID'|'PENDING'|'NONE'>('ALL');
  const [generatingPay, setGeneratingPay]     = useState<string | null>(null);
  const [deletingPay, setDeletingPay]         = useState<string | null>(null);
  const [markingPaid, setMarkingPaid]         = useState<string | null>(null);
  const [configSaving, setConfigSaving]       = useState<string | null>(null);
  const [payOpen, setPayOpen]                 = useState(false);
  const [payForm, setPayForm]                 = useState({
    memberId: '', amount: '', month: String(now.getMonth() + 1),
    year: String(now.getFullYear()), status: 'PAID', notes: '',
  });
  const [savingPay, setSavingPay]   = useState(false);
  const [payError, setPayError]     = useState<string | null>(null);
  const [flowOpen, setFlowOpen]     = useState(false);
  const [flowForm, setFlowForm]     = useState({ type: 'INCOME', amount: '', description: '', date: '' });
  const [savingFlow, setSavingFlow] = useState(false);
  const [flowError, setFlowError]   = useState<string | null>(null);
  const [deletingFlow, setDeletingFlow] = useState<string | null>(null);
  const [editFlowEntry, setEditFlowEntry] = useState<CashEntry | null>(null);
  const [editFlowForm, setEditFlowForm] = useState({ type: 'INCOME', amount: '', description: '', date: '' });
  const [savingEditFlow, setSavingEditFlow] = useState(false);
  const [editFlowError, setEditFlowError] = useState<string | null>(null);

  // ── Datos con caché ──────────────────────────────────────────────────────────
  const { data: membersData } = useQuery({
    queryKey: QK.members(),
    queryFn: async () => { const token = await getToken(); return apiFetch<{ members: Member[] }>('/members', { token }); },
  });
  const { data: paymentsData, isLoading: loadingPay } = useQuery({
    queryKey: QK.payments(filterMonth, filterYear),
    queryFn: async () => { const token = await getToken(); return apiFetch<{ payments: Payment[] }>(`/payments?month=${filterMonth}&year=${filterYear}`, { token }); },
  });
  const { data: cashflowData, isLoading: loadingFlow } = useQuery({
    queryKey: QK.cashflow(filterMonth, filterYear),
    queryFn: async () => { const token = await getToken(); return apiFetch<{ entries: CashEntry[] }>(`/cashflow?month=${filterMonth}&year=${filterYear}`, { token }); },
  });

  const allMembers = membersData?.members  ?? [];
  const payments   = paymentsData?.payments ?? [];
  const entries    = cashflowData?.entries  ?? [];

  useEffect(() => {
    getToken().then(token =>
      apiFetch<{ club: { name: string } }>('/clubs/settings', { token })
        .then(r => setClubName(r.club.name)).catch(() => {})
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useClubStream((ev) => {
    if (ev === 'payments') qc.invalidateQueries({ queryKey: ['payments'] });
    if (ev === 'cashflow') qc.invalidateQueries({ queryKey: ['cashflow'] });
    if (ev === 'members')  qc.invalidateQueries({ queryKey: QK.members() });
  });

  // ── Vista unificada de deportistas ───────────────────────────────────────────
  const studentRows = useMemo(() => {
    const students = allMembers.filter(m => m.role === 'STUDENT');
    return students.map(m => {
      // Busca el pago más relevante del mes (OVERDUE > PENDING > PAID > primero)
      const monthPayments = payments.filter(p => p.memberId === m.id);
      const pay = monthPayments.find(p => p.status === 'OVERDUE')
               ?? monthPayments.find(p => p.status === 'PENDING')
               ?? monthPayments[0]
               ?? null;
      const configured = !!(m.monthlyFee && m.paymentDueDay);
      return { member: m, payment: pay, configured };
    }).sort((a, b) => {
      const order: Record<string, number> = { OVERDUE: 0, PENDING: 1, NONE_CFG: 2, NONE: 3, PAID: 4 };
      const keyA = !a.payment
        ? (a.configured ? 'NONE_CFG' : 'NONE')
        : a.payment.status;
      const keyB = !b.payment
        ? (b.configured ? 'NONE_CFG' : 'NONE')
        : b.payment.status;
      return (order[keyA] ?? 5) - (order[keyB] ?? 5);
    });
  }, [allMembers, payments]);

  // ── Invalidadores ────────────────────────────────────────────────────────────
  const invalidatePay  = () => qc.invalidateQueries({ queryKey: QK.payments(filterMonth, filterYear) });
  const invalidateFlow = () => qc.invalidateQueries({ queryKey: QK.cashflow(filterMonth, filterYear) });

  // ── Lista filtrada por estado ─────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    if (statusFilter === 'ALL') return studentRows;
    if (statusFilter === 'PAID')    return studentRows.filter(r => r.payment?.status === 'PAID');
    if (statusFilter === 'PENDING') return studentRows.filter(r => r.payment && r.payment.status !== 'PAID');
    if (statusFilter === 'NONE')    return studentRows.filter(r => !r.payment);
    return studentRows;
  }, [studentRows, statusFilter]);

  // ── Resumen ──────────────────────────────────────────────────────────────────
  const totalPaid    = payments.filter(p => p.status === 'PAID').reduce((s, p) => s + p.amount, 0);
  const totalPending = payments.filter(p => p.status !== 'PAID').reduce((s, p) => s + p.amount, 0);
  const countPaid    = studentRows.filter(r => r.payment?.status === 'PAID').length;
  const countPending = studentRows.filter(r => r.payment && r.payment.status !== 'PAID').length;
  const countNone    = studentRows.filter(r => !r.payment && r.configured).length;

  // ── Acciones de mensualidades ────────────────────────────────────────────────
  async function handleGenerateMonth() {
    setGeneratingMonth(true);
    try {
      const token = await getToken();
      const res = await apiFetch<{ created: number; skipped: number }>('/payments/generate-month', {
        method: 'POST', token,
        body: JSON.stringify({ month: filterMonth, year: filterYear }),
      });
      invalidatePay();
      if (res.created === 0) alert(`Todos los cobros del mes ya estaban generados (${res.skipped} omitidos).`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al generar cobros');
    } finally {
      setGeneratingMonth(false);
    }
  }

  async function handleMarkPaid(id: string) {
    if (markingPaid === id) return;
    setMarkingPaid(id);
    try {
      const token = await getToken();
      await apiFetch(`/payments/${id}`, { method: 'PATCH', token, body: JSON.stringify({ status: 'PAID' }) });
      invalidatePay(); invalidateFlow();
    } finally { setMarkingPaid(null); }
  }

  async function handleDeletePay(id: string) {
    if (!confirm('¿Eliminar este cobro?')) return;
    setDeletingPay(id);
    try {
      const token = await getToken();
      await apiFetch(`/payments/${id}`, { method: 'DELETE', token });
      invalidatePay(); invalidateFlow();
    } finally { setDeletingPay(null); }
  }

  async function handleGeneratePending(memberId: string, amount: number) {
    setGeneratingPay(memberId);
    try {
      const token = await getToken();
      await apiFetch('/payments', {
        method: 'POST', token,
        body: JSON.stringify({ memberId, amount, month: filterMonth, year: filterYear, status: 'PENDING' }),
      });
      invalidatePay();
    } catch (e) { console.error(e); }
    finally { setGeneratingPay(null); }
  }

  async function handleConfigSave(memberId: string, fullName: string, monthlyFee: number, paymentDueDay: number) {
    setConfigSaving(memberId);
    try {
      const token = await getToken();
      await apiFetch(`/members/${memberId}`, {
        method: 'PUT', token,
        body: JSON.stringify({ fullName, monthlyFee, paymentDueDay }),
      });
      qc.invalidateQueries({ queryKey: QK.members() });
    } catch (e) {
      console.error('Error al guardar config:', e);
    } finally { setConfigSaving(null); }
  }

  async function handleSavePay() {
    if (!payForm.memberId || !payForm.amount) return;
    setSavingPay(true); setPayError(null);
    try {
      const token = await getToken();
      const created = await apiFetch<{ payment: Payment }>('/payments', {
        method: 'POST', token,
        body: JSON.stringify({
          memberId: payForm.memberId, amount: parseFloat(payForm.amount),
          month: parseInt(payForm.month), year: parseInt(payForm.year),
          status: payForm.status, notes: payForm.notes || undefined,
        }),
      });
      setPayOpen(false);
      invalidatePay(); invalidateFlow();
      const memberName = allMembers.find(m => m.id === payForm.memberId)?.fullName ?? '';
      if (created.payment.status === 'PAID') {
        downloadInvoicePDF({ ...created.payment, memberName }, clubName);
      }
    } catch (e) { setPayError(e instanceof Error ? e.message : 'Error'); }
    finally { setSavingPay(false); }
  }

  // ── Flujo de caja ────────────────────────────────────────────────────────────
  const totalIncome  = entries.filter(e => e.type === 'INCOME').reduce((s, e) => s + e.amount, 0);
  const totalExpense = entries.filter(e => e.type === 'EXPENSE').reduce((s, e) => s + e.amount, 0);
  const balance      = totalIncome - totalExpense;

  async function handleSaveFlow() {
    if (!flowForm.amount || !flowForm.description) return;
    setSavingFlow(true); setFlowError(null);
    try {
      const token = await getToken();
      await apiFetch('/cashflow', {
        method: 'POST', token,
        body: JSON.stringify({ type: flowForm.type, amount: parseFloat(flowForm.amount), description: flowForm.description, date: flowForm.date || undefined }),
      });
      setFlowOpen(false);
      setFlowForm({ type: 'INCOME', amount: '', description: '', date: '' });
      invalidateFlow();
    } catch (e) { setFlowError(e instanceof Error ? e.message : 'Error'); }
    finally { setSavingFlow(false); }
  }

  function openEditFlow(e: CashEntry) {
    setEditFlowEntry(e);
    setEditFlowForm({
      type: e.type,
      amount: String(e.amount),
      description: e.description,
      date: e.date ? e.date.split('T')[0] : '',
    });
    setEditFlowError(null);
  }

  async function handleSaveEditFlow() {
    if (!editFlowEntry || !editFlowForm.amount || !editFlowForm.description) return;
    setSavingEditFlow(true); setEditFlowError(null);
    try {
      const token = await getToken();
      await apiFetch(`/cashflow/${editFlowEntry.id}`, {
        method: 'PATCH', token,
        body: JSON.stringify({
          type: editFlowForm.type,
          amount: parseFloat(editFlowForm.amount),
          description: editFlowForm.description,
          date: editFlowForm.date || undefined,
        }),
      });
      setEditFlowEntry(null);
      invalidateFlow();
    } catch (e) { setEditFlowError(e instanceof Error ? e.message : 'Error'); }
    finally { setSavingEditFlow(false); }
  }

  async function handleDeleteFlow(id: string) {
    if (!confirm('¿Eliminar esta entrada?')) return;
    setDeletingFlow(id);
    try {
      const token = await getToken();
      await apiFetch(`/cashflow/${id}`, { method: 'DELETE', token });
      invalidateFlow();
    } finally { setDeletingFlow(null); }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div className="px-5 py-3 bg-background border-b border-border flex items-center justify-between">
        <h1 className="text-[17px] font-bold text-foreground" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
          Finanzas
        </h1>
        <button
          onClick={() => tab === 'mensualidades'
            ? (setPayForm({ memberId: '', amount: '', month: String(filterMonth), year: String(filterYear), status: 'PAID', notes: '' }), setPayError(null), setPayOpen(true))
            : (setFlowForm({ type: 'INCOME', amount: '', description: '', date: '' }), setFlowError(null), setFlowOpen(true))
          }
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white cursor-pointer"
          style={{ background: '#4361EE' }}
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">{tab === 'mensualidades' ? 'Registrar cobro' : 'Agregar'}</span>
        </button>
      </div>

      <div className="px-4 pt-4 flex flex-col gap-4">

        {/* Tabs */}
        <div className="flex gap-1 bg-secondary rounded-xl p-1">
          {([
            { key: 'mensualidades', label: 'Mensualidades' },
            { key: 'flujo',        label: 'Flujo de Caja' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="flex-1 py-2 rounded-lg text-[12px] font-semibold transition-all cursor-pointer"
              style={tab === key
                ? { background: '#fff', color: '#1A1028', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }
                : { color: '#8E87A8' }
              }
            >
              {label}
            </button>
          ))}
        </div>

        {/* Filtro mes/año */}
        <div className="flex gap-2 items-center">
          <Select value={String(filterMonth)} onValueChange={v => { setFilterMonth(parseInt(v ?? '')); setStatusFilter('ALL'); }}>
            <SelectTrigger className="w-36 bg-white">
              <span className="text-sm">{MONTH_NAMES[filterMonth - 1]}</span>
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((name, idx) => (
                <SelectItem key={idx + 1} value={String(idx + 1)}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(filterYear)} onValueChange={v => setFilterYear(parseInt(v ?? ''))}>
            <SelectTrigger className="w-24 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ── MENSUALIDADES ─────────────────────────────────────────────────── */}
        {tab === 'mensualidades' && (
          <>
            {/* Tarjeta débito bancaria */}
            <div
              className="relative overflow-hidden text-white select-none"
              style={{
                borderRadius: 20,
                background: 'linear-gradient(135deg, #2B2D8E 0%, #4361EE 45%, #7209B7 100%)',
                boxShadow: '0 8px 32px rgba(67,97,238,0.35), 0 2px 8px rgba(0,0,0,0.18)',
                aspectRatio: '1.586 / 1', // ratio estándar tarjeta bancaria
              }}
            >
              {/* Círculos decorativos de fondo */}
              <div className="absolute" style={{ width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', top: -60, right: -60 }} />
              <div className="absolute" style={{ width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', bottom: -50, left: -40 }} />
              <div className="absolute" style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', top: '30%', right: '20%' }} />

              {/* Contenido */}
              <div className="relative h-full flex flex-col justify-between p-5">
                {/* Fila superior: nombre del club + chip */}
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold tracking-[0.15em] uppercase opacity-90"
                    style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                    {clubName}
                  </p>
                  {/* Chip EMV decorativo */}
                  <div className="w-8 h-6 rounded-[4px] opacity-80"
                    style={{ background: 'linear-gradient(135deg, #FFD166, #F4A623)', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
                    <div className="w-full h-full rounded-[4px] grid grid-cols-2 gap-px p-0.5 opacity-60"
                      style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.15) 3px, rgba(0,0,0,0.15) 4px)' }} />
                  </div>
                </div>

                {/* Monto cobrado — centro */}
                <div>
                  <p className="text-[10px] font-semibold tracking-widest uppercase opacity-60 mb-1">
                    Cobrado {MONTH_NAMES[filterMonth - 1]} {filterYear}
                  </p>
                  <p className="text-[32px] font-extrabold leading-none tracking-tight"
                    style={{ fontFamily: 'var(--font-space-grotesk)', textShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                    {fmt.format(totalPaid)}
                  </p>
                  {totalPending > 0 && (
                    <p className="text-[11px] mt-1 opacity-75">
                      <span style={{ color: '#FFD166' }}>{fmt.format(totalPending)}</span> pendiente
                    </p>
                  )}
                </div>

                {/* Fila inferior: mes/año + logo Visa estilo */}
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[8px] opacity-50 uppercase tracking-widest mb-0.5">Mes de corte</p>
                    <p className="text-[13px] font-bold opacity-90" style={{ fontFamily: 'var(--font-space-grotesk)', letterSpacing: '0.1em' }}>
                      {String(filterMonth).padStart(2,'0')} / {filterYear}
                    </p>
                  </div>
                  {/* Círculos MasterCard estilo */}
                  <div className="flex items-center" style={{ gap: -8 }}>
                    <div className="w-8 h-8 rounded-full opacity-70" style={{ background: '#EB001B' }} />
                    <div className="w-8 h-8 rounded-full opacity-70 -ml-3" style={{ background: '#F79E1B' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Filtros de estado — fila debajo de la tarjeta morada */}
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: 'PAID',    label: 'Pagados',   value: countPaid,    color: '#06D6A0', bg: 'rgba(6,214,160,0.10)' },
                { key: 'PENDING', label: 'Pendiente', value: countPending, color: '#FFB703', bg: 'rgba(255,183,3,0.10)'  },
                { key: 'NONE',    label: 'Sin cobro', value: countNone,    color: '#8E87A8', bg: 'rgba(142,135,168,0.08)'},
              ] as const).map(({ key, label, value, color, bg }) => {
                const active = statusFilter === key;
                return (
                  <motion.button
                    key={key}
                    whileTap={reducedMotion ? {} : { scale: 0.96 }}
                    transition={{ duration: 0.12, ease: EASE_OUT }}
                    onClick={() => setStatusFilter(active ? 'ALL' : key)}
                    className="rounded-xl px-3 py-2.5 flex flex-col items-center gap-0.5 border-2 transition-all cursor-pointer"
                    style={{
                      background: active ? bg : '#fff',
                      borderColor: active ? color : 'transparent',
                      boxShadow: active ? `0 0 0 1px ${color}22` : '0 1px 3px rgba(0,0,0,0.06)',
                    }}
                  >
                    <p className="text-[18px] font-extrabold leading-none" style={{ fontFamily: 'var(--font-space-grotesk)', color }}>{value}</p>
                    <p className="text-[9px] font-semibold" style={{ color: active ? color : '#8E87A8' }}>{label}</p>
                  </motion.button>
                );
              })}
            </div>

            {/* Botón generar cobros del mes */}
            <motion.button
              whileTap={reducedMotion ? {} : { scale: 0.98 }}
              transition={{ duration: 0.12, ease: EASE_OUT }}
              onClick={handleGenerateMonth}
              disabled={generatingMonth}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold cursor-pointer transition-opacity disabled:opacity-60"
              style={{ background: 'rgba(67,97,238,0.08)', color: '#4361EE', border: '1.5px dashed rgba(67,97,238,0.25)' }}
            >
              <Zap className="w-4 h-4" />
              {generatingMonth ? 'Generando...' : `Generar cobros — ${MONTH_NAMES[filterMonth - 1]} ${filterYear}`}
            </motion.button>

            {/* Lista deportistas */}
            {loadingPay && !paymentsData ? (
              <div className="space-y-2">
                {[1,2,3,4].map(i => (
                  <div key={i} className="bg-white border border-border rounded-xl px-4 py-3 flex items-center gap-3 animate-pulse">
                    <div className="w-9 h-9 rounded-full bg-secondary shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-32 bg-secondary rounded-full" />
                      <div className="h-2.5 w-20 bg-secondary rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="bg-white border border-border rounded-xl px-4 py-10 text-center">
                <CreditCard className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-[13px] font-semibold text-muted-foreground">No hay deportistas registrados</p>
              </div>
            ) : (
              <motion.div
                className="space-y-1.5 pb-28"
                variants={reducedMotion ? undefined : listVariants}
                initial={reducedMotion ? undefined : 'hidden'}
                animate={reducedMotion ? undefined : 'visible'}
              >
                {filteredRows.map(({ member: m, payment, configured }) => (
                  <StudentRow
                    key={m.id}
                    member={m}
                    payment={payment}
                    clubName={clubName}
                    filterMonth={filterMonth}
                    filterYear={filterYear}
                    reducedMotion={reducedMotion}
                    sentWa={sentWa}
                    onSentWa={key => setSentWa(prev => new Set(prev).add(key))}
                    onMarkPaid={handleMarkPaid}
                    onGenerate={handleGeneratePending}
                    onDeletePay={handleDeletePay}
                    generating={generatingPay === m.id}
                    deleting={deletingPay === payment?.id}
                    marking={markingPaid === payment?.id}
                    onConfigSave={handleConfigSave}
                    configSaving={configSaving === m.id}
                  />
                ))}
              </motion.div>
            )}
          </>
        )}

        {/* ── FLUJO DE CAJA ─────────────────────────────────────────────────── */}
        {tab === 'flujo' && (
          <>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Ingresos', value: totalIncome,  color: '#06D6A0', icon: TrendingUp },
                { label: 'Egresos',  value: totalExpense, color: '#EF476F', icon: TrendingDown },
                { label: 'Balance',  value: balance,      color: balance >= 0 ? '#4361EE' : '#EF476F', icon: Wallet },
              ].map(({ label, value, color, icon: Icon }) => (
                <div key={label} className="bg-white border border-border rounded-xl p-3 text-center">
                  <Icon className="w-4 h-4 mx-auto mb-1" style={{ color }} />
                  <p className="text-[11px] font-extrabold text-foreground" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                    {fmt.format(value)}
                  </p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {loadingFlow && !cashflowData ? (
              <div className="flex justify-center py-10">
                <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            ) : entries.length === 0 ? (
              <div className="bg-white border border-border rounded-xl px-4 py-10 text-center">
                <Wallet className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-[13px] font-semibold text-muted-foreground">Sin movimientos este mes</p>
                <p className="text-[11px] text-muted-foreground mt-1">Los cobros marcados como pagados aparecen aquí automáticamente</p>
              </div>
            ) : (
              <div className="space-y-2 pb-28">
                {entries.map(e => {
                  const isIncome = e.type === 'INCOME';
                  const isAuto   = !!e.paymentId;
                  const dateStr  = new Date(e.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
                  return (
                    <div key={e.id} className="bg-white border border-border rounded-xl px-4 py-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: isIncome ? 'rgba(6,214,160,0.12)' : 'rgba(239,71,111,0.12)' }}>
                        {isIncome
                          ? <TrendingUp  className="w-4 h-4" style={{ color: '#06D6A0' }} />
                          : <TrendingDown className="w-4 h-4" style={{ color: '#EF476F' }} />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-foreground truncate">{e.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-[11px] font-bold" style={{ color: isIncome ? '#06D6A0' : '#EF476F' }}>
                            {isIncome ? '+' : '-'}{fmt.format(e.amount)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{dateStr}</p>
                          {isAuto && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(67,97,238,0.10)', color: '#4361EE' }}>
                              Auto
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal registrar cobro manual */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Registrar cobro</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Deportista *</Label>
              <Select value={payForm.memberId} onValueChange={v => setPayForm(f => ({ ...f, memberId: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar deportista" /></SelectTrigger>
                <SelectContent>
                  {allMembers.filter(m => m.role === 'STUDENT').map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Monto (COP) *</Label>
              <Input
                type="text" inputMode="numeric"
                value={payForm.amount ? Number(payForm.amount).toLocaleString('es-CO') : ''}
                onChange={e => setPayForm(f => ({ ...f, amount: e.target.value.replace(/\./g, '').replace(/\D/g, '') }))}
                placeholder="ej. 150.000"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Mes</Label>
                <Select value={payForm.month} onValueChange={v => setPayForm(f => ({ ...f, month: v ?? '' }))}>
                  <SelectTrigger><span className="text-sm">{MONTH_NAMES[parseInt(payForm.month) - 1]}</span></SelectTrigger>
                  <SelectContent>{MONTH_NAMES.map((name, idx) => <SelectItem key={idx + 1} value={String(idx + 1)}>{name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Año</Label>
                <Select value={payForm.year} onValueChange={v => setPayForm(f => ({ ...f, year: v ?? '' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={payForm.status} onValueChange={v => setPayForm(f => ({ ...f, status: v ?? 'PAID' }))}>
                <SelectTrigger><span className="text-sm">{payForm.status === 'PAID' ? 'Pagado' : payForm.status === 'PENDING' ? 'Pendiente' : 'Vencido'}</span></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PAID">Pagado</SelectItem>
                  <SelectItem value="PENDING">Pendiente</SelectItem>
                  <SelectItem value="OVERDUE">Vencido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Input value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} placeholder="Opcional" />
            </div>
            {payError && <p className="text-sm text-red-600">{payError}</p>}
            <Button onClick={handleSavePay} disabled={savingPay || !payForm.memberId || !payForm.amount} className="w-full">
              {savingPay ? 'Guardando...' : 'Registrar cobro'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal agregar movimiento manual */}
      <Dialog open={flowOpen} onOpenChange={setFlowOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Agregar movimiento</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <div className="grid grid-cols-2 gap-2">
                {(['INCOME', 'EXPENSE'] as const).map(t => (
                  <button key={t} onClick={() => setFlowForm(f => ({ ...f, type: t }))}
                    className="py-2 rounded-xl text-[12px] font-semibold border transition-all cursor-pointer"
                    style={flowForm.type === t
                      ? { background: t === 'INCOME' ? '#06D6A0' : '#EF476F', color: '#fff', borderColor: 'transparent' }
                      : { background: '#fff', color: '#8E87A8', borderColor: 'rgba(120,80,200,0.10)' }
                    }
                  >
                    {t === 'INCOME' ? 'Ingreso' : 'Egreso'}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descripción *</Label>
              <Input value={flowForm.description} onChange={e => setFlowForm(f => ({ ...f, description: e.target.value }))} placeholder="ej. Compra de conos" />
            </div>
            <div className="space-y-2">
              <Label>Monto (COP) *</Label>
              <Input
                type="text" inputMode="numeric"
                value={flowForm.amount ? Number(flowForm.amount).toLocaleString('es-CO') : ''}
                onChange={e => setFlowForm(f => ({ ...f, amount: e.target.value.replace(/\./g, '').replace(/\D/g, '') }))}
                placeholder="ej. 80.000"
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input type="date" value={flowForm.date} onChange={e => setFlowForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            {flowError && <p className="text-sm text-red-600">{flowError}</p>}
            <Button onClick={handleSaveFlow} disabled={savingFlow || !flowForm.amount || !flowForm.description} className="w-full">
              {savingFlow ? 'Guardando...' : 'Agregar movimiento'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Modal editar movimiento */}
      <Dialog open={!!editFlowEntry} onOpenChange={v => { if (!v) setEditFlowEntry(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Editar movimiento</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <div className="grid grid-cols-2 gap-2">
                {(['INCOME', 'EXPENSE'] as const).map(t => (
                  <button key={t} onClick={() => setEditFlowForm(f => ({ ...f, type: t }))}
                    className="py-2 rounded-xl text-[12px] font-semibold border transition-all cursor-pointer"
                    style={editFlowForm.type === t
                      ? { background: t === 'INCOME' ? '#06D6A0' : '#EF476F', color: '#fff', borderColor: 'transparent' }
                      : { background: '#fff', color: '#8E87A8', borderColor: 'rgba(120,80,200,0.10)' }
                    }
                  >
                    {t === 'INCOME' ? 'Ingreso' : 'Egreso'}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descripción *</Label>
              <Input value={editFlowForm.description} onChange={e => setEditFlowForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Monto (COP) *</Label>
              <Input
                type="text" inputMode="numeric"
                value={editFlowForm.amount ? Number(editFlowForm.amount).toLocaleString('es-CO') : ''}
                onChange={e => setEditFlowForm(f => ({ ...f, amount: e.target.value.replace(/\./g, '').replace(/\D/g, '') }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input type="date" value={editFlowForm.date} onChange={e => setEditFlowForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            {editFlowError && <p className="text-sm text-red-600">{editFlowError}</p>}
            <Button onClick={handleSaveEditFlow} disabled={savingEditFlow || !editFlowForm.amount || !editFlowForm.description} className="w-full">
              {savingEditFlow ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
