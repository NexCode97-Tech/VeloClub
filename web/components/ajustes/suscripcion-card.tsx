'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { apiFetch } from '@/lib/api-client';
import { Desplegable } from '@/components/ui/desplegable';
import { CreditCard, ArrowLeft, Landmark, Banknote, Clock, RefreshCw, XCircle, Check, Star, Users, Zap, Copy, Upload } from 'lucide-react';

const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const cop = fmt.format.bind(fmt);
const EASE = [0.23, 1, 0.32, 1] as const;

// Deslizamiento horizontal entre formularios de pago (Tarjeta / PSE / Efecty),
// con dirección según hacia qué lado del selector se mueve.
const SLIDE_VARIANTS = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 16 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: -dir * 16 }),
};

type TipoPlan = 'MENSUAL' | 'TRIMESTRAL' | 'ANUAL';
const PLAN_LABEL: Record<TipoPlan, string> = { MENSUAL: 'Mensual', TRIMESTRAL: 'Trimestral', ANUAL: 'Anual' };
const PLAN_DESCUENTO_LABEL: Record<TipoPlan, string> = { MENSUAL: 'Sin descuento', TRIMESTRAL: '10% de descuento', ANUAL: '20% de descuento' };
const MESES_POR_PLAN: Record<TipoPlan, number> = { MENSUAL: 1, TRIMESTRAL: 3, ANUAL: 12 };
// Todos los planes incluyen lo mismo — la lista solo refuerza el valor en la tarjeta
const BENEFICIOS_PLAN = [
  'Gestión de miembros y asistencia digital',
  'Pagos y finanzas del club',
  'Resultados y competencias',
  'Analíticas',
  'Gestión de sedes',
];

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
  enTrial: boolean;
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

type MetodoPago = 'CARD' | 'PSE' | 'EFECTY' | 'BREB';

// Datos para transferir por Bre-B. La llave vive en el backend (variable de
// entorno), nunca en el bundle: es un dato personal y puede cambiar.
interface DatosBreb {
  disponible: boolean;
  llave?: string;
  titular?: string;
  referencia?: string;
  monto?: number;
  pendiente?: { id: string; monto: number; creadoEn: string; comprobanteUrl: string | null } | null;
}
interface MetodosDisponibles {
  tarjeta: boolean;
  pse: { disponible: boolean; bancos: Array<{ id: string; description: string }> };
  efecty: boolean;
}
const DOC_TYPES = ['CC', 'CE', 'NIT', 'TI', 'PAS'];

// La url de redirección llega en la respuesta de la API (viene de Mercado Pago).
// Se comprueba el destino antes de navegar para no convertir esa respuesta en una
// redirección abierta si alguna vez devolviera un valor inesperado.
const HOSTS_DE_PAGO = ['mercadopago.com', 'mercadopago.com.co', 'mercadolibre.com', 'mercadolivre.com'];

function esDestinoDePagoConfiable(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== 'https:') return false;
    return HOSTS_DE_PAGO.some(h => hostname === h || hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

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
    return <img src="/card-brands/mastercard.svg" alt="Mastercard" style={{ height: 16, width: 'auto' }} />;
  }
  if (brand === 'visa') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src="/card-brands/visa.svg" alt="Visa" style={{ height: 11, width: 'auto' }} />;
  }
  if (brand === 'amex') {
    return (
      <svg viewBox="0 0 44 24" height="20" role="img" aria-label="American Express">
        <rect width="44" height="24" rx="3" fill="#2E77BC" />
        <text x="22" y="16" textAnchor="middle"
          fontSize="9" fontWeight="600" letterSpacing="0.3" fill="#fff">AMEX</text>
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
          style={{ height: 22, padding: '0 6px', boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}
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

/**
 * Los tres pasos por los que pasa un pago de Bre-B.
 *
 * El punto activo lleva halo ademas de color: quien no distingue verde de ambar
 * necesita una segunda senal para saber donde esta el pago.
 */
function PasosVerificacion({ recibidoEn, comprobanteUrl }: {
  recibidoEn: string;
  comprobanteUrl: string | null;
}) {
  const pasos = [
    {
      titulo: 'Comprobante recibido',
      detalle: new Date(recibidoEn).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }),
      estado: 'hecho' as const,
    },
    {
      titulo: 'Verificando el pago',
      detalle: 'Unas horas, máximo un día hábil',
      estado: 'ahora' as const,
    },
    {
      titulo: 'Plan activado',
      detalle: 'Te llega una notificación',
      estado: 'falta' as const,
    },
  ];

  const COLOR = { hecho: '#0E7C57', ahora: '#D9A22B', falta: '#D8D3E4' };

  return (
    <div className="mt-1">
      <ol className="list-none m-0 p-0 flex flex-col gap-3 md:grid md:grid-cols-3 md:gap-0">
        {pasos.map((paso, i) => {
          const ultimo = i === pasos.length - 1;
          return (
            <li key={paso.titulo} className="relative pl-6 md:pl-0 md:pr-3.5">
              {/* Riel. En movil baja desde el punto hasta el siguiente; en
                  escritorio corre hacia la derecha, y el tramo ya recorrido va
                  en verde atenuado — lo que debe resaltar es donde esta el pago
                  ahora, no lo que ya paso. */}
              {!ultimo && (
                <span
                  aria-hidden="true"
                  className="absolute left-[4px] top-[15px] bottom-[-12px] w-0.5 rounded-full md:left-[14px] md:right-0 md:top-[4px] md:bottom-auto md:h-0.5 md:w-auto"
                  style={{
                    background: paso.estado === 'hecho' ? 'rgba(14,124,87,0.35)' : '#E8E4F0',
                  }}
                />
              )}
              <span
                aria-hidden="true"
                className="absolute left-0 top-[5px] w-2.5 h-2.5 rounded-full md:top-0"
                style={{
                  background: COLOR[paso.estado],
                  boxShadow: paso.estado === 'ahora'
                    ? '0 0 0 3px rgba(240,180,41,0.20)'
                    : '0 0 0 3px #fff',
                }}
              />
              <span className={`block text-[12.5px] leading-tight md:mt-[19px] ${paso.estado === 'falta' ? 'font-medium text-muted-foreground' : 'font-semibold text-foreground'}`}>
                {paso.titulo}
              </span>
              <span className="block text-[11.5px] text-muted-foreground leading-snug mt-0.5">
                {paso.detalle}
              </span>
            </li>
          );
        })}
      </ol>

      {/* El aviso y el enlace comparten fila cuando hay ancho: el enlace suelto
          y centrado se leia como el boton principal de la tarjeta. */}
      <div className="mt-3.5 pt-3 border-t border-border/60 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground m-0 flex-1 min-w-[180px]">
          Tu club sigue funcionando normal. No hace falta que pagues de nuevo.
        </p>
        {comprobanteUrl && (
          <a href={comprobanteUrl} target="_blank" rel="noopener noreferrer"
            className="shrink-0 text-[12px] font-semibold text-primary underline">
            Ver el comprobante
          </a>
        )}
      </div>
    </div>
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
  const [avisoReembolso, setAvisoReembolso] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Intención de renovación automática en el flujo de pago (caso: sin plan / vencido)
  const [activarAutoRenovacion, setActivarAutoRenovacion] = useState(false);
  // Formulario para activar recurrencia sobre un plan ya activo
  const [showActivarForm, setShowActivarForm] = useState(false);

  // Cupón de descuento (solo aplica a pago único, no a la renovación automática)
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ codigo: string; porcentaje: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  async function aplicarCupon() {
    const codigo = couponInput.trim();
    if (!codigo) return;
    setValidatingCoupon(true); setCouponError(null);
    try {
      const token = await getToken();
      const res = await apiFetch<{ valido: boolean; codigo: string; porcentaje: number }>(
        '/mercadopago/validar-cupon',
        { method: 'POST', token, body: JSON.stringify({ codigo }) },
      );
      setAppliedCoupon({ codigo: res.codigo, porcentaje: res.porcentaje });
      setCouponInput('');
    } catch (e) {
      setAppliedCoupon(null);
      setCouponError(e instanceof Error ? e.message : 'No se pudo validar el cupón');
    } finally {
      setValidatingCoupon(false);
    }
  }

  function quitarCupon() {
    setAppliedCoupon(null);
    setCouponError(null);
    setCouponInput('');
  }

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

  // Dirección del deslizamiento entre formularios de pago: hacia la derecha si
  // el nuevo medio está más a la derecha en el selector (Tarjeta → PSE → Efecty → Bre-B),
  // hacia la izquierda si es al revés.
  const METODO_ORDEN: MetodoPago[] = ['CARD', 'PSE', 'EFECTY', 'BREB'];
  const metodoEfectivo: MetodoPago = activarAutoRenovacion ? 'CARD' : metodo;
  const esBreb = metodoEfectivo === 'BREB';
  const prevMetodoRef = useRef(metodoEfectivo);
  const direccionSlide = METODO_ORDEN.indexOf(metodoEfectivo) >= METODO_ORDEN.indexOf(prevMetodoRef.current) ? 1 : -1;
  useEffect(() => { prevMetodoRef.current = metodoEfectivo; });
  const [pse, setPse] = useState({
    bancoId: '', personType: 'natural', docType: 'CC', docNumber: '',
    nombres: '', apellidos: '', telefono: '',
    direccion: '', numeroDireccion: '', codigoPostal: '', barrio: '', ciudad: '',
  });
  const [efecty, setEfecty] = useState({ docType: 'CC', docNumber: '' });
  const [breb, setBreb] = useState<DatosBreb | null>(null);
  const [comprobante, setComprobante] = useState<{ base64: string; nombre: string } | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [payPending, setPayPending] = useState(false);
  const [voucherUrl, setVoucherUrl] = useState<string | null>(null);

  // Selección de plan — se muestra mientras el club no tenga ningún pago registrado
  const [pickedPlan, setPickedPlan] = useState(false);
  const [planes, setPlanes] = useState<PlanOpcion[] | null>(null);
  const [loadingPlanes, setLoadingPlanes] = useState(false);
  const [settingPlan, setSettingPlan] = useState<TipoPlan | null>(null);
  // En móvil el plan se elige en dos pasos: primero se selecciona (la tarjeta se
  // expande y muestra qué incluye) y luego se confirma. En escritorio las tres
  // columnas ya muestran todo a la vez, así que se elige de un solo clic.
  const [planEnfocado, setPlanEnfocado] = useState<TipoPlan>('TRIMESTRAL');

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

  // Al montar (p. ej. al volver del banco tras un pago PSE), verificar si algún
  // pago pendiente ya se acreditó — activa el club al instante sin esperar el
  // webhook de Mercado Pago. Si acreditó algo, recargar la suscripción.
  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const r = await apiFetch<{ acreditados: number }>('/mercadopago/sincronizar', { method: 'POST', token });
        if (r.acreditados > 0) await load();
      } catch { /* silencioso: es una verificación de respaldo */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      // Bre-B se consulta aparte y no bloquea: si falla, quedan los medios de
      // Mercado Pago, que son los que cubren el caso normal.
      const [res, datosBreb] = await Promise.all([
        apiFetch<MetodosDisponibles>('/mercadopago/metodos-pago', { token }),
        apiFetch<DatosBreb>('/mercadopago/breb', { token }).catch(() => null),
      ]);
      setMetodos(res);
      if (datosBreb) setBreb(datosBreb);
      if (!res.tarjeta) setMetodo(res.pse.disponible ? 'PSE' : 'EFECTY');
    } catch { /* la sección de pago mostrará solo tarjeta como fallback */ }
    finally { setLoadingMetodos(false); }
  }

  /** Lee el comprobante como data URL, que es lo que espera el backend. */
  function tomarComprobante(archivo: File | null) {
    if (!archivo) { setComprobante(null); return; }
    // Cloudinary y el guard del backend rechazan lo grande; avisar aquí evita
    // que alguien espere una subida que ya se sabe que va a fallar.
    if (archivo.size > 5 * 1024 * 1024) {
      setError('El comprobante no puede pesar más de 5 MB.');
      return;
    }
    const lector = new FileReader();
    lector.onload = () => {
      setError(null);
      setComprobante({ base64: String(lector.result), nombre: archivo.name });
    };
    lector.onerror = () => setError('No se pudo leer el archivo. Intenta con otro.');
    lector.readAsDataURL(archivo);
  }

  async function copiar(texto: string, cual: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(cual);
      setTimeout(() => setCopiado(null), 1800);
    } catch { /* sin portapapeles el dato sigue visible para copiarlo a mano */ }
  }

  /** Registra la transferencia por Bre-B. No activa el club: queda en revisión. */
  async function enviarBreb() {
    if (!comprobante) { setError('Sube el comprobante de la transferencia.'); return; }
    setPaying(true);
    setError(null);
    try {
      const token = await getToken();
      await apiFetch('/mercadopago/breb', {
        method: 'POST', token,
        body: JSON.stringify({ base64: comprobante.base64, aceptaTerminos }),
      });
      setComprobante(null);
      const actualizado = await apiFetch<DatosBreb>('/mercadopago/breb', { token });
      setBreb(actualizado);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar el comprobante.');
    } finally {
      setPaying(false);
    }
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
      if (appliedCoupon) body.couponCode = appliedCoupon.codigo;
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
        quitarCupon();
        await load();
      } else if (res.status === 'pending') {
        if (metodo === 'PSE' && res.redirectUrl && esDestinoDePagoConfiable(res.redirectUrl)) {
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
      const res = await apiFetch<{ ok: true; reembolsado: boolean }>('/mercadopago/cancelar', { method: 'POST', token });
      setConfirmarCancelar(false);
      setAvisoReembolso(res.reembolsado);
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
        <p className="text-[11px] font-semibold text-muted-foreground tracking-wide mb-1">
          Sin plan activo<span className="hidden md:inline"> · {data.cantidadDeportistas} deportistas</span>
        </p>
        <p className="text-[20px] font-semibold text-foreground mb-1 md:text-[15px] md:mb-4">Elige tu plan</p>
        <p className="text-[12px] text-muted-foreground mb-4 md:hidden">Tu club queda listo apenas pagues.</p>

        {/* Resumen del club — en móvil explica de dónde sale el precio, que en
            escritorio se entiende por el contexto de las tres columnas */}
        <div className="flex items-center gap-3 rounded-2xl p-3 mb-4 md:hidden" style={{ background: 'rgba(120,80,200,0.06)' }}>
          <div className="w-9 h-9 rounded-full shrink-0 grid place-items-center bg-white border border-border">
            <Users className="w-[18px] h-[18px]" style={{ color: '#7C3AED' }} />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-foreground leading-tight">
              {data.cantidadDeportistas} deportista{data.cantidadDeportistas !== 1 ? 's' : ''} registrado{data.cantidadDeportistas !== 1 ? 's' : ''}
            </p>
            <p className="text-[11.5px] text-muted-foreground mt-0.5">El precio se ajusta solo si cambia el número</p>
          </div>
        </div>

        {avisoReembolso && (
          <p className="text-[12px] rounded-lg p-2.5 mb-3" style={{ background: 'rgba(6,214,160,0.08)', color: '#06D6A0' }}>
            Cancelaste dentro de tu período de prueba gratis. Ya se reembolsó el pago completo a tu tarjeta.
          </p>
        )}
        {error && <p className="text-[12px] text-red-500 mb-3">{error}</p>}

        {loadingPlanes || !planes ? (
          <div className="flex justify-center py-10">
            <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : (
          <>
          {/* ── Móvil: selección en dos pasos, la tarjeta activa se expande ── */}
          <div className="md:hidden space-y-2.5" role="radiogroup" aria-label="Plan de suscripción">
            {(() => { const precioMensualBase = planes.find(x => x.tipoPlan === 'MENSUAL')?.precio ?? 0; return planes.map(p => {
              const activo = planEnfocado === p.tipoPlan;
              const destacado = p.tipoPlan === 'TRIMESTRAL';
              const precioMes = Math.round(p.precio / MESES_POR_PLAN[p.tipoPlan]);
              const ahorroPesos = precioMensualBase * MESES_POR_PLAN[p.tipoPlan] - p.precio;
              return (
                <motion.button
                  key={p.tipoPlan}
                  role="radio"
                  aria-checked={activo}
                  onClick={() => setPlanEnfocado(p.tipoPlan)}
                  whileTap={reduce ? {} : { scale: 0.99 }}
                  transition={{ duration: 0.12, ease: EASE }}
                  className="relative w-full text-left rounded-2xl overflow-hidden transition-colors"
                  style={{
                    background: '#fff',
                    border: activo ? '2px solid #7C3AED' : '1px solid rgba(26,16,40,0.10)',
                    // Un solo atajo, sin paddingTop aparte. Antes iban los dos, y
                    // en las tarjetas sin etiqueta el segundo valia undefined: al
                    // montar, React lo aplica igual y borra el relleno superior
                    // que acababa de poner el atajo, asi que el contenido salia
                    // pegado al borde de arriba. En los siguientes dibujados ya no
                    // habia diferencia que aplicar y el relleno sobrevivia, por eso
                    // se acomodaba solo despues de la primera seleccion.
                    //
                    // La franja de arriba es para la etiqueta "Mas popular", que va
                    // anclada a esa esquina, justo donde cae el precio.
                    padding: `${destacado ? (activo ? 33 : 34) : (activo ? 13 : 14)}px ${activo ? 13 : 14}px ${activo ? 13 : 14}px`,
                    boxShadow: activo ? '0 6px 22px -12px rgba(124,58,237,0.5)' : undefined,
                  }}
                >
                  {destacado && (
                    <span
                      className="absolute top-0 right-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1"
                      style={{ background: '#7C3AED', color: '#fff', borderBottomLeftRadius: 12 }}
                    >
                      <Star className="w-2.5 h-2.5" style={{ color: '#FFD60A' }} fill="#FFD60A" />
                      Más popular
                    </span>
                  )}
                  {/* Centrada y con alto minimo: las dos columnas no miden lo
                      mismo (nombre + subtitulo contra precio + periodo), asi que
                      ancladas arriba el nombre y el precio quedaban a distinta
                      altura y la tarjeta mas corta pegada al borde. El alto fijo
                      ademas empareja las plegadas entre si, sin importar cuanto
                      mida el ahorro de cada club. */}
                  <div className="flex items-center gap-3" style={{ minHeight: 52 }}>
                    <span
                      className="w-[22px] h-[22px] rounded-full shrink-0 grid place-items-center transition-colors"
                      style={{ border: `2px solid ${activo ? '#7C3AED' : 'rgba(26,16,40,0.16)'}` }}
                    >
                      <motion.span
                        animate={{ scale: activo ? 1 : 0 }}
                        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 22 }}
                        style={{ width: 12, height: 12, borderRadius: '50%', background: '#7C3AED', display: 'block' }}
                      />
                    </span>
                    <div>
                      <p className="text-[15.5px] font-semibold text-foreground leading-tight">{PLAN_LABEL[p.tipoPlan]}</p>
                      <p className="text-[12px] mt-0.5" style={{ color: ahorroPesos > 0 ? '#06D6A0' : 'var(--muted-foreground, #8E87A8)', fontWeight: ahorroPesos > 0 ? 600 : 400 }}>
                        {ahorroPesos > 0 ? `Ahorras ${cop(ahorroPesos)}` : 'Se paga cada mes'}
                      </p>
                    </div>
                    <div className="ml-auto text-right shrink-0">
                      <p className="text-[17px] font-semibold text-foreground tabular-nums">{cop(p.precio)}</p>
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        {p.tipoPlan === 'MENSUAL' ? 'por mes' : `${cop(precioMes)} / mes`}
                      </p>
                    </div>
                  </div>

                  <Expand show={activo}>
                    <ul className="flex flex-col gap-2.5 pt-4" style={{ paddingLeft: 34 }}>
                      {BENEFICIOS_PLAN.map((b, i) => (
                        <motion.li
                          key={b}
                          initial={reduce ? { opacity: 1 } : { opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={reduce ? { duration: 0 } : { delay: i * 0.05, duration: 0.3, ease: EASE }}
                          className="flex items-center gap-2.5 text-[12.5px]"
                          style={{ color: 'rgba(26,16,40,0.78)' }}
                        >
                          <Check className="w-[15px] h-[15px] shrink-0" strokeWidth={3} style={{ color: '#06D6A0' }} />
                          {b}
                        </motion.li>
                      ))}
                    </ul>
                  </Expand>
                </motion.button>
              );
            }); })()}

            <motion.button
              onClick={() => handleElegirPlan(planEnfocado)}
              disabled={settingPlan !== null}
              whileTap={reduce ? {} : { scale: 0.985 }}
              transition={{ duration: 0.12, ease: EASE }}
              className="w-full py-3.5 rounded-2xl text-white text-[14px] font-semibold disabled:opacity-60"
              style={{ background: '#7C3AED', marginTop: 14 }}
            >
              {settingPlan
                ? 'Guardando...'
                : <>Continuar con <PrecioAnimado valor={planes.find(x => x.tipoPlan === planEnfocado)?.precio ?? 0} /></>}
            </motion.button>
          </div>

          {/* ── Escritorio: las tres columnas se comparan de un vistazo ────── */}
          <div className="hidden md:grid md:grid-cols-3 md:gap-4 md:items-stretch">
            {(() => { const precioMensualBase = planes.find(x => x.tipoPlan === 'MENSUAL')?.precio ?? 0; return planes.map(p => {
              const destacado = p.tipoPlan === 'TRIMESTRAL';
              const precioMes = Math.round(p.precio / MESES_POR_PLAN[p.tipoPlan]);
              const ahorroPesos = precioMensualBase * MESES_POR_PLAN[p.tipoPlan] - p.precio;
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
                      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-md mb-2 md:absolute md:-top-3 md:left-1/2 md:-translate-x-1/2 md:mb-0"
                      style={{ background: '#7C3AED', color: '#fff' }}
                    >
                      <Star className="w-3 h-3" style={{ color: '#FFD60A' }} fill="#FFD60A" />
                      Más popular
                    </span>
                  )}
                  <div className="flex items-center justify-between md:flex-col md:items-center md:gap-1 md:mt-1">
                    <div className="md:order-1">
                      <p className="text-[14px] font-semibold text-foreground md:text-[12px] md:font-semibold md:tracking-wide md:text-muted-foreground">{PLAN_LABEL[p.tipoPlan]}</p>
                      <p className="text-[12px] mt-0.5 md:hidden" style={{ color: p.tipoPlan === 'MENSUAL' ? 'var(--muted-foreground, #8E87A8)' : '#06D6A0' }}>
                        {ahorroPesos > 0 ? `${PLAN_DESCUENTO_LABEL[p.tipoPlan]} · Ahorras ${fmt.format(ahorroPesos)}` : PLAN_DESCUENTO_LABEL[p.tipoPlan]}
                      </p>
                    </div>
                    <div className="text-right md:text-center md:order-2 md:mt-2">
                      <p className="text-[18px] font-semibold text-foreground md:text-[26px]">{settingPlan === p.tipoPlan ? '...' : fmt.format(p.precio)}</p>
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
                  {ahorroPesos > 0 && (
                    <p className="hidden md:block text-[11px] text-muted-foreground mt-0.5">
                      Ahorras {fmt.format(ahorroPesos)} en total
                    </p>
                  )}
                  <ul className="hidden md:flex md:flex-1 md:flex-col md:gap-1.5 text-left mt-4">
                    {BENEFICIOS_PLAN.map(b => (
                      <li key={b} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Check className="w-3 h-3 shrink-0" style={{ color: '#06D6A0' }} />
                        {b}
                      </li>
                    ))}
                  </ul>
                  <div className="hidden md:flex md:items-end md:pt-4 md:mt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                    <span
                      className="text-[13px] font-semibold px-4 py-2 rounded-lg w-full text-center"
                      style={{ background: destacado ? '#7C3AED' : 'rgba(67,97,238,0.08)', color: destacado ? '#fff' : '#4361EE' }}
                    >
                      {settingPlan === p.tipoPlan ? 'Guardando...' : 'Elegir este plan'}
                    </span>
                  </div>
                </motion.button>
              );
            }); })()}
          </div>
          </>
        )}

        {/* Solo si de verdad hay algo que ahorrar. Durante la campaña el
            trimestre vale lo mismo con renovación automática y sin ella, y
            prometer un 5% que el cobro no da es la clase de detalle que hace
            que un club deje de creerle a la pantalla. */}
        {planes?.some(p => p.precioConAutoRenew < p.precio) && (
          <p className="text-[11px] text-muted-foreground text-center mt-4">
            Activa la renovación automática al pagar y suma 5% de descuento adicional
          </p>
        )}
      </div>
    );
  }

  const { suscripcion, cantidadDeportistas, vigencia, enTrial } = data;
  const planActivo = !!vigencia && !vigencia.vencido;
  const pctColor = !vigencia ? '#8E87A8' : vigencia.vencido ? '#EF476F' : vigencia.pct >= 50 ? '#06D6A0' : vigencia.pct >= 20 ? '#FFB703' : '#EF476F';
  const precioAPagar = activarAutoRenovacion ? suscripcion.planMontoConAutoRenew : suscripcion.planMontoSinAutoRenew;
  // El cupón solo aplica a pago único (no a la renovación automática recurrente).
  const cuponActivo = !activarAutoRenovacion ? appliedCoupon : null;
  const descuentoCuponPesos = cuponActivo ? Math.round(precioAPagar * (cuponActivo.porcentaje / 100)) : 0;
  const precioFinal = Math.max(0, precioAPagar - descuentoCuponPesos);
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
          style={{ paddingRight: cardBrand ? 60 : undefined }}
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
        <p className="text-[11px] text-muted-foreground">Tarjeta débito detectada. El pago se hace en 1 solo cobro.</p>
      )}
      {!loadingCuotas && cardTipo === 'credit_card' && cuotas.length > 1 && (
        <Desplegable
          valor={String(cuotasSeleccionadas)}
          opciones={cuotas.map(c => ({ valor: String(c.installments), texto: c.recommended_message }))}
          vacio="Elegir cuotas"
          titulo="En cuántas cuotas"
          onElegir={v => setCuotasSeleccionadas(Number(v))}
        />
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
              <PrecioAnimado valor={planActivo ? suscripcion.planMonto : precioAPagar} className="text-[22px] font-semibold text-foreground" />
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
              <p className="text-[26px] font-semibold" style={{ color: pctColor }}>{vigencia.pct}%</p>
              <p className="text-[10px] font-semibold" style={{ color: pctColor }}>{vigencia.vencido ? 'Vencido' : `${vigencia.diasRestantes}d restantes`}</p>
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
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(6,214,160,0.12)', color: '#06D6A0' }}>-5%</span>
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
                    {enTrial
                      ? 'Todavía estás en tu período de prueba gratis. Si cancelas ahora, te devolvemos el pago completo a tu tarjeta.'
                      : <>¿Seguro que quieres cancelar? Tu club seguirá activo hasta el <span className="font-semibold">{fechaVencimiento}</span> y no se harán más cobros. Podrás reactivar cuando quieras.</>}
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
                  Ya pagué, actualizar estado
                </button>
              </div>
            ) : loadingMetodos ? (
              <div className="flex justify-center py-6">
                <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            ) : (
              <>
                {/* Toggle de renovación automática como descuento.
                    No se ofrece con Bre-B: el cobro recurrente se hace con la
                    tarjeta tokenizada en Mercado Pago, y una transferencia no
                    deja nada que volver a cobrar. Tampoco con un comprobante en
                    revisión, que es un pago que todavía no termina. */}
                {metodo !== 'BREB' && !breb?.pendiente && (
                <div className="rounded-xl p-3 flex items-center justify-between gap-3"
                  style={{ background: activarAutoRenovacion ? 'rgba(6,214,160,0.08)' : 'rgba(120,80,200,0.05)', transition: 'background 0.25s cubic-bezier(0.23,1,0.32,1)' }}>
                  <div className="flex items-center gap-2.5">
                    <RefreshCw className="w-4 h-4 shrink-0" style={{ color: activarAutoRenovacion ? '#06D6A0' : '#8E87A8' }} />
                    <div>
                      <p className="text-[13px] font-semibold text-foreground flex items-center gap-1.5">
                        Renovación automática
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(6,214,160,0.14)', color: '#06D6A0' }}>-5%</span>
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
                )}

                {enTrial && (
                  <p className="text-[11px] text-muted-foreground rounded-lg p-2.5" style={{ background: 'rgba(67,97,238,0.06)' }}>
                    Todavía estás en tu período de prueba gratis. Si pagas ahora, tu plan pagado empieza a correr cuando termine la prueba, para que aproveches tus días gratis completos. Si cancelas antes de esa fecha, te devolvemos el pago completo.
                  </p>
                )}

                {/* Un comprobante en revisión es lo primero que tiene que ver: es
                    su plata. Vivía dentro de la pestaña Bre-B, y como al recargar
                    el medio por defecto es Tarjeta, el estado quedaba escondido
                    detrás de una pestaña que nadie tenía por qué volver a abrir —
                    justo el escenario en el que alguien paga dos veces creyendo
                    que el primer envío no quedó. Va arriba y no depende del medio
                    seleccionado. */}
                {breb?.pendiente && (
                  <div className="rounded-xl border border-border p-3 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold text-foreground m-0">Pago en verificación</p>
                      <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(240,180,41,0.14)', color: '#8A6216' }}>
                        En revisión
                      </span>
                    </div>
                    <p className="text-[11.5px] text-muted-foreground m-0">
                      {cop(breb.pendiente.monto)} · enviado por Bre-B
                    </p>
                    {/* Los marcadores por defecto de una lista se pierden contra
                        el fondo blanco: quedaban tres frases del mismo peso y nada
                        decía en cuál de los tres pasos está el pago. Vertical en
                        movil; en escritorio el recorrido se lee de izquierda a
                        derecha, que es donde el ancho deja de sobrar. */}
                    <PasosVerificacion
                      recibidoEn={breb.pendiente.creadoEn}
                      comprobanteUrl={breb.pendiente.comprobanteUrl}
                    />
                  </div>
                )}

                {!breb?.pendiente && (
                <p className="text-[13px] font-semibold text-foreground">Paga tu suscripción</p>
                )}

                {/* Selector de medio — oculto cuando la renovación automática está activa (solo tarjeta) */}
                <Expand show={!activarAutoRenovacion && !breb?.pendiente}>
                  {/* Cuatro medios ya no caben en una fila en movil: 2x2 abajo,
                      una sola fila desde tablet. */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pb-0.5">
                    {([
                      { key: 'CARD'   as MetodoPago, label: 'Tarjeta', icon: CreditCard, disponible: metodos?.tarjeta ?? true },
                      { key: 'PSE'    as MetodoPago, label: 'PSE',     icon: Landmark,   disponible: metodos?.pse.disponible ?? false },
                      { key: 'EFECTY' as MetodoPago, label: 'Efecty',  icon: Banknote,   disponible: metodos?.efecty ?? false },
                      { key: 'BREB'   as MetodoPago, label: 'Bre-B',   icon: Zap,        disponible: breb?.disponible ?? false },
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
                          {key === 'BREB' && (
                            <span className="relative z-10 text-[9px] font-medium opacity-70 -mt-0.5">Transferencia</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </Expand>

                {/* Formularios según medio (o tarjeta forzada si auto-renovación) */}
                <AnimatePresence mode="wait" custom={direccionSlide} initial={false}>
                {!breb?.pendiente && metodoEfectivo === 'CARD' && (
                  <motion.div
                    key="form-card"
                    custom={direccionSlide}
                    variants={SLIDE_VARIANTS}
                    initial={reduce ? false : 'enter'}
                    animate="center"
                    exit={reduce ? undefined : 'exit'}
                    transition={{ duration: 0.2, ease: EASE }}
                  >
                    {activarAutoRenovacion && (
                      <p className="text-[11px] text-muted-foreground rounded-lg p-2 mb-2.5" style={{ background: 'rgba(255,183,3,0.08)' }}>
                        Mercado Pago hará un cobro de validación de <strong>$1.600</strong> para confirmar que tu tarjeta funciona. No es parte del pago de tu plan y <strong>te lo devuelven automáticamente</strong> en las siguientes horas.
                      </p>
                    )}
                    {cardFields}
                  </motion.div>
                )}

                {!breb?.pendiente && metodoEfectivo === 'PSE' && (
                  <motion.div
                    key="form-pse"
                    custom={direccionSlide}
                    variants={SLIDE_VARIANTS}
                    initial={reduce ? false : 'enter'}
                    animate="center"
                    exit={reduce ? undefined : 'exit'}
                    transition={{ duration: 0.2, ease: EASE }}
                    className="space-y-2.5">
                    <Desplegable
                      valor={pse.bancoId}
                      opciones={(metodos?.pse.bancos ?? []).map(b => ({ valor: String(b.id), texto: b.description }))}
                      vacio="Selecciona tu banco"
                      titulo="Tu banco"
                      onElegir={v => setPse(p => ({ ...p, bancoId: v }))}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Desplegable
                        valor={pse.personType}
                        opciones={[
                          { valor: 'natural',  texto: 'Persona natural' },
                          { valor: 'juridica', texto: 'Persona jurídica' },
                        ]}
                        vacio="Tipo de persona"
                        titulo="Tipo de persona"
                        onElegir={v => setPse(p => ({ ...p, personType: v }))}
                      />
                      <Desplegable
                        valor={pse.docType}
                        opciones={DOC_TYPES.map(d => ({ valor: d, texto: d }))}
                        vacio="Documento"
                        titulo="Tipo de documento"
                        onElegir={v => setPse(p => ({ ...p, docType: v }))}
                      />
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

                {!breb?.pendiente && metodoEfectivo === 'EFECTY' && (
                  <motion.div
                    key="form-efecty"
                    custom={direccionSlide}
                    variants={SLIDE_VARIANTS}
                    initial={reduce ? false : 'enter'}
                    animate="center"
                    exit={reduce ? undefined : 'exit'}
                    transition={{ duration: 0.2, ease: EASE }}
                    className="space-y-2.5"
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <Desplegable
                        valor={efecty.docType}
                        opciones={DOC_TYPES.map(d => ({ valor: d, texto: d }))}
                        vacio="Documento"
                        titulo="Tipo de documento"
                        onElegir={v => setEfecty(p => ({ ...p, docType: v }))}
                      />
                      <input placeholder="Número de documento" value={efecty.docNumber} onChange={e => setEfecty(p => ({ ...p, docNumber: e.target.value }))}
                        className="px-3 py-2 rounded-lg border border-input text-sm" inputMode="numeric" />
                    </div>
                    <p className="text-[11px] text-muted-foreground">Generaremos un cupón para que pagues en efectivo en cualquier punto Efecty. Tu plan se activa cuando pagues.</p>
                  </motion.div>
                )}

                {!breb?.pendiente && metodoEfectivo === 'BREB' && (
                  <motion.div
                    key="form-breb"
                    custom={direccionSlide}
                    variants={SLIDE_VARIANTS}
                    initial={reduce ? false : 'enter'}
                    animate="center"
                    exit={reduce ? undefined : 'exit'}
                    transition={{ duration: 0.2, ease: EASE }}
                    className="space-y-2.5"
                  >
                      <>
                        <div className="rounded-xl border border-border p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground m-0">Llave Bre-B</p>
                              <p className="text-[15px] font-bold text-foreground m-0 tabular-nums">{breb?.llave}</p>
                            </div>
                            <button type="button" onClick={() => copiar(breb?.llave ?? '', 'llave')}
                              className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-primary px-2.5 py-1.5 rounded-lg border border-primary/30 cursor-pointer">
                              {copiado === 'llave' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              {copiado === 'llave' ? 'Copiada' : 'Copiar'}
                            </button>
                          </div>
                          <p className="text-[11.5px] text-muted-foreground m-0">
                            A nombre de <b className="text-foreground">{breb?.titular}</b> · solo Colombia
                          </p>

                          <div className="flex items-center justify-between gap-2 pt-1">
                            <div className="min-w-0">
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground m-0">
                                Referencia, escríbela en la nota
                              </p>
                              <p className="text-[14px] font-bold text-foreground m-0">{breb?.referencia}</p>
                            </div>
                            <button type="button" onClick={() => copiar(breb?.referencia ?? '', 'ref')}
                              className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-primary px-2.5 py-1.5 rounded-lg border border-primary/30 cursor-pointer">
                              {copiado === 'ref' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              {copiado === 'ref' ? 'Copiada' : 'Copiar'}
                            </button>
                          </div>
                        </div>

                        {/* El aviso va ANTES de que transfiera: si se entera de la
                            demora cuando ya pagó, escribe preocupado. */}
                        <div className="rounded-xl p-3 flex gap-2"
                          style={{ background: 'rgba(240,180,41,0.10)', border: '1px solid rgba(240,180,41,0.30)' }}>
                          <Clock className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#8A6216' }} />
                          <p className="text-[11.5px] m-0 leading-relaxed" style={{ color: '#8A6216' }}>
                            <b>La verificación puede tomar unas horas.</b> Tu transferencia llega en
                            segundos, pero confirmamos manualmente que entró antes de activar el plan.
                            Te avisamos apenas quede lista. No tienes que volver a pagar.
                          </p>
                        </div>

                        <label className="block rounded-xl p-4 text-center cursor-pointer"
                          style={{ border: '1.5px dashed rgba(120,80,200,0.30)', background: 'rgba(124,58,237,0.03)' }}>
                          <input type="file" accept="image/*,application/pdf" className="hidden"
                            onChange={e => tomarComprobante(e.target.files?.[0] ?? null)} />
                          <Upload className="w-4 h-4 mx-auto mb-1 text-primary" />
                          <span className="block text-[12.5px] font-semibold text-foreground">
                            {comprobante ? comprobante.nombre : 'Subir comprobante'}
                          </span>
                          <span className="block text-[11px] text-muted-foreground mt-0.5">
                            {comprobante ? 'Toca para cambiarlo' : 'Foto o PDF · hasta 5 MB'}
                          </span>
                        </label>
                      </>
                  </motion.div>
                )}
                </AnimatePresence>

                {/* Cupón de descuento — solo para pago único (no renovación automática).
                    Queda fuera de Bre-B: el canje se registraría al enviar el
                    comprobante, y un pago que despues no se verifica dejaria el
                    cupon quemado sin que el club recibiera nada. */}
                {!activarAutoRenovacion && !esBreb && (
                  <div className="rounded-xl border border-border p-3">
                    {cuponActivo ? (
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[12px] font-semibold text-foreground m-0 truncate">
                            Cupón {cuponActivo.codigo} aplicado
                          </p>
                          <p className="text-[11px] text-[#06D6A0] m-0">
                            −{cuponActivo.porcentaje}% · ahorras {fmt.format(descuentoCuponPesos)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={quitarCupon}
                          className="shrink-0 text-[11px] font-semibold text-muted-foreground hover:text-foreground underline"
                        >
                          Quitar
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">¿Tienes un cupón de descuento?</p>
                        <div className="flex gap-2">
                          <input
                            value={couponInput}
                            onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponError(null); }}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); aplicarCupon(); } }}
                            placeholder="Código del cupón"
                            className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-border bg-background text-[13px] uppercase tracking-wide"
                          />
                          <button
                            type="button"
                            onClick={aplicarCupon}
                            disabled={validatingCoupon || !couponInput.trim()}
                            className="shrink-0 px-3.5 py-2 rounded-lg bg-secondary text-[12px] font-semibold text-foreground disabled:opacity-50"
                          >
                            {validatingCoupon ? '...' : 'Aplicar'}
                          </button>
                        </div>
                        {couponError && <p className="text-[11px] text-[#EF476F] mt-1.5 m-0">{couponError}</p>}
                      </>
                    )}
                  </div>
                )}

                {/* Términos — el texto cambia si activa renovación automática */}
                {/* Con un comprobante ya en revision no hay nada que aceptar ni que
                    enviar: el formulario de arriba muestra en que va. */}
                {!breb?.pendiente && (
                <>
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
                  onClick={esBreb ? enviarBreb : handlePagar}
                  disabled={
                    paying || !aceptaTerminos ||
                    ((activarAutoRenovacion || metodo === 'CARD') && !sdkReady) ||
                    (esBreb && !comprobante)
                  }
                  whileTap={reduce ? {} : { scale: 0.98 }}
                  transition={{ duration: 0.12, ease: EASE }}
                  className="w-full py-3 rounded-xl bg-primary text-white text-[13px] font-semibold disabled:opacity-60"
                >
                  {paying
                    ? (esBreb ? 'Enviando...' : 'Procesando pago...')
                    : esBreb
                      ? 'Ya transferí, enviar para verificación'
                      : <>Pagar <PrecioAnimado valor={precioFinal} /></>}
                </motion.button>
                <p className="text-[10px] text-muted-foreground text-center">
                  {esBreb
                    ? 'Bre-B solo funciona entre cuentas y billeteras de Colombia. Verificamos la transferencia manualmente antes de activar el plan, y no permite renovación automática: para eso paga con tarjeta.'
                    : 'Pago procesado de forma segura por Mercado Pago. Tus datos nunca se guardan en VeloClub.'}
                </p>
                </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
