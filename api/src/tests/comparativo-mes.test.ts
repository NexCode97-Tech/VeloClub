import { describe, it, expect } from 'vitest';
import { cortesComparativo, variacion } from '../lib/comparativo';

// Las tarjetas de Finanzas comparan el mes con el anterior al mismo día. Los
// meses no miden lo mismo, así que el criterio de corte queda fijado por
// pruebas: el día del mes anterior nunca pasa de su último día, y el último día
// de un mes se compara contra el mes anterior completo.

/** Un instante en hora de Colombia, que es la hora con la que opera el club. */
function bogota(y: number, m: number, d: number, h = 10): Date {
  return new Date(Date.UTC(y, m - 1, d, h + 5));
}

/** Fecha de fin del día en Colombia, escrita como la leería una persona. */
function dia(fecha: Date): string {
  const local = new Date(fecha.getTime() - 5 * 3600 * 1000);
  return local.toISOString().slice(0, 10);
}

describe('cortesComparativo', () => {
  it('mes en curso: corta los dos meses en el día de hoy', () => {
    const c = cortesComparativo(2026, 9, bogota(2026, 9, 17))!;
    expect(dia(c.actual)).toBe('2026-09-17');
    expect(dia(c.anterior)).toBe('2026-08-17');
    expect(c.etiqueta).toBe('17 ago');
    expect(c.mesCerrado).toBe(false);
  });

  it('el corte cubre el día entero, no solo hasta la hora actual', () => {
    const c = cortesComparativo(2026, 9, bogota(2026, 9, 17, 8))!;
    // 23:59:59.999 del 17 en Colombia = 04:59:59.999 del 18 en UTC
    expect(c.actual.toISOString()).toBe('2026-09-18T04:59:59.999Z');
  });

  it('si el mes anterior es más corto, corta en su último día', () => {
    const c = cortesComparativo(2026, 3, bogota(2026, 3, 30))!;
    expect(dia(c.anterior)).toBe('2026-02-28');
    expect(c.etiqueta).toBe('28 feb');
  });

  it('respeta los años bisiestos', () => {
    const c = cortesComparativo(2028, 3, bogota(2028, 3, 30))!;
    expect(dia(c.anterior)).toBe('2028-02-29');
  });

  it('el último día del mes se compara contra el mes anterior completo', () => {
    // 30 de septiembre es fin de mes; agosto tiene 31 días.
    const c = cortesComparativo(2026, 9, bogota(2026, 9, 30))!;
    expect(dia(c.actual)).toBe('2026-09-30');
    expect(dia(c.anterior)).toBe('2026-08-31');
    expect(c.etiqueta).toBe('agosto');
  });

  it('el 31 de mayo se compara contra abril completo', () => {
    const c = cortesComparativo(2026, 5, bogota(2026, 5, 31))!;
    expect(dia(c.anterior)).toBe('2026-04-30');
    expect(c.etiqueta).toBe('abril');
  });

  it('enero se compara contra diciembre del año anterior', () => {
    const c = cortesComparativo(2027, 1, bogota(2027, 1, 12))!;
    expect(dia(c.anterior)).toBe('2026-12-12');
    expect(c.etiqueta).toBe('12 dic');
  });

  it('un mes pasado se compara completo contra el anterior completo', () => {
    const c = cortesComparativo(2026, 8, bogota(2026, 9, 17))!;
    expect(dia(c.actual)).toBe('2026-08-31');
    expect(dia(c.anterior)).toBe('2026-07-31');
    expect(c.etiqueta).toBe('julio');
    expect(c.mesCerrado).toBe(true);
  });

  it('un mes que no ha empezado no tiene comparación', () => {
    expect(cortesComparativo(2026, 10, bogota(2026, 9, 17))).toBeNull();
  });

  it('usa la hora de Colombia: el 1 a las 9 p. m. todavía es el 1', () => {
    // 21:00 del 1 de octubre en Colombia ya es 2 de octubre en UTC.
    const c = cortesComparativo(2026, 10, bogota(2026, 10, 1, 21))!;
    expect(dia(c.actual)).toBe('2026-10-01');
    expect(dia(c.anterior)).toBe('2026-09-01');
  });
});

describe('variacion', () => {
  it('calcula el cambio porcentual redondeado', () => {
    expect(variacion(24, 20)).toBe(20);
    expect(variacion(12, 16)).toBe(-25);
    expect(variacion(2, 3)).toBe(-33);
  });

  it('sin cambio es cero', () => {
    expect(variacion(10, 10)).toBe(0);
    expect(variacion(0, 0)).toBe(0);
  });

  it('sin base para comparar devuelve null, no infinito', () => {
    // El mes anterior no tenía ninguno: no hay porcentaje que decir.
    expect(variacion(5, 0)).toBeNull();
  });
});
