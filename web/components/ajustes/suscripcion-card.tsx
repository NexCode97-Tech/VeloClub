'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import Script from 'next/script';
import { apiFetch } from '@/lib/api-client';
import { CreditCard, RotateCcw, CheckCircle2, XCircle } from 'lucide-react';

const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

type TipoPlan = 'MENSUAL' | 'TRIMESTRAL' | 'ANUAL';
const PLAN_LABEL: Record<TipoPlan, string> = { MENSUAL: 'Mensual', TRIMESTRAL: 'Trimestral', ANUAL: 'Anual' };
const PLAN_DESCUENTO_LABEL: Record<TipoPlan, string> = { MENSUAL: 'Sin descuento', TRIMESTRAL: '10% de descuento', ANUAL: '20% de descuento' };
const MESES_POR_PLAN: Record<TipoPlan, number> = { MENSUAL: 1, TRIMESTRAL: 3, ANUAL: 12 };

interface PlanOpcion { tipoPlan: TipoPlan; precio: number; precioConAutoRenew: number }

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

  // Selección de plan — se muestra mientras el club no tenga ningún pago registrado
  const [pickedPlan, setPickedPlan] = useState(false);
  const [planes, setPlanes] = useState<PlanOpcion[] | null>(null);
  const [loadingPlanes, setLoadingPlanes] = useState(false);
  const [settingPlan, setSettingPlan] = useState<TipoPlan | null>(null);

  async function loadPlanes() {
    setLoadingPlanes(true);
    try {
      const token = await getToken();
      const res = await apiFetch<{ cantidadDeportistas: number; planes: PlanOpcion[] }>('/mercadopago/planes', { token });
      setPlanes(res.planes);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al cargar los planes'); }
    finally { setLoadingPlanes(false); }
  }

  async function handleElegirPlan(tipoPlan: TipoPlan) {
    setSettingPlan(tipoPlan); setError(null);
    try {
      const token = await getToken();
      await apiFetch('/mercadopago/set-plan', { method: 'POST', token, body: JSON.stringify({ tipoPlan }) });
      setPickedPlan(true);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo elegir el plan'); }
    finally { setSettingPlan(null); }
  }

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

  // Sin pagos registrados aún y sin elegir plan en esta sesión → cargar precios de los 3 planes
  useEffect(() => {
    if (data && !data.vigencia && !pickedPlan && !planes && !loadingPlanes) loadPlanes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, pickedPlan]);

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

  // Sin pagos registrados y sin elegir plan aún en esta sesión → mostrar selector
  if (!data.vigencia && !pickedPlan) {
    return (
      <div className="bg-white border border-border rounded-2xl p-5">
        <p className="text-[11px] font-semibold text-muted-foreground tracking-wide mb-1">Sin plan activo · {data.cantidadDeportistas} deportistas</p>
        <p className="text-[15px] font-bold text-foreground mb-4">Elige tu plan</p>

        {error && <p className="text-[12px] text-red-500 mb-3">{error}</p>}

        {loadingPlanes || !planes ? (
          <div className="flex justify-center py-10">
            <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : (
          <div className="space-y-2.5">
            {planes.map(p => {
              const destacado = p.tipoPlan === 'TRIMESTRAL';
              const precioMes = Math.round(p.precio / MESES_POR_PLAN[p.tipoPlan]);
              return (
                <button
                  key={p.tipoPlan}
                  onClick={() => handleElegirPlan(p.tipoPlan)}
                  disabled={settingPlan !== null}
                  className="w-full text-left rounded-xl p-4 transition-colors disabled:opacity-60"
                  style={{ border: destacado ? '2px solid #7C3AED' : '1px solid var(--border, rgba(0,0,0,0.10))', background: '#fff' }}
                >
                  {destacado && (
                    <span className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-md mb-2" style={{ background: 'rgba(124,58,237,0.10)', color: '#7C3AED' }}>
                      Más popular
                    </span>
                  )}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[14px] font-semibold text-foreground">{PLAN_LABEL[p.tipoPlan]}</p>
                      <p className="text-[12px] mt-0.5" style={{ color: p.tipoPlan === 'MENSUAL' ? 'var(--muted-foreground, #8E87A8)' : '#06D6A0' }}>
                        {PLAN_DESCUENTO_LABEL[p.tipoPlan]}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[18px] font-bold text-foreground">{settingPlan === p.tipoPlan ? '...' : fmt.format(p.precio)}</p>
                      {p.tipoPlan !== 'MENSUAL' && (
                        <p className="text-[11px] text-muted-foreground">{fmt.format(precioMes)} / mes</p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground text-center mt-4">
          Activa la renovación automática en cualquier plan y suma 5% adicional
        </p>
      </div>
    );
  }

  const { suscripcion, cantidadDeportistas, vigencia } = data;
  const pctColor = !vigencia ? '#8E87A8' : vigencia.vencido ? '#EF476F' : vigencia.pct >= 50 ? '#06D6A0' : vigencia.pct >= 20 ? '#FFB703' : '#EF476F';

  return (
    <>
      <Script src="https://sdk.mercadopago.com/js/v2" strategy="afterInteractive" onLoad={() => setSdkReady(true)} />

      <div className="bg-white border border-border rounded-2xl p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground tracking-wide">Plan {PLAN_LABEL[suscripcion.tipoPlan]}</p>
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
              <p className="text-[13px] font-semibold text-foreground flex items-center gap-1.5">
                Renovación automática
                {suscripcion.autoRenew && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(6,214,160,0.12)', color: '#06D6A0' }}>-5%</span>
                )}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {suscripcion.autoRenew ? 'Se cobra sola cuando vence, con 5% de descuento' : 'Actívala y obtén 5% de descuento adicional'}
              </p>
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

        {(!vigencia || vigencia.vencido) && (
          <button onClick={handlePagar} disabled={paying}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white text-[13px] font-semibold disabled:opacity-60">
            <RotateCcw className="w-4 h-4" />
            {paying ? 'Redirigiendo...' : 'Pagar suscripción ahora'}
          </button>
        )}
      </div>
    </>
  );
}
