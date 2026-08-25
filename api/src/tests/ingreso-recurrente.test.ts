import { describe, it, expect } from 'vitest';
import { aporteMensual } from '../lib/finanzas-plataforma';

// Cuanto aporta al mes cada club. Se calcula con lo que pago de verdad la
// ultima vez, no con `planMonto`: ese campo guarda la tarifa de un mes en unos
// clubes y el total del periodo en otros, y dividirlo por los meses del plan
// contaba 20.000 donde eran 60.000.
//
// Los dos riesgos que fijan estas pruebas: que un ciclo pagado en dos
// movimientos se cuente solo por el ultimo, y que un club que dejo de pagar
// siga sumando.

const HOY = new Date('2026-08-25T12:00:00Z');
const hace = (dias: number) => new Date(HOY.getTime() - dias * 86_400_000);

describe('aporteMensual', () => {
  it('reparte el trimestre entre sus tres meses', () => {
    expect(aporteMensual([{ monto: 180_000, createdAt: hace(10) }], 'TRIMESTRAL', HOY)).toBe(60_000);
  });

  it('suma los pagos del mismo dia: el cobro con tarjeta y el saldo por Bre-B', () => {
    const pagos = [
      { monto: 153_000, createdAt: new Date('2026-08-15T10:00:00Z') },
      { monto: 27_000, createdAt: new Date('2026-08-15T18:00:00Z') },
    ];
    expect(aporteMensual(pagos, 'TRIMESTRAL', HOY)).toBe(60_000);
  });

  it('no arrastra el ciclo anterior, solo el ultimo', () => {
    const pagos = [
      { monto: 50_000, createdAt: hace(70) },
      { monto: 55_000, createdAt: hace(5) },
    ];
    expect(aporteMensual(pagos, 'MENSUAL', HOY)).toBe(55_000);
  });

  it('no depende del orden en que lleguen los pagos', () => {
    const pagos = [
      { monto: 55_000, createdAt: hace(5) },
      { monto: 50_000, createdAt: hace(70) },
    ];
    expect(aporteMensual(pagos, 'MENSUAL', HOY)).toBe(55_000);
  });

  it('deja de contar al club cuyo periodo ya se vencio', () => {
    // Un mensual pagado hace 40 dias: su mes ya paso.
    expect(aporteMensual([{ monto: 50_000, createdAt: hace(40) }], 'MENSUAL', HOY)).toBe(0);
    // Un trimestre pagado hace 100 dias tambien.
    expect(aporteMensual([{ monto: 180_000, createdAt: hace(100) }], 'TRIMESTRAL', HOY)).toBe(0);
  });

  it('mantiene al anual durante todo su año', () => {
    expect(aporteMensual([{ monto: 540_000, createdAt: hace(300) }], 'ANUAL', HOY)).toBe(45_000);
    expect(aporteMensual([{ monto: 540_000, createdAt: hace(370) }], 'ANUAL', HOY)).toBe(0);
  });

  it('un club sin pagos no aporta nada', () => {
    expect(aporteMensual([], 'TRIMESTRAL', HOY)).toBe(0);
  });
});
