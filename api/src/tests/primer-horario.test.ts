import { describe, it, expect, vi, beforeEach } from 'vitest';

// Quien ve el modal de «arma tu horario» y quien no.
//
// Lo que se prueba aca no es que aparezca, es que NO aparezca de mas: es una
// interrupcion a dieciocho clubes que hoy trabajan bien sin esto, y el modo de
// fallar caro es mostrarselo a quien no puede hacer nada con el o a quien ya
// dijo que no.

vi.mock('../db/client', () => ({
  prisma: {
    location: { count: vi.fn() },
    grupo:    { count: vi.fn() },
  },
  prismaClubEntero: {},
}));

const { prisma } = await import('../db/client');
const { estadoPrimerHorario } = await import('../lib/primer-horario');

const sedes  = prisma.location.count as unknown as ReturnType<typeof vi.fn>;
const grupos = prisma.grupo.count    as unknown as ReturnType<typeof vi.fn>;

const BASE = {
  clubId: 'club-1',
  deporteId: 'dep-1',
  rol: 'ADMIN',
  aplazadoAt: null as Date | null,
  aplazos: 0,
};

const HACE = (dias: number) => new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

beforeEach(() => {
  vi.clearAllMocks();
  sedes.mockResolvedValue(3);
  grupos.mockResolvedValue(0);
});

describe('el caso para el que existe', () => {
  it('administrador, con sedes y sin grupos: se muestra', async () => {
    expect(await estadoPrimerHorario(BASE)).toEqual({ mostrar: true, pendiente: true });
  });
});

describe('a quien no le sirve, no se le muestra', () => {
  it('a un entrenador nunca, aunque el club lo necesite', async () => {
    expect(await estadoPrimerHorario({ ...BASE, rol: 'ENTRENADOR' }))
      .toEqual({ mostrar: false, pendiente: false });
  });

  it('a un deportista tampoco', async () => {
    expect(await estadoPrimerHorario({ ...BASE, rol: 'DEPORTISTA' }))
      .toEqual({ mostrar: false, pendiente: false });
  });

  it('sin club, nada', async () => {
    expect(await estadoPrimerHorario({ ...BASE, clubId: null }))
      .toEqual({ mostrar: false, pendiente: false });
  });

  it('sin sedes no se muestra NI queda pendiente: lo que falta es la sede', async () => {
    sedes.mockResolvedValue(0);
    expect(await estadoPrimerHorario(BASE))
      .toEqual({ mostrar: false, pendiente: false });
  });
});

describe('con el primer grupo se acaba', () => {
  it('deja de aparecer y deja de estar pendiente', async () => {
    grupos.mockResolvedValue(1);
    expect(await estadoPrimerHorario(BASE))
      .toEqual({ mostrar: false, pendiente: false });
  });

  it('y no lo revive un aplazamiento viejo', async () => {
    grupos.mockResolvedValue(2);
    expect(await estadoPrimerHorario({ ...BASE, aplazadoAt: HACE(30), aplazos: 1 }))
      .toEqual({ mostrar: false, pendiente: false });
  });
});

describe('el freno de quien lo aplaza', () => {
  it('recien aplazado no se le repite', async () => {
    expect(await estadoPrimerHorario({ ...BASE, aplazadoAt: new Date(), aplazos: 1 }))
      .toEqual({ mostrar: false, pendiente: true });
  });

  it('al segundo dia todavia no', async () => {
    expect(await estadoPrimerHorario({ ...BASE, aplazadoAt: HACE(2), aplazos: 1 }))
      .toEqual({ mostrar: false, pendiente: true });
  });

  it('pasados los tres dias vuelve', async () => {
    expect(await estadoPrimerHorario({ ...BASE, aplazadoAt: HACE(4), aplazos: 1 }))
      .toEqual({ mostrar: true, pendiente: true });
  });

  it('a la tercera vez deja de insistir, por vieja que sea la fecha', async () => {
    expect(await estadoPrimerHorario({ ...BASE, aplazadoAt: HACE(90), aplazos: 3 }))
      .toEqual({ mostrar: false, pendiente: true });
  });
});

describe('la tarea es del club, no de la persona', () => {
  it('otro administrador que nunca lo aplazo si lo ve', async () => {
    // El primero lo aplazo hoy; este entra con su propio contador en cero.
    expect(await estadoPrimerHorario({ ...BASE, aplazadoAt: null, aplazos: 0 }))
      .toEqual({ mostrar: true, pendiente: true });
  });
});

describe('el aislamiento por deporte', () => {
  it('cuenta sedes y grupos de la carpeta activa, no del club entero', async () => {
    await estadoPrimerHorario(BASE);
    expect(sedes).toHaveBeenCalledWith({ where: { clubId: 'club-1', deporteId: 'dep-1' } });
    expect(grupos).toHaveBeenCalledWith({ where: { clubId: 'club-1', deporteId: 'dep-1' } });
  });
});
