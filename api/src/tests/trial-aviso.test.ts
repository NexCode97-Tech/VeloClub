import { describe, it, expect } from 'vitest';
import { hitoQueCorresponde, textoDelAviso } from '../lib/trial';

/**
 * El aviso de fin de prueba.
 *
 * Lo que hay que sostener acá es que **el aviso no se repite y no se salta**.
 * Si se repite, la gente aprende a ignorarlo; si se salta, el club se entera
 * cuando ya no puede entrar.
 */

describe('a quien le toca aviso', () => {
  it('no avisa cuando todavia falta mucho', () => {
    expect(hitoQueCorresponde(30)).toBeNull();
    expect(hitoQueCorresponde(8)).toBeNull();
  });

  it('a siete dias arranca el primero', () => {
    expect(hitoQueCorresponde(7)).toBe(7);
  });

  // Entre hitos sigue vigente el anterior: si el de siete no alcanzo a salir
  // —el servicio estaba caido, el club se creo a mitad de camino— tiene que
  // salir igual, no perderse.
  it('entre siete y tres sigue vigente el de siete', () => {
    expect(hitoQueCorresponde(6)).toBe(7);
    expect(hitoQueCorresponde(4)).toBe(7);
  });

  it('a tres dias pasa al de tres', () => {
    expect(hitoQueCorresponde(3)).toBe(3);
    expect(hitoQueCorresponde(1)).toBe(3);
  });

  it('el dia del final, y despues, es el ultimo', () => {
    expect(hitoQueCorresponde(0)).toBe(0);
    expect(hitoQueCorresponde(-5)).toBe(0);
    expect(hitoQueCorresponde(-90)).toBe(0);
  });
});

describe('que dice el aviso', () => {
  it('cuenta los dias que faltan', () => {
    expect(textoDelAviso(7, 7).titulo).toContain('7 días');
    expect(textoDelAviso(3, 3).titulo).toContain('3 días');
  });

  it('el dia del final no habla de dias', () => {
    const { titulo } = textoDelAviso(0, 0);
    expect(titulo).toContain('hoy');
    expect(titulo).not.toContain('días');
  });

  // Al que ya se le vencio hay que decirle que sus datos siguen ahi. Es lo
  // primero que uno teme cuando se le acaba una prueba.
  it('al vencido le dice que no perdio nada', () => {
    const { titulo, cuerpo } = textoDelAviso(0, -3);
    expect(titulo).toContain('acabó');
    expect(cuerpo).toContain('siguen acá');
  });

  it('siempre manda a Ajustes, que es donde se activa', () => {
    for (const [hito, faltan] of [[7, 7], [3, 3], [0, 0], [0, -1]] as const) {
      expect(textoDelAviso(hito, faltan).cuerpo).toContain('Ajustes');
    }
  });
});

/**
 * La regla de no repetir, que vive en `avisarTrialesPorVencer`: se salta al
 * club cuyo `trialUltimoAviso` ya sea menor o igual al hito que toca.
 */
describe('no repetir', () => {
  const yaSeMando = (ultimo: number | null, hito: number) =>
    ultimo !== null && ultimo <= hito;

  it('no vuelve a mandar el mismo', () => {
    expect(yaSeMando(7, 7)).toBe(true);
  });

  it('no retrocede a uno mas lejano', () => {
    expect(yaSeMando(3, 7)).toBe(true);
  });

  it('si deja pasar al siguiente, que esta mas cerca del final', () => {
    expect(yaSeMando(7, 3)).toBe(false);
    expect(yaSeMando(3, 0)).toBe(false);
  });

  it('al que nunca recibio nada, le manda', () => {
    expect(yaSeMando(null, 7)).toBe(false);
    expect(yaSeMando(null, 0)).toBe(false);
  });
});
