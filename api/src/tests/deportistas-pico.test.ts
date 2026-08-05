import { describe, it, expect, vi, beforeEach } from 'vitest';

// El tope del ciclo es lo que impide que un club desactive a todos la vispera
// del cobro, pague el tramo mas barato y los reactive al dia siguiente. Es la
// unica pieza del modulo con incentivo economico para romperla, asi que se
// prueba el comportamiento completo: sube al crecer, no baja dentro del ciclo,
// y se reinicia al pagar.

vi.mock('../db/client', () => ({
  prisma: {
    member: { count: vi.fn() },
    clubSuscripcion: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  },
}));

const { prisma } = await import('../db/client');
const { contarDeportistasFacturables, contarDeportistasActivos, reiniciarPicoDeportistas } =
  await import('../lib/deportistas');

const count      = prisma.member.count as unknown as ReturnType<typeof vi.fn>;
const findUnique = prisma.clubSuscripcion.findUnique as unknown as ReturnType<typeof vi.fn>;
const update     = prisma.clubSuscripcion.update as unknown as ReturnType<typeof vi.fn>;
const updateMany = prisma.clubSuscripcion.updateMany as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  update.mockResolvedValue({});
  updateMany.mockResolvedValue({ count: 1 });
});

describe('contarDeportistasActivos', () => {
  it('solo cuenta deportistas activos', async () => {
    count.mockResolvedValue(35);
    await contarDeportistasActivos('club-1');
    expect(count).toHaveBeenCalledWith({
      where: { clubId: 'club-1', role: 'STUDENT', active: true },
    });
  });
});

describe('contarDeportistasFacturables — tope del ciclo', () => {
  it('desactivar en masa no baja el precio del ciclo en curso', async () => {
    // El club llego a 60 este ciclo y hoy desactivo hasta quedar en 5
    count.mockResolvedValue(5);
    findUnique.mockResolvedValue({ id: 's1', picoDeportistas: 60 });

    expect(await contarDeportistasFacturables('club-1')).toBe(60);
    expect(update).not.toHaveBeenCalled();
  });

  it('sube el tope de inmediato cuando el club crece', async () => {
    count.mockResolvedValue(75);
    findUnique.mockResolvedValue({ id: 's1', picoDeportistas: 60 });

    expect(await contarDeportistasFacturables('club-1')).toBe(75);
    expect(update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { picoDeportistas: 75 } });
  });

  it('estrena el tope cuando la suscripcion nunca lo ha tenido', async () => {
    count.mockResolvedValue(22);
    findUnique.mockResolvedValue({ id: 's1', picoDeportistas: null });

    expect(await contarDeportistasFacturables('club-1')).toBe(22);
    expect(update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { picoDeportistas: 22 } });
  });

  it('un club en prueba, sin suscripcion, cobra por sus activos', async () => {
    count.mockResolvedValue(12);
    findUnique.mockResolvedValue(null);

    expect(await contarDeportistasFacturables('club-1')).toBe(12);
    expect(update).not.toHaveBeenCalled();
  });
});

describe('reiniciarPicoDeportistas', () => {
  it('al pagar, el tope vuelve a los activos reales y ahi si baja el precio', async () => {
    count.mockResolvedValue(5);
    await reiniciarPicoDeportistas('club-1');
    expect(updateMany).toHaveBeenCalledWith({
      where: { clubId: 'club-1' },
      data: { picoDeportistas: 5 },
    });
  });
});
