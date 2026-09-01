import { describe, it, expect, vi, beforeEach } from 'vitest';

// De dónde sale la lista de deportistas de una clase.
//
// El grupo dejó de ser una pantalla: se deduce del nombre y la sede. Lo que se
// prueba acá es el renombre, que es donde se pierden datos en silencio. Si al
// corregirle una letra al nombre a una clase se le creara un grupo nuevo, la
// clase amanecería con la planilla vacía y nadie sabría por qué.

vi.mock('../db/client', () => ({
  prisma: {
    grupo:        { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    claseHorario: { count: vi.fn() },
  },
  prismaClubEntero: {},
}));

const { prisma } = await import('../db/client');
const { grupoParaClase } = await import('../lib/grupo-de-clase');

const buscar   = prisma.grupo.findFirst      as unknown as ReturnType<typeof vi.fn>;
const renombrar = prisma.grupo.update        as unknown as ReturnType<typeof vi.fn>;
const crear    = prisma.grupo.create         as unknown as ReturnType<typeof vi.fn>;
const contar   = prisma.claseHorario.count   as unknown as ReturnType<typeof vi.fn>;

const BASE = {
  clubId: 'club-1',
  deporteId: 'dep-1',
  locationId: 'sede-1',
  nombre: 'Clase de la mañana',
};

beforeEach(() => {
  vi.clearAllMocks();
  buscar.mockResolvedValue(null);
  crear.mockResolvedValue({ id: 'grupo-nuevo' });
  contar.mockResolvedValue(0);
});

describe('una clase que se crea', () => {
  it('sin ninguna que se llame igual, estrena grupo', async () => {
    expect(await grupoParaClase(BASE)).toBe('grupo-nuevo');
    expect(crear).toHaveBeenCalledOnce();
  });

  it('con el mismo nombre y la misma sede que otra, comparte su lista', async () => {
    buscar.mockResolvedValue({ id: 'grupo-manana' });
    expect(await grupoParaClase(BASE)).toBe('grupo-manana');
    expect(crear).not.toHaveBeenCalled();
  });
});

describe('una clase que se renombra', () => {
  it('si es la única con ese grupo, se lo lleva y no pierde a nadie', async () => {
    // Nadie más se llama así, y ninguna otra clase usa el grupo viejo.
    const r = await grupoParaClase({
      ...BASE, nombre: 'Clase de la mañanita',
      claseId: 'clase-1', grupoActualId: 'grupo-manana',
    });
    expect(r).toBe('grupo-manana');
    expect(renombrar).toHaveBeenCalledOnce();
    expect(crear).not.toHaveBeenCalled();
  });

  it('si otra clase comparte el grupo, se separa en uno nuevo', async () => {
    // Renombrar acá no puede arrastrar a la otra: son dos clases distintas
    // desde el momento en que dejaron de llamarse igual.
    contar.mockResolvedValue(1);
    const r = await grupoParaClase({
      ...BASE, nombre: 'Clase de la mañanita',
      claseId: 'clase-1', grupoActualId: 'grupo-manana',
    });
    expect(r).toBe('grupo-nuevo');
    expect(renombrar).not.toHaveBeenCalled();
  });

  it('si el nombre nuevo ya lo tiene otra clase, se une a esa', async () => {
    buscar.mockResolvedValue({ id: 'grupo-tarde' });
    const r = await grupoParaClase({
      ...BASE, nombre: 'Clase de la tarde',
      claseId: 'clase-1', grupoActualId: 'grupo-manana',
    });
    expect(r).toBe('grupo-tarde');
    // Renombrar el grupo viejo lo dejaria con el nombre de otro que ya existe,
    // y la sede tiene ese nombre unico.
    expect(renombrar).not.toHaveBeenCalled();
    expect(crear).not.toHaveBeenCalled();
  });
});

describe('una clase que se guarda sin cambiarle el nombre', () => {
  it('se queda en su grupo, sin escribir nada', async () => {
    buscar.mockResolvedValue({ id: 'grupo-manana' });
    const r = await grupoParaClase({
      ...BASE, claseId: 'clase-1', grupoActualId: 'grupo-manana',
    });
    expect(r).toBe('grupo-manana');
    expect(renombrar).not.toHaveBeenCalled();
    expect(crear).not.toHaveBeenCalled();
  });
});
