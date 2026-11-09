'use client';

// El bloque de pago de Mi suscripción con los Payment Elements de Whop.
//
// Whop dibuja los medios (tarjeta, PSE, Nequi, Bancolombia, Efecty, Bre-B,
// Google Pay, Apple Pay, cripto) y entrega un token. El token va a nuestra API,
// que es la que pone el precio y crea el pago: el monto que se pasa aquí solo
// sirve para que Whop sepa qué medios ofrecer (cada uno tiene sus topes).
//
// Con la renovación prendida se pide guardar el medio (`setupFutureUsage`), y
// Whop solo ofrece los que se pueden guardar: tarjeta y billeteras.

import { useState } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { WhopElements, Payments, PaymentElement, BrandingElement, usePayments, useWhop } from '@whop/elements-react';
import { loadWhop } from '@whop/elements';
import { apiFetch } from '@/lib/api-client';

// Se carga una sola vez por pestaña.
const whopCargado = typeof window !== 'undefined' ? loadWhop() : null;

const TEMA = {
  theme: { appearance: 'light' as const, accentColor: 'violet' as const },
};

export const PAGO_PENDIENTE_KEY = 'veloclub:pago-whop-pendiente';

// El orden de los medios en la lista. Whop muestra cuatro y el resto lo guarda
// en «N métodos de pago más»: PSE va a la vista porque es el que más usan los
// clubes, y Efecty queda detrás. Los que no estén aquí conservan el orden de Whop.
const ORDEN_MEDIOS = ['card', 'bancolombia', 'bre_b', 'pse', 'nequi', 'efecty', 'crypto'];

interface Props {
  /** Lo que se le muestra al club, en pesos. El cobro real lo recalcula la API. */
  monto: number;
  renovacion: boolean;
  aceptaTerminos: boolean;
  couponCode: string | null;
  etiquetaBoton: React.ReactNode;
  onPagado: (pagoId: string) => void;
  onPendiente: (pagoId: string) => void;
}

export function PagoWhop(props: Props) {
  const accountId = process.env.NEXT_PUBLIC_WHOP_ACCOUNT_ID;
  if (!accountId) {
    return <p className="text-[12px] text-red-500">Falta configurar la cuenta de Whop.</p>;
  }
  const returnUrl = typeof window !== 'undefined'
    ? window.location.origin + '/ajustes?tab=suscripcion'
    : 'https://www.veloclubtech.com/ajustes?tab=suscripcion';

  return (
    <WhopElements
      elements={whopCargado}
      appearance={TEMA}
      locale="es"
      environment={process.env.NEXT_PUBLIC_WHOP_ENV === 'sandbox' ? 'sandbox' : 'production'}
    >
      <Payments
        accountId={accountId}
        mode="payment"
        currency="cop"
        amount={Math.round(props.monto * 100)}
        returnUrl={returnUrl}
        setupFutureUsage={props.renovacion ? 'off_session' : undefined}
      >
        <Formulario {...props} />
      </Payments>
    </WhopElements>
  );
}

function Formulario({ aceptaTerminos, renovacion, couponCode, etiquetaBoton, onPagado, onPendiente }: Props) {
  const payments = usePayments();
  const whop = useWhop();
  const { getToken } = useAuth();
  const { user } = useUser();
  const [completo, setCompleto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pagar() {
    if (!payments || !whop || !aceptaTerminos || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const email = user?.primaryEmailAddress?.emailAddress;
      const { confirmationToken } = await payments.createConfirmationToken({
        billingDetails: email ? { email } : undefined,
      });
      const token = await getToken();
      const r = await apiFetch<{ id: string; status: string; clientSecret: string | null }>('/pagos/cobrar', {
        method: 'POST',
        token,
        body: JSON.stringify({ confirmationToken, renovacion, aceptaTerminos, couponCode }),
      });

      if (r.status === 'paid') { onPagado(r.id); return; }

      if (r.clientSecret) {
        // 3D Secure, PSE, la app del banco: Whop abre el paso que falte. Si
        // tiene que salir de la página, al volver se consulta el pago por su id.
        try { sessionStorage.setItem(PAGO_PENDIENTE_KEY, r.id); } catch { /* sin almacenamiento se consulta igual por el aviso */ }
        const fin = await whop.payments.handleNextAction({ clientSecret: r.clientSecret });
        if (fin.redirected) return;
        try { sessionStorage.removeItem(PAGO_PENDIENTE_KEY); } catch { /* nada que limpiar */ }
        if (fin.status === 'succeeded' || fin.status === 'paid') { onPagado(r.id); return; }
        if (fin.status === 'processing' || fin.status === 'pending') { onPendiente(r.id); return; }
        setError(fin.lastPaymentError?.message ?? 'El pago no se completó. Intenta de nuevo o con otro medio.');
        return;
      }

      if (r.status === 'pending' || r.status === 'open') { onPendiente(r.id); return; }
      setError('El pago no pasó. Intenta con otro medio.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo procesar el pago. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-3">
      <PaymentElement order={ORDEN_MEDIOS} onChange={e => setCompleto(e.complete)} />
      <BrandingElement />
      {error && <p role="alert" className="text-[12px] text-red-500 m-0">{error}</p>}
      <button
        type="button"
        onClick={pagar}
        disabled={!completo || !aceptaTerminos || enviando || !payments}
        className="w-full py-3 rounded-xl bg-primary text-white text-[13px] font-semibold disabled:opacity-60 transition-transform active:scale-[0.98] cursor-pointer"
      >
        {enviando ? 'Procesando pago...' : etiquetaBoton}
      </button>
    </div>
  );
}
