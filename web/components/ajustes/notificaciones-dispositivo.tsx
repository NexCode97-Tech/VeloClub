'use client';

/**
 * «Notificaciones en este dispositivo», en Ajustes > Mi perfil.
 *
 * Activa los avisos push en el navegador o celular donde se toca, no en la
 * cuenta: cada dispositivo pide su propio permiso, y por eso la tarjeta habla
 * de «este dispositivo». El envío está en api/src/lib/push.ts y el aviso lo
 * muestra el service worker (app/sw.ts).
 *
 * En iPhone y iPad Apple solo deja recibirlos con VeloClub agregado a la
 * pantalla de inicio. Desde Safari la tarjeta no ofrece el botón, porque el
 * navegador ni siquiera tiene con qué suscribirse: explica en tres pasos cómo
 * agregarla.
 */
import { useAuth } from '@clerk/nextjs';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { IconNotificaciones } from '@/components/ui/custom-icons';

type Estado = 'cargando' | 'apagada' | 'activa' | 'trabajando' | 'ios-instalar' | 'bloqueadas' | 'no-soportado';

function esAppleMovil(): boolean {
  const ua = navigator.userAgent;
  // El iPad con iPadOS se presenta como Mac; lo delata la pantalla táctil.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function estaInstalada(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches;
}

function soportaPush(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** La clave VAPID llega en base64 de URL; el navegador la quiere en bytes. */
function aBytes(base64: string): Uint8Array<ArrayBuffer> {
  const relleno = '='.repeat((4 - (base64.length % 4)) % 4);
  const crudo = atob((base64 + relleno).replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(new ArrayBuffer(crudo.length));
  for (let i = 0; i < crudo.length; i++) bytes[i] = crudo.charCodeAt(i);
  return bytes;
}

/** El registro del worker, sin quedarse esperando si nunca llega (navegadores internos). */
async function registroDelWorker(): Promise<ServiceWorkerRegistration | null> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>(resolve => setTimeout(() => resolve(null), 8000)),
  ]);
}

const COMPARTIR = 'M12 2.5 7.8 6.7l1.1 1.1 2.3-2.3V15h1.6V5.5l2.3 2.3 1.1-1.1zM6 10h3v1.6H6.6v8.8h10.8v-8.8H15V10h3v12H6z';

export default function NotificacionesDispositivo({ rol }: { rol: string | null }) {
  const { getToken } = useAuth();
  const [estado, setEstado] = useState<Estado>('cargando');
  const [error, setError] = useState<string | null>(null);

  const guardarEnServidor = useCallback(async (sub: PushSubscription) => {
    const token = await getToken();
    await apiFetch('/push/dispositivos', { method: 'POST', token, body: JSON.stringify(sub.toJSON()) });
  }, [getToken]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      if (esAppleMovil() && !estaInstalada()) return vivo && setEstado('ios-instalar');
      if (!soportaPush()) return vivo && setEstado('no-soportado');
      if (Notification.permission === 'denied') return vivo && setEstado('bloqueadas');
      const reg = await registroDelWorker();
      if (!reg) return vivo && setEstado('no-soportado');
      const sub = await reg.pushManager.getSubscription();
      if (sub && Notification.permission === 'granted') {
        // Se vuelve a guardar: si el servidor la había borrado, así se recupera.
        guardarEnServidor(sub).catch(() => undefined);
        if (vivo) setEstado('activa');
      } else if (vivo) {
        setEstado('apagada');
      }
    })().catch(() => vivo && setEstado('no-soportado'));
    return () => { vivo = false; };
  }, [guardarEnServidor]);

  async function activar() {
    setError(null);
    setEstado('trabajando');
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== 'granted') {
        setEstado(permiso === 'denied' ? 'bloqueadas' : 'apagada');
        return;
      }
      const reg = await registroDelWorker();
      if (!reg) { setEstado('no-soportado'); return; }
      const token = await getToken();
      const { clave } = await apiFetch<{ clave: string }>('/push/clave', { token });
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(clave) });
      await guardarEnServidor(sub);
      setEstado('activa');
    } catch {
      setError('No se pudieron activar. Intenta de nuevo.');
      setEstado('apagada');
    }
  }

  async function desactivar() {
    setError(null);
    setEstado('trabajando');
    try {
      const reg = await registroDelWorker();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const token = await getToken();
        await apiFetch('/push/dispositivos', { method: 'DELETE', token, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => undefined);
        await sub.unsubscribe();
      }
      setEstado('apagada');
    } catch {
      setError('No se pudieron desactivar. Intenta de nuevo.');
      setEstado('activa');
    }
  }

  if (estado === 'cargando') return null;

  const queAvisa = rol === 'ADMIN'
    ? 'Te avisamos de los comprobantes de pago y las inscripciones nuevas'
    : rol === 'ENTRENADOR'
      ? 'Te avisamos una hora antes de cada clase'
      : 'Te avisamos de tus clases, tus mensualidades y los eventos del club';

  const boton = estado === 'apagada' || estado === 'trabajando'
    ? (
      <button
        type="button"
        onClick={activar}
        disabled={estado === 'trabajando'}
        className="h-[42px] px-5 rounded-xl bg-[#381DA0] text-white text-sm font-semibold whitespace-nowrap shadow-[0_1px_2px_rgba(56,29,160,.2),0_3px_8px_-2px_rgba(56,29,160,.28)] disabled:opacity-60 transition-transform duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#381DA0]/40 w-full sm:w-auto"
      >
        {estado === 'trabajando' ? 'Activando…' : 'Activar notificaciones'}
      </button>
    )
    : estado === 'activa'
      ? (
        <button
          type="button"
          onClick={desactivar}
          className="h-10 px-[18px] rounded-xl bg-white border border-border text-[13.5px] font-medium text-foreground transition-transform duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#381DA0]/40 w-full sm:w-auto"
        >
          Desactivar
        </button>
      )
      : null;

  return (
    <section className="bg-white border border-border rounded-2xl p-[18px] sm:px-7 sm:py-[22px]">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3.5">
        <div className="flex items-start gap-3.5 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#F0ECFB] grid place-items-center shrink-0">
            <IconNotificaciones className="w-[19px] h-[19px] text-[#381DA0]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] font-semibold text-foreground tracking-[-0.01em]">Notificaciones en este dispositivo</h3>

            {estado === 'activa' && (
              <span className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-[3px] rounded-full bg-[#EAFBF0] text-[#15803D] text-xs font-semibold">
                <span className="w-[7px] h-[7px] rounded-full bg-[#16A34A]" />
                Activas
              </span>
            )}

            <p className="text-[13px] text-muted-foreground leading-relaxed mt-1">
              {estado === 'activa' && `${queAvisa}, aunque tengas VeloClub cerrado.`}
              {(estado === 'apagada' || estado === 'trabajando') && `${queAvisa}, aunque tengas VeloClub cerrado.`}
              {estado === 'ios-instalar' && 'En iPhone los avisos llegan solo con VeloClub en tu pantalla de inicio. Agrégalo así y vuelve aquí para activarlos.'}
              {estado === 'bloqueadas' && 'Los avisos están bloqueados en este navegador. Permítelos desde la configuración del sitio y vuelve a esta pantalla.'}
              {estado === 'no-soportado' && 'Este navegador no permite notificaciones. Abre VeloClub en Chrome, Edge, Firefox o Safari.'}
            </p>

            {estado === 'ios-instalar' && (
              <ol className="mt-3 flex flex-col gap-2">
                {[
                  <>Toca <svg viewBox="0 0 24 24" className="inline w-4 h-4 -mt-0.5 fill-[#381DA0]" aria-hidden="true"><path d={COMPARTIR} /></svg> Compartir, abajo en Safari</>,
                  <>Elige «Agregar a inicio»</>,
                  <>Abre VeloClub desde el ícono nuevo</>,
                ].map((paso, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-[13px] text-foreground">
                    <span className="w-[22px] h-[22px] rounded-full bg-[#381DA0] text-white text-xs font-semibold grid place-items-center shrink-0">{i + 1}</span>
                    <span>{paso}</span>
                  </li>
                ))}
              </ol>
            )}

            {error && <p className="text-[12.5px] text-[#DC2626] mt-2">{error}</p>}
          </div>
        </div>
        {boton}
      </div>
    </section>
  );
}
