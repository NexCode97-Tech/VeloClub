import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Los avisos de Whop. Lo que se sostiene: un pago entra una sola vez aunque
 * llegue dos veces, el período empieza cuando termina lo cubierto, el próximo
 * cobro queda al final de la cobertura, y una renovación fallida se reintenta
 * dos veces antes de apagarse.
 */

const db = vi.hoisted(() => ({
  suscripcion: vi.fn(),
  actualizarSuscripcion: vi.fn(),
  pago: vi.fn(),
  upsertPago: vi.fn(),
}));
const efectos = vi.hoisted(() => ({
  activar: vi.fn(),
  avisar: vi.fn(),
  comision: vi.fn(),
  reembolso: vi.fn(),
  obtener: vi.fn(),
}));

vi.mock('../db/client', () => ({
  prisma: {
    clubSuscripcion: { findUnique: db.suscripcion, update: db.actualizarSuscripcion },
    suscripcionPago: { findUnique: db.pago, upsert: db.upsertPago },
  },
}));
vi.mock('@sentry/node', () => ({ captureException: vi.fn() }));
vi.mock('../lib/sync-suscripciones', () => ({ activarClubTrasPago: efectos.activar }));
vi.mock('../lib/notify', () => ({ notifyClubStaff: efectos.avisar }));
vi.mock('../lib/finanzas-plataforma', () => ({ registrarComisionWhop: efectos.comision }));
vi.mock('../lib/reembolsos', () => ({ registrarReembolso: efectos.reembolso }));
vi.mock('../lib/auditoria', () => ({ registrarEvento: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../lib/whop', async (original) => ({
  ...(await original<typeof import('../lib/whop')>()),
  obtenerPagoWhop: efectos.obtener,
}));

import { finDeCobertura, siguienteIntento, esNuestro, pagoExitoso, pagoFallido, reembolsoODisputa } from '../lib/whop-eventos';
import type { PagoWhop } from '../lib/whop';

const pagoWhop = (extra: Partial<PagoWhop> = {}): PagoWhop => ({
  id: 'pay_1', status: 'paid', presentment_total: 127500, presentment_refunded_amount: 0,
  total: 38.2, amount_after_fees: 36.4, member_id: 'mber_1', payment_method_id: 'payt_1',
  payment_method_type: 'card', metadata: { suscripcionId: 's1', clubId: 'c1', tipo: 'pago' },
  paid_at: '2026-11-09T15:00:00Z', refunded_at: null, ...extra,
});

const suscripcionDe = (extra: Record<string, unknown> = {}) => ({
  id: 's1', clubId: 'c1', tipoPlan: 'TRIMESTRAL', autoRenew: true, intentosFallidos: 0, pagos: [],
  club: { name: 'Club Deportivo Aurora', trialEndsAt: new Date('2026-12-01T00:00:00Z') }, ...extra,
});

beforeEach(() => {
  Object.values(db).forEach(f => f.mockReset());
  Object.values(efectos).forEach(f => f.mockReset());
});

describe('reglas', () => {
  it('el próximo cobro cae al terminar la cobertura nueva', () => {
    const inicio = new Date('2026-11-08T00:00:00Z');
    expect(finDeCobertura(inicio, 'TRIMESTRAL').toISOString()).toBe('2027-02-06T00:00:00.000Z');
    expect(finDeCobertura(inicio, 'MENSUAL').toISOString()).toBe('2026-12-08T00:00:00.000Z');
  });

  it('un fallo corre el cobro tres días y al tercero apaga la renovación', () => {
    const ahora = new Date('2027-02-06T12:00:00Z');
    expect(siguienteIntento(0, ahora)).toEqual({ intentos: 1, apagar: false, proximo: new Date('2027-02-09T12:00:00Z') });
    expect(siguienteIntento(2, ahora)).toEqual({ intentos: 3, apagar: true, proximo: null });
  });

  it('solo se atienden pagos con suscripcionId en la metadata', () => {
    expect(esNuestro({ metadata: { suscripcionId: 's1' } })).toBe(true);
    expect(esNuestro({ metadata: null })).toBe(false);
  });
});

describe('pago que entró', () => {
  it('empieza cuando termina la prueba, guarda el medio y agenda el próximo cobro', async () => {
    db.suscripcion.mockResolvedValue(suscripcionDe());
    db.pago.mockResolvedValue(null);
    await pagoExitoso(pagoWhop());

    const creado = db.upsertPago.mock.calls[0][0].create;
    expect(creado).toMatchObject({ monto: 127500, estado: 'PAID', whopPaymentId: 'pay_1', medio: 'card' });
    expect(creado.fecha.toISOString()).toBe('2026-12-01T00:00:00.000Z');

    const datos = db.actualizarSuscripcion.mock.calls[0][0].data;
    expect(datos).toMatchObject({ whopMemberId: 'mber_1', whopPaymentMethodId: 'payt_1', intentosFallidos: 0 });
    expect(datos.proximoCobroAt.toISOString()).toBe('2027-03-01T00:00:00.000Z');

    expect(efectos.activar).toHaveBeenCalledWith('c1');
    expect(efectos.comision.mock.calls[0][0]).toMatchObject({ whopPaymentId: 'pay_1', monto: 6008 });
  });

  it('sin renovación no guarda el medio ni agenda cobro', async () => {
    db.suscripcion.mockResolvedValue(suscripcionDe({ autoRenew: false }));
    db.pago.mockResolvedValue(null);
    await pagoExitoso(pagoWhop());
    const datos = db.actualizarSuscripcion.mock.calls[0][0].data;
    expect(datos.whopPaymentMethodId).toBeUndefined();
    expect(datos.proximoCobroAt).toBeNull();
  });

  it('si ya estaba registrado no hace nada', async () => {
    db.suscripcion.mockResolvedValue(suscripcionDe());
    db.pago.mockResolvedValue({ estado: 'PAID' });
    await pagoExitoso(pagoWhop());
    expect(db.upsertPago).not.toHaveBeenCalled();
    expect(efectos.activar).not.toHaveBeenCalled();
  });

  it('un pago ajeno a la plataforma se ignora', async () => {
    await pagoExitoso(pagoWhop({ metadata: null }));
    expect(db.suscripcion).not.toHaveBeenCalled();
  });
});

describe('renovación que no pasó', () => {
  it('el primer fallo agenda el reintento', async () => {
    db.suscripcion.mockResolvedValue(suscripcionDe());
    await pagoFallido(pagoWhop({ status: 'failed', metadata: { suscripcionId: 's1', tipo: 'renovacion' } }));
    const datos = db.actualizarSuscripcion.mock.calls[0][0].data;
    expect(datos.intentosFallidos).toBe(1);
    expect(datos.proximoCobroAt).toBeInstanceOf(Date);
  });

  it('el tercer fallo apaga la renovación y olvida la tarjeta', async () => {
    db.suscripcion.mockResolvedValue(suscripcionDe({ intentosFallidos: 2 }));
    await pagoFallido(pagoWhop({ status: 'failed', metadata: { suscripcionId: 's1', tipo: 'renovacion' } }));
    expect(db.actualizarSuscripcion.mock.calls[0][0].data).toEqual({
      autoRenew: false, intentosFallidos: 0, proximoCobroAt: null, whopPaymentMethodId: null,
    });
  });

  it('un pago hecho por el club que falla no toca la renovación', async () => {
    await pagoFallido(pagoWhop({ status: 'failed' }));
    expect(db.suscripcion).not.toHaveBeenCalled();
  });
});

describe('reembolso', () => {
  it('anota lo devuelto en pesos, no en dólares', async () => {
    efectos.obtener.mockResolvedValue(pagoWhop({ presentment_refunded_amount: 127500, refunded_at: '2026-11-10T10:00:00Z' }));
    await reembolsoODisputa('pay_1');
    expect(efectos.reembolso.mock.calls[0][0]).toMatchObject({ whopPaymentId: 'pay_1', monto: 127500 });
  });
});
