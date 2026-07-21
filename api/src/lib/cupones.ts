// Validación y cálculo de descuento de cupones para el checkout de suscripción.
// La validación vive aquí para que la usen tanto el endpoint de previsualización
// (/mercadopago/validar-cupon) como el de cobro (/mercadopago/pagar) — el precio
// final SIEMPRE se recalcula en el servidor, nunca se confía en el frontend.

import { prisma } from '../db/client';

export interface CuponValido {
  id: string;
  codigo: string;
  porcentaje: number;
}

export type ValidacionCupon =
  | { ok: true; cupon: CuponValido }
  | { ok: false; error: string };

export function normalizarCodigo(codigo: string): string {
  return String(codigo ?? '').trim().toUpperCase();
}

/** Valida un cupón para un club concreto: existencia, estado, expiración, usos y
 *  que ese club no lo haya usado antes (un uso por club). */
export async function validarCupon(codigoRaw: string, clubId: string): Promise<ValidacionCupon> {
  const codigo = normalizarCodigo(codigoRaw);
  if (!codigo) return { ok: false, error: 'Ingresa un código de cupón' };

  const cupon = await prisma.cupon.findUnique({
    where: { codigo },
    include: { canjes: { where: { clubId }, select: { id: true } } },
  });

  if (!cupon || !cupon.activo) return { ok: false, error: 'El cupón no existe o no está activo' };
  if (cupon.expiraEn && cupon.expiraEn.getTime() < Date.now()) return { ok: false, error: 'El cupón ya expiró' };
  if (cupon.maxUsos != null && cupon.usosActuales >= cupon.maxUsos) return { ok: false, error: 'El cupón alcanzó su límite de usos' };
  if (cupon.canjes.length > 0) return { ok: false, error: 'Ya usaste este cupón' };

  return { ok: true, cupon: { id: cupon.id, codigo: cupon.codigo, porcentaje: cupon.porcentaje } };
}

/** Descuento en pesos (redondeado) que aplica un cupón sobre un monto. */
export function descuentoCupon(monto: number, porcentaje: number): number {
  return Math.round(monto * (porcentaje / 100));
}

/** Registra el canje de un cupón por un club e incrementa sus usos, de forma
 *  atómica. Idempotente por el índice único (cuponId, clubId): si el club ya lo
 *  había canjeado, no vuelve a contar ni lanza error. */
export async function registrarCanje(cuponId: string, clubId: string, montoDescontado: number): Promise<void> {
  try {
    await prisma.$transaction([
      prisma.cuponCanje.create({ data: { cuponId, clubId, montoDescontado } }),
      prisma.cupon.update({ where: { id: cuponId }, data: { usosActuales: { increment: 1 } } }),
    ]);
  } catch (err) {
    // P2002 = ya existe el canje (cuponId, clubId) → no duplicar; cualquier otro
    // error se propaga.
    if (typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002') return;
    throw err;
  }
}
