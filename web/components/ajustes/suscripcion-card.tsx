'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import Script from 'next/script';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { apiFetch } from '@/lib/api-client';
import { CreditCard, ArrowLeft, Landmark, Banknote, Clock, RefreshCw, XCircle } from 'lucide-react';

const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const EASE = [0.23, 1, 0.32, 1] as const;

type TipoPlan = 'MENSUAL' | 'TRIMESTRAL' | 'ANUAL';
const PLAN_LABEL: Record<TipoPlan, string> = { MENSUAL: 'Mensual', TRIMESTRAL: 'Trimestral', ANUAL: 'Anual' };
const PLAN_DESCUENTO_LABEL: Record<TipoPlan, string> = { MENSUAL: 'Sin descuento', TRIMESTRAL: '10% de descuento', ANUAL: '20% de descuento' };
const MESES_POR_PLAN: Record<TipoPlan, number> = { MENSUAL: 1, TRIMESTRAL: 3, ANUAL: 12 };

interface PlanOpcion { tipoPlan: TipoPlan; precio: number; precioConAutoRenew: number }

interface Suscripcion {
  id: string;
  tipoPlan: TipoPlan;
  planMonto: number;
  planMontoSinAutoRenew: number;
  planMontoConAutoRenew: number;
  autoRenew: boolean;
  canceladaAt: string | null;
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
interface PayerCost {
  installments: number;
  installment_rate: number;
  recommended_message: string;
}
interface MpInstallmentsResult {
  payment_method_id: string;
  payment_type_id: 'credit_card' | 'debit_card' | string;
  payer_costs: PayerCost[];
}
interface MpInstance {
  createCardToken: (params: MpCardTokenParams) => Promise<{ id: string }>;
  getPaymentMethods: (params: { bin: string }) => Promise<{ results: Array<{ id: string }> }>;
  getInstallments: (params: { bin: string; amount: string }) => Promise<MpInstallmentsResult[]>;
}
declare global {
  interface Window { MercadoPago?: new (publicKey: string) => MpInstance; MP_DEVICE_SESSION_ID?: string }
}

type MetodoPago = 'CARD' | 'PSE' | 'EFECTY';
interface MetodosDisponibles {
  tarjeta: boolean;
  pse: { disponible: boolean; bancos: Array<{ id: string; description: string }> };
  efecty: boolean;
}
const DOC_TYPES = ['CC', 'CE', 'NIT', 'TI', 'PAS'];

// ── Detección de marca + formato del número de tarjeta ───────────────────────
type CardBrand = 'visa' | 'mastercard' | 'amex' | 'diners' | null;

function detectarMarca(digits: string): CardBrand {
  if (/^4/.test(digits)) return 'visa';
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(digits)) return 'mastercard';
  if (/^3[47]/.test(digits)) return 'amex';
  if (/^3(0[0-5]|[68])/.test(digits)) return 'diners';
  return null;
}

function formatearNumeroTarjeta(raw: string, brand: CardBrand): string {
  const digits = raw.replace(/\D/g, '').slice(0, brand === 'amex' ? 15 : 19);
  if (brand === 'amex') {
    // Amex: 4-6-5
    return [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10, 15)].filter(Boolean).join(' ');
  }
  // Resto: grupos de 4
  return digits.match(/.{1,4}/g)?.join(' ') ?? digits;
}

// Logos reales de cada franquicia. Mastercard y Visa usan los SVG oficiales
// (public/card-brands); Amex y Diners quedan como respaldo dibujado en línea.
function BrandLogo({ brand }: { brand: Exclude<CardBrand, null> }) {
  if (brand === 'mastercard') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src="/card-brands/mastercard.svg" alt="Mastercard" style={{ height: 22, width: 'auto' }} />;
  }
  if (brand === 'visa') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src="/card-brands/visa.svg" alt="Visa" style={{ height: 15, width: 'auto' }} />;
  }
  if (brand === 'amex') {
    return (
      <svg viewBox="0 0 44 24" height="20" role="img" aria-label="American Express">
        <rect width="44" height="24" rx="3" fill="#2E77BC" />
        <text x="22" y="16" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif"
          fontSize="9" fontWeight="700" letterSpacing="0.3" fill="#fff">AMEX</text>
      </svg>
    );
  }
  // Diners Club
  return (
    <svg viewBox="0 0 24 24" height="20" role="img" aria-label="Diners Club">
      <circle cx="12" cy="12" r="11" fill="#0079BE" />
      <circle cx="12" cy="12" r="5.5" fill="#fff" />
    </svg>
  );
}

function CardBrandBadge({ brand }: { brand: CardBrand }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {brand && (
        <motion.span
          key={brand}
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.15, ease: EASE }}
          className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center bg-white rounded-md pointer-events-none"
          style={{ height: 28, padding: '0 7px', boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}
        >
          <BrandLogo brand={brand} />
        </motion.span>
      )}
    </AnimatePresence>
  );
}

// ── Toggle deslizante estilo iOS ─────────────────────────────────────────────
function SlideToggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label="Renovación automática"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative shrink-0 flex items-center"
      style={{
        width: 46, height: 26, borderRadius: 999, padding: 3,
        justifyContent: checked ? 'flex-end' : 'flex-start',
        background: checked ? '#06D6A0' : 'rgba(120,80,200,0.22)',
        transition: 'background 0.22s cubic-bezier(0.23,1,0.32,1)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <motion.span
        layout
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 34 }}
        style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.28)', display: 'block' }}
      />
    </button>
  );
}

// ── Precio con animación al cambiar (descuento) ──────────────────────────────
function PrecioAnimado({ valor, className }: { valor: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <span className="relative inline-block" style={{ minWidth: 1 }}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={valor}
          className={className}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: 'blur(4px)' }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, filter: 'blur(4px)' }}
          transition={{ duration: 0.22, ease: EASE }}
          style={{ display: 'inline-block' }}
        >
          {fmt.format(valor)}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

// ── Contenedor que expande su altura con animación ───────────────────────────
function Expand({ show, children }: { show: boolean; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={reduce ? { duration: 0 } : { duration: 0.28, ease: EASE }}
          style={{ overflow: 'hidden' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function SuscripcionCard() {
  const { getToken } = useAuth();
  const reduce = useReducedMotion();
  const [data, setData] = useState<MiSuscripcionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [activating, setActivating] = useState(false);
  const [unsubscribing, setUnsubscribing] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [confirmarCancelar, setConfirmarCancelar] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Intención de renovación automática en el flujo de pago (caso: sin plan / vencido)
  const [activarAutoRenovacion, setActivarAutoRenovacion] = useState(false);
  // Formulario para activar recurrencia sobre un plan ya activo
  const [showActivarForm, setShowActivarForm] = useState(false);

  const [card, setCard] = useState({ number: '', name: '', expiry: '', cvv: '', docNumber: '' });
  const cardBrand = detectarMarca(card.number.replace(/\D/g, ''));

  function handleCardNumberChange(raw: string) {
    const brand = detectarMarca(raw.replace(/\D/g, ''));
    setCard(c => ({ ...c, number: formatearNumeroTarjeta(raw, brand) }));
  }

  function formatearVencimiento(raw: string): string {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  }

  // Tipo de tarjeta (débito/crédito) y cuotas disponibles — se consultan a Mercado
  // Pago apenas se completa el BIN (primeros 6 dígitos), antes de tokenizar.
  const [cardTipo, setCardTipo] = useState<'credit_card' | 'debit_card' | null>(null);
  const [cuotas, setCuotas] = useState<PayerCost[]>([]);
  const [cuotasSeleccionadas, setCuotasSeleccionadas] = useState(1);
  const [loadingCuotas, setLoadingCuotas] = useState(false);

  const bin = card.number.replace(/\D/g, '').slice(0, 6);
  const montoParaCuotas = data
    ? (activarAutoRenovacion ? data.suscripcion.planMontoConAutoRenew : data.suscripcion.planMontoSinAutoRenew)
    : 0;

  useEffect(() => {
    setCardTipo(null); setCuotas([]); setCuotasSeleccionadas(1);
    if (bin.length !== 6 || !sdkReady || !window.MercadoPago || !montoParaCuotas) return;
    const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
    if (!publicKey) return;

    let cancelado = false;
    setLoadingCuotas(true);
    const mp = new window.MercadoPago(publicKey);
    mp.getInstallments({ bin, amount: String(montoParaCuotas) })
      .then(results => {
        if (cancelado || !results?.[0]) return;
        setCardTipo(results[0].payment_type_id === 'debit_card' ? 'debit_card' : 'credit_card');
        setCuotas(results[0].payer_costs ?? []);
      })
      .catch(() => { /* si falla, se sigue con 1 cuota por defecto */ })
      .finally(() => { if (!cancelado) setLoadingCuotas(false); });

    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bin, sdkReady, montoParaCuotas]);

  // Pago dentro de la app (Checkout API) — medios y datos
  const [metodos, setMetodos] = useState<MetodosDisponibles | null>(null);
  const [loadingMetodos, setLoadingMetodos] = useState(false);
  const [metodo, setMetodo] = useState<MetodoPago>('CARD');
  const [pse, setPse] = useState({
    bancoId: '', personType: 'natural', docType: 'CC', docNumber: '',
    nombres: '', apellidos: '', telefono: '',
    direccion: '', numeroDireccion: '', codigoPostal: '', barrio: '', ciudad: '',
  });
  const [efecty, setEfecty] = useState({ docType: 'CC', docNumber: '' });
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
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

  // El SDK de Mercado Pago puede haberse cargado ya en una navegación previa,
  // en cuyo caso el onLoad del <Script> no vuelve a dispararse. Verificamos
  // directamente window.MercadoPago para no dejar el botón deshabilitado.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.MercadoPago) { setSdkReady(true); return; }
    const iv = setInterval(() => {
      if (typeof window !== 'undefined' && window.MercadoPago) { setSdkReady(true); clearInterval(iv); }
    }, 300);
    return () => clearInterval(iv);
  }, []);

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

  // Cargar los medios de pago cuando hay algo por pagar
  useEffect(() => {
    const debePagar = data && ((!data.vigencia && pickedPlan) || data.vigencia?.vencido);
    if (debePagar && !metodos && !loadingMetodos) loadMetodos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, pickedPlan]);

  // Tokeniza la tarjeta en el navegador (nunca toca nuestro backend) y detecta el tipo
  async function tokenizarTarjeta(): Promise<{ tokenId: string; paymentMethodId?: string }> {
    if (!window.MercadoPago) throw new Error('El pago aún está cargando, intenta de nuevo en unos segundos.');
    const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
    if (!publicKey) throw new Error('Falta configurar la llave pública de Mercado Pago');
    const mp = new window.MercadoPago(publicKey);
    const [mes, año] = card.expiry.split('/');
    const tokenResult = await mp.createCardToken({
      cardNumber: card.number.replace(/\s/g, ''),
      cardholderName: card.name,
      cardExpirationMonth: mes,
      cardExpirationYear: año?.length === 2 ? `20${año}` : año,
      securityCode: card.cvv,
      identificationType: 'CC',
      identificationNumber: card.docNumber,
    });
    const binTarjeta = card.number.replace(/\s/g, '').slice(0, 6);
    const pm = await mp.getPaymentMethods({ bin: binTarjeta });
    return { tokenId: tokenResult.id, paymentMethodId: pm.results?.[0]?.id };
  }

  function resetCard() {
    setCard({ number: '', name: '', expiry: '', cvv: '', docNumber: '' });
    setCardTipo(null); setCuotas([]); setCuotasSeleccionadas(1);
  }

  // Flujo de pago del caso "sin plan / vencido"
  async function handlePagar() {
    setPaying(true); setError(null);
    try {
      // Device ID: recolectado automáticamente por el SDK JS de Mercado Pago —
      // Mercado Pago lo exige para evaluar el riesgo del pago (X-meli-session-id)
      const deviceId = typeof window !== 'undefined' ? (window as unknown as { MP_DEVICE_SESSION_ID?: string }).MP_DEVICE_SESSION_ID : undefined;

      // Con renovación automática → suscripción recurrente (cobra ya + guarda tarjeta)
      if (activarAutoRenovacion) {
        const { tokenId } = await tokenizarTarjeta();
        const token = await getToken();
        await apiFetch('/mercadopago/subscribe', {
          method: 'POST', token, body: JSON.stringify({ cardTokenId: tokenId, aceptaTerminos, deviceId }),
        });
        resetCard();
        await load();
        return;
      }

      // Sin renovación automática → pago único (tarjeta / PSE / Efecty)
      const body: Record<string, unknown> = { metodo, aceptaTerminos, deviceId };
      if (metodo === 'CARD') {
        const { tokenId, paymentMethodId } = await tokenizarTarjeta();
        if (!paymentMethodId) throw new Error('No reconocimos la tarjeta. Verifica el número.');
        Object.assign(body, {
          cardTokenId: tokenId, paymentMethodId, docType: 'CC', docNumber: card.docNumber,
          installments: cardTipo === 'credit_card' ? cuotasSeleccionadas : 1,
        });
      } else if (metodo === 'PSE') {
        Object.assign(body, {
          bancoId: pse.bancoId, personType: pse.personType, docType: pse.docType, docNumber: pse.docNumber,
          nombres: pse.nombres, apellidos: pse.apellidos, telefono: pse.telefono,
          direccion: pse.direccion, numeroDireccion: pse.numeroDireccion,
          codigoPostal: pse.codigoPostal, barrio: pse.barrio, ciudad: pse.ciudad,
        });
      } else {
        Object.assign(body, { docType: efecty.docType, docNumber: efecty.docNumber });
      }

      const token = await getToken();
      const res = await apiFetch<{ status: string; redirectUrl?: string | null }>('/mercadopago/pagar', {
        method: 'POST', token, body: JSON.stringify(body),
      });

      if (res.status === 'approved') {
        resetCard();
        await load();
      } else if (res.status === 'pending') {
        if (metodo === 'PSE' && res.redirectUrl) {
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

  // Activar recurrencia sobre un plan YA activo (requiere tarjeta)
  async function handleActivarRecurrente() {
    setActivating(true); setError(null);
    try {
      const { tokenId } = await tokenizarTarjeta();
      const token = await getToken();
      await apiFetch('/mercadopago/subscribe', {
        method: 'POST', token, body: JSON.stringify({ cardTokenId: tokenId, aceptaTerminos: true }),
      });
      setShowActivarForm(false);
      resetCard();
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

  async function handleCancelar() {
    setCanceling(true); setError(null);
    try {
      const token = await getToken();
      await apiFetch('/mercadopago/cancelar', { method: 'POST', token });
      setConfirmarCancelar(false);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cancelar la suscripción'); }
    finally { setCanceling(false); }
  }

  async function handleReactivar() {
    setReactivating(true); setError(null);
    try {
      const token = await getToken();
      await apiFetch('/mercadopago/reactivar', { method: 'POST', token });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo reactivar la suscripción'); }
    finally { setReactivating(false); }
  }

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
  if (!data) return <p className="text-sm text-muted-foreground text-center py-10">No se pudo cargar tu suscripción.</p>;

  // ══ SELECTOR DE PLAN — sin pagos registrados y sin elegir plan aún ══════════
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
                <motion.button
                  key={p.tipoPlan}
                  onClick={() => handleElegirPlan(p.tipoPlan)}
                  disabled={settingPlan !== null}
                  whileTap={reduce ? {} : { scale: 0.98 }}
                  transition={{ duration: 0.12, ease: EASE }}
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
                </motion.button>
              );
            })}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground text-center mt-4">
          Activa la renovación automática al pagar y suma 5% de descuento adicional
        </p>
      </div>
    );
  }

  const { suscripcion, cantidadDeportistas, vigencia } = data;
  const planActivo = !!vigencia && !vigencia.vencido;
  const pctColor = !vigencia ? '#8E87A8' : vigencia.vencido ? '#EF476F' : vigencia.pct >= 50 ? '#06D6A0' : vigencia.pct >= 20 ? '#FFB703' : '#EF476F';
  const precioAPagar = activarAutoRenovacion ? suscripcion.planMontoConAutoRenew : suscripcion.planMontoSinAutoRenew;
  const estaCancelada = planActivo && !!suscripcion.canceladaAt;
  const fechaVencimiento = planActivo && vigencia
    ? new Date(Date.now() + vigencia.diasRestantes * 86400000).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
    : null;

  // Campos de tarjeta reutilizables
  const cardFields = (
    <div className="space-y-2.5">
      <div className="relative">
        <input
          placeholder="Número de tarjeta" value={card.number}
          onChange={e => handleCardNumberChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-input text-sm"
          style={{ paddingRight: cardBrand ? 72 : undefined }}
          inputMode="numeric" autoComplete="cc-number"
        />
        <CardBrandBadge brand={cardBrand} />
      </div>
      <input placeholder="Nombre del titular" value={card.name} onChange={e => setCard(c => ({ ...c, name: e.target.value }))}
        className="w-full px-3 py-2 rounded-lg border border-input text-sm" autoComplete="cc-name" />
      <div className="grid grid-cols-3 gap-2">
        <input placeholder="MM/AA" value={card.expiry} onChange={e => setCard(c => ({ ...c, expiry: formatearVencimiento(e.target.value) }))}
          className="px-3 py-2 rounded-lg border border-input text-sm" inputMode="numeric" maxLength={5} autoComplete="cc-exp" />
        <input placeholder="CVV" value={card.cvv} onChange={e => setCard(c => ({ ...c, cvv: e.target.value.replace(/\D/g, '') }))}
          className="px-3 py-2 rounded-lg border border-input text-sm" inputMode="numeric" maxLength={cardBrand === 'amex' ? 4 : 3} autoComplete="cc-csc" />
        <input placeholder="Cédula" value={card.docNumber} onChange={e => setCard(c => ({ ...c, docNumber: e.target.value.replace(/\D/g, '') }))}
          className="px-3 py-2 rounded-lg border border-input text-sm" inputMode="numeric" />
      </div>

      {loadingCuotas && (
        <p className="text-[11px] text-muted-foreground">Consultando cuotas disponibles...</p>
      )}
      {!loadingCuotas && cardTipo === 'debit_card' && (
        <p className="text-[11px] text-muted-foreground">Tarjeta débito detectada — el pago se hace en 1 solo cobro.</p>
      )}
      {!loadingCuotas && cardTipo === 'credit_card' && cuotas.length > 1 && (
        <select
          value={cuotasSeleccionadas}
          onChange={e => setCuotasSeleccionadas(Number(e.target.value))}
          className="w-full px-3 py-2 rounded-lg border border-input text-sm bg-white"
        >
          {cuotas.map(c => (
            <option key={c.installments} value={c.installments}>{c.recommended_message}</option>
          ))}
        </select>
      )}
    </div>
  );

  return (
    <>
      <Script src="https://sdk.mercadopago.com/js/v2" strategy="afterInteractive" onLoad={() => setSdkReady(true)} />

      <div className="bg-white border border-border rounded-2xl p-5 space-y-5">
        {!vigencia && (
          <button
            onClick={() => { setPickedPlan(false); setPlanes(null); setActivarAutoRenovacion(false); }}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Cambiar plan
          </button>
        )}

        {/* ── Encabezado con precio ──────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground tracking-wide">Plan {PLAN_LABEL[suscripcion.tipoPlan]}</p>
            <div className="flex items-baseline gap-2">
              <PrecioAnimado valor={planActivo ? suscripcion.planMonto : precioAPagar} className="text-[22px] font-extrabold text-foreground" />
              <AnimatePresence>
                {!planActivo && activarAutoRenovacion && (
                  <motion.span
                    initial={reduce ? { opacity: 0 } : { opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, x: -4 }}
                    transition={{ duration: 0.2, ease: EASE }}
                    className="text-[13px] font-semibold text-muted-foreground line-through"
                  >
                    {fmt.format(suscripcion.planMontoSinAutoRenew)}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
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
            <motion.div
              className="h-full rounded-full"
              style={{ background: pctColor }}
              initial={{ width: 0 }}
              animate={{ width: `${vigencia.pct}%` }}
              transition={reduce ? { duration: 0 } : { duration: 0.6, ease: EASE }}
            />
          </div>
        )}

        {error && <p className="text-[12px] text-red-500">{error}</p>}

        {/* ══ CASO A: plan activo — gestionar renovación automática ══════════ */}
        {planActivo && (
          <>
          {estaCancelada && (
            <div className="rounded-xl p-3 space-y-3"
              style={{ background: 'rgba(239,71,111,0.06)', border: '1px solid rgba(239,71,111,0.20)' }}>
              <div className="flex items-start gap-2.5">
                <XCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#EF476F' }} />
                <div>
                  <p className="text-[13px] font-semibold text-foreground">Suscripción cancelada</p>
                  <p className="text-[11px] text-muted-foreground">
                    Tu club sigue activo hasta el {fechaVencimiento} y no se harán nuevos cobros. Tu plan ya está pagado: puedes retomarlo sin volver a pagar.
                  </p>
                </div>
              </div>
              <motion.button
                onClick={handleReactivar}
                disabled={reactivating}
                whileTap={reduce ? {} : { scale: 0.98 }}
                transition={{ duration: 0.12, ease: EASE }}
                className="w-full py-2 rounded-lg text-white text-[12px] font-semibold disabled:opacity-60"
                style={{ background: '#06D6A0' }}
              >
                {reactivating ? 'Reactivando...' : 'Reactivar suscripción'}
              </motion.button>
            </div>
          )}
          <div className="rounded-xl bg-secondary/40 p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-semibold text-foreground flex items-center gap-1.5">
                  Renovación automática
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(6,214,160,0.12)', color: '#06D6A0' }}>-5%</span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {suscripcion.autoRenew ? 'Se cobra sola cuando vence, con 5% de descuento' : 'Actívala y ahorra 5% en cada renovación'}
                </p>
              </div>
              <SlideToggle
                checked={suscripcion.autoRenew || showActivarForm}
                disabled={unsubscribing || activating}
                onChange={(next) => {
                  if (suscripcion.autoRenew) { if (!next) handleDesactivarAutoRenew(); return; }
                  setShowActivarForm(next);
                  setError(null);
                }}
              />
            </div>

            <Expand show={showActivarForm && !suscripcion.autoRenew}>
              <div className="pt-1 space-y-3">
                <p className="text-[12px] font-semibold text-foreground flex items-center gap-2"><CreditCard className="w-3.5 h-3.5" /> Datos de la tarjeta</p>
                <p className="text-[11px] text-muted-foreground">
                  La renovación automática solo funciona con tarjeta de crédito o débito. Puedes desactivarla cuando quieras, sin penalidades.
                </p>
                <p className="text-[11px] text-muted-foreground rounded-lg p-2" style={{ background: 'rgba(255,183,3,0.08)' }}>
                  Mercado Pago hará un cobro de validación de <strong>$1.600</strong> para confirmar que tu tarjeta funciona. No es parte del pago de tu plan y <strong>te lo devuelven automáticamente</strong> en las siguientes horas.
                </p>
                {cardFields}
                <motion.button
                  onClick={handleActivarRecurrente}
                  disabled={activating || !sdkReady}
                  whileTap={reduce ? {} : { scale: 0.98 }}
                  transition={{ duration: 0.12, ease: EASE }}
                  className="w-full py-2.5 rounded-xl bg-primary text-white text-[13px] font-semibold disabled:opacity-60"
                >
                  {activating ? 'Activando...' : 'Activar renovación automática'}
                </motion.button>
              </div>
            </Expand>
          </div>

          {!estaCancelada && (
            <div>
              {!confirmarCancelar ? (
                <button
                  onClick={() => { setConfirmarCancelar(true); setError(null); }}
                  className="text-[12px] font-semibold text-muted-foreground hover:text-red-500 transition-colors cursor-pointer"
                >
                  Cancelar suscripción
                </button>
              ) : (
                <div className="rounded-xl p-3 space-y-2.5" style={{ background: 'rgba(239,71,111,0.05)', border: '1px solid rgba(239,71,111,0.18)' }}>
                  <p className="text-[12px] text-foreground">
                    ¿Seguro que quieres cancelar? Tu club seguirá activo hasta el <span className="font-semibold">{fechaVencimiento}</span> y no se harán más cobros. Podrás reactivar cuando quieras.
                  </p>
                  <div className="flex gap-2">
                    <motion.button
                      onClick={handleCancelar}
                      disabled={canceling}
                      whileTap={reduce ? {} : { scale: 0.98 }}
                      transition={{ duration: 0.12, ease: EASE }}
                      className="flex-1 py-2 rounded-lg text-white text-[12px] font-semibold disabled:opacity-60"
                      style={{ background: '#EF476F' }}
                    >
                      {canceling ? 'Cancelando...' : 'Sí, cancelar'}
                    </motion.button>
                    <button
                      onClick={() => setConfirmarCancelar(false)}
                      disabled={canceling}
                      className="flex-1 py-2 rounded-lg text-[12px] font-semibold text-muted-foreground border border-input disabled:opacity-60 cursor-pointer"
                    >
                      No, volver
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          </>
        )}

        {/* ══ CASO B: sin plan / vencido — pago con todos los medios ════════ */}
        {!planActivo && (
          <div className="space-y-4 pt-1" style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 16 }}>
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
                  <a href={voucherUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-[13px] font-semibold text-primary underline">
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
                {/* Toggle de renovación automática como descuento */}
                <div className="rounded-xl p-3 flex items-center justify-between gap-3"
                  style={{ background: activarAutoRenovacion ? 'rgba(6,214,160,0.08)' : 'rgba(120,80,200,0.05)', transition: 'background 0.25s cubic-bezier(0.23,1,0.32,1)' }}>
                  <div className="flex items-center gap-2.5">
                    <RefreshCw className="w-4 h-4 shrink-0" style={{ color: activarAutoRenovacion ? '#06D6A0' : '#8E87A8' }} />
                    <div>
                      <p className="text-[13px] font-semibold text-foreground flex items-center gap-1.5">
                        Renovación automática
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(6,214,160,0.14)', color: '#06D6A0' }}>-5%</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">Se renueva sola al vencer y ahorras 5%</p>
                    </div>
                  </div>
                  <SlideToggle
                    checked={activarAutoRenovacion}
                    onChange={(next) => {
                      setActivarAutoRenovacion(next);
                      if (next) setMetodo('CARD');
                      setError(null);
                    }}
                  />
                </div>

                <p className="text-[13px] font-semibold text-foreground">Paga tu suscripción</p>

                {/* Selector de medio — oculto cuando la renovación automática está activa (solo tarjeta) */}
                <Expand show={!activarAutoRenovacion}>
                  <div className="grid grid-cols-3 gap-2 pb-0.5">
                    {([
                      { key: 'CARD'   as MetodoPago, label: 'Tarjeta', icon: CreditCard, disponible: metodos?.tarjeta ?? true },
                      { key: 'PSE'    as MetodoPago, label: 'PSE',     icon: Landmark,   disponible: metodos?.pse.disponible ?? false },
                      { key: 'EFECTY' as MetodoPago, label: 'Efecty',  icon: Banknote,   disponible: metodos?.efecty ?? false },
                    ]).filter(m => m.disponible).map(({ key, label, icon: Icon }) => {
                      const active = metodo === key;
                      return (
                        <button key={key} onClick={() => { setMetodo(key); setError(null); }}
                          className="relative flex flex-col items-center gap-1 py-2.5 rounded-xl text-[12px] font-semibold transition-colors cursor-pointer"
                          style={active
                            ? { color: '#7C3AED', background: 'rgba(124,58,237,0.05)' }
                            : { border: '1px solid rgba(0,0,0,0.10)', color: '#8E87A8', background: '#fff' }}
                        >
                          {active && (
                            <motion.span layoutId="metodo-activo" className="absolute inset-0 rounded-xl pointer-events-none"
                              style={{ border: '2px solid #7C3AED' }}
                              transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 34 }} />
                          )}
                          <Icon className="w-4 h-4 relative z-10" />
                          <span className="relative z-10">{label}</span>
                          {key === 'CARD' && (
                            <span className="relative z-10 text-[9px] font-medium opacity-70 -mt-0.5">Débito/Crédito</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </Expand>

                {/* Formularios según medio (o tarjeta forzada si auto-renovación) */}
                {(activarAutoRenovacion || metodo === 'CARD') && (
                  <motion.div
                    initial={reduce ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, ease: EASE }}
                    key="form-card"
                  >
                    {activarAutoRenovacion && (
                      <p className="text-[11px] text-muted-foreground rounded-lg p-2 mb-2.5" style={{ background: 'rgba(255,183,3,0.08)' }}>
                        Mercado Pago hará un cobro de validación de <strong>$1.600</strong> para confirmar que tu tarjeta funciona. No es parte del pago de tu plan y <strong>te lo devuelven automáticamente</strong> en las siguientes horas.
                      </p>
                    )}
                    {cardFields}
                  </motion.div>
                )}

                {!activarAutoRenovacion && metodo === 'PSE' && (
                  <motion.div initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: EASE }} key="form-pse" className="space-y-2.5">
                    <select value={pse.bancoId} onChange={e => setPse(p => ({ ...p, bancoId: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-input text-sm bg-white">
                      <option value="">Selecciona tu banco</option>
                      {(metodos?.pse.bancos ?? []).map(b => (<option key={b.id} value={b.id}>{b.description}</option>))}
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
                    <div className="grid grid-cols-2 gap-2">
                      <input placeholder="Nombres" value={pse.nombres} onChange={e => setPse(p => ({ ...p, nombres: e.target.value }))}
                        className="px-3 py-2 rounded-lg border border-input text-sm" autoComplete="given-name" />
                      <input placeholder="Apellidos" value={pse.apellidos} onChange={e => setPse(p => ({ ...p, apellidos: e.target.value }))}
                        className="px-3 py-2 rounded-lg border border-input text-sm" autoComplete="family-name" />
                    </div>
                    <input placeholder="Teléfono (sin indicativo)" value={pse.telefono} onChange={e => setPse(p => ({ ...p, telefono: e.target.value.replace(/\D/g, '') }))}
                      className="w-full px-3 py-2 rounded-lg border border-input text-sm" inputMode="numeric" autoComplete="tel-national" />
                    <div className="grid grid-cols-3 gap-2">
                      <input placeholder="Dirección" value={pse.direccion} onChange={e => setPse(p => ({ ...p, direccion: e.target.value }))}
                        className="col-span-2 px-3 py-2 rounded-lg border border-input text-sm" autoComplete="address-line1" />
                      <input placeholder="Número" value={pse.numeroDireccion} onChange={e => setPse(p => ({ ...p, numeroDireccion: e.target.value }))}
                        className="px-3 py-2 rounded-lg border border-input text-sm" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <input placeholder="Barrio" value={pse.barrio} onChange={e => setPse(p => ({ ...p, barrio: e.target.value }))}
                        className="px-3 py-2 rounded-lg border border-input text-sm" />
                      <input placeholder="Ciudad" value={pse.ciudad} onChange={e => setPse(p => ({ ...p, ciudad: e.target.value }))}
                        className="px-3 py-2 rounded-lg border border-input text-sm" autoComplete="address-level2" />
                      <input placeholder="Cód. postal" value={pse.codigoPostal} onChange={e => setPse(p => ({ ...p, codigoPostal: e.target.value.replace(/\D/g, '') }))}
                        className="px-3 py-2 rounded-lg border border-input text-sm" inputMode="numeric" autoComplete="postal-code" />
                    </div>
                    <p className="text-[11px] text-muted-foreground">Serás dirigido a tu banco para autorizar la transferencia. Al completarla, volverás a VeloClub.</p>
                  </motion.div>
                )}

                {!activarAutoRenovacion && metodo === 'EFECTY' && (
                  <motion.div initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: EASE }} key="form-efecty" className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <select value={efecty.docType} onChange={e => setEfecty(p => ({ ...p, docType: e.target.value }))}
                        className="px-3 py-2 rounded-lg border border-input text-sm bg-white">
                        {DOC_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <input placeholder="Número de documento" value={efecty.docNumber} onChange={e => setEfecty(p => ({ ...p, docNumber: e.target.value }))}
                        className="px-3 py-2 rounded-lg border border-input text-sm" inputMode="numeric" />
                    </div>
                    <p className="text-[11px] text-muted-foreground">Generaremos un cupón para que pagues en efectivo en cualquier punto Efecty. Tu plan se activa cuando pagues.</p>
                  </motion.div>
                )}

                {/* Términos — el texto cambia si activa renovación automática */}
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" checked={aceptaTerminos} onChange={e => setAceptaTerminos(e.target.checked)} className="mt-0.5 shrink-0" />
                  <span className="text-[11px] text-muted-foreground leading-relaxed">
                    {activarAutoRenovacion
                      ? <>Autorizo este pago y los cobros automáticos recurrentes a esta tarjeta al inicio de cada período. </>
                      : <>Acepto </>}
                    Los <a href="/legal/terminos" target="_blank" rel="noopener noreferrer" className="underline text-primary">Términos y Condiciones</a> y
                    la <a href="/legal/politica-datos" target="_blank" rel="noopener noreferrer" className="underline text-primary">Política de Tratamiento de Datos</a> de VeloClub.
                    {activarAutoRenovacion && ' Puedo desactivar la renovación automática cuando quiera, sin penalidades (Ley 1480 de 2011).'}
                  </span>
                </label>

                <motion.button
                  onClick={handlePagar}
                  disabled={paying || !aceptaTerminos || ((activarAutoRenovacion || metodo === 'CARD') && !sdkReady)}
                  whileTap={reduce ? {} : { scale: 0.98 }}
                  transition={{ duration: 0.12, ease: EASE }}
                  className="w-full py-3 rounded-xl bg-primary text-white text-[13px] font-semibold disabled:opacity-60"
                >
                  {paying ? 'Procesando pago...' : <>Pagar <PrecioAnimado valor={precioAPagar} /></>}
                </motion.button>
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
