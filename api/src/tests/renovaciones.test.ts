import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * La renovación que dispara VeloClub. Lo que se sostiene: no se cobra antes de
 * tiempo, no se cobra dos veces el mismo período, se cobra el precio del día y
 * no corre nada mientras el proveedor siga siendo Mercado Pago.
 */

const db = vi.hoisted(() => ({ buscar: vi.fn(), actualizar: vi.fn() }));
const ext = vi.hoisted(() => ({ cobrar: vi.fn(), contar: vi.fn(), fallo: vi.fn() }));

vi.mock('../db/client', () => ({ prisma: { clubSuscripcion: { findMany: db.buscar, update: db.actualizar } } }));
vi.mock('@sentry/node', () => ({ captureException: vi.fn() }));
vi.mock('../lib/whop', () => ({ cobrarRenovacion: ext.cobrar }));
vi.mock('../lib/deportistas', () => ({ contarDeportistasFacturables: ext.contar }));
vi.mock('../lib/whop-eventos', () => ({ pagoFallido: ext.fallo }));

import { tocaCobrar, llaveRenovacion, cobrarRenovacionesVencidas } from '../lib/renovaciones';

const ahora = new Date('2027-02-06T10:00:00Z');
const base = {
  id: 's1', clubId: 'c1', tipoPlan: 'TRIMESTRAL', intentosFallidos: 0,
  autoRenew: true, canceladaAt: null, whopMemberId: 'mber_1', whopPaymentMethodId: 'payt_1',
  proximoCobroAt: new Date('2027-02-06T00:00:00Z'),
};

beforeEach(() => {
  Object.values(db).forEach(f => f.mockReset());
  Object.values(ext).forEach(f => f.mockReset());
  process.env.PAGOS_PROVEEDOR = 'whop';
});

describe('cuándo toca cobrar', () => {
  it('cobra cuando llegó la fecha y hay medio guardado', () => {
    expect(tocaCobrar(base, ahora)).toBe(true);
  });
  it('no cobra antes de la fecha', () => {
    expect(tocaCobrar({ ...base, proximoCobroAt: new Date('2027-02-07T00:00:00Z') }, ahora)).toBe(false);
  });
  it('no cobra si canceló, si apagó la renovación o si no hay medio', () => {
    expect(tocaCobrar({ ...base, canceladaAt: new Date() }, ahora)).toBe(false);
    expect(tocaCobrar({ ...base, autoRenew: false }, ahora)).toBe(false);
    expect(tocaCobrar({ ...base, whopPaymentMethodId: null }, ahora)).toBe(false);
  });
  it('la llave es la misma para el mismo período e intento, y cambia en el reintento', () => {
    const fecha = new Date('2027-02-06T00:00:00Z');
    expect(llaveRenovacion('s1', fecha, 0)).toBe('renov-s1-2027-02-06-0');
    expect(llaveRenovacion('s1', fecha, 1)).not.toBe(llaveRenovacion('s1', fecha, 0));
  });
});

describe('el temporizador', () => {
  it('cobra el precio del tramo de ese día, con el 5 % de la renovación', async () => {
    db.buscar.mockResolvedValue([base]);
    ext.contar.mockResolvedValue(38);
    ext.cobrar.mockResolvedValue({ id: 'pay_r', status: 'pending' });
    const r = await cobrarRenovacionesVencidas(ahora);
    expect(r).toEqual({ cobradas: 1, fallidas: 0 });
    expect(ext.cobrar.mock.calls[0][0]).toMatchObject({
      memberId: 'mber_1', paymentMethodId: 'payt_1', monto: 127500, idempotencia: 'renov-s1-2027-02-06-0',
      metadata: { suscripcionId: 's1', tipo: 'renovacion' },
    });
    // La fecha se corre antes de cobrar, para que el siguiente turno no repita.
    expect(db.actualizar.mock.invocationCallOrder[0]).toBeLessThan(ext.cobrar.mock.invocationCallOrder[0]);
  });

  it('si Whop lo rechaza en el acto, cuenta el intento', async () => {
    db.buscar.mockResolvedValue([base]);
    ext.contar.mockResolvedValue(38);
    ext.cobrar.mockResolvedValue({ id: 'pay_r', status: 'failed', metadata: { suscripcionId: 's1', tipo: 'renovacion' } });
    const r = await cobrarRenovacionesVencidas(ahora);
    expect(r.fallidas).toBe(1);
    expect(ext.fallo).toHaveBeenCalled();
  });

  it('con Mercado Pago como proveedor no hace nada', async () => {
    process.env.PAGOS_PROVEEDOR = 'mercadopago';
    const r = await cobrarRenovacionesVencidas(ahora);
    expect(r).toEqual({ cobradas: 0, fallidas: 0 });
    expect(db.buscar).not.toHaveBeenCalled();
  });
});
