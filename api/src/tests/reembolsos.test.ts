import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Un reembolso queda como salida en las finanzas y el pago deja de cubrir.
 *
 * Lo que se sostiene: entra una sola vez aunque llegue por tres lados, un
 * reembolso parcial no tumba el pago, y si falla anotarlo no se cae nada.
 */

const db = vi.hoisted(() => ({
  pago: vi.fn(),
  actualizar: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock('../db/client', () => ({
  prisma: {
    suscripcionPago: { findUnique: db.pago, update: db.actualizar },
    gastoPlataforma: { upsert: db.upsert },
  },
}));
vi.mock('@sentry/node', () => ({ captureException: vi.fn() }));

import { registrarReembolso } from '../lib/reembolsos';

const pagoDe = (estado: string, monto = 153000) => ({
  id: 'p1', estado, monto, suscripcion: { club: { name: 'LANDI Piedecuesta' } },
});

describe('registrar un reembolso', () => {
  beforeEach(() => { db.pago.mockReset(); db.actualizar.mockReset(); db.upsert.mockReset(); });

  it('el reembolso total marca el pago y anota la salida', async () => {
    db.pago.mockResolvedValue(pagoDe('PAID'));
    expect(await registrarReembolso({ mpPaymentId: '187709474000', monto: 153000 })).toBe(true);
    expect(db.actualizar).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { estado: 'REFUNDED' } });
    const arg = db.upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ origen: 'reembolso:187709474000' });
    expect(arg.create).toMatchObject({ monto: 153000, categoria: 'REEMBOLSOS', descripcion: 'Reembolso a LANDI Piedecuesta' });
  });

  // Llega por la cancelación, por el aviso de Mercado Pago y por el barrido:
  // el origen único hace que la salida sea siempre la misma fila.
  it('si ya estaba reembolsado no lo vuelve a marcar, y la salida es la misma', async () => {
    db.pago.mockResolvedValue(pagoDe('REFUNDED'));
    await registrarReembolso({ mpPaymentId: '187709474000', monto: 153000 });
    expect(db.actualizar).not.toHaveBeenCalled();
    expect(db.upsert.mock.calls[0][0].update).toEqual({ monto: 153000 });
  });

  it('un reembolso parcial anota lo devuelto y deja el pago cubriendo', async () => {
    db.pago.mockResolvedValue(pagoDe('PAID'));
    await registrarReembolso({ mpPaymentId: '1', monto: 50000 });
    expect(db.actualizar).not.toHaveBeenCalled();
    expect(db.upsert.mock.calls[0][0].create.monto).toBe(50000);
  });

  it('un pago que no es de la plataforma no se toca', async () => {
    db.pago.mockResolvedValue(null);
    expect(await registrarReembolso({ mpPaymentId: 'otro', monto: 1000 })).toBe(false);
    expect(db.upsert).not.toHaveBeenCalled();
  });

  it('sin monto no hay nada que anotar', async () => {
    expect(await registrarReembolso({ mpPaymentId: '1', monto: 0 })).toBe(false);
    expect(db.pago).not.toHaveBeenCalled();
  });

  it('si falla la base, no lanza', async () => {
    db.pago.mockRejectedValue(new Error('caida'));
    await expect(registrarReembolso({ mpPaymentId: '1', monto: 1000 })).resolves.toBe(false);
  });
});
