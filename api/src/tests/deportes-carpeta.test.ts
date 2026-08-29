import { describe, it, expect, vi, beforeEach } from 'vitest';

// Quien queda parado en que carpeta. Es la pieza con consecuencias de permisos
// de todo el modelo de varios deportes: de lo que devuelva esta funcion sale el
// filtro que despues aplica el cliente de Prisma a todo lo demas.
//
// Lo que se prueba aca no es que funcione, es que NO abra de mas: que a quien no
// es administrador, pedir la carpeta de otro nunca se la conceda, y que aun asi
// nadie quede trancado por fuera de su propio club.

vi.mock('../db/client', () => ({
  prisma: { deporte: { findMany: vi.fn() } },
  prismaClubEntero: { deporte: { findMany: vi.fn() } },
}));

vi.mock('../lib/redis', () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
  cacheDel: vi.fn().mockResolvedValue(undefined),
}));

const { prisma } = await import('../db/client');
const { resolverCarpeta } = await import('../lib/deportes');

const findMany = prisma.deporte.findMany as unknown as ReturnType<typeof vi.fn>;

const PATINAJE = { id: 'dep-patinaje', nombre: 'Patinaje', activo: true };
const NATACION = { id: 'dep-natacion', nombre: 'Natacion', activo: true };
const CERRADO  = { id: 'dep-cerrado',  nombre: 'Tenis',    activo: false };

const CLUB = { clubId: 'club-1', userId: 'user-1' };

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue([PATINAJE, NATACION, CERRADO]);
});

describe('el administrador que además es dueño', () => {
  const dueño = { ...CLUB, rol: 'ADMIN', deporteIdDelUsuario: null, ownerUserId: 'user-1' };

  it('sin pedir nada entra por la más antigua, que es donde está todo', async () => {
    expect(await resolverCarpeta(dueño))
      .toEqual({ ok: true, deporteId: PATINAJE.id, esDueno: true, puedeCambiar: true });
  });

  it('cambia a la que pida, si es de su club y está activa', async () => {
    expect(await resolverCarpeta({ ...dueño, pedida: NATACION.id }))
      .toEqual({ ok: true, deporteId: NATACION.id, esDueno: true, puedeCambiar: true });
  });

  it('pedir una desactivada no la abre: cae en la de siempre', async () => {
    expect(await resolverCarpeta({ ...dueño, pedida: CERRADO.id }))
      .toEqual({ ok: true, deporteId: PATINAJE.id, esDueno: true, puedeCambiar: true });
  });

  it('pedir la carpeta de otro club no la abre', async () => {
    expect(await resolverCarpeta({ ...dueño, pedida: 'dep-de-otro-club' }))
      .toEqual({ ok: true, deporteId: PATINAJE.id, esDueno: true, puedeCambiar: true });
  });
});

// El caso que motivó abrirlo: un club con cuatro administradores, de los cuales
// solo uno era el dueño. Los otros tres no tenían forma ni de enterarse de que
// el club podía tener más de un deporte.
describe('un administrador que no es el dueño', () => {
  const admin = { ...CLUB, rol: 'ADMIN', deporteIdDelUsuario: NATACION.id, ownerUserId: 'otro-user' };

  it('también cambia de deporte', async () => {
    expect(await resolverCarpeta({ ...admin, pedida: PATINAJE.id }))
      .toEqual({ ok: true, deporteId: PATINAJE.id, esDueno: false, puedeCambiar: true });
  });

  it('sin pedir nada entra por la suya, que es donde trabaja', async () => {
    expect(await resolverCarpeta(admin))
      .toEqual({ ok: true, deporteId: NATACION.id, esDueno: false, puedeCambiar: true });
  });

  it('sigue sin ser dueño, que es otra cosa', async () => {
    const r = await resolverCarpeta(admin);
    expect(r.ok && r.esDueno).toBe(false);
  });
});

describe('entrenadores y deportistas', () => {
  const entrenador = { ...CLUB, rol: 'ENTRENADOR', deporteIdDelUsuario: NATACION.id, ownerUserId: 'otro-user' };

  it('entran a la suya', async () => {
    expect(await resolverCarpeta(entrenador))
      .toEqual({ ok: true, deporteId: NATACION.id, esDueno: false, puedeCambiar: false });
  });

  it('pedir otra no se la concede: se quedan en la suya', async () => {
    expect(await resolverCarpeta({ ...entrenador, pedida: PATINAJE.id }))
      .toEqual({ ok: true, deporteId: NATACION.id, esDueno: false, puedeCambiar: false });
  });

  it('tampoco cambian si el club no tiene dueño declarado', async () => {
    expect(await resolverCarpeta({ ...entrenador, ownerUserId: null }))
      .toEqual({ ok: true, deporteId: NATACION.id, esDueno: false, puedeCambiar: false });
  });
});

describe('cuentas sin carpeta asignada', () => {
  const huerfano = { ...CLUB, rol: 'ENTRENADOR', deporteIdDelUsuario: null, ownerUserId: null };

  it('con un solo deporte entra a ese: no hay nada que aislar', async () => {
    findMany.mockResolvedValue([PATINAJE]);
    expect(await resolverCarpeta(huerfano))
      .toEqual({ ok: true, deporteId: PATINAJE.id, esDueno: false, puedeCambiar: false });
  });

  it('con varios se detiene y lo explica, en vez de adivinar', async () => {
    const r = await resolverCarpeta(huerfano);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('no esta asignada a ningun deporte');
  });

  it('un club sin ningún deporte activo tampoco se resuelve a ciegas', async () => {
    findMany.mockResolvedValue([CERRADO]);
    const r = await resolverCarpeta({ ...CLUB, rol: 'ADMIN', deporteIdDelUsuario: null, ownerUserId: 'user-1' });
    expect(r.ok).toBe(false);
  });
});
