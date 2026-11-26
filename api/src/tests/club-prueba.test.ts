import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

// La burbuja de los clubes de prueba. Lo que se prueba no es que el club de
// prueba funcione, es que NO se salga: que ningún cliente real lo vea en el
// muro, en el buscador ni en un perfil, que él no vea a los reales, y que no se
// le pueda cobrar. Y al revés, que dentro de su propio club todo siga igual.

vi.mock('../db/client', () => ({
  prisma: {},
  prismaClubEntero: {
    club:   { findUnique: vi.fn() },
    member: { findFirst: vi.fn() },
    user:   { findUnique: vi.fn() },
  },
}));

const { prismaClubEntero } = await import('../db/client');
const { cruzaLaFrontera, soloSuLado, ladoDe, ladoDelVisitante, rechazarClubDePrueba, CLUB_REAL } =
  await import('../lib/club-prueba');

const club = prismaClubEntero.club.findUnique as unknown as ReturnType<typeof vi.fn>;
const ficha = prismaClubEntero.member.findFirst as unknown as ReturnType<typeof vi.fn>;

const REAL_A  = { clubId: 'club-a', esPrueba: false };
const REAL_B  = { clubId: 'club-b', esPrueba: false };
const PRUEBA  = { clubId: 'club-prueba', esPrueba: true };
const PRUEBA2 = { clubId: 'club-prueba-2', esPrueba: true };

beforeEach(() => {
  vi.clearAllMocks();
  club.mockImplementation(({ where }: { where: { id: string } }) =>
    Promise.resolve({ esPrueba: where.id.startsWith('club-prueba') }));
});

describe('cruzaLaFrontera', () => {
  it('entre dos clubes reales no hay frontera', () => {
    expect(cruzaLaFrontera(REAL_A, REAL_B)).toBe(false);
  });

  it('un club real y uno de prueba no se ven, en ninguna dirección', () => {
    expect(cruzaLaFrontera(REAL_A, PRUEBA)).toBe(true);
    expect(cruzaLaFrontera(PRUEBA, REAL_A)).toBe(true);
  });

  it('dos clubes de prueba distintos tampoco se ven', () => {
    expect(cruzaLaFrontera(PRUEBA, PRUEBA2)).toBe(true);
  });

  it('dentro del mismo club de prueba todo sigue igual', () => {
    expect(cruzaLaFrontera(PRUEBA, { ...PRUEBA })).toBe(false);
  });

  it('quien no tiene club (superadmin) no ve al club de prueba por los sitios de comunidad', () => {
    expect(cruzaLaFrontera({ clubId: null, esPrueba: false }, PRUEBA)).toBe(true);
  });
});

describe('soloSuLado', () => {
  it('un visitante real solo recibe clubes reales', () => {
    expect(soloSuLado(REAL_A)).toEqual({ club: CLUB_REAL });
  });

  it('un visitante de prueba solo recibe su propio club', () => {
    expect(soloSuLado(PRUEBA)).toEqual({ clubId: 'club-prueba' });
  });

  it('un visitante de prueba sin club no recibe nada, en vez de recibirlo todo', () => {
    expect(soloSuLado({ clubId: null, esPrueba: true })).toEqual({ clubId: '__sin_club__' });
  });
});

describe('de qué lado está cada quien', () => {
  it('sin club es el lado real y no consulta la base', async () => {
    expect(await ladoDe(null)).toEqual({ clubId: null, esPrueba: false });
    expect(club).not.toHaveBeenCalled();
  });

  it('el deportista, que no tiene fila en User, sale de su ficha', async () => {
    ficha.mockResolvedValue({ clubId: 'club-prueba' });
    const req = { auth: { clerkId: 'user_dep' } } as unknown as Request;
    expect(await ladoDelVisitante(req)).toEqual({ clubId: 'club-prueba', esPrueba: true });
  });

  it('el staff sale de su propio club sin buscar ficha', async () => {
    const req = { user: { id: 'u1', clubId: 'club-a', role: 'ADMIN' }, auth: { clerkId: 'user_admin' } } as unknown as Request;
    expect(await ladoDelVisitante(req)).toEqual({ clubId: 'club-a', esPrueba: false });
    expect(ficha).not.toHaveBeenCalled();
  });
});

describe('rechazarClubDePrueba', () => {
  function respuesta() {
    const res = { status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);
    return res as unknown as Response & { status: ReturnType<typeof vi.fn> };
  }

  it('a un club de prueba no se le puede cobrar', async () => {
    const res = respuesta();
    const next = vi.fn();
    const req = { user: { id: 'u1', clubId: 'club-prueba', role: 'ADMIN' } } as unknown as Request;
    await rechazarClubDePrueba(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('a un club real se le deja seguir al pago', async () => {
    const res = respuesta();
    const next = vi.fn();
    const req = { user: { id: 'u1', clubId: 'club-a', role: 'ADMIN' } } as unknown as Request;
    await rechazarClubDePrueba(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
