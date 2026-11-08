import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { Webhook } from 'standardwebhooks';

/**
 * El aviso de Whop solo se atiende con la firma correcta, y la firma se
 * verifica sobre el cuerpo crudo.
 */

const manejadores = vi.hoisted(() => ({
  exito: vi.fn(),
  fallo: vi.fn(),
  accion: vi.fn(),
  reembolso: vi.fn(),
}));
vi.mock('../lib/whop-eventos', () => ({
  pagoExitoso: manejadores.exito,
  pagoFallido: manejadores.fallo,
  pagoPideAccion: manejadores.accion,
  reembolsoODisputa: manejadores.reembolso,
}));
vi.mock('@sentry/node', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

import whopWebhook from '../routes/whop-webhook';

const SECRETO = 'ws_prueba0123456789abcdef0123456789abcdef0123456789abcdef01234567';

// Igual que el helper de Whop: la clave HMAC es el secreto tal cual, en base64.
function firmar(cuerpo: string) {
  const wh = new Webhook(Buffer.from(SECRETO, 'utf8').toString('base64'));
  const id = 'msg_1';
  const fecha = new Date();
  return {
    'webhook-id': id,
    'webhook-timestamp': String(Math.floor(fecha.getTime() / 1000)),
    'webhook-signature': wh.sign(id, fecha, cuerpo),
    'content-type': 'application/json',
  };
}

function app() {
  const a = express();
  a.use('/whop/webhook', whopWebhook);
  return a;
}

const espera = () => new Promise(r => setTimeout(r, 20));

describe('webhook de Whop', () => {
  beforeEach(() => {
    process.env.WHOP_WEBHOOK_SECRET = SECRETO;
    Object.values(manejadores).forEach(f => f.mockReset());
  });

  it('con firma válida atiende el pago exitoso', async () => {
    const cuerpo = JSON.stringify({ type: 'payment.succeeded', data: { id: 'pay_1', metadata: { suscripcionId: 's1' } } });
    const r = await request(app()).post('/whop/webhook').set(firmar(cuerpo)).send(cuerpo);
    expect(r.status).toBe(200);
    await espera();
    expect(manejadores.exito).toHaveBeenCalledWith(expect.objectContaining({ id: 'pay_1' }));
  });

  it('con el cuerpo alterado responde 400 y no toca nada', async () => {
    const cuerpo = JSON.stringify({ type: 'payment.succeeded', data: { id: 'pay_1' } });
    const r = await request(app()).post('/whop/webhook').set(firmar(cuerpo)).send(cuerpo.replace('pay_1', 'pay_2'));
    expect(r.status).toBe(400);
    expect(manejadores.exito).not.toHaveBeenCalled();
  });

  it('sin secreto configurado no acepta nada', async () => {
    delete process.env.WHOP_WEBHOOK_SECRET;
    const cuerpo = JSON.stringify({ type: 'payment.succeeded', data: { id: 'pay_1' } });
    const r = await request(app()).post('/whop/webhook').set(firmar(cuerpo)).send(cuerpo);
    expect(r.status).toBe(400);
  });

  it('el reembolso solo se atiende cuando ya salió', async () => {
    const pendiente = JSON.stringify({ type: 'refund.created', data: { status: 'pending', payment_id: 'pay_1' } });
    await request(app()).post('/whop/webhook').set(firmar(pendiente)).send(pendiente);
    const hecho = JSON.stringify({ type: 'refund.updated', data: { status: 'succeeded', payment_id: 'pay_1' } });
    await request(app()).post('/whop/webhook').set(firmar(hecho)).send(hecho);
    await espera();
    expect(manejadores.reembolso).toHaveBeenCalledTimes(1);
    expect(manejadores.reembolso).toHaveBeenCalledWith('pay_1');
  });

  it('la disputa toma el id del pago anidado', async () => {
    const cuerpo = JSON.stringify({ type: 'dispute.created', data: { id: 'dsp_1', payment: { id: 'pay_7' } } });
    await request(app()).post('/whop/webhook').set(firmar(cuerpo)).send(cuerpo);
    await espera();
    expect(manejadores.reembolso).toHaveBeenCalledWith('pay_7', true);
  });
});
