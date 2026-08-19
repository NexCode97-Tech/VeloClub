import crypto from 'crypto';

/**
 * Pago por transferencia Bre-B con verificación humana.
 *
 * Bre-B mueve la plata de cuenta a cuenta en segundos y sin comisión, pero la
 * llave receptora es una cuenta común: no emite webhooks y nadie puede avisarle
 * al sistema que el dinero entró. Por eso este medio NO se acredita solo — el
 * club sube el comprobante, el pago queda PENDING y un superadministrador lo
 * aprueba después de verlo en su cuenta.
 *
 * Existe porque PSE se cae: los cinco intentos de un club terminaron en
 * `bank_error` del banco y hubo que recibirle la plata por fuera de la
 * plataforma. Esto le da a ese caso un camino dentro del producto.
 */

/** La llave nunca va en el código: es un dato personal y puede cambiar. */
export function datosBreb(): { llave: string; titular: string } | null {
  const llave = process.env.BREB_LLAVE?.trim();
  const titular = process.env.BREB_TITULAR?.trim();
  if (!llave || !titular) return null;
  return { llave, titular };
}

export function brebDisponible(): boolean {
  return datosBreb() !== null;
}

/**
 * Referencia que el club escribe en la nota de la transferencia.
 *
 * Se deriva del clubId en vez de sortearse por pago: así es estable y el club
 * la ve ANTES de transferir. Sirve para lo único que importa al conciliar —
 * saber de quién es el dinero que llegó — y no cambia si reintenta.
 */
export function referenciaDe(clubId: string): string {
  const hash = crypto.createHash('sha256').update(clubId).digest('hex');
  return `VC-${parseInt(hash.slice(0, 8), 16).toString(36).toUpperCase().slice(0, 4).padStart(4, '0')}`;
}

/** Marca en el concepto para reconocer estos pagos sin migrar el esquema. */
export const MARCA_BREB = 'Bre-B';

export function conceptoBreb(clubId: string): string {
  return `${MARCA_BREB} · ${referenciaDe(clubId)}`;
}

export function esPagoBreb(concepto: string): boolean {
  return concepto.startsWith(MARCA_BREB);
}
