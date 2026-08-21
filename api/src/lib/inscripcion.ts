import crypto from 'crypto';
import { prisma } from '../db/client';

/**
 * Inscripcion por enlace.
 *
 * Cada club comparte una url publica y las familias llenan sus propios datos,
 * en vez de que alguien del club arme un Excel con la informacion de cuarenta
 * personas. Lo que entra por ahi queda esperando el visto bueno del club.
 */

/** Alfabeto sin caracteres que se confunden al dictar un enlace por telefono. */
const ALFABETO = 'abcdefghjkmnpqrstuvwxyz23456789';

/**
 * Token del enlace. Aleatorio y no derivado del nombre del club: con una url
 * del estilo /inscripcion/bont-skate-santander, cualquiera encontraria el
 * formulario de cualquier club probando nombres, y se acaba el control de quien
 * recibe inscripciones.
 *
 * Diez caracteres de este alfabeto son ~49 bits: no se llega por fuerza bruta,
 * y sigue siendo corto para pegarlo en un WhatsApp.
 */
export function nuevoToken(): string {
  const bytes = crypto.randomBytes(10);
  return Array.from(bytes, b => ALFABETO[b % ALFABETO.length]).join('');
}

/** Crea el token del club si todavia no tiene. Devuelve el vigente. */
export async function asegurarToken(clubId: string): Promise<string> {
  const club = await prisma.club.findUnique({
    where: { id: clubId },
    select: { inscripcionToken: true },
  });
  if (club?.inscripcionToken) return club.inscripcionToken;

  const token = nuevoToken();
  await prisma.club.update({ where: { id: clubId }, data: { inscripcionToken: token } });
  return token;
}

/** Rota el token. El enlace anterior deja de servir en el acto. */
export async function rotarToken(clubId: string): Promise<string> {
  const token = nuevoToken();
  await prisma.club.update({ where: { id: clubId }, data: { inscripcionToken: token } });
  return token;
}

export function urlDeInscripcion(token: string): string {
  const base = process.env.WEB_ORIGIN?.replace(/\/$/, '') ?? 'https://veloclubtech.com';
  return `${base}/inscripcion/${token}`;
}

/** Años cumplidos. Se calcula con la fecha, no restando años. */
export function edad(nacimiento: Date, hoy: Date = new Date()): number {
  let años = hoy.getFullYear() - nacimiento.getFullYear();
  const mes = hoy.getMonth() - nacimiento.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) años--;
  return años;
}

export const MAYORIA_DE_EDAD = 18;

export function esMenor(nacimiento: Date | null | undefined): boolean {
  if (!nacimiento) return false;
  return edad(nacimiento) < MAYORIA_DE_EDAD;
}

/** Campos que una familia puede tocar desde el enlace. */
export const CAMPOS_ACTUALIZABLES = [
  'fullName', 'phone', 'docType', 'docNumber', 'birthDate',
  'emergencyContact', 'emergencyPhone', 'guardianRelation', 'guardianDocNumber',
  'eps', 'gender', 'rh', 'allergies', 'category', 'tipo',
] as const;

export type CampoActualizable = typeof CAMPOS_ACTUALIZABLES[number];

/** Como se llama cada campo cuando el club lee la lista de cambios. */
export const NOMBRE_CAMPO: Record<string, string> = {
  fullName: 'Nombre', phone: 'Celular', docType: 'Tipo de documento',
  docNumber: 'Documento', birthDate: 'Nacimiento',
  emergencyContact: 'Acudiente', emergencyPhone: 'Celular del acudiente',
  guardianRelation: 'Parentesco', guardianDocNumber: 'Cédula del acudiente',
  eps: 'EPS', gender: 'Género', rh: 'RH', allergies: 'Alergias',
  category: 'Categoría', tipo: 'Nivel', locationId: 'Sede',
};

/**
 * Solo lo que de verdad cambia.
 *
 * Guardar todo lo que mando la familia obligaria al club a comparar veinte
 * campos para encontrar los tres que se movieron. Y los que dejo iguales no se
 * tocan: si el club ya habia corregido algo a mano, no se pisa con un valor
 * viejo.
 */
export function soloLoQueCambia(
  actual: Record<string, unknown>,
  propuesto: Record<string, unknown>,
): Record<string, { antes: unknown; despues: unknown }> {
  const cambios: Record<string, { antes: unknown; despues: unknown }> = {};

  for (const [campo, nuevo] of Object.entries(propuesto)) {
    if (nuevo === undefined || nuevo === null || nuevo === '') continue;

    const viejo = actual[campo];
    const mismo = viejo instanceof Date && typeof nuevo === 'string'
      ? viejo.toISOString().slice(0, 10) === nuevo.slice(0, 10)
      : String(viejo ?? '') === String(nuevo);

    if (!mismo) {
      cambios[campo] = {
        antes: viejo instanceof Date ? viejo.toISOString().slice(0, 10) : (viejo ?? null),
        despues: nuevo,
      };
    }
  }
  return cambios;
}

/**
 * Que ya esta ocupado dentro del club.
 *
 * Correo y documento se revisan juntos porque son dos formas distintas de la
 * misma persona repetida, y basta con que uno choque para rechazar. La
 * comparacion del correo es sin distinguir mayusculas: el mismo buzon escrito
 * de dos maneras no son dos cuentas.
 */
export async function yaExiste(params: {
  clubId: string;
  email?: string | null;
  docNumber?: string | null;
  /** Al editar, el propio miembro no cuenta como choque consigo mismo. */
  exceptoMemberId?: string;
}): Promise<{ correo: boolean; documento: boolean }> {
  const { clubId, exceptoMemberId } = params;
  const email = params.email?.trim().toLowerCase();
  const doc = params.docNumber?.trim();

  const base = exceptoMemberId ? { id: { not: exceptoMemberId } } : {};

  const [correo, documento] = await Promise.all([
    email
      ? prisma.member.findFirst({
          where: { ...base, clubId, email: { equals: email, mode: 'insensitive' } },
          select: { id: true },
        })
      : null,
    doc
      ? prisma.member.findFirst({
          where: { ...base, clubId, docNumber: doc },
          select: { id: true },
        })
      : null,
  ]);

  return { correo: !!correo, documento: !!documento };
}

/**
 * A quien corresponde ese documento dentro del club, si los datos coinciden.
 *
 * El documento solo NO alcanza para reconocer a alguien: si bastara, quien sepa
 * una cedula podria reescribir esa ficha, y cambiarle el correo es quedarse con
 * su cuenta. Se exige tambien la fecha de nacimiento.
 */
export async function reconocerPorDocumento(params: {
  clubId: string;
  docNumber: string;
  birthDate: string;
}): Promise<
  | { estado: 'nuevo' }
  | { estado: 'reconocido'; id: string; nombre: string; tieneCuenta: boolean }
  | { estado: 'ajeno' }
> {
  const existente = await prisma.member.findFirst({
    where: { clubId: params.clubId, docNumber: params.docNumber.trim() },
    select: { id: true, fullName: true, birthDate: true, clerkId: true, email: true },
  });

  if (!existente) return { estado: 'nuevo' };

  // Sin fecha guardada no hay con que confirmar la identidad, asi que se trata
  // como ajeno: es mas seguro pedirle al club que lo resuelva.
  if (!existente.birthDate) return { estado: 'ajeno' };

  const laDelClub = existente.birthDate.toISOString().slice(0, 10);
  const laEnviada = params.birthDate.slice(0, 10);
  if (laDelClub !== laEnviada) return { estado: 'ajeno' };

  return {
    estado: 'reconocido',
    id: existente.id,
    nombre: existente.fullName,
    tieneCuenta: !!existente.clerkId || !!existente.email,
  };
}
