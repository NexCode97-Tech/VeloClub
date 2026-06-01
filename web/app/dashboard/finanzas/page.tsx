'use client';

import { useAuth } from '@clerk/nextjs';
import { useClubStream } from '@/hooks/useClubStream';
import { useEffect, useState, useMemo } from 'react';
import { apiFetch } from '@/lib/api-client';
import {
  CreditCard, Plus, Trash2, CheckCircle2, Clock, AlertCircle,
  TrendingUp, TrendingDown, Wallet, Download, MessageCircle, Check,
  PhoneOff, Users, Settings,
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

// ── Pagos types ───────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  PAID: 'Pagado', PENDING: 'Pendiente', OVERDUE: 'Vencido', REFUNDED: 'Reembolsado',
};
const STATUS_COLORS: Record<string, { text: string; bg: string; icon: React.ElementType }> = {
  PAID:     { text: '#06D6A0', bg: 'rgba(6,214,160,0.12)',   icon: CheckCircle2 },
  PENDING:  { text: '#FFB703', bg: 'rgba(255,183,3,0.12)',   icon: Clock },
  OVERDUE:  { text: '#EF476F', bg: 'rgba(239,71,111,0.12)',  icon: AlertCircle },
  REFUNDED: { text: '#8E87A8', bg: 'rgba(142,135,168,0.12)', icon: CreditCard },
};
const PAY_TABS = ['Todos', 'Pagados', 'Pendientes', 'Vencidos'] as const;
const PAY_FILTER: Record<string, string | null> = {
  Todos: null, Pagados: 'PAID', Pendientes: 'PENDING', Vencidos: 'OVERDUE',
};

// ── Animation variants ────────────────────────────────────────────────────────
const listVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};
const rowVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.24, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] } },
};

// ── WhatsApp helpers ──────────────────────────────────────────────────────────
function buildWhatsAppUrl(phone: string, memberName: string, amount: number, month: number, year: number, clubName: string): string {
  const clean = phone.replace(/\D/g, '');
  const normalized = clean.startsWith('57') ? clean : `57${clean}`;
  const text = encodeURIComponent(
    `Hola, soy del ${clubName}. Le recordamos que la mensualidad de ${memberName} correspondiente a ${MONTH_NAMES[month - 1]} ${year} por ${fmt.format(amount)} está pendiente de pago. Por favor comuníquese con nosotros para coordinar. ¡Gracias!`
  );
  return `https://wa.me/${normalized}?text=${text}`;
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

interface PayMember { id: string; fullName: string; email?: string; phone?: string }
interface Payment {
  id: string; memberId: string; amount: number;
  month: number; year: number; status: string;
  paidAt?: string; notes?: string; member: PayMember;
}
interface Member {
  id: string; fullName: string; role: string;
  phone?: string; emergencyPhone?: string;
  monthlyFee?: number | null; paymentDueDay?: number | null;
}

// ── CashEntry types ───────────────────────────────────────────────────────────
interface CashEntry {
  id: string; type: 'INCOME' | 'EXPENSE'; amount: number;
  description: string; date: string; paymentId?: string | null;
  payment?: { member?: { fullName: string } } | null;
}

const now = new Date();

export default function FinanzasPage() {
  const { getToken } = useAuth();
  const reducedMotion = useReducedMotion();
  const [tab, setTab]             = useState<'pagos' | 'estado' | 'flujo'>('pagos');
  const [clubName, setClubName]   = useState('VeloClub');
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear]   = useState(now.getFullYear());
  const [sentWa, setSentWa]       = useState<Set<string>>(new Set());
  const [generatingPay, setGeneratingPay] = useState<string | null>(null);

  // Pagos state
  const [payments, setPayments]     = useState<Payment[]>([]);
  const [members, setMembers]       = useState<Member[]>([]);
  const [payTab, setPayTab]         = useState<typeof PAY_TABS[number]>('Todos');
  const [loadingPay, setLoadingPay] = useState(true);
  const [payOpen, setPayOpen]       = useState(false);
  const [payForm, setPayForm]       = useState({
    memberId: '', amount: '', month: String(now.getMonth() + 1),
    year: String(now.getFullYear()), status: 'PAID', notes: '',
  });
  const [savingPay, setSavingPay]   = useState(false);
  const [payError, setPayError]     = useState<string | null>(null);
  const [deletingPay, setDeletingPay] = useState<string | null>(null);

  // Flujo state
  const [entries, setEntries]         = useState<CashEntry[]>([]);
  const [loadingFlow, setLoadingFlow] = useState(true);
  const [flowOpen, setFlowOpen]       = useState(false);
  const [flowForm, setFlowForm]       = useState({ type: 'INCOME', amount: '', description: '', date: '' });
  const [savingFlow, setSavingFlow]   = useState(false);
  const [flowError, setFlowError]     = useState<string | null>(null);
  const [deletingFlow, setDeletingFlow] = useState<string | null>(null);

  async function loadPayments() {
    const token = await getToken();
    const res = await apiFetch<{ payments: Payment[] }>(
      `/payments?month=${filterMonth}&year=${filterYear}`, { token }
    );
    setPayments(res.payments);
    setLoadingPay(false);
  }

  async function loadFlow() {
    const token = await getToken();
    const res = await apiFetch<{ entries: CashEntry[] }>(
      `/cashflow?month=${filterMonth}&year=${filterYear}`, { token }
    );
    setEntries(res.entries);
    setLoadingFlow(false);
  }

  useEffect(() => {
    (async () => {
      const token = await getToken();
      const [membersRes, settingsRes] = await Promise.all([
        apiFetch<{ members: Member[] }>('/members', { token }),
        apiFetch<{ club: { name: string } }>('/clubs/settings', { token }).catch(() => null),
      ]);
      setMembers(membersRes.members);
      if (settingsRes) setClubName(settingsRes.club.name);
    })();
    loadPayments();
    loadFlow();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLoadingPay(true); setLoadingFlow(true);
    loadPayments();
    loadFlow();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMonth, filterYear]);

  useClubStream((ev) => {
    if (ev === 'payments' || ev === 'cashflow') { loadPayments(); loadFlow(); }
  });

  // ── Estado de deportistas (computed) ─────────────────────────────────────────
  const studentStatus = useMemo(() => {
    const students = members.filter(m => m.role === 'STUDENT');
    return students.map(m => {
      const pay = payments.find(p => p.memberId === m.id);
      const configured = !!(m.monthlyFee && m.paymentDueDay);
      return { member: m, payment: pay ?? null, configured };
    }).sort((a, b) => {
      // Ordenar: OVERDUE → PENDING → sin pago → PAID → sin configurar
      const order: Record<string, number> = { OVERDUE: 0, PENDING: 1, NONE: 2, PAID: 3, UNCONFIGURED: 4 };
      const keyA = !a.configured ? 'UNCONFIGURED' : !a.payment ? 'NONE' : a.payment.status;
      const keyB = !b.configured ? 'UNCONFIGURED' : !b.payment ? 'NONE' : b.payment.status;
      return (order[keyA] ?? 5) - (order[keyB] ?? 5);
    });
  }, [members, payments]);

  // Pagos helpers
  const filteredPay = payments.filter(p => {
    const f = PAY_FILTER[payTab];
    return f === null || p.status === f;
  });
  const totalPaid    = payments.filter(p => p.status === 'PAID').reduce((s, p) => s + p.amount, 0);
  const totalPending = payments.filter(p => p.status !== 'PAID').reduce((s, p) => s + p.amount, 0);

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
      await Promise.all([loadPayments(), loadFlow()]);
      const memberName = members.find(m => m.id === payForm.memberId)?.fullName ?? '';
      if (created.payment.status === 'PAID') {
        downloadInvoicePDF({ ...created.payment, memberName }, clubName);
      }
    } catch (e) { setPayError(e instanceof Error ? e.message : 'Error'); }
    finally { setSavingPay(false); }
  }

  function handleWhatsApp(phone: string, memberName: string, amount: number, payId?: string) {
    const url = buildWhatsAppUrl(phone, memberName, amount, filterMonth, filterYear, clubName);
    window.open(url, '_blank');
    if (payId) setSentWa(prev => new Set(prev).add(payId));
  }

  async function handleMarkPaid(id: string) {
    const token = await getToken();
    await apiFetch(`/payments/${id}`, { method: 'PATCH', token, body: JSON.stringify({ status: 'PAID' }) });
    await Promise.all([loadPayments(), loadFlow()]);
  }

  async function handleDeletePay(id: string) {
    if (!confirm('¿Eliminar este pago?')) return;
    setDeletingPay(id);
    try {
      const token = await getToken();
      await apiFetch(`/payments/${id}`, { method: 'DELETE', token });
      await Promise.all([loadPayments(), loadFlow()]);
    } finally { setDeletingPay(null); }
  }

  async function handleGeneratePending(memberId: string, amount: number) {
    setGeneratingPay(memberId);
    try {
      const token = await getToken();
      await apiFetch('/payments', {
        method: 'POST', token,
        body: JSON.stringify({
          memberId, amount, month: filterMonth, year: filterYear, status: 'PENDING',
        }),
      });
      await loadPayments();
    } catch (e) { console.error(e); }
    finally { setGeneratingPay(null); }
  }

  // Flujo helpers
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
        body: JSON.stringify({
          type: flowForm.type, amount: parseFloat(flowForm.amount),
          description: flowForm.description,
          date: flowForm.date || undefined,
        }),
      });
      setFlowOpen(false);
      setFlowForm({ type: 'INCOME', amount: '', description: '', date: '' });
      await loadFlow();
    } catch (e) { setFlowError(e instanceof Error ? e.message : 'Error'); }
    finally { setSavingFlow(false); }
  }

  async function handleDeleteFlow(id: string) {
    if (!confirm('¿Eliminar esta entrada?')) return;
    setDeletingFlow(id);
    try {
      const token = await getToken();
      await apiFetch(`/cashflow/${id}`, { method: 'DELETE', token });
      await loadFlow();
    } finally { setDeletingFlow(null); }
  }

  return (
    <div className="min-h-full bg-background">
      {/* Encabezado */}
      <div className="px-5 py-3 bg-background border-b border-border flex items-center justify-between">
        <h1 className="text-[17px] font-bold text-foreground" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
          Finanzas
        </h1>
        {tab !== 'estado' && (
          <button
            onClick={() => tab === 'pagos'
              ? (setPayForm({ memberId: '', amount: '', month: String(filterMonth), year: String(filterYear), status: 'PAID', notes: '' }), setPayError(null), setPayOpen(true))
              : (setFlowForm({ type: 'INCOME', amount: '', description: '', date: '' }), setFlowError(null), setFlowOpen(true))
            }
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white cursor-pointer"
            style={{ background: '#4361EE' }}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{tab === 'pagos' ? 'Registrar' : 'Agregar'}</span>
          </button>
        )}
      </div>

      <div className="px-4 pt-4 flex flex-col gap-4">

        {/* Tabs */}
        <div className="flex gap-1 bg-secondary rounded-xl p-1">
          {([
            { key: 'pagos',  label: 'Mensualidades' },
            { key: 'estado', label: 'Estado' },
            { key: 'flujo',  label: 'Flujo de Caja' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="flex-1 py-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer"
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
          <Select value={String(filterMonth)} onValueChange={v => setFilterMonth(parseInt(v ?? ''))}>
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
            <SelectTrigger className="w-24 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ── PAGOS TAB ─────────────────────────────────────────────────────── */}
        {tab === 'pagos' && (
          <>
            <div className="rounded-2xl p-4 text-white" style={{ background: 'linear-gradient(135deg,#4361EE,#7209B7)' }}>
              <p className="text-[10px] font-semibold tracking-widest opacity-80 uppercase mb-1">
                Cobrado — {MONTH_NAMES[filterMonth - 1]} {filterYear}
              </p>
              <p className="text-4xl font-extrabold mb-3" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                {fmt.format(totalPaid)}
              </p>
              <div className="flex gap-6">
                <div>
                  <p className="text-[10px] opacity-70 uppercase tracking-wide">Total pagado</p>
                  <p className="text-base font-bold" style={{ fontFamily: 'var(--font-space-grotesk)' }}>{fmt.format(totalPaid)}</p>
                </div>
                <div>
                  <p className="text-[10px] opacity-70 uppercase tracking-wide">Pendiente</p>
                  <p className="text-base font-bold" style={{ fontFamily: 'var(--font-space-grotesk)', color: '#FFB703' }}>{fmt.format(totalPending)}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {PAY_TABS.map(t => (
                <button key={t} onClick={() => setPayTab(t)}
                  className="shrink-0 px-4 py-1.5 rounded-full text-[12px] font-semibold border cursor-pointer"
                  style={payTab === t
                    ? { background: '#4361EE', color: '#fff', borderColor: '#4361EE' }
                    : { background: '#fff', color: '#1A1028', borderColor: 'rgba(120,80,200,0.10)' }
                  }
                >{t}</button>
              ))}
            </div>

            {loadingPay ? (
              <div className="space-y-2">
                {[1,2,3].map(i => (
                  <div key={i} className="bg-white border border-border rounded-xl px-4 py-3 flex items-center gap-3 animate-pulse">
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-32 bg-secondary rounded-full" />
                      <div className="h-3 w-20 bg-secondary rounded-full" />
                    </div>
                    <div className="h-7 w-16 bg-secondary rounded-lg" />
                  </div>
                ))}
              </div>
            ) : filteredPay.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
                className="bg-white border border-border rounded-xl px-4 py-10 text-center"
              >
                <CreditCard className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-[13px] font-semibold text-muted-foreground">Sin pagos registrados</p>
              </motion.div>
            ) : (
              <motion.div
                className="space-y-2 pb-4"
                variants={reducedMotion ? undefined : listVariants}
                initial={reducedMotion ? undefined : 'hidden'}
                animate={reducedMotion ? undefined : 'visible'}
              >
                {filteredPay.map(p => {
                  const sc = STATUS_COLORS[p.status] ?? STATUS_COLORS.PENDING;
                  const StatusIcon = sc.icon;
                  const hasPhone = !!p.member.phone;
                  const wasSent  = sentWa.has(p.id);
                  const isPending = p.status !== 'PAID';

                  return (
                    <motion.div
                      key={p.id}
                      variants={reducedMotion ? undefined : rowVariants}
                      className="bg-white border border-border rounded-xl px-4 py-3 flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-[13px] font-bold text-foreground truncate">{p.member.fullName}</p>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 flex items-center gap-1" style={{ background: sc.bg, color: sc.text }}>
                            <StatusIcon className="w-2.5 h-2.5" />{STATUS_LABELS[p.status]}
                          </span>
                        </div>
                        <p className="text-[12px] font-semibold text-foreground">{fmt.format(p.amount)}</p>
                        <p className="text-[10px] text-muted-foreground">{MONTH_NAMES[p.month - 1]} {p.year}</p>
                        {p.notes && <p className="text-[10px] text-muted-foreground mt-0.5">{p.notes}</p>}
                      </div>

                      <div className="flex flex-col gap-1.5 shrink-0 items-end">
                        {isPending && (
                          <motion.button
                            onClick={() => handleMarkPaid(p.id)}
                            whileHover={{ scale: reducedMotion ? 1 : 1.02 }}
                            whileTap={{ scale: reducedMotion ? 1 : 0.97 }}
                            transition={{ duration: 0.12, ease: [0.23, 1, 0.32, 1] }}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer"
                            style={{ background: 'rgba(6,214,160,0.12)', color: '#06D6A0' }}
                          >
                            Marcar pagado
                          </motion.button>
                        )}

                        <div className="flex gap-1.5 items-center">
                          {isPending && (
                            <motion.button
                              onClick={() => p.member.phone && handleWhatsApp(p.member.phone, p.member.fullName, p.amount, p.id)}
                              whileHover={hasPhone && !reducedMotion ? { scale: 1.08, y: -1 } : {}}
                              whileTap={hasPhone && !reducedMotion ? { scale: 0.97 } : {}}
                              transition={{ duration: 0.12, ease: [0.23, 1, 0.32, 1] }}
                              disabled={!hasPhone}
                              title={hasPhone ? `Recordar a ${p.member.fullName}` : 'Sin número'}
                              className="relative w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer"
                              style={{
                                background: hasPhone ? (wasSent ? 'rgba(6,214,160,0.15)' : 'rgba(37,211,102,0.12)') : 'rgba(142,135,168,0.10)',
                                cursor: hasPhone ? 'pointer' : 'not-allowed',
                              }}
                            >
                              <AnimatePresence mode="wait">
                                {wasSent ? (
                                  <motion.span key="sent" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}>
                                    <Check className="w-3.5 h-3.5" style={{ color: '#06D6A0' }} />
                                  </motion.span>
                                ) : hasPhone ? (
                                  <motion.span key="wa" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}>
                                    <MessageCircle className="w-3.5 h-3.5" style={{ color: '#25D366' }} />
                                  </motion.span>
                                ) : (
                                  <motion.span key="no-phone">
                                    <PhoneOff className="w-3.5 h-3.5" style={{ color: '#8E87A8' }} />
                                  </motion.span>
                                )}
                              </AnimatePresence>
                            </motion.button>
                          )}

                          <motion.button
                            onClick={() => downloadInvoicePDF({ ...p, memberName: p.member.fullName }, clubName)}
                            whileHover={{ scale: reducedMotion ? 1 : 1.08, y: reducedMotion ? 0 : -1 }}
                            whileTap={{ scale: reducedMotion ? 1 : 0.97 }}
                            transition={{ duration: 0.12, ease: [0.23, 1, 0.32, 1] }}
                            className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground cursor-pointer"
                            title="Descargar factura"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </motion.button>

                          <motion.button
                            onClick={() => handleDeletePay(p.id)}
                            disabled={deletingPay === p.id}
                            whileHover={{ scale: reducedMotion ? 1 : 1.08, y: reducedMotion ? 0 : -1 }}
                            whileTap={{ scale: reducedMotion ? 1 : 0.97 }}
                            transition={{ duration: 0.12, ease: [0.23, 1, 0.32, 1] }}
                            className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-red-400 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </motion.button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </>
        )}

        {/* ── ESTADO TAB ────────────────────────────────────────────────────── */}
        {tab === 'estado' && (
          <>
            {/* Mini resumen */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Pagados',    value: studentStatus.filter(s => s.payment?.status === 'PAID').length,    color: '#06D6A0' },
                { label: 'Pendientes', value: studentStatus.filter(s => s.payment && s.payment.status !== 'PAID').length, color: '#FFB703' },
                { label: 'Sin pago',   value: studentStatus.filter(s => !s.payment && s.configured).length,     color: '#8E87A8' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white border border-border rounded-xl p-3 text-center">
                  <p className="text-2xl font-extrabold" style={{ fontFamily: 'var(--font-space-grotesk)', color }}>{value}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {studentStatus.length === 0 ? (
              <div className="bg-white border border-border rounded-xl px-4 py-10 text-center">
                <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-[13px] font-semibold text-muted-foreground">No hay deportistas registrados</p>
              </div>
            ) : (
              <motion.div
                className="space-y-2 pb-4"
                variants={reducedMotion ? undefined : listVariants}
                initial={reducedMotion ? undefined : 'hidden'}
                animate={reducedMotion ? undefined : 'visible'}
              >
                {studentStatus.map(({ member: m, payment, configured }) => {
                  const sc = payment ? (STATUS_COLORS[payment.status] ?? STATUS_COLORS.PENDING) : null;
                  const StatusIcon = sc?.icon;
                  const hasPendingOrOverdue = payment && payment.status !== 'PAID';
                  const contactPhone = m.emergencyPhone || m.phone;
                  const waKey = `estado-${m.id}`;
                  const wasSent = sentWa.has(waKey);

                  return (
                    <motion.div
                      key={m.id}
                      variants={reducedMotion ? undefined : rowVariants}
                      className="bg-white border border-border rounded-xl px-4 py-3 flex items-center gap-3"
                    >
                      {/* Avatar */}
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-[12px]"
                        style={{ background: sc ? sc.text : '#8E87A8' }}
                      >
                        {getInitials(m.fullName)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-foreground truncate">{m.fullName}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {payment && sc && StatusIcon ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1" style={{ background: sc.bg, color: sc.text }}>
                              <StatusIcon className="w-2.5 h-2.5" />
                              {STATUS_LABELS[payment.status]} — {fmt.format(payment.amount)}
                            </span>
                          ) : configured ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(142,135,168,0.10)', color: '#8E87A8' }}>
                              Sin pago este mes
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1" style={{ background: 'rgba(142,135,168,0.08)', color: '#8E87A8' }}>
                              <Settings className="w-2.5 h-2.5" />Sin configurar
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Acciones */}
                      <div className="flex flex-col gap-1.5 shrink-0 items-end">
                        {/* Marcar pagado directamente */}
                        {hasPendingOrOverdue && (
                          <button
                            onClick={() => handleMarkPaid(payment!.id)}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer"
                            style={{ background: 'rgba(6,214,160,0.12)', color: '#06D6A0' }}
                          >
                            Marcar pagado
                          </button>
                        )}

                        <div className="flex gap-1.5 items-center">
                          {/* Generar pago PENDING si está configurado y no tiene pago este mes */}
                          {configured && !payment && (
                            <button
                              onClick={() => handleGeneratePending(m.id, m.monthlyFee!)}
                              disabled={generatingPay === m.id}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer"
                              style={{ background: 'rgba(67,97,238,0.10)', color: '#4361EE' }}
                            >
                              {generatingPay === m.id ? '...' : 'Generar'}
                            </button>
                          )}

                          {/* WhatsApp al acudiente — solo si hay pago pendiente/vencido */}
                          {hasPendingOrOverdue && (
                            <motion.button
                              onClick={() => contactPhone && handleWhatsApp(contactPhone, m.fullName, payment!.amount, waKey)}
                              disabled={!contactPhone}
                              whileHover={contactPhone && !reducedMotion ? { scale: 1.08, y: -1 } : {}}
                              whileTap={contactPhone && !reducedMotion ? { scale: 0.97 } : {}}
                              transition={{ duration: 0.12, ease: [0.23, 1, 0.32, 1] }}
                              title={contactPhone ? 'Recordar por WhatsApp' : 'Sin número de contacto'}
                              className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer"
                              style={{
                                background: !contactPhone ? 'rgba(142,135,168,0.10)' : wasSent ? 'rgba(6,214,160,0.15)' : 'rgba(37,211,102,0.12)',
                                cursor: contactPhone ? 'pointer' : 'not-allowed',
                              }}
                            >
                              <AnimatePresence mode="wait">
                                {wasSent ? (
                                  <motion.span key="sent" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.18 }}>
                                    <Check className="w-3.5 h-3.5" style={{ color: '#06D6A0' }} />
                                  </motion.span>
                                ) : contactPhone ? (
                                  <motion.span key="wa" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.18 }}>
                                    <MessageCircle className="w-3.5 h-3.5" style={{ color: '#25D366' }} />
                                  </motion.span>
                                ) : (
                                  <motion.span key="none">
                                    <PhoneOff className="w-3.5 h-3.5" style={{ color: '#8E87A8' }} />
                                  </motion.span>
                                )}
                              </AnimatePresence>
                            </motion.button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </>
        )}

        {/* ── FLUJO DE CAJA TAB ─────────────────────────────────────────────── */}
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

            {loadingFlow ? (
              <div className="flex justify-center py-10"><div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>
            ) : entries.length === 0 ? (
              <div className="bg-white border border-border rounded-xl px-4 py-10 text-center">
                <Wallet className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-[13px] font-semibold text-muted-foreground">Sin movimientos este mes</p>
                <p className="text-[11px] text-muted-foreground mt-1">Los pagos registrados aparecen aquí automáticamente</p>
              </div>
            ) : (
              <div className="space-y-2 pb-4">
                {entries.map(e => {
                  const isIncome = e.type === 'INCOME';
                  const isAuto   = !!e.paymentId;
                  const dateStr  = new Date(e.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
                  return (
                    <div key={e.id} className="bg-white border border-border rounded-xl px-4 py-3 flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: isIncome ? 'rgba(6,214,160,0.12)' : 'rgba(239,71,111,0.12)' }}
                      >
                        {isIncome
                          ? <TrendingUp className="w-4 h-4" style={{ color: '#06D6A0' }} />
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
                      {!isAuto && (
                        <button onClick={() => handleDeleteFlow(e.id)} disabled={deletingFlow === e.id}
                          className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-red-400 cursor-pointer">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal registrar pago */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Registrar pago</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Deportista *</Label>
              <Select value={payForm.memberId} onValueChange={v => setPayForm(f => ({ ...f, memberId: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar miembro" /></SelectTrigger>
                <SelectContent>{members.filter(m => m.role === 'STUDENT').map(m => <SelectItem key={m.id} value={m.id}>{m.fullName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Monto (COP) *</Label>
              <Input
                type="text"
                inputMode="numeric"
                value={payForm.amount ? Number(payForm.amount).toLocaleString('es-CO') : ''}
                onChange={e => {
                  const raw = e.target.value.replace(/\./g, '').replace(/\D/g, '');
                  setPayForm(f => ({ ...f, amount: raw }));
                }}
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
                <SelectTrigger><span className="text-sm">{STATUS_LABELS[payForm.status]}</span></SelectTrigger>
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
              {savingPay ? 'Guardando...' : 'Registrar pago'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal agregar entrada manual */}
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
                type="text"
                inputMode="numeric"
                value={flowForm.amount ? Number(flowForm.amount).toLocaleString('es-CO') : ''}
                onChange={e => {
                  const raw = e.target.value.replace(/\./g, '').replace(/\D/g, '');
                  setFlowForm(f => ({ ...f, amount: raw }));
                }}
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
    </div>
  );
}
