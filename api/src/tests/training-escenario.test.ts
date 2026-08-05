import { describe, it, expect } from 'vitest';
import { camposDelEscenario } from '../routes/training';

// El escenario lo manda la sesion, no el formulario. Si alguien envia campos de
// gimnasio a un entrenamiento de pista (o al reves), el resultado quedaria con
// datos mezclados que la interfaz mostraria como si fueran validos. Estas
// pruebas fijan que el servidor descarte lo que no aplica.

const completo = {
  memberId: 'm1',
  time: '2:30.5', distance: '500m', laps: 3,
  exercise: 'Sentadilla', weight: '60kg', sets: 4, reps: 12, mark: '45cm',
  observations: 'Buena sesion',
};

describe('camposDelEscenario', () => {
  it('en pista conserva tiempo, distancia y vueltas', () => {
    const r = camposDelEscenario(completo, 'PISTA');
    expect(r.time).toBe('2:30.5');
    expect(r.distance).toBe('500m');
    expect(r.laps).toBe(3);
    expect(r.observations).toBe('Buena sesion');
  });

  it('en pista descarta los campos de gimnasio', () => {
    const r = camposDelEscenario(completo, 'PISTA');
    expect(r.exercise).toBeNull();
    expect(r.weight).toBeNull();
    expect(r.sets).toBeNull();
    expect(r.reps).toBeNull();
    expect(r.mark).toBeNull();
  });

  it('en gimnasio conserva ejercicio, peso, series, repeticiones y marca', () => {
    const r = camposDelEscenario(completo, 'GIMNASIO');
    expect(r.exercise).toBe('Sentadilla');
    expect(r.weight).toBe('60kg');
    expect(r.sets).toBe(4);
    expect(r.reps).toBe(12);
    expect(r.mark).toBe('45cm');
  });

  it('en gimnasio descarta los campos de pista', () => {
    const r = camposDelEscenario(completo, 'GIMNASIO');
    expect(r.time).toBeNull();
    expect(r.distance).toBeNull();
    expect(r.laps).toBeNull();
  });

  it('convierte a null los campos que llegan vacios', () => {
    const r = camposDelEscenario({ memberId: 'm1' }, 'GIMNASIO');
    expect(r.exercise).toBeNull();
    expect(r.observations).toBeNull();
  });
});
