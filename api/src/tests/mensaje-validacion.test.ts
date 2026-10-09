import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { mensajeDeValidacion } from '../lib/mensaje-validacion';

/**
 * Crear un club desde el superadmin.
 *
 * Lo que se sostiene acá: cuando un dato no pasa, la pantalla dice cuál y qué
 * hacer, en vez de un error genérico. Y un correo con un espacio colgando,
 * que es lo que deja el autocompletado del celular, ya no cuenta como malo.
 */

const esquema = z.object({
  clubName:   z.string().trim().min(2).max(100),
  adminEmail: z.string().trim().toLowerCase().email(),
  adminName:  z.string().trim().min(2).max(100),
  adminPhone: z.string().trim().max(30).optional(),
});

const CAMPOS = {
  clubName:   'El nombre del club',
  adminEmail: 'El correo del admin',
  adminName:  'El nombre del admin',
  adminPhone: 'El celular del admin',
};

const valido = { clubName: 'Club Aurora', adminEmail: 'admin@club.com', adminName: 'Ana Ruiz' };

function mensaje(datos: Record<string, unknown>): string {
  const r = esquema.safeParse(datos);
  if (r.success) throw new Error('se esperaba un error');
  return mensajeDeValidacion(r.error.issues, CAMPOS);
}

describe('crear club, los datos', () => {
  it('acepta el correo con espacios y mayúsculas, y lo deja limpio', () => {
    const r = esquema.safeParse({ ...valido, adminEmail: '  Admin@Club.com ' });
    expect(r.success).toBe(true);
    expect(r.data?.adminEmail).toBe('admin@club.com');
  });

  it('recorta el nombre del club', () => {
    const r = esquema.safeParse({ ...valido, clubName: '  Club Aurora  ' });
    expect(r.data?.clubName).toBe('Club Aurora');
  });

  // Dos espacios no son un nombre: sin el recorte pasaban el mínimo de 2.
  it('un nombre hecho solo de espacios no pasa', () => {
    expect(esquema.safeParse({ ...valido, clubName: '   ' }).success).toBe(false);
  });
});

describe('crear club, el mensaje', () => {
  it('dice cuál correo está mal', () => {
    expect(mensaje({ ...valido, adminEmail: 'admin.club.com' }))
      .toBe('El correo del admin no es un correo válido. Revísalo.');
  });

  it('dice qué tan corto es lo corto', () => {
    expect(mensaje({ ...valido, clubName: 'A' }))
      .toBe('El nombre del club es muy corto. Debe tener al menos 2 caracteres.');
  });

  it('dice qué tan largo es lo largo', () => {
    expect(mensaje({ ...valido, adminPhone: '3'.repeat(31) }))
      .toBe('El celular del admin es muy largo. Debe tener máximo 30 caracteres.');
  });

  it('dice qué falta', () => {
    expect(mensaje({ clubName: 'Club Aurora', adminEmail: 'admin@club.com' }))
      .toBe('Falta el nombre del admin.');
  });

  it('siempre es texto, nunca la lista de zod', () => {
    expect(typeof mensaje({})).toBe('string');
  });

  it('sin problemas en la lista, igual responde algo útil', () => {
    expect(mensajeDeValidacion([], CAMPOS)).toBe('Revisa los datos del formulario.');
  });
});
