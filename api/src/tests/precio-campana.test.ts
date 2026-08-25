import { describe, it, expect } from 'vitest';
import { calcularPrecioPlan, TRIMESTRE_CAMPANA } from '../lib/pricing';

// Mientras dura la campana el trimestre vale 180.000 para todos: ni tramos ni
// descuentos. El riesgo real es que el precio plano se filtre a los otros
// planes, que se quede pegado despues del 31 de octubre, o que un descuento se
// le monte encima. Estas pruebas fijan el contrato sin depender del dia en que
// se ejecuten.

const EN_CAMPANA = new Date('2026-09-15T12:00:00-05:00');
const DESPUES    = new Date('2026-11-02T12:00:00-05:00');

describe('calcularPrecioPlan — trimestre de campana', () => {
  it('cobra 180.000 sin importar cuantos deportistas tenga el club', () => {
    for (const deportistas of [0, 1, 15, 40, 41, 80, 124, 500]) {
      expect(calcularPrecioPlan(deportistas, 'TRIMESTRAL', false, EN_CAMPANA)).toBe(TRIMESTRE_CAMPANA);
    }
  });

  it('no le aplica el descuento de renovacion automatica', () => {
    expect(calcularPrecioPlan(120, 'TRIMESTRAL', true, EN_CAMPANA)).toBe(TRIMESTRE_CAMPANA);
  });

  it('sigue en 180.000 el ultimo dia, el 31 de octubre por la noche', () => {
    expect(calcularPrecioPlan(30, 'TRIMESTRAL', false, new Date('2026-10-31T23:59:00-05:00')))
      .toBe(TRIMESTRE_CAMPANA);
  });

  it('vuelve a la tarifa por tramos apenas entra noviembre', () => {
    // 15 deportistas es el tramo de 50.000: 50.000 x 3 con 10% de descuento.
    expect(calcularPrecioPlan(15, 'TRIMESTRAL', false, DESPUES)).toBe(135_000);
    // Mas de 80 es el tramo de 60.000, y con renovacion automatica va 15%.
    expect(calcularPrecioPlan(124, 'TRIMESTRAL', true, DESPUES)).toBe(153_000);
  });
});

describe('calcularPrecioPlan — el mensual y el anual no entran a la campana', () => {
  it('el mensual cobra su tramo, tambien durante la campana', () => {
    expect(calcularPrecioPlan(15, 'MENSUAL', false, EN_CAMPANA)).toBe(50_000);
    expect(calcularPrecioPlan(60, 'MENSUAL', false, EN_CAMPANA)).toBe(55_000);
    expect(calcularPrecioPlan(124, 'MENSUAL', false, EN_CAMPANA)).toBe(60_000);
  });

  it('el anual mantiene su 20% de descuento durante la campana', () => {
    // 60.000 x 12 = 720.000, menos 20% = 576.000
    expect(calcularPrecioPlan(124, 'ANUAL', false, EN_CAMPANA)).toBe(576_000);
  });

  it('el anual con renovacion automatica llega al 25%', () => {
    expect(calcularPrecioPlan(124, 'ANUAL', true, EN_CAMPANA)).toBe(540_000);
  });
});
