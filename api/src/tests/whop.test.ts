import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cobrarConToken, cobrarRenovacion, varianteDe, ErrorWhop, comisionEnPesos } from '../lib/whop';

function respuesta(cuerpo: unknown, status = 200) {
  return new Response(JSON.stringify(cuerpo), { status });
}

describe('cliente de Whop', () => {
  beforeEach(() => {
    process.env.WHOP_ENV = 'sandbox';
    process.env.WHOP_API_KEY_SANDBOX = 'k_test';
    process.env.WHOP_ACCOUNT_ID = 'biz_test';
    process.env.WHOP_PRODUCT_ID = 'prod_test';
  });
  afterEach(() => vi.unstubAllGlobals());

  it('arma el plan en línea en pesos con el monto exacto', () => {
    expect(varianteDe(127500, 'Plan Trimestral')).toEqual({
      product_id: 'prod_test', billing_type: 'one_time', currency: 'cop',
      initial_price: 127500, title: 'Plan Trimestral', visibility: 'hidden',
    });
  });

  it('cobra con el token y pide guardar el medio solo con renovación', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuesta({ id: 'pay_1', status: 'paid' }));
    vi.stubGlobal('fetch', fetchMock);
    await cobrarConToken({
      confirmationToken: 'ct_1', monto: 127500, titulo: 'Plan Trimestral', email: 'a@b.co', guardar: true,
      metadata: { suscripcionId: 's1' }, returnUrl: 'https://www.veloclubtech.com/ajustes', idempotencia: 'k1',
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://sandbox-api.whop.com/api/v1/payments');
    expect(init.headers['Idempotency-Key']).toBe('k1');
    expect(init.headers['Api-Version-Date']).toBe('2026-11-03');
    expect(init.headers.Authorization).toBe('Bearer k_test');
    const cuerpo = JSON.parse(init.body);
    expect(cuerpo.setup_future_usage).toBe('off_session');
    expect(cuerpo.variant.initial_price).toBe(127500);
    expect(cuerpo.account_id).toBe('biz_test');
  });

  it('no pide guardar el medio sin renovación', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuesta({ id: 'pay_2', status: 'paid' }));
    vi.stubGlobal('fetch', fetchMock);
    await cobrarConToken({
      confirmationToken: 'ct_2', monto: 135000, titulo: 'Plan Trimestral', email: 'a@b.co', guardar: false,
      metadata: {}, returnUrl: 'https://x', idempotencia: 'k2',
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).setup_future_usage).toBeUndefined();
  });

  it('la renovación va off_session con el medio guardado', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuesta({ id: 'pay_3', status: 'pending' }));
    vi.stubGlobal('fetch', fetchMock);
    await cobrarRenovacion({
      memberId: 'mber_1', paymentMethodId: 'payt_1', monto: 127500, titulo: 'Plan Trimestral',
      metadata: { suscripcionId: 's1' }, idempotencia: 'renov-s1-2027-02-05',
    });
    const cuerpo = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(cuerpo).toMatchObject({ member_id: 'mber_1', payment_method_id: 'payt_1', off_session: true });
  });

  it('en producción usa la API y la clave de producción', async () => {
    process.env.WHOP_ENV = 'production';
    process.env.WHOP_API_KEY = 'k_prod';
    const fetchMock = vi.fn().mockResolvedValue(respuesta({ id: 'pay_4', status: 'paid' }));
    vi.stubGlobal('fetch', fetchMock);
    await cobrarRenovacion({ memberId: 'm', paymentMethodId: 'p', monto: 1000, titulo: 't', metadata: {}, idempotencia: 'x' });
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.whop.com/api/v1/payments');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer k_prod');
  });

  it('un error de Whop se lanza con su estado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta({ error: { message: 'no' } }, 400)));
    await expect(cobrarRenovacion({ memberId: 'm', paymentMethodId: 'p', monto: 1, titulo: 't', metadata: {}, idempotencia: 'x' }))
      .rejects.toBeInstanceOf(ErrorWhop);
  });

  it('pasa la comisión de dólares a pesos con la proporción del pago', () => {
    // 127.500 COP que en dólares fueron 38,20 y Whop dejó 36,40: se quedó el 4,712 %.
    expect(comisionEnPesos({ presentment_total: 127500, total: 38.2, amount_after_fees: 36.4 })).toBe(6008);
    expect(comisionEnPesos({ presentment_total: null, total: 38.2, amount_after_fees: 36.4 })).toBe(0);
  });
});
