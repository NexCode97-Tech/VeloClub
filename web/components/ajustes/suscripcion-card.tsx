'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import Script from 'next/script';
import { apiFetch } from '@/lib/api-client';
import { CreditCard, CheckCircle2, XCircle, ArrowLeft, Landmark, Banknote, Clock } from 'lucide-react';

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
  getPaymentMethods: (params: { bin: string }) => Promise<{ results: Array<{ id: string }> }>;
}
declare global {
  interface Window { MercadoPago?: new (publicKey: string) => MpInstance }
}

type MetodoPago = 'CARD' | 'PSE' | 'EFECTY';
interface MetodosDisponibles {
  tarjeta: boolean;
  pse: { disponible: boolean; bancos: Array<{ id: string; description: string }> };
  efecty: boolean;
}
const DOC_TYPES = ['CC', 'CE', 'NIT', 'TI', 'PAS'];

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

  // Pago dentro de la app (Checkout API) — medios, formularios y consentimientos
  const [metodos, setMetodos] = useState<MetodosDisponibles | null>(null);
  const [loadingMetodos, setLoadingMetodos] = useState(false);
  const [metodo, setMetodo] = useState<MetodoPago>('CARD');
  const [pse, setPse] = useState({ bancoId: '', personType: 'natural', docType: 'CC', docNumber: '' });
  const [efecty, setEfecty] = useState({ docType: 'CC', docNumber: '' });
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [aceptaRecurrente, setAceptaRecurrente] = useState(false);
  const [payPending, setPayPending] = useState(false);
  const [voucherUrl, setVoucherUrl] = useState<string | null>(null);

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

  async function loadMetodos() {
    setLoadingMetodos(true);
    try {
      const token = await getToken();
      const res = await apiFetch<MetodosDisponibles>('/mercadopago/metodos-pago', { token });
      setMetodos(res);
      if (!res.tarjeta) setMetodo(res.pse.disponible ? 'PSE' : 'EFECTY');
    } catch { /* la sección de pago mostrará solo tarjeta como fallback */ }
    finally { setLoadingMetodos(false); }
  }

  // Cargar los medios de pago cuando hay algo por pagar (sin vigencia o vencido)
  useEffect(() => {
    const debePagar = data && ((!data.vigencia && pickedPlan) || data.vigencia?.vencido);
    if (debePagar && !metodos && !loadingMetodos) loadMetodos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, pickedPlan]);

  async function handlePagarDirecto() {
    setPaying(true); setError(null);
    try {
      const body: Record<string, unknown> = { metodo, aceptaTerminos };

      if (metodo === 'CARD') {
        if (!window.MercadoPago) throw new Error('El pago aún está cargando, intenta de nuevo en unos segundos.');
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
        const bin = card.number.replace(/\s/g, '').slice(0, 6);
        const pm = await mp.getPaymentMethods({ bin });
        const paymentMethodId = pm.results?.[0]?.id;
        if (!paymentMethodId) throw new Error('No reconocimos la tarjeta. Verifica el número.');
        Object.assign(body, { cardTokenId: tokenResult.id, paymentMethodId, docType: 'CC', docNumber: card.docNumber });
      } else if (metodo === 'PSE') {
        Object.assign(body, { bancoId: pse.bancoId, personType: pse.personType, docType: pse.docType, docNumber: pse.docNumber });
      } else {
        Object.assign(body, { docType: efecty.docType, docNumber: efecty.docNumber });
      }

      const token = await getToken();
      const res = await apiFetch<{ status: string; redirectUrl?: string | null }>('/mercadopago/pagar', {
        method: 'POST', token, body: JSON.stringify(body),
      });

      if (res.status === 'approved') {
        setCard({ number: '', name: '', month: '', year: '', cvv: '', docNumber: '' });
        await load();
      } else if (res.status === 'pending') {
        if (metodo === 'PSE' && res.redirectUrl) {
          // PSE: el banco es quien autoriza la transferencia — redirección obligatoria
          window.location.href = res.redirectUrl;
          return;
        }
        setVoucherUrl(res.redirectUrl ?? null);
        setPayPending(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo procesar el pago. Intenta de nuevo.');
    } finally {
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
        body: JSON.stringify({ cardTokenId: tokenResult.id, aceptaTerminos: aceptaRecurrente }),
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
          <div className="space-y-2.5 md:space-y-0 md:grid md:grid-cols-3 md:gap-4 md:items-stretch">
            {planes.map(p => {
              const destacado = p.tipoPlan === 'TRIMESTRAL';
              const precioMes = Math.round(p.precio / MESES_POR_PLAN[p.tipoPlan]);
              return (
                <button
                  key={p.tipoPlan}
                  onClick={() => handleElegirPlan(p.tipoPlan)}
                  disabled={settingPlan !== null}
                  className="w-full text-left rounded-xl p-4 transition-colors disabled:opacity-60 md:relative md:flex md:flex-col md:text-center md:p-5"
                  style={{ border: destacado ? '2px solid #7C3AED' : '1px solid var(--border, rgba(0,0,0,0.10))', background: '#fff' }}
                >
                  {destacado && (
                    <span
                      className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-md mb-2 md:absolute md:-top-3 md:left-1/2 md:-translate-x-1/2 md:mb-0"
                      style={{ background: '#7C3AED', color: '#fff' }}
                    >
                      Más popular
                    </span>
                  )}
                  <div className="flex items-center justify-between md:flex-col md:items-center md:gap-1 md:mt-1">
                    <div className="md:order-1">
                      <p className="text-[14px] font-semibold text-foreground md:text-[12px] md:font-semibold md:tracking-wide md:text-muted-foreground">{PLAN_LABEL[p.tipoPlan]}</p>
                      <p className="text-[12px] mt-0.5 md:hidden" style={{ color: p.tipoPlan === 'MENSUAL' ? 'var(--muted-foreground, #8E87A8)' : '#06D6A0' }}>
                        {PLAN_DESCUENTO_LABEL[p.tipoPlan]}
                      </p>
                    </div>
                    <div className="text-right md:text-center md:order-2 md:mt-2">
                      <p className="text-[18px] font-bold text-foreground md:text-[26px]">{settingPlan === p.tipoPlan ? '...' : fmt.format(p.precio)}</p>
                      {p.tipoPlan !== 'MENSUAL' && (
                        <p className="text-[11px] text-muted-foreground">{fmt.format(precioMes)} / mes</p>
                      )}
                    </div>
                  </div>
                  <p
                    className="hidden md:block text-[12px] font-semibold mt-1"
                    style={{ color: p.tipoPlan === 'MENSUAL' ? 'var(--muted-foreground, #8E87A8)' : '#06D6A0' }}
                  >
                    {PLAN_DESCUENTO_LABEL[p.tipoPlan]}
                  </p>
                  <div className="hidden md:flex md:flex-1 md:items-end md:pt-4 md:mt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                    <span
                      className="text-[13px] font-semibold px-4 py-2 rounded-lg w-full text-center"
                      style={{ background: destacado ? '#7C3AED' : 'rgba(67,97,238,0.08)', color: destacado ? '#fff' : '#4361EE' }}
                    >
                      {settingPlan === p.tipoPlan ? 'Guardando...' : 'Elegir este plan'}
                    </span>
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
        {!vigencia && (
          <button
            onClick={() => { setPickedPlan(false); setPlanes(null); }}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Cambiar plan
          </button>
        )}
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
                {suscripcion.autoRenew ? 'Se cobra sola cuando vence, con 5% de descuento' : 'Se cobra de una vez y luego se renueva sola, con 5% de descuento'}
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
            <p className="text-[11px] text-muted-foreground -mt-1">
              La renovación automática solo admite tarjeta de crédito o débito — es el único medio que se puede volver a cobrar sin que estés presente. Para pagar con PSE o Efecty, usa la sección de pago manual cada vez que venza tu plan.
            </p>
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
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={aceptaRecurrente} onChange={e => setAceptaRecurrente(e.target.checked)} className="mt-0.5 shrink-0" />
              <span className="text-[11px] text-muted-foreground leading-relaxed">
                Autorizo de forma expresa este pago y los cobros automáticos recurrentes a esta tarjeta al inicio de cada período, según los{' '}
                <a href="/legal/terminos" target="_blank" rel="noopener noreferrer" className="underline text-primary">Términos y Condiciones</a> y la{' '}
                <a href="/legal/politica-datos" target="_blank" rel="noopener noreferrer" className="underline text-primary">Política de Tratamiento de Datos</a>.
                Puedo desactivar la renovación automática en cualquier momento desde esta pantalla, sin penalidades (Ley 1480 de 2011).
              </span>
            </label>
            <button onClick={handleActivarAutoRenew} disabled={activating || !sdkReady || !aceptaRecurrente}
              className="w-full py-2.5 rounded-xl bg-primary text-white text-[13px] font-semibold disabled:opacity-60">
              {activating ? 'Procesando pago...' : 'Pagar y activar renovación automática'}
            </button>
          </div>
        )}

        {/* ── Pago único dentro de la app — todos los medios de Mercado Pago ── */}
        {(!vigencia || vigencia.vencido) && !showCardForm && (
          <div className="space-y-3 pt-1" style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 16 }}>
            <p className="text-[13px] font-semibold text-foreground">Paga tu suscripción</p>

            {payPending ? (
              <div className="p-4 rounded-xl space-y-2" style={{ background: 'rgba(255,183,3,0.08)', border: '1px solid rgba(255,183,3,0.30)' }}>
                <p className="text-[13px] font-semibold flex items-center gap-1.5" style={{ color: '#B26A00' }}>
                  <Clock className="w-3.5 h-3.5" /> Pago pendiente de confirmación
                </p>
                <p className="text-[12px] text-muted-foreground">
                  {voucherUrl
                    ? 'Generamos tu cupón de pago. Cuando lo pagues en un punto Efecty, tu plan se activará automáticamente.'
                    : 'Cuando el pago se confirme, tu plan se activará automáticamente.'}
                </p>
                {voucherUrl && (
                  <a href={voucherUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-block text-[13px] font-semibold text-primary underline">
                    Abrir cupón de pago
                  </a>
                )}
                <button onClick={() => { setPayPending(false); setVoucherUrl(null); load(); }}
                  className="block text-[12px] font-semibold text-muted-foreground underline cursor-pointer">
                  Ya pagué — actualizar estado
                </button>
              </div>
            ) : loadingMetodos ? (
              <div className="flex justify-center py-6">
                <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            ) : (
              <>
                {/* Selector de medio de pago */}
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { key: 'CARD'   as MetodoPago, label: 'Tarjeta', icon: CreditCard, disponible: metodos?.tarjeta ?? true },
                    { key: 'PSE'    as MetodoPago, label: 'PSE',     icon: Landmark,   disponible: metodos?.pse.disponible ?? false },
                    { key: 'EFECTY' as MetodoPago, label: 'Efecty',  icon: Banknote,   disponible: metodos?.efecty ?? false },
                  ]).filter(m => m.disponible).map(({ key, label, icon: Icon }) => {
                    const active = metodo === key;
                    return (
                      <button key={key} onClick={() => { setMetodo(key); setError(null); }}
                        className="flex flex-col items-center gap-1 py-2.5 rounded-xl text-[12px] font-semibold transition-colors cursor-pointer"
                        style={active
                          ? { border: '2px solid #7C3AED', color: '#7C3AED', background: 'rgba(124,58,237,0.05)' }
                          : { border: '1px solid rgba(0,0,0,0.10)', color: '#8E87A8', background: '#fff' }}
                      >
                        <Icon className="w-4 h-4" />
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* Formulario según el medio */}
                {metodo === 'CARD' && (
                  <div className="space-y-2.5">
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
                  </div>
                )}

                {metodo === 'PSE' && (
                  <div className="space-y-2.5">
                    <select value={pse.bancoId} onChange={e => setPse(p => ({ ...p, bancoId: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-input text-sm bg-white">
                      <option value="">Selecciona tu banco</option>
                      {(metodos?.pse.bancos ?? []).map(b => (
                        <option key={b.id} value={b.id}>{b.description}</option>
                      ))}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <select value={pse.personType} onChange={e => setPse(p => ({ ...p, personType: e.target.value }))}
                        className="px-3 py-2 rounded-lg border border-input text-sm bg-white">
                        <option value="natural">Persona natural</option>
                        <option value="juridica">Persona jurídica</option>
                      </select>
                      <select value={pse.docType} onChange={e => setPse(p => ({ ...p, docType: e.target.value }))}
                        className="px-3 py-2 rounded-lg border border-input text-sm bg-white">
                        {DOC_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <input placeholder="Número de documento" value={pse.docNumber} onChange={e => setPse(p => ({ ...p, docNumber: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-input text-sm" inputMode="numeric" />
                    <p className="text-[11px] text-muted-foreground">Serás dirigido a tu banco para autorizar la transferencia. Al completarla, volverás a VeloClub.</p>
                  </div>
                )}

                {metodo === 'EFECTY' && (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <select value={efecty.docType} onChange={e => setEfecty(p => ({ ...p, docType: e.target.value }))}
                        className="px-3 py-2 rounded-lg border border-input text-sm bg-white">
                        {DOC_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <input placeholder="Número de documento" value={efecty.docNumber} onChange={e => setEfecty(p => ({ ...p, docNumber: e.target.value }))}
                        className="px-3 py-2 rounded-lg border border-input text-sm" inputMode="numeric" />
                    </div>
                    <p className="text-[11px] text-muted-foreground">Generaremos un cupón para que pagues en efectivo en cualquier punto Efecty. Tu plan se activa cuando pagues.</p>
                  </div>
                )}

                {/* Aceptación de términos — obligatoria (Ley 1480 de 2011) */}
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" checked={aceptaTerminos} onChange={e => setAceptaTerminos(e.target.checked)} className="mt-0.5 shrink-0" />
                  <span className="text-[11px] text-muted-foreground leading-relaxed">
                    Acepto los <a href="/legal/terminos" target="_blank" rel="noopener noreferrer" className="underline text-primary">Términos y Condiciones</a> y
                    la <a href="/legal/politica-datos" target="_blank" rel="noopener noreferrer" className="underline text-primary">Política de Tratamiento de Datos</a> de VeloClub.
                  </span>
                </label>

                <button
                  onClick={handlePagarDirecto}
                  disabled={paying || !aceptaTerminos || (metodo === 'CARD' && !sdkReady)}
                  className="w-full py-3 rounded-xl bg-primary text-white text-[13px] font-semibold disabled:opacity-60"
                >
                  {paying ? 'Procesando pago...' : `Pagar ${fmt.format(suscripcion.planMonto)}`}
                </button>
                <p className="text-[10px] text-muted-foreground text-center">
                  Pago procesado de forma segura por Mercado Pago. Tus datos nunca se guardan en VeloClub.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
