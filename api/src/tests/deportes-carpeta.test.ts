import { describe, it, expect, vi, beforeEach } from 'vitest';

// Quien queda parado en que carpeta. Es la pieza con consecuencias de permisos
// de todo el modelo de varios deportes: de lo que devuelva esta funcion sale el
// filtro que despues aplica el cliente de Prisma a todo lo demas.
//
// Lo que se prueba aca no es que funcione, es que NO abra de mas: que pedir la
// carpeta de otro nunca la conceda, y que aun asi nadie quede trancado por
// fuera de su propio club.

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

const BASE = { clubId: 'club-1', userId: 'user-1' };

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue([PATINAJE, NATACION, CERRADO]);
});

describe('el dueño del club', () => {
  const dueño = { ...BASE, deporteIdDelUsuario: null, ownerUserId: 'user-1' };

  it('sin pedir nada entra por la más antigua, que es donde está todo', async () => {
    const r = await resolverCarpeta(dueño);
    expect(r).toEqual({ ok: true, deporteId: PATINAJE.id, esDueno: true });
  });

  it('cambia a la que pida, si es de su club y está activa', async () => {
    const r = await resolverCarpeta({ ...dueño, pedida: NATACION.id });
    expect(r).toEqual({ ok: true, deporteId: NATACION.id, esDueno: true });
  });

  it('pedir una desactivada no la abre: cae en la de siempre', async () => {
    const r = await resolverCarpeta({ ...dueño, pedida: CERRADO.id });
    expect(r).toEqual({ ok: true, deporteId: PATINAJE.id, esDueno: true });
  });

  it('pedir la carpeta de otro club no la abre', async () => {
    const r = await resolverCarpeta({ ...dueño, pedida: 'dep-de-otro-club' });
    expect(r).toEqual({ ok: true, deporteId: PATINAJE.id, esDueno: true });
  });
});

describe('el resto del equipo', () => {
  const entrenador = { ...BASE, deporteIdDelUsuario: NATACION.id, ownerUserId: 'otro-user' };

  it('entra a la suya', async () => {
    const r = await resolverCarpeta(entrenador);
    expect(r).toEqual({ ok: true, deporteId: NATACION.id, esDueno: false });
  });

  it('pedir otra no se la concede: se queda en la suya', async () => {
    const r = await resolverCarpeta({ ...entrenador, pedida: PATINAJE.id });
    expect(r).toEqual({ ok: true, deporteId: NATACION.id, esDueno: false });
  });

  it('no es dueño aunque el club no tenga ninguno declarado', async () => {
    const r = await resolverCarpeta({ ...entrenador, ownerUserId: null });
    expect(r).toEqual({ ok: true, deporteId: NATACION.id, esDueno: false });
  });
});

describe('cuentas sin carpeta asignada', () => {
  const huerfano = { ...BASE, deporteIdDelUsuario: null, ownerUserId: null };

  it('con un solo deporte entra a ese: no hay nada que aislar', async () => {
    findMany.mockResolvedValue([PATINAJE]);
    const r = await resolverCarpeta(huerfano);
    expect(r).toEqual({ ok: true, deporteId: PATINAJE.id, esDueno: false });
  });

  it('con varios se detiene y lo explica, en vez de adivinar', async () => {
    const r = await resolverCarpeta(huerfano);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('no esta asignada a ningun deporte');
  });

  it('un club sin ningún deporte activo tampoco se resuelve a ciegas', async () => {
    findMany.mockResolvedValue([CERRADO]);
    const r = await resolverCarpeta({ ...BASE, deporteIdDelUsuario: null, ownerUserId: 'user-1' });
    expect(r.ok).toBe(false);
  });
});
