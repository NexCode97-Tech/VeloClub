import { describe, it, expect } from 'vitest';
import { inicioDelPeriodo } from '../lib/pricing';

/**
 * Desde cuándo corre un período pagado que entra ahora.
 *
 * Lo que se sostiene: un pago nunca empieza a contar mientras el club todavía
 * tiene tiempo cubierto. Ni la prueba se desperdicia ni el período pagado se
 * cruza con el siguiente.
 *
 * Los casos salen de LANDI y Correcaminos (5 nov 2026): activaron la renovación
 * automática en plena prueba, Mercado Pago cobró ese día y otra vez a los tres
 * meses, con dos meses todavía cubiertos.
 */

const d = (iso: string) => new Date(iso);
const pagado = (iso: string) => ({ estado: 'PAID', fecha: d(iso) });

describe('sin nada cubierto', () => {
  it('un club sin prueba ni pagos empieza hoy', () => {
    const hoy = d('2026-11-05T12:00:00Z');
    expect(inicioDelPeriodo([], 'TRIMESTRAL', null, hoy)).toEqual(hoy);
  });

  it('con la prueba ya vencida, también hoy', () => {
    const hoy = d('2026-11-05T12:00:00Z');
    expect(inicioDelPeriodo([], 'TRIMESTRAL', d('2026-10-01T00:00:00Z'), hoy)).toEqual(hoy);
  });

  it('con el último período ya vencido, también hoy', () => {
    const hoy = d('2026-11-05T12:00:00Z');
    expect(inicioDelPeriodo([pagado('2026-07-01T00:00:00Z')], 'TRIMESTRAL', null, hoy)).toEqual(hoy);
  });
});

describe('con tiempo cubierto', () => {
  // Activa la renovación en plena prueba: el primer cobro va al final de la prueba.
  it('en prueba, empieza cuando la prueba termina', () => {
    const finPrueba = d('2026-10-07T14:11:03Z');
    expect(inicioDelPeriodo([], 'TRIMESTRAL', finPrueba, d('2026-08-04T13:51:00Z'))).toEqual(finPrueba);
  });

  // LANDI: pagó el trimestre desde el 7 de octubre y el 4 de noviembre llegó
  // otro cobro. Ese cobro debe contar desde el 5 de enero, no desde el 4 de nov.
  it('con un trimestre pagado, empieza donde termina ese trimestre', () => {
    const r = inicioDelPeriodo(
      [pagado('2026-08-04T12:00:00Z'), pagado('2026-10-07T14:11:03Z')],
      'TRIMESTRAL', null, d('2026-11-04T14:18:42Z'),
    );
    expect(r).toEqual(d('2027-01-05T14:11:03Z'));
  });

  it('cuenta el último pago, no el primero', () => {
    const r = inicioDelPeriodo(
      [pagado('2026-10-11T00:00:00Z'), pagado('2026-07-31T00:00:00Z')],
      'TRIMESTRAL', null, d('2026-10-31T00:00:00Z'),
    );
    expect(r).toEqual(d('2027-01-09T00:00:00Z'));
  });

  it('un pago reembolsado no cuenta como cubierto', () => {
    const r = inicioDelPeriodo(
      [{ estado: 'REFUNDED', fecha: d('2026-11-04T00:00:00Z') }],
      'TRIMESTRAL', null, d('2026-11-05T00:00:00Z'),
    );
    expect(r).toEqual(d('2026-11-05T00:00:00Z'));
  });

  it('respeta la duración del plan', () => {
    const ahora = d('2026-11-05T00:00:00Z');
    expect(inicioDelPeriodo([pagado('2026-11-01T00:00:00Z')], 'MENSUAL', null, ahora)).toEqual(d('2026-12-01T00:00:00Z'));
    expect(inicioDelPeriodo([pagado('2026-11-01T00:00:00Z')], 'ANUAL', null, ahora)).toEqual(d('2027-11-01T00:00:00Z'));
  });

  it('entre la prueba y un pago, gana lo que termine más tarde', () => {
    const r = inicioDelPeriodo([pagado('2026-11-01T00:00:00Z')], 'MENSUAL', d('2026-12-20T00:00:00Z'), d('2026-11-05T00:00:00Z'));
    expect(r).toEqual(d('2026-12-20T00:00:00Z'));
  });
});
