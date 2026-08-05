import { describe, it, expect } from 'vitest';
import { resumirAsistencia } from '../lib/asistencia';

// Este porcentaje es el que el club le muestra a un padre o le entrega a una
// liga, asi que el criterio queda fijado por pruebas y no por costumbre.

const P = 'PRESENT', T = 'LATE', A = 'ABSENT', E = 'MEDICAL_EXCUSE';

describe('resumirAsistencia', () => {
  it('cuenta la tardanza como asistencia', () => {
    // Entreno los 4 dias, en 2 llego tarde
    expect(resumirAsistencia([P, T, P, T]).porcentaje).toBe(100);
  });

  it('la excusa medica sale de la base en vez de contar como falta', () => {
    // 3 dias entrenados, 1 excusado: 3 de 3, no 3 de 4
    expect(resumirAsistencia([P, P, P, E]).porcentaje).toBe(100);
  });

  it('la ausencia si baja el porcentaje', () => {
    expect(resumirAsistencia([P, P, P, A]).porcentaje).toBe(75);
  });

  it('devuelve null, no 0, cuando todos los dias fueron excusados', () => {
    // Un lesionado todo el mes. Un 0% diria lo contrario de lo que paso.
    const r = resumirAsistencia([E, E, E]);
    expect(r.porcentaje).toBeNull();
    expect(r.excusas).toBe(3);
  });

  it('devuelve null cuando no hay ningun registro', () => {
    expect(resumirAsistencia([]).porcentaje).toBeNull();
  });

  it('redondea a entero', () => {
    // 2 de 3 = 66,66%
    expect(resumirAsistencia([P, P, A]).porcentaje).toBe(67);
  });

  it('cuenta cada estado por separado', () => {
    const r = resumirAsistencia([P, P, T, A, E]);
    expect(r).toMatchObject({ presentes: 2, tardanzas: 1, ausencias: 1, excusas: 1 });
    // (2 presentes + 1 tardanza) de 4 dias con base = 75%
    expect(r.porcentaje).toBe(75);
  });

  it('un deportista que nunca fue queda en 0, no en null', () => {
    expect(resumirAsistencia([A, A, A]).porcentaje).toBe(0);
  });
});
