import { describe, it, expect } from 'vitest';
import { filtroDePlanilla } from '../lib/planilla';

// La pieza que decide quien entra a una planilla. Lo que se prueba aca no es que
// arme la lista, es que un club que todavia no armo grupos siga viendo
// exactamente lo que veia: si esta regla se equivoca, las listas de asistencia
// de los clubes que ya operan amanecen vacias o con gente de mas.

describe('una clase con grupo', () => {
  it('trae a los miembros del grupo, y la categoria deja de mandar', () => {
    expect(filtroDePlanilla({
      grupoId: 'g1', locationId: 'sede-1', categoria: 'Menores 3-10 años',
    })).toEqual({
      role: 'DEPORTISTA',
      active: true,
      grupos: { some: { grupoId: 'g1' } },
    });
  });

  it('no filtra por sede: la sede ya la define el grupo', () => {
    const f = filtroDePlanilla({ grupoId: 'g1', locationId: 'sede-1', categoria: null });
    expect(f).not.toHaveProperty('locations');
  });
});

describe('una clase sin grupo', () => {
  it('cae a la regla vieja: sede cruzada con categoria', () => {
    expect(filtroDePlanilla({
      grupoId: null, locationId: 'sede-1', categoria: 'Menores 3-10 años',
    })).toEqual({
      role: 'DEPORTISTA',
      active: true,
      locations: { some: { locationId: 'sede-1' } },
      category: 'Menores 3-10 años',
    });
  });

  it('sin categoria declarada no filtra por categoria, o la lista saldria vacia', () => {
    expect(filtroDePlanilla({
      grupoId: null, locationId: 'sede-1', categoria: null,
    })).toEqual({
      role: 'DEPORTISTA',
      active: true,
      locations: { some: { locationId: 'sede-1' } },
    });
  });
});

describe('sin clase ninguna', () => {
  it('el dia entero de una sede', () => {
    expect(filtroDePlanilla({ grupoId: null, locationId: 'sede-1', categoria: null }))
      .toMatchObject({ locations: { some: { locationId: 'sede-1' } } });
  });

  it('sin sede tampoco, trae el club entero de esa carpeta', () => {
    expect(filtroDePlanilla({ grupoId: null, locationId: null, categoria: null }))
      .toEqual({ role: 'DEPORTISTA', active: true });
  });
});

// El deportista en pausa es el caso que mas veces se ha colado. Queda como test
// propio y no como detalle de los de arriba, para que si alguien lo quita se
// caiga una prueba que lo dice por su nombre.
describe('el deportista en pausa', () => {
  it('nunca entra, tenga grupo o no', () => {
    expect(filtroDePlanilla({ grupoId: 'g1', locationId: null, categoria: null }))
      .toMatchObject({ active: true });
    expect(filtroDePlanilla({ grupoId: null, locationId: 'sede-1', categoria: null }))
      .toMatchObject({ active: true });
  });
});
