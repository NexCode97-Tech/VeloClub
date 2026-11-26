/**
 * Notificaciones push: los avisos que llegan al computador, la tablet o el
 * celular aunque VeloClub esté cerrado.
 *
 * Es una salida más de las notificaciones que ya existen, no un sistema
 * aparte. `notify` y `notifyClubStaff` (lib/notify.ts) guardan el aviso en la
 * campana y, si el tipo está en la lista de abajo, también lo mandan aquí. Así
 * ninguna ruta tiene que acordarse de llamar a dos sitios.
 *
 * Solo salen los tipos aprobados. No todo lo de la campana merece interrumpir
 * a alguien en su celular: lo que vale es lo que pide hacer algo (pagar, revisar
 * un comprobante, recibir a un inscrito) o lo que avisa de algo que se viene.
 *
 * En iPhone y iPad el aviso solo llega con VeloClub agregado a la pantalla de
 * inicio (regla de Apple desde iOS 16.4). El permiso lo pide la pantalla
 * (components/notificaciones-dispositivo.tsx), nunca el servidor.
 *
 * Las claves VAPID viven en Railway (VAPID_PUBLICA y VAPID_PRIVADA). Sin ellas
 * no sale nada y no se rompe nada: la campana sigue igual.
 */
import webpush from 'web-push';
import * as Sentry from '@sentry/node';
import { prismaClubEntero } from '../db/client';

/** Avisos personales que también salen al dispositivo de quien los recibe. */
export const PUSH_PERSONAL = new Set(['PAYMENT_DUE', 'PAGO_POR_VENCER', 'PAGO_VENCIDO_DEPORTISTA']);
/** Avisos al staff del club que también salen al dispositivo. */
export const PUSH_STAFF = new Set(['RECEIPT_UPLOADED', 'INSCRIPCION_RECIBIDA']);

export interface AvisoPush {
  titulo: string;
  cuerpo: string;
  /** La pantalla que abre al tocarlo, dentro de la app ("/finanzas"). */
  link?: string;
  /** Agrupa avisos del mismo asunto: uno nuevo reemplaza al anterior. */
  etiqueta?: string;
}

/**
 * Los servicios de push de los navegadores. El servidor le hace una petición a
 * la dirección que mande el navegador, así que no se acepta cualquiera: una
 * dirección inventada convertiría al servidor en un mensajero hacia donde el
 * que la mandó quisiera.
 */
const SERVICIOS_PUSH = [
  /^fcm\.googleapis\.com$/,                 // Chrome, Edge en Android, Opera
  /^[a-z0-9.-]+\.notify\.windows\.com$/,    // Edge en Windows
  /^updates\.push\.services\.mozilla\.com$/, // Firefox
  /^web\.push\.apple\.com$/,                // Safari en iPhone, iPad y Mac
  /^[a-z0-9.-]+\.push\.apple\.com$/,
];

export function endpointValido(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  return SERVICIOS_PUSH.some(re => re.test(url.hostname));
}

let configurado: boolean | null = null;

/** La clave pública que la pantalla necesita para suscribirse. */
export function clavePublica(): string | null {
  return process.env.VAPID_PUBLICA?.trim() || null;
}

function configurar(): boolean {
  if (configurado !== null) return configurado;
  const publica = clavePublica();
  const privada = process.env.VAPID_PRIVADA?.trim();
  if (!publica || !privada) {
    console.warn('[push] Sin VAPID_PUBLICA o VAPID_PRIVADA: no se mandan notificaciones push.');
    configurado = false;
    return false;
  }
  webpush.setVapidDetails('https://www.veloclubtech.com', publica, privada);
  configurado = true;
  return true;
}

/**
 * Manda el aviso a todos los dispositivos de esas personas. Nunca lanza: un
 * aviso que no sale no puede tumbar la operación que lo generó.
 */
export async function enviarPush(clerkIds: string[], aviso: AvisoPush): Promise<number> {
  const destino = [...new Set(clerkIds.filter(Boolean))];
  if (destino.length === 0 || !configurar()) return 0;

  try {
    const dispositivos = await prismaClubEntero.pushDispositivo.findMany({
      where: { clerkId: { in: destino } },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });
    const carga = JSON.stringify({
      titulo: aviso.titulo,
      cuerpo: aviso.cuerpo,
      link: aviso.link ?? '/inicio',
      etiqueta: aviso.etiqueta,
    });

    let enviados = 0;
    const muertos: string[] = [];
    await Promise.all(dispositivos.map(async d => {
      try {
        await webpush.sendNotification(
          { endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } },
          carga,
          // Un recordatorio de clase que llega al día siguiente ya no sirve.
          { TTL: 6 * 60 * 60, urgency: 'normal' },
        );
        enviados++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // El navegador borró la suscripción o la persona quitó el permiso.
        if (status === 404 || status === 410) muertos.push(d.id);
        else Sentry.captureException(err, { tags: { tarea: 'push' }, extra: { status } });
      }
    }));

    if (muertos.length) await prismaClubEntero.pushDispositivo.deleteMany({ where: { id: { in: muertos } } });
    if (enviados) {
      await prismaClubEntero.pushDispositivo.updateMany({
        where: { id: { in: dispositivos.filter(d => !muertos.includes(d.id)).map(d => d.id) } },
        data: { usadoAt: new Date() },
      });
    }
    return enviados;
  } catch (err) {
    Sentry.captureException(err, { tags: { tarea: 'push' } });
    return 0;
  }
}
