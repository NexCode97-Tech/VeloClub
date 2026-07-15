'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import Script from 'next/script';
import { apiFetch } from '@/lib/api-client';
import { CreditCard, RotateCcw, CheckCircle2, XCircle } from 'lucide-react';

const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

type TipoPlan = 'MENSUAL' | 'TRIMESTRAL' | 'ANUAL';
const PLAN_LABEL: Record<TipoPlan, string> = { MENSUAL: 'Mensual', TRIMESTRAL: 'Trimestral', ANUAL: 'Anual' };

interface Suscripcion {
  id: string;
  tipoPlan: TipoPlan;
  planMonto: number;
  autoRenew: boolean;
}
interface MiSuscripcionResponse {
  suscripcion: Suscripcion;
  cantidadDeportistas: number;
  vigencia: { pct: number; diasRestantes: number; vencido: boolean } | null;
}

interface MpCardTokenParams {
  cardNumber: string; cardholderName: string;
  cardExpirationMonth: string; cardExpirationYear: string;
  securityCode: string; identificationType: string; identificationNumber: string;
}
interface MpInstance {
  createCardToken: (params: MpCardTokenParams) => Promise<{ id: string }>;
}
declare global {
  interface Window { MercadoPago?: new (publicKey: string) => MpInstance }
}

export default function SuscripcionCard() {
  const { getToken } = useAuth();
  const [data, setData] = useState<MiSuscripcionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [unsubscribing, setUnsubscribing] = useState(false);
  const [showCardForm, setShowCardForm] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [card, setCard] = useState({ number: '', name: '', month: '', year: '', cvv: '', docNumber: '' });

  async function load() {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await apiFetch<MiSuscripcionResponse>('/mercadopago/mi-suscripcion', { token });
      setData(res);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al cargar la suscripción'); }
    finally { setLoading(false); }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  async function handlePagar() {
    setPaying(true); setError(null);
    try {
      const token = await getToken();
      const res = await apiFetch<{ initPoint: string }>('/mercadopago/checkout', { method: 'POST', token });
      window.location.href = res.initPoint;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar el pago');
      setPaying(false);
    }
  }

  async function handleActivarAutoRenew() {
    if (!window.MercadoPago) { setError('El pago aún está cargando, intenta de nuevo en unos segundos.'); return; }
    setActivating(true); setError(null);
    try {
      const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
      if (!publicKey) throw new Error('Falta configurar la llave pública de Mercado Pago');
      const mp = new window.MercadoPago(publicKey);

      const tokenResult = await mp.createCardToken({
        cardNumber: card.number.replace(/\s/g, ''),
        cardholderName: card.name,
        cardExpirationMonth: card.month,
        cardExpirationYear: card.year,
        securityCode: card.cvv,
        identificationType: 'CC',
        identificationNumber: card.docNumber,
      });

      const token = await getToken();
      await apiFetch('/mercadopago/subscribe', {
        method: 'POST', token,
        body: JSON.stringify({ cardTokenId: tokenResult.id }),
      });

      setShowCardForm(false);
      setCard({ number: '', name: '', month: '', year: '', cvv: '', docNumber: '' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo activar la renovación automática. Revisa los datos de la tarjeta.');
    } finally {
      setActivating(false);
    }
  }

  async function handleDesactivarAutoRenew() {
    if (!confirm('¿Desactivar la renovación automática? Tendrás que pagar manualmente cuando venza tu plan.')) return;
    setUnsubscribing(true); setError(null);
    try {
      const token = await getToken();
      await apiFetch('/mercadopago/unsubscribe', { method: 'POST', token });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo desactivar'); }
    finally { setUnsubscribing(false); }
  }

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
  if (!data) return <p className="text-sm text-muted-foreground text-center py-10">No se pudo cargar tu suscripción.</p>;

  const { suscripcion, cantidadDeportistas, vigencia } = data;
  const pctColor = !vigencia ? '#8E87A8' : vigencia.vencido ? '#EF476F' : vigencia.pct >= 50 ? '#06D6A0' : vigencia.pct >= 20 ? '#FFB703' : '#EF476F';

  return (
    <>
      <Script src="https://sdk.mercadopago.com/js/v2" strategy="afterInteractive" onLoad={() => setSdkReady(true)} />

      <div className="bg-white border border-border rounded-2xl p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Plan {PLAN_LABEL[suscripcion.tipoPlan]}</p>
            <p className="text-[22px] font-extrabold text-foreground">{fmt.format(suscripcion.planMonto)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{cantidadDeportistas} deportista{cantidadDeportistas !== 1 ? 's' : ''} registrados</p>
          </div>
          {vigencia && (
            <div className="text-right">
              <p className="text-[26px] font-extrabold" style={{ color: pctColor }}>{vigencia.pct}%</p>
              <p className="text-[10px] font-bold" style={{ color: pctColor }}>{vigencia.vencido ? 'Vencido' : `${vigencia.diasRestantes}d restantes`}</p>
            </div>
          )}
        </div>

        {vigencia && (
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${vigencia.pct}%`, background: pctColor }} />
          </div>
        )}

        {error && <p className="text-[12px] text-red-500">{error}</p>}

        {/* Renovación automática */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/40">
          <div className="flex items-center gap-2">
            {suscripcion.autoRenew ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-muted-foreground" />}
            <div>
              <p className="text-[13px] font-semibold text-foreground">Renovación automática</p>
              <p className="text-[11px] text-muted-foreground">{suscripcion.autoRenew ? 'Se cobra sola cuando vence' : 'Debes pagar manualmente cada vez'}</p>
            </div>
          </div>
          {suscripcion.autoRenew ? (
            <button onClick={handleDesactivarAutoRenew} disabled={unsubscribing}
              className="text-[12px] font-semibold text-red-500 hover:opacity-70 transition-colors shrink-0">
              {unsubscribing ? '...' : 'Desactivar'}
            </button>
          ) : (
            <button onClick={() => setShowCardForm(v => !v)}
              className="text-[12px] font-semibold text-primary hover:opacity-70 transition-colors shrink-0">
              {showCardForm ? 'Cancelar' : 'Activar'}
            </button>
          )}
        </div>

        {showCardForm && !suscripcion.autoRenew && (
          <div className="space-y-3 p-4 rounded-xl border border-border">
            <p className="text-[12px] font-semibold text-foreground flex items-center gap-2"><CreditCard className="w-3.5 h-3.5" /> Datos de la tarjeta</p>
            <input placeholder="Número de tarjeta" value={card.number} onChange={e => setCard(c => ({ ...c, number: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-input text-sm" inputMode="numeric" />
            <input placeholder="Nombre del titular" value={card.name} onChange={e => setCard(c => ({ ...c, name: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-input text-sm" />
            <div className="grid grid-cols-4 gap-2">
              <input placeholder="MM" value={card.month} onChange={e => setCard(c => ({ ...c, month: e.target.value }))}
                className="px-3 py-2 rounded-lg border border-input text-sm" inputMode="numeric" maxLength={2} />
              <input placeholder="AAAA" value={card.year} onChange={e => setCard(c => ({ ...c, year: e.target.value }))}
                className="px-3 py-2 rounded-lg border border-input text-sm" inputMode="numeric" maxLength={4} />
              <input placeholder="CVV" value={card.cvv} onChange={e => setCard(c => ({ ...c, cvv: e.target.value }))}
                className="px-3 py-2 rounded-lg border border-input text-sm" inputMode="numeric" maxLength={4} />
              <input placeholder="Cédula" value={card.docNumber} onChange={e => setCard(c => ({ ...c, docNumber: e.target.value }))}
                className="px-3 py-2 rounded-lg border border-input text-sm" inputMode="numeric" />
            </div>
            <button onClick={handleActivarAutoRenew} disabled={activating || !sdkReady}
              className="w-full py-2.5 rounded-xl bg-primary text-white text-[13px] font-semibold disabled:opacity-60">
              {activating ? 'Activando...' : 'Guardar tarjeta y activar'}
            </button>
          </div>
        )}

        <button onClick={handlePagar} disabled={paying}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white text-[13px] font-semibold disabled:opacity-60">
          <RotateCcw className="w-4 h-4" />
          {paying ? 'Redirigiendo...' : 'Pagar suscripción ahora'}
        </button>
      </div>
    </>
  );
}
