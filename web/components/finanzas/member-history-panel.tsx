'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import {
  X, Check, Clock, AlertCircle, Receipt, Download, MessageCircle,
  FileDown, Upload, Trash2, FileX, RotateCcw,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { downloadInvoicePDF, downloadHistoryPDF } from '@/lib/pdf';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];
const IOS: [number, number, number, number] = [0.32, 0.72, 0, 1];

const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const MONTHS_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MONTHS_INI  = ['E','F','M','A','M','J','J','A','S','O','N','D'];

export interface HistoryMember {
  id: string; fullName: string;
  phone?: string; emergencyPhone?: string;
  docType?: string | null; docNumber?: string | null;
  monthlyFee?: number | null; paymentDueDay?: number | null;
}

interface HistoryPayment {
  id: string; amount: number; month: number; year: number; status: string;
  dueDate?: string | null; paidAt?: string | null; notes?: string | null;
  receiptUrl?: string | null; receiptPublicId?: string | null;
}

// Estado visual de un mes: distingue pagó a tiempo de pagó tarde, algo que la
// lista mensual no permite ver.
type MonthState = 'ontime' | 'late' | 'pending' | 'none';

const MONTH_STYLE: Record<MonthState, { bg: string; color: string; label: string }> = {
  ontime:  { bg: 'rgba(6,214,160,0.16)',  color: '#0B7A5D', label: 'pagado a tiempo' },
  late:    { bg: 'rgba(239,71,111,0.16)', color: '#A32D2D', label: 'pagado con retraso' },
  pending: { bg: 'rgba(255,183,3,0.20)',  color: '#8A6200', label: 'pendiente' },
  none:    { bg: 'rgba(120,80,200,0.07)', color: '#B8B2CC', label: 'sin generar' },
};

function pagoATiempo(p: HistoryPayment): boolean | null {
  if (p.status !== 'PAID' || !p.paidAt || !p.dueDate) return null;
  return new Date(p.paidAt) <= new Date(p.dueDate);
}

function estadoMes(p: HistoryPayment | undefined): MonthState {
  if (!p) return 'none';
  if (p.status === 'PAID') {
    const t = pagoATiempo(p);
    return t === false ? 'late' : 'ontime';
  }
  if (p.status === 'REFUNDED') return 'none';
  return 'pending';
}

function fechaCorta(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
}

function diasDeDiferencia(paidAt: string, dueDate: string): number {
  return Math.round((new Date(paidAt).getTime() - new Date(dueDate).getTime()) / 86_400_000);
}

export default function MemberHistoryPanel({
  member, clubName, clubLogoUrl, onClose, onChanged,
}: {
  member: HistoryMember;
  clubName: string;
  clubLogoUrl: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { getToken } = useAuth();
  const reducedMotion = useReducedMotion();

  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [receipt, setReceipt] = useState<HistoryPayment | null>(null);
  const [receiptFile, setReceiptFile] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generandoPdf, setGenerandoPdf] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['memberPayments', member.id],
    queryFn: async () => {
      const token = await getToken();
      return apiFetch<{ payments: HistoryPayment[] }>(`/payments?memberId=${member.id}`, { token });
    },
  });

  const payments = useMemo(() => data?.payments ?? [], [data]);

  // Cerrar con Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !receipt) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, receipt]);

  // Años con movimiento, del más reciente al más antiguo
  const years = useMemo(() => {
    const s = new Set(payments.map(p => p.year));
    s.add(new Date().getFullYear());
    return Array.from(s).sort((a, b) => b - a);
  }, [payments]);

  useEffect(() => {
    if (years.length > 0 && !years.includes(year)) setYear(years[0]);
  }, [years, year]);

  const stats = useMemo(() => {
    const pagados    = payments.filter(p => p.status === 'PAID');
    const pendientes = payments.filter(p => p.status !== 'PAID' && p.status !== 'REFUNDED');
    const conFechas  = pagados.filter(p => p.dueDate && p.paidAt);
    const aTiempo    = conFechas.filter(p => pagoATiempo(p) === true).length;
    return {
      totalPagado:    pagados.reduce((a, p) => a + p.amount, 0),
      totalPendiente: pendientes.reduce((a, p) => a + p.amount, 0),
      puntualidad:    conFechas.length > 0 ? Math.round((aTiempo / conFechas.length) * 100) : null,
    };
  }, [payments]);

  const delAño = useMemo(
    () => payments.filter(p => p.year === year).sort((a, b) => b.month - a.month),
    [payments, year],
  );

  const porMes = useMemo(() => {
    const map = new Map<number, HistoryPayment>();
    for (const p of payments) if (p.year === year) map.set(p.month, p);
    return map;
  }, [payments, year]);

  async function marcarPagado(id: string) {
    setBusy(id); setError(null);
    try {
      const token = await getToken();
      await apiFetch(`/payments/${id}`, { method: 'PATCH', token, body: JSON.stringify({ status: 'PAID' }) });
      await refetch();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo marcar como pagado');
    } finally { setBusy(null); }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { setError('La imagen no puede superar 3MB'); return; }
    setError(null);
    const reader = new FileReader();
    reader.onload = ev => setReceiptFile(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function subirComprobante() {
    if (!receipt || !receiptFile) return;
    setBusy('receipt'); setError(null);
    try {
      const token = await getToken();
      await apiFetch(`/payments/${receipt.id}/receipt`, {
        method: 'POST', token, body: JSON.stringify({ base64: receiptFile }),
      });
      setReceipt(null); setReceiptFile(null);
      await refetch();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir el comprobante');
    } finally { setBusy(null); }
  }

  async function borrarComprobante() {
    if (!receipt) return;
    setBusy('receipt'); setError(null);
    try {
      const token = await getToken();
      await apiFetch(`/payments/${receipt.id}/receipt`, { method: 'DELETE', token });
      setReceipt(null); setReceiptFile(null);
      await refetch();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar el comprobante');
    } finally { setBusy(null); }
  }

  async function descargarHistorial() {
    setGenerandoPdf(true);
    try {
      await downloadHistoryPDF(member, payments, clubName, clubLogoUrl);
    } finally { setGenerandoPdf(false); }
  }

  const contactPhone = member.emergencyPhone || member.phone;

  return (
    <>
      {/* Fondo oscurecido */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.25, ease: EASE_OUT }}
        onClick={onClose}
        className="fixed inset-0 z-[90]"
        style={{ background: 'rgba(26,16,40,0.42)', backdropFilter: 'blur(3px)' }}
      />

      {/* Panel lateral */}
      <motion.aside
        initial={reducedMotion ? { opacity: 0 } : { x: '100%' }}
        animate={reducedMotion ? { opacity: 1 } : { x: 0 }}
        exit={reducedMotion ? { opacity: 0 } : { x: '100%' }}
        transition={{ duration: reducedMotion ? 0.2 : 0.42, ease: IOS }}
        className="fixed right-0 top-0 bottom-0 z-[91] w-full sm:w-[440px] bg-white flex flex-col"
        style={{ boxShadow: '-8px 0 40px rgba(26,16,40,0.16)' }}
        role="dialog"
        aria-label={`Historial de pagos de ${member.fullName}`}
      >
        {/* Encabezado */}
        <div className="flex items-center gap-3 px-4 shrink-0"
          style={{ minHeight: 62, borderBottom: '1px solid rgba(120,80,200,0.10)' }}>
          <div className="flex items-center justify-center text-white font-semibold shrink-0"
            style={{ width: 44, height: 44, borderRadius: '50%', fontSize: 14, background: 'linear-gradient(135deg,#7C3AED,#4361EE)' }}>
            {member.fullName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14.5px] font-semibold truncate m-0" style={{ color: '#1A1028' }}>{member.fullName}</p>
            <p className="text-[11px] m-0 truncate" style={{ color: '#8E87A8' }}>
              {[
                member.docNumber ? `${member.docType ?? 'CC'} ${member.docNumber}` : null,
                member.monthlyFee ? `Cuota ${fmt.format(member.monthlyFee)}` : null,
                member.paymentDueDay ? `Vence el ${member.paymentDueDay}` : null,
              ].filter(Boolean).join(' · ') || 'Sin configurar'}
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar"
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors hover:bg-secondary"
            style={{ color: '#8E87A8' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#7C3AED', borderTopColor: 'transparent' }} />
            </div>
          ) : (
            <>
              {/* Indicadores */}
              <div className="grid grid-cols-3" style={{ gap: 1, background: 'rgba(120,80,200,0.10)' }}>
                {[
                  { l: 'Total pagado', v: fmt.format(stats.totalPagado), c: '#06D6A0' },
                  { l: 'Pendiente',    v: fmt.format(stats.totalPendiente), c: '#EF476F' },
                  { l: 'Puntualidad',  v: stats.puntualidad !== null ? `${stats.puntualidad}%` : '—', c: '#7C3AED' },
                ].map(s => (
                  <div key={s.l} className="bg-white text-center" style={{ padding: '12px 6px' }}>
                    <p className="m-0 text-[10.5px]" style={{ color: '#8E87A8' }}>{s.l}</p>
                    <p className="m-0 text-[15px] font-semibold" style={{ color: s.c, letterSpacing: '-0.3px' }}>{s.v}</p>
                  </div>
                ))}
              </div>

              {/* Selector de año */}
              {years.length > 1 && (
                <div className="flex gap-1.5 px-4 pt-4 flex-wrap">
                  {years.map(y => (
                    <button key={y} onClick={() => setYear(y)}
                      className="px-3 py-1 rounded-lg text-[11.5px] font-semibold transition-colors"
                      style={{
                        background: y === year ? 'rgba(124,58,237,0.10)' : 'transparent',
                        color: y === year ? '#7C3AED' : '#8E87A8',
                        border: `1px solid ${y === year ? 'rgba(124,58,237,0.28)' : 'rgba(120,80,200,0.14)'}`,
                      }}>
                      {y}
                    </button>
                  ))}
                </div>
              )}

              {/* Mapa del año */}
              <div className="px-4 pt-4">
                <p className="m-0 mb-2.5 text-[11px] font-semibold" style={{ color: '#8E87A8' }}>
                  {year} en un vistazo
                </p>
                <div className="grid grid-cols-12" style={{ gap: 4 }}>
                  {MONTHS_INI.map((ini, i) => {
                    const p = porMes.get(i + 1);
                    const st = MONTH_STYLE[estadoMes(p)];
                    return (
                      <div key={i}
                        title={`${MONTHS_FULL[i]} · ${st.label}`}
                        className="flex items-center justify-center text-[9px] font-semibold transition-transform hover:scale-[1.18]"
                        style={{ aspectRatio: '1', borderRadius: 5, background: st.bg, color: st.color }}>
                        {ini}
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-2.5">
                  {([['ontime','Al día'],['late','Pagó tarde'],['pending','Pendiente'],['none','Sin generar']] as [MonthState,string][]).map(([k, l]) => (
                    <span key={k} className="flex items-center gap-1.5 text-[10.5px]" style={{ color: '#8E87A8' }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: MONTH_STYLE[k].bg, border: `1px solid ${MONTH_STYLE[k].color}33` }} />
                      {l}
                    </span>
                  ))}
                </div>
              </div>

              {/* Historial */}
              <div className="px-4 pt-5 pb-4">
                <p className="m-0 mb-1 text-[11px] font-semibold" style={{ color: '#8E87A8' }}>
                  Historial de pagos
                </p>

                {delAño.length === 0 ? (
                  <div className="text-center" style={{ padding: '28px 8px' }}>
                    <p className="m-0 text-[12.5px] font-semibold" style={{ color: '#8E87A8' }}>Sin pagos en {year}</p>
                    <p className="m-0 mt-1 text-[11px]" style={{ color: '#C4BFD8' }}>Los cobros que generes aparecerán aquí</p>
                  </div>
                ) : delAño.map(p => {
                  const aTiempo = pagoATiempo(p);
                  const pagado  = p.status === 'PAID';
                  const dias    = pagado && p.paidAt && p.dueDate ? diasDeDiferencia(p.paidAt, p.dueDate) : null;

                  const Icon = pagado ? (aTiempo === false ? AlertCircle : Check) : Clock;
                  const tono = pagado
                    ? (aTiempo === false ? { bg: 'rgba(239,71,111,0.12)', fg: '#A32D2D' } : { bg: 'rgba(6,214,160,0.13)', fg: '#0B7A5D' })
                    : { bg: 'rgba(255,183,3,0.14)', fg: '#8A6200' };

                  return (
                    <div key={p.id}
                      className="flex items-center gap-3"
                      style={{ padding: '10px 0', borderBottom: '1px solid rgba(120,80,200,0.07)' }}>
                      <div className="flex items-center justify-center shrink-0"
                        style={{ width: 32, height: 32, borderRadius: 9, background: tono.bg, color: tono.fg }}>
                        <Icon className="w-4 h-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="m-0 text-[13px] font-semibold" style={{ color: '#1A1028' }}>
                          {MONTHS_FULL[p.month - 1]} · {fmt.format(p.amount)}
                        </p>
                        <p className="m-0 text-[11px]" style={{ color: '#8E87A8' }}>
                          {pagado
                            ? `Pagado el ${fechaCorta(p.paidAt)}${dias !== null ? (dias > 0 ? ` · ${dias} día${dias !== 1 ? 's' : ''} tarde` : ' · a tiempo') : ''}`
                            : p.dueDate ? `Vence el ${fechaCorta(p.dueDate)} · sin pagar` : 'Sin pagar'}
                        </p>
                      </div>

                      {/* Acciones según el estado */}
                      {!pagado && contactPhone && (
                        <button
                          onClick={() => window.open(buildWhatsAppUrl(contactPhone, member.fullName, p.amount, p.month, p.year, clubName), '_blank')}
                          title="Recordar por WhatsApp"
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-transform active:scale-95"
                          style={{ background: 'rgba(37,211,102,0.12)', color: '#25D366' }}>
                          <MessageCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {!pagado && (
                        <button onClick={() => marcarPagado(p.id)} disabled={busy === p.id}
                          title="Marcar como pagado"
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 disabled:opacity-50 transition-transform active:scale-95"
                          style={{ background: 'rgba(6,214,160,0.13)', color: '#0B7A5D' }}>
                          {busy === p.id
                            ? <div className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#0B7A5D', borderTopColor: 'transparent' }} />
                            : <Check className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      <button
                        onClick={() => { setReceipt(p); setReceiptFile(null); setError(null); }}
                        title={p.receiptUrl ? 'Ver comprobante' : 'Subir comprobante'}
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-transform active:scale-95"
                        style={{
                          border: '1px solid rgba(120,80,200,0.16)',
                          color: p.receiptUrl ? '#7C3AED' : '#B8B2CC',
                        }}>
                        {p.receiptUrl ? <Receipt className="w-3.5 h-3.5" /> : <FileX className="w-3.5 h-3.5" />}
                      </button>
                      {pagado && (
                        <button
                          onClick={() => downloadInvoicePDF(
                            { ...p, paidAt: p.paidAt ?? undefined, notes: p.notes ?? undefined, memberName: member.fullName, docType: member.docType, docNumber: member.docNumber },
                            clubName, clubLogoUrl,
                          )}
                          title="Descargar recibo"
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-transform active:scale-95"
                          style={{ border: '1px solid rgba(120,80,200,0.16)', color: '#7C3AED' }}>
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Descargar historial completo */}
        <div className="px-4 py-3 shrink-0" style={{ borderTop: '1px solid rgba(120,80,200,0.10)' }}>
          <button onClick={descargarHistorial} disabled={generandoPdf || payments.length === 0}
            className="w-full flex items-center justify-center gap-2 rounded-xl text-[12.5px] font-semibold text-white disabled:opacity-50 transition-transform active:scale-[0.98]"
            style={{ padding: '11px 0', background: 'linear-gradient(135deg,#7C3AED,#4361EE)' }}>
            <FileDown className="w-4 h-4" />
            {generandoPdf ? 'Generando...' : 'Descargar historial en PDF'}
          </button>
        </div>
      </motion.aside>

      {/* Modal de comprobante — dentro del mismo panel */}
      <Dialog open={!!receipt} onOpenChange={v => { if (!v) { setReceipt(null); setReceiptFile(null); setError(null); } }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>
              Comprobante · {receipt ? `${MONTHS_FULL[receipt.month - 1]} ${receipt.year}` : ''}
            </DialogTitle>
          </DialogHeader>

          {receipt && (
            <div className="space-y-3">
              {(receiptFile || receipt.receiptUrl) ? (
                <div className="rounded-xl overflow-hidden flex items-center justify-center"
                  style={{ border: '1px solid rgba(120,80,200,0.14)', background: '#F7F7FB' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={receiptFile ?? receipt.receiptUrl!} alt="Comprobante de pago"
                    style={{ width: '100%', maxHeight: 320, objectFit: 'contain' }} />
                </div>
              ) : (
                <div className="rounded-xl flex flex-col items-center justify-center gap-2"
                  style={{ border: '1px dashed rgba(120,80,200,0.24)', background: '#F7F7FB', padding: '32px 16px' }}>
                  <FileX className="w-7 h-7" style={{ color: '#C4BFD8' }} />
                  <p className="m-0 text-[12px]" style={{ color: '#8E87A8' }}>Este pago no tiene comprobante</p>
                </div>
              )}

              {error && <p className="m-0 text-[12px]" style={{ color: '#EF476F' }}>{error}</p>}

              <div className="flex gap-2">
                <label
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl text-[12px] font-semibold cursor-pointer transition-colors"
                  style={{ padding: '10px 0', border: '1px solid rgba(120,80,200,0.18)', color: '#7C3AED' }}>
                  {receipt.receiptUrl ? <RotateCcw className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
                  {receipt.receiptUrl ? 'Reemplazar' : 'Subir'}
                  <input type="file" accept="image/*" onChange={onFile} className="hidden" />
                </label>

                {receipt.receiptUrl && !receiptFile && (
                  <button onClick={borrarComprobante} disabled={busy === 'receipt'}
                    className="flex items-center justify-center gap-2 rounded-xl text-[12px] font-semibold disabled:opacity-50"
                    style={{ padding: '10px 16px', border: '1px solid rgba(239,71,111,0.25)', background: 'rgba(239,71,111,0.06)', color: '#EF476F' }}>
                    <Trash2 className="w-3.5 h-3.5" /> Eliminar
                  </button>
                )}

                {receiptFile && (
                  <button onClick={subirComprobante} disabled={busy === 'receipt'}
                    className="flex-1 rounded-xl text-[12px] font-semibold text-white disabled:opacity-50"
                    style={{ padding: '10px 0', background: 'linear-gradient(135deg,#7C3AED,#4361EE)' }}>
                    {busy === 'receipt' ? 'Guardando...' : 'Guardar comprobante'}
                  </button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
