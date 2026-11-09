import { describe, it, expect, afterEach } from 'vitest';
import { pasarelaDe } from '../lib/pasarela';

describe('pasarela de cada club', () => {
  afterEach(() => { delete process.env.PAGOS_PROVEEDOR; delete process.env.PAGOS_WHOP_CLUBES; });

  it('por defecto sigue Mercado Pago', () => {
    expect(pasarelaDe('c1')).toBe('mercadopago');
  });
  it('un club de la lista de prueba paga con Whop y los demás no', () => {
    process.env.PAGOS_WHOP_CLUBES = 'c1, c2';
    expect(pasarelaDe('c2')).toBe('whop');
    expect(pasarelaDe('c3')).toBe('mercadopago');
  });
  it('con el interruptor general todos pagan con Whop', () => {
    process.env.PAGOS_PROVEEDOR = 'whop';
    expect(pasarelaDe('cualquiera')).toBe('whop');
  });
});
