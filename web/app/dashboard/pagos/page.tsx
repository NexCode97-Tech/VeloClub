'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { Plus, Trash2, CheckCircle2, Clock, AlertCircle, CalendarDays, TrendingUp, Upload } from 'lucide-react';
import { IconMisPagos } from '@/components/ui/custom-icons';
import { motion } from 'framer-motion';
import { stagger, cardVariant } from '@/lib/page-animations';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const fmt = new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0,
});

const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

const STATUS_LABELS: Record<string, string> = {
  PAID:     'Pagado',
  PENDING:  'Pendiente',
  OVERDUE:  'Vencido',
  REFUNDED: 'Reembolsado',
};
const STATUS_COLORS: Record<string, { text: string; bg: string; icon: React.ElementType }> = {
  PAID:     { text: '#06D6A0', bg: 'rgba(6,214,160,0.12)',   icon: CheckCircle2 },
  PENDING:  { text: '#FFB703', bg: 'rgba(255,183,3,0.12)',   icon: Clock },
  OVERDUE:  { text: '#EF476F', bg: 'rgba(239,71,111,0.12)',  icon: AlertCircle },
  REFUNDED: { text: '#8E87A8', bg: 'rgba(142,135,168,0.12)', icon: IconMisPagos },
};

const TABS = ['Todos', 'Pagados', 'Pendientes', 'Vencidos'] as const;
const TAB_FILTER: Record<string, string | null> = {
  Todos: null, Pagados: 'PAID', Pendientes: 'PENDING', Vencidos: 'OVERDUE',
};

interface PaymentMember { id: string; fullName: string; email?: string }
interface Payment {
  id: string; memberId: string; amount: number;
  month: number; year: number; status: string;
  paidAt?: string; dueDate?: string; notes?: string;
  receiptUrl?: string | null;
  member: PaymentMember;
}
interface Member { id: string; fullName: string; email?: string }

const now = new Date();
const emptyForm = {
  memberId: '', amount: '', month: String(now.getMonth() + 1),
  year: String(now.getFullYear()), status: 'PAID', notes: '',
};

export default function PagosPage() {
  const { getToken } = useAuth();
  const [payments, setPayments]   = useState<Payment[]>([]);
  const [members, setMembers]     = useState<Member[]>([]);
  const [role, setRole]           = useState('');
  const [myMemberId, setMyMemberId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>('Todos');
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear]   = useState(now.getFullYear());
  const [loading, setLoading]     = useState(true);
  const [open, setOpen]           = useState(false);
  const [form, setForm]           = useState(emptyForm);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState<string | null>(null);

  const canManage = role === 'ADMIN' || role === 'COACH';

  async function handleUploadReceipt(paymentId: string, file: File) {
    if (uploadingReceipt) return;
    if (file.size > 8 * 1024 * 1024) { alert('El archivo supera 8MB'); return; }
    setUploadingReceipt(paymentId);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const token = await getToken();
      await apiFetch(`/payments/${paymentId}/my-receipt`, {
        method: 'POST', token, body: JSON.stringify({ base64 }),
      });
      await loadPayments(myMemberId);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al subir el comprobante');
    } finally {
      setUploadingReceipt(null);
    }
  }

  async function loadPayments(memberId?: string | null) {
    const token = await getToken();
    const res = await apiFetch<{ payments: Payment[] }>(
      `/payments?month=${filterMonth}&year=${filterYear}`, { token }
    );
    const all = res.payments;
    // STUDENT: filtrar solo sus propios pagos
    setPayments(memberId !== undefined
      ? (memberId ? all.filter(p => p.memberId === memberId) : all)
      : all
    );
  }

  useEffect(() => {
    (async () => {
      const token = await getToken();
      const meRes = await apiFetch<{ status: string; user?: { role: string } }>('/me', { token });
      const userRole = meRes.user?.role ?? '';
      setRole(userRole);

      let memberId: string | null = null;
      if (userRole === 'STUDENT') {
        const memberRes = await apiFetch<{ member: { id: string } }>('/members/me', { token }).catch(() => null);
        memberId = memberRes?.member.id ?? null;
        setMyMemberId(memberId);
      }

      const [paymentsRes, membersRes] = await Promise.all([
        apiFetch<{ payments: Payment[] }>(`/payments?month=${filterMonth}&year=${filterYear}`, { token }),
        userRole !== 'STUDENT' ? apiFetch<{ members: Member[] }>('/members', { token }) : Promise.resolve({ members: [] }),
      ]);

      const all = paymentsRes.payments;
      setPayments(userRole === 'STUDENT' && memberId ? all.filter(p => p.memberId === memberId) : all);
      setMembers(membersRes.members);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!loading) loadPayments(myMemberId !== null ? myMemberId : undefined);
  }, [filterMonth, filterYear]);

  const filtered = payments.filter(p => {
    const statusFilter = TAB_FILTER[activeTab];
    return statusFilter === null || p.status === statusFilter;
  });

  const totalPaid    = payments.filter(p => p.status === 'PAID').reduce((s, p) => s + p.amount, 0);
  const totalPending = payments.filter(p => p.status !== 'PAID').reduce((s, p) => s + p.amount, 0);

  function openNew() {
    setForm(emptyForm); setError(null); setOpen(true);
  }

  async function handleSave() {
    if (!form.memberId || !form.amount) return;
    setSaving(true); setError(null);
    try {
      const token = await getToken();
      await apiFetch('/payments', {
        method: 'POST', token,
        body: JSON.stringify({
          memberId: form.memberId,
          amount:   parseFloat(form.amount),
          month:    parseInt(form.month),
          year:     parseInt(form.year),
          status:   form.status,
          notes:    form.notes || undefined,
        }),
      });
      setOpen(false);
      await loadPayments();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkPaid(id: string) {
    const token = await getToken();
    await apiFetch(`/payments/${id}`, {
      method: 'PATCH', token,
      body: JSON.stringify({ status: 'PAID' }),
    });
    await loadPayments();
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este pago?')) return;
    setDeleting(id);
    try {
      const token = await getToken();
      await apiFetch(`/payments/${id}`, { method: 'DELETE', token });
      await loadPayments();
    } finally {
      setDeleting(null);
    }
  }

  // ── Skeleton mientras carga el rol ───────────────────────────────────────
  if (!role) {
    return (
      <div className="min-h-full bg-background px-4 pt-4 flex flex-col gap-3">
        <div className="h-8 w-32 rounded-lg bg-white border border-border animate-pulse" />
        <div className="h-32 rounded-2xl bg-white border border-border animate-pulse" />
        <div className="h-16 rounded-xl bg-white border border-border animate-pulse" />
        <div className="h-16 rounded-xl bg-white border border-border animate-pulse" />
      </div>
    );
  }

  // ── Vista STUDENT ────────────────────────────────────────────────────────
  if (role === 'STUDENT') {
    const pending = payments.filter(p => p.status === 'PENDING' || p.status === 'OVERDUE');
    const paid    = payments.filter(p => p.status === 'PAID');
    const totalOwed = pending.reduce((s, p) => s + p.amount, 0);
    const totalPaidStudent = paid.reduce((s, p) => s + p.amount, 0);
    const hasOverdue = pending.some(p => p.status === 'OVERDUE');

    return (
      <div className="min-h-full bg-background">
        {/* Header */}
        <div className="px-5 py-3 bg-background">
          <h1 className="text-[17px] font-bold text-foreground" style={{ fontFamily: 'inherit' }}>
            Mis pagos
          </h1>
        </div>

        <motion.div variants={stagger} initial="hidden" animate="show" className="px-4 pt-4 pb-8 flex flex-col gap-4">

          {loading ? (
            <motion.div variants={cardVariant} className="flex flex-col gap-3">
              <div className="h-32 rounded-2xl bg-white border border-border animate-pulse" />
              <div className="h-16 rounded-xl bg-white border border-border animate-pulse" />
              <div className="h-16 rounded-xl bg-white border border-border animate-pulse" />
            </motion.div>
          ) : (
            <>
              {/* Tarjeta estado actual */}
              <motion.div variants={cardVariant}
                className="rounded-2xl p-5 text-white"
                style={{
                  background: hasOverdue
                    ? 'linear-gradient(135deg,#EF476F,#B5002E)'
                    : pending.length > 0
                    ? 'linear-gradient(135deg,#FFB703,#F48C06)'
                    : 'linear-gradient(135deg,#06D6A0,#028A5B)',
                }}
              >
                <div className="flex items-center gap-2 mb-3 opacity-90">
                  {hasOverdue ? (
                    <AlertCircle className="w-4 h-4" />
                  ) : pending.length > 0 ? (
                    <Clock className="w-4 h-4" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <p className="text-[11px] font-bold tracking-widest uppercase">
                    {hasOverdue ? 'Pago vencido' : pending.length > 0 ? 'Pago pendiente' : 'Al día'}
                  </p>
                </div>

                {pending.length > 0 ? (
                  <>
                    <p className="text-[11px] opacity-75 uppercase tracking-wide mb-1">Por pagar</p>
                    <p className="text-4xl font-bold mb-1" style={{ fontFamily: 'inherit' }}>
                      {fmt.format(totalOwed)}
                    </p>
                    <p className="text-[11px] opacity-70">
                      {pending.length} {pending.length === 1 ? 'cuota pendiente' : 'cuotas pendientes'}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-3xl font-bold mb-1" style={{ fontFamily: 'inherit' }}>
                      ¡Todo pagado!
                    </p>
                    <p className="text-[11px] opacity-75">No tienes pagos pendientes</p>
                  </>
                )}
              </motion.div>

              {/* Resumen rápido */}
              <motion.div variants={cardVariant} className="grid grid-cols-2 gap-3">
                <div className="bg-white border border-border rounded-2xl p-4 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingUp className="w-3.5 h-3.5" style={{ color: '#06D6A0' }} />
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Total pagado</p>
                  </div>
                  <p className="text-[18px] font-bold text-foreground" style={{ fontFamily: 'inherit' }}>
                    {fmt.format(totalPaidStudent)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{paid.length} {paid.length === 1 ? 'pago' : 'pagos'}</p>
                </div>
                <div className="bg-white border border-border rounded-2xl p-4 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <CalendarDays className="w-3.5 h-3.5" style={{ color: '#4361EE' }} />
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Historial</p>
                  </div>
                  <p className="text-[18px] font-bold text-foreground" style={{ fontFamily: 'inherit' }}>
                    {payments.length}
                  </p>
                  <p className="text-[10px] text-muted-foreground">registros totales</p>
                </div>
              </motion.div>

              {/* Pendientes / vencidos primero */}
              {pending.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2 px-1">
                    Pendientes
                  </p>
                  <div className="space-y-2">
                    {pending.map(p => {
                      const sc = STATUS_COLORS[p.status] ?? STATUS_COLORS.PENDING;
                      const StatusIcon = sc.icon;
                      return (
                        <motion.div variants={cardVariant}
                          key={p.id}
                          className="bg-white border rounded-xl px-4 py-3.5 flex flex-col gap-3"
                          style={{ borderColor: sc.text + '33' }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                              style={{ background: sc.bg }}
                            >
                              <StatusIcon className="w-5 h-5" style={{ color: sc.text }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-bold text-foreground">
                                {MONTH_NAMES[p.month - 1]} {p.year}
                              </p>
                              {p.notes && (
                                <p className="text-[11px] text-muted-foreground truncate">{p.notes}</p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-[14px] font-bold" style={{ color: sc.text, fontFamily: 'inherit' }}>
                                {fmt.format(p.amount)}
                              </p>
                              <span
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                style={{ background: sc.bg, color: sc.text }}
                              >
                                {STATUS_LABELS[p.status]}
                              </span>
                            </div>
                          </div>

                          {/* Comprobante — solo el deportista (no admin/coach) */}
                          {!canManage && (
                            p.receiptUrl ? (
                              <div className="flex items-center justify-between gap-2 rounded-lg px-3 py-2"
                                style={{ background: 'rgba(255,183,3,0.10)' }}>
                                <span className="text-[11px] font-semibold" style={{ color: '#B8860B' }}>
                                  ⏳ Comprobante en revisión
                                </span>
                                <label className="text-[11px] font-bold cursor-pointer" style={{ color: '#7C3AED' }}>
                                  {uploadingReceipt === p.id ? 'Subiendo…' : 'Reemplazar'}
                                  <input type="file" accept="image/*,application/pdf" className="hidden"
                                    disabled={!!uploadingReceipt}
                                    onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadReceipt(p.id, f); e.target.value = ''; }} />
                                </label>
                              </div>
                            ) : (
                              <label className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-[12px] font-bold cursor-pointer transition-colors"
                                style={{ background: 'rgba(124,58,237,0.08)', color: '#7C3AED', border: '1.5px dashed rgba(124,58,237,0.25)' }}>
                                <Upload className="w-3.5 h-3.5" />
                                {uploadingReceipt === p.id ? 'Subiendo…' : 'Subir comprobante'}
                                <input type="file" accept="image/*,application/pdf" className="hidden"
                                  disabled={!!uploadingReceipt}
                                  onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadReceipt(p.id, f); e.target.value = ''; }} />
                              </label>
                            )
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Historial de pagados */}
              {paid.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2 px-1">
                    Historial
                  </p>
                  <div className="space-y-2">
                    {[...paid].reverse().map(p => (
                      <motion.div variants={cardVariant} key={p.id} className="bg-white border border-border rounded-xl px-4 py-3.5 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(6,214,160,0.10)' }}>
                          <CheckCircle2 className="w-5 h-5" style={{ color: '#06D6A0' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-foreground">
                            {MONTH_NAMES[p.month - 1]} {p.year}
                          </p>
                          {p.paidAt && (
                            <p className="text-[11px] text-muted-foreground">
                              Pagado el {new Date(p.paidAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                            </p>
                          )}
                        </div>
                        <p className="text-[14px] font-bold text-foreground shrink-0" style={{ fontFamily: 'inherit' }}>
                          {fmt.format(p.amount)}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {payments.length === 0 && (
                <div className="bg-white border border-border rounded-xl px-4 py-10 text-center">
                  <IconMisPagos className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-[13px] font-semibold text-muted-foreground">Sin pagos registrados</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Tu historial de pagos aparecerá aquí</p>
                </div>
              )}
            </>
          )}
        </motion.div>
      </div>
    );
  }

  // ── Vista ADMIN / COACH ───────────────────────────────────────────────────
  return (
    <div className="min-h-full bg-background">
      {/* Encabezado */}
      <div className="px-5 py-3 bg-background flex items-center justify-between">
        <h1 className="text-[17px] font-bold text-foreground" style={{ fontFamily: 'inherit' }}>
          Pagos
        </h1>
        {canManage && (
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #4361EE 100%)' }}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Registrar</span>
          </button>
        )}
      </div>

      <motion.div variants={stagger} initial="hidden" animate="show" className="px-4 pt-4 flex flex-col gap-4">

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

        {/* Tarjeta resumen */}
        <div
          className="rounded-2xl p-4 text-white"
          style={{ background: 'linear-gradient(135deg,#4361EE,#7209B7)' }}
        >
          <p className="text-[10px] font-semibold tracking-widest opacity-80 uppercase mb-1">
            Cobrado — {MONTH_NAMES[filterMonth - 1]} {filterYear}
          </p>
          <p className="text-4xl font-bold mb-3" style={{ fontFamily: 'inherit' }}>
            {fmt.format(totalPaid)}
          </p>
          <div className="flex gap-6">
            <div>
              <p className="text-[10px] opacity-70 uppercase tracking-wide">Total pagado</p>
              <p className="text-base font-bold" style={{ fontFamily: 'inherit' }}>
                {fmt.format(totalPaid)}
              </p>
            </div>
            <div>
              <p className="text-[10px] opacity-70 uppercase tracking-wide">Pendiente</p>
              <p className="text-base font-bold" style={{ fontFamily: 'inherit', color: '#FFB703' }}>
                {fmt.format(totalPending)}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs filtro */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="shrink-0 px-4 py-1.5 rounded-full text-[12px] font-semibold border"
              style={
                activeTab === tab
                  ? { background: '#4361EE', color: '#fff', borderColor: '#4361EE' }
                  : { background: '#fff', color: '#1A1028', borderColor: 'rgba(120,80,200,0.10)' }
              }
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-border rounded-xl px-4 py-10 text-center">
            <IconMisPagos className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-[13px] font-semibold text-muted-foreground">Sin pagos registrados</p>
            <p className="text-[11px] text-muted-foreground mt-1">Registra el primer pago del mes</p>
          </div>
        ) : (
          <div className="space-y-2 pb-4">
            {filtered.map(p => {
              const sc = STATUS_COLORS[p.status] ?? STATUS_COLORS.PENDING;
              const StatusIcon = sc.icon;
              return (
                <div key={p.id} className="bg-white border border-border rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-[13px] font-bold text-foreground truncate">{p.member.fullName}</p>
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 flex items-center gap-1"
                        style={{ background: sc.bg, color: sc.text }}
                      >
                        <StatusIcon className="w-2.5 h-2.5" />
                        {STATUS_LABELS[p.status]}
                      </span>
                    </div>
                    <p className="text-[12px] font-semibold text-foreground">{fmt.format(p.amount)}</p>
                    <p className="text-[10px] text-muted-foreground">{MONTH_NAMES[p.month - 1]} {p.year}</p>
                    {p.notes && <p className="text-[10px] text-muted-foreground mt-0.5">{p.notes}</p>}
                  </div>
                  {canManage && (
                    <div className="flex flex-col gap-1 shrink-0">
                      {p.status !== 'PAID' && (
                        <button
                          onClick={() => handleMarkPaid(p.id)}
                          className="px-2 py-1 rounded-lg text-[10px] font-semibold"
                          style={{ background: 'rgba(6,214,160,0.12)', color: '#06D6A0' }}
                        >
                          Marcar pagado
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(p.id)}
                        disabled={deleting === p.id}
                        className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-red-400 hover:text-red-600 self-end"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Modal registrar pago — solo ADMIN/COACH */}
      {canManage && <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar pago</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">

            <div className="space-y-2">
              <Label>Deportista *</Label>
              <Select value={form.memberId} onValueChange={v => setForm(f => ({ ...f, memberId: v ?? '' }))}>
                <SelectTrigger>
                  <span className="text-sm">{form.memberId ? members.find(m => m.id === form.memberId)?.fullName ?? 'Seleccionar miembro' : 'Seleccionar miembro'}</span>
                </SelectTrigger>
                <SelectContent>
                  {members.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Monto (COP) *</Label>
              <Input
                type="number"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="ej. 150000"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Mes</Label>
                <Select value={form.month} onValueChange={v => setForm(f => ({ ...f, month: v ?? '' }))}>
                  <SelectTrigger><span className="text-sm">{MONTH_NAMES[parseInt(form.month) - 1]}</span></SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((name, idx) => (
                      <SelectItem key={idx + 1} value={String(idx + 1)}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Año</Label>
                <Select value={form.year} onValueChange={v => setForm(f => ({ ...f, year: v ?? '' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026, 2027].map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v ?? 'PAID' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PAID">Pagado</SelectItem>
                  <SelectItem value="PENDING">Pendiente</SelectItem>
                  <SelectItem value="OVERDUE">Vencido</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notas</Label>
              <Input
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Opcional"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button onClick={handleSave} disabled={saving || !form.memberId || !form.amount} className="w-full">
              {saving ? 'Guardando...' : 'Registrar pago'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>}
    </div>
  );
}
