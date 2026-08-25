import { describe, it, expect } from 'vitest';
import { calcularPrecioPlan, TRIMESTRE_CAMPANA } from '../lib/pricing';

// El trimestre vale 180.000 para todo club que se registre mientras dura la
// campana: ni tramos ni descuentos. Lo que manda es la fecha en que el club se
// registro, no la del cobro — un club que entra el 30 de octubre paga a fines
// de diciembre y le toca el mismo precio que se le ofrecio al entrar.
//
// El riesgo real es que el precio plano se filtre a los otros planes, que se
// aplique a un club que se registro despues, o que un descuento se le monte
// encima. Estas pruebas fijan el contrato sin depender del dia en que se
// ejecuten.

/** Un club que se registro durante la campana. */
const REGISTRADO_EN_CAMPANA = new Date('2026-09-15T12:00:00-05:00');
/** Uno que se registro despues, ya con la tarifa normal. */
const REGISTRADO_DESPUES    = new Date('2026-11-02T12:00:00-05:00');

describe('calcularPrecioPlan — trimestre de campana', () => {
  it('cobra 180.000 sin importar cuantos deportistas tenga el club', () => {
    for (const deportistas of [0, 1, 15, 40, 41, 80, 124, 500]) {
      expect(calcularPrecioPlan(deportistas, 'TRIMESTRAL', false, REGISTRADO_EN_CAMPANA)).toBe(TRIMESTRE_CAMPANA);
    }
  });

  it('no le aplica el descuento de renovacion automatica', () => {
    expect(calcularPrecioPlan(120, 'TRIMESTRAL', true, REGISTRADO_EN_CAMPANA)).toBe(TRIMESTRE_CAMPANA);
  });

  it('lo alcanza el club que se registra el ultimo dia, el 31 por la noche', () => {
    expect(calcularPrecioPlan(30, 'TRIMESTRAL', false, new Date('2026-10-31T23:59:00-05:00')))
      .toBe(TRIMESTRE_CAMPANA);
  });

  it('le sigue tocando aunque pague meses despues, ya fuera de campana', () => {
    // Se registra el 30 de octubre: sus dos meses gratis lo llevan a pagar a
    // fines de diciembre. El precio es el que se le ofrecio al entrar.
    const seRegistro = new Date('2026-10-30T12:00:00-05:00');
    expect(calcularPrecioPlan(15, 'TRIMESTRAL', false, seRegistro)).toBe(TRIMESTRE_CAMPANA);
  });

  it('no alcanza al club que se registra apenas entra noviembre', () => {
    // 15 deportistas es el tramo de 50.000: 50.000 x 3 con 10% de descuento.
    expect(calcularPrecioPlan(15, 'TRIMESTRAL', false, REGISTRADO_DESPUES)).toBe(135_000);
    // Mas de 80 es el tramo de 60.000, y con renovacion automatica va 15%.
    expect(calcularPrecioPlan(124, 'TRIMESTRAL', true, REGISTRADO_DESPUES)).toBe(153_000);
  });
});

describe('calcularPrecioPlan — el mensual y el anual no entran a la campana', () => {
  it('el mensual cobra su tramo, tambien durante la campana', () => {
    expect(calcularPrecioPlan(15, 'MENSUAL', false, REGISTRADO_EN_CAMPANA)).toBe(50_000);
    expect(calcularPrecioPlan(60, 'MENSUAL', false, REGISTRADO_EN_CAMPANA)).toBe(55_000);
    expect(calcularPrecioPlan(124, 'MENSUAL', false, REGISTRADO_EN_CAMPANA)).toBe(60_000);
  });

  it('el anual mantiene su 20% de descuento durante la campana', () => {
    // 60.000 x 12 = 720.000, menos 20% = 576.000
    expect(calcularPrecioPlan(124, 'ANUAL', false, REGISTRADO_EN_CAMPANA)).toBe(576_000);
  });

  it('el anual con renovacion automatica llega al 25%', () => {
    expect(calcularPrecioPlan(124, 'ANUAL', true, REGISTRADO_EN_CAMPANA)).toBe(540_000);
  });
});
