import { describe, it, expect } from 'vitest';
import { diasDePrueba } from '../routes/clubs';

// La promocion de 2 meses depende de una fecha, asi que el riesgo real es que
// caduque antes de tiempo o que siga regalando dias despues del 31 de octubre.
// Estas pruebas fijan ese contrato sin depender del dia en que se ejecuten.

describe('diasDePrueba — promocion de 2 meses', () => {
  it('da 60 dias a un club que se registra durante la promocion', () => {
    expect(diasDePrueba(new Date('2026-08-01T12:00:00-05:00'))).toBe(60);
  });

  it('sigue dando 60 dias el ultimo dia, el 31 de octubre por la noche', () => {
    expect(diasDePrueba(new Date('2026-10-31T23:59:00-05:00'))).toBe(60);
  });

  it('vuelve a 15 dias apenas entra noviembre', () => {
    expect(diasDePrueba(new Date('2026-11-01T00:01:00-05:00'))).toBe(15);
  });

  it('sigue en 15 dias mucho despues de la promocion', () => {
    expect(diasDePrueba(new Date('2027-03-15T12:00:00-05:00'))).toBe(15);
  });
});
