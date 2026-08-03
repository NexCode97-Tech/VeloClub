import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks (deben declararse antes de cualquier import que los use) ──────────────

vi.mock('../db/client', () => ({
  prisma: {
    member: { findFirst: vi.fn() },
    user:   { findUnique: vi.fn() },
  },
}));

import { resolverNombreAutor, aTitleCase } from '../lib/nombre-autor';
import { prisma } from '../db/client';

const mockMember = prisma.member.findFirst as unknown as ReturnType<typeof vi.fn>;
const mockUser   = prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockMember.mockResolvedValue(null);
  mockUser.mockResolvedValue(null);
});

/**
 * Estas pruebas cubren el fallo que dejó cinco publicaciones firmadas como
 * "Usuario" en producción: el nombre de Clerk llega vacío cuando la persona se
 * registra solo con el correo, y el `??` de antes no atrapaba la cadena vacía.
 */
describe('resolverNombreAutor', () => {
  it('usa el nombre de Clerk cuando viene completo', async () => {
    const nombre = await resolverNombreAutor('user_1', 'Diana Estevez');
    expect(nombre).toBe('Diana Estevez');
    expect(mockMember).not.toHaveBeenCalled();
  });

  it('cae al nombre del deportista cuando Clerk lo manda vacío', async () => {
    mockMember.mockResolvedValue({ fullName: 'Diana Estevez Arenas' });
    const nombre = await resolverNombreAutor('user_1', '');
    expect(nombre).toBe('Diana Estevez Arenas');
  });

  it('trata los espacios en blanco como vacío', async () => {
    mockMember.mockResolvedValue({ fullName: 'Devis Guzmán Fuentes' });
    expect(await resolverNombreAutor('user_1', '   ')).toBe('Devis Guzmán Fuentes');
  });

  it('ignora los marcadores de relleno que llegaran guardados', async () => {
    mockMember.mockResolvedValue({ fullName: 'Alexander Castellar' });
    expect(await resolverNombreAutor('user_1', 'Usuario')).toBe('Alexander Castellar');
    expect(await resolverNombreAutor('user_1', 'Autor')).toBe('Alexander Castellar');
  });

  it('cae a la cuenta cuando el deportista no tiene nombre', async () => {
    mockMember.mockResolvedValue({ fullName: '' });
    mockUser.mockResolvedValue({ name: 'francisco carreño' });
    expect(await resolverNombreAutor('user_1', '')).toBe('Francisco Carreño');
  });

  it('nunca devuelve una cadena vacía ni "Usuario"', async () => {
    const nombre = await resolverNombreAutor('user_1', '');
    expect(nombre.trim().length).toBeGreaterThan(0);
    expect(nombre).not.toBe('Usuario');
  });

  it('no consulta la base cuando no hay clerkId', async () => {
    const nombre = await resolverNombreAutor(null, '');
    expect(nombre.trim().length).toBeGreaterThan(0);
    expect(mockMember).not.toHaveBeenCalled();
  });
});

describe('aTitleCase', () => {
  it('corrige nombres en minúscula y en mayúscula sostenida', () => {
    expect(aTitleCase('francisco carreño')).toBe('Francisco Carreño');
    expect(aTitleCase('DIANA ESTEVEZ ARENAS')).toBe('Diana Estevez Arenas');
  });

  it('colapsa los espacios sobrantes', () => {
    expect(aTitleCase('  juan   pablo  ')).toBe('Juan Pablo');
  });
});
