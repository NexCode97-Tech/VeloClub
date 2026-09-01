import { describe, it, expect } from 'vitest';
import { filtroDePlanilla } from '../lib/planilla';

// La pieza que decide quien entra a una planilla. Lo que se prueba aca no es que
// arme la lista, es que un club siga viendo exactamente lo que veia: si esta
// regla se equivoca, las listas de asistencia amanecen vacias o con gente de
// mas.

describe('una clase con categoria', () => {
  it('trae a los de esa categoria en esa sede', () => {
    expect(filtroDePlanilla({
      locationId: 'sede-1', categoria: 'Menores 3-10 años',
    })).toEqual({
      role: 'DEPORTISTA',
      active: true,
      locations: { some: { locationId: 'sede-1' } },
      category: 'Menores 3-10 años',
    });
  });
});

describe('una clase abierta a todas las categorias', () => {
  it('trae la sede entera, no una lista vacia', () => {
    expect(filtroDePlanilla({ locationId: 'sede-1', categoria: null })).toEqual({
      role: 'DEPORTISTA',
      active: true,
      locations: { some: { locationId: 'sede-1' } },
    });
  });
});

describe('sin clase ninguna', () => {
  it('sin sede tampoco, trae el club entero de esa carpeta', () => {
    expect(filtroDePlanilla({ locationId: null, categoria: null }))
      .toEqual({ role: 'DEPORTISTA', active: true });
  });
});

// El deportista en pausa es el caso que mas veces se ha colado. Queda como test
// propio y no como detalle de los de arriba, para que si alguien lo quita se
// caiga una prueba que lo dice por su nombre.
describe('el deportista en pausa', () => {
  it('nunca entra, tenga categoria la clase o no', () => {
    expect(filtroDePlanilla({ locationId: 'sede-1', categoria: 'Mayores 14+ años' }))
      .toMatchObject({ active: true });
    expect(filtroDePlanilla({ locationId: 'sede-1', categoria: null }))
      .toMatchObject({ active: true });
  });
});
