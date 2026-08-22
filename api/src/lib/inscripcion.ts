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

/**
 * Como se llama cada campo cuando el club lee la lista de cambios.
 *
 * Que un campo se pueda tocar desde el enlace no se decide aca sino en la ruta,
 * que es la que arma lo propuesto. Una lista aparte se desincronizaria y
 * parecería mandar sin mandar.
 */
export const NOMBRE_CAMPO: Record<string, string> = {
  fullName: 'Nombre', phone: 'Celular', docType: 'Tipo de documento',
  docNumber: 'Documento', birthDate: 'Nacimiento', email: 'Correo',
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

/** Lo que el club tiene guardado y el formulario vuelve a mostrar. */
const FICHA = {
  id: true, fullName: true, email: true, phone: true, birthDate: true,
  docType: true, docNumber: true, clerkId: true,
  emergencyContact: true, emergencyPhone: true, guardianRelation: true,
  guardianDocNumber: true, eps: true, gender: true, rh: true, allergies: true,
  category: true, tipo: true,
  locations: { select: { locationId: true } },
} as const;

export interface FichaPublica {
  fullName: string; email: string; phone: string; birthDate: string;
  docType: string; docNumber: string;
  guardianName: string; guardianRelation: string; guardianDocNumber: string;
  guardianPhone: string; eps: string; gender: string; rh: string;
  allergies: string; category: string; tipo: string; locationId: string;
}

/** Una fecha se devuelve como aaaa-mm-dd, que es lo que espera un input date. */
function soloFecha(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : '';
}

/**
 * Quien es el dueno de ese documento dentro del club.
 *
 * El documento es la identificacion de la persona y es lo unico que el club
 * seguro tiene de todos, asi que es la llave. Tres desenlaces:
 *
 * - `nuevo`: no esta, se inscribe de cero.
 * - `reconocido`: esta una sola vez, y se le devuelve su ficha para completarla.
 * - `ambiguo`: el mismo numero esta en dos o mas fichas, casi siempre por un
 *   error viejo de digitacion o por un documento de relleno tipo «123456789».
 *   No se puede saber cual de las dos es, asi que no se reconoce a nadie: sigue
 *   como inscripcion nueva y el club decide despues.
 */
export async function buscarPorDocumento(params: {
  clubId: string;
  docNumber: string;
}): Promise<
  | { estado: 'nuevo' }
  | { estado: 'reconocido'; id: string; tieneCuenta: boolean; ficha: FichaPublica }
  | { estado: 'ambiguo'; cuantos: number }
> {
  const doc = params.docNumber.trim();
  if (!doc) return { estado: 'nuevo' };

  const encontrados = await prisma.member.findMany({
    where: { clubId: params.clubId, docNumber: doc },
    select: FICHA,
    take: 5,
  });

  if (encontrados.length === 0) return { estado: 'nuevo' };
  if (encontrados.length > 1) return { estado: 'ambiguo', cuantos: encontrados.length };

  const m = encontrados[0];
  return {
    estado: 'reconocido',
    id: m.id,
    tieneCuenta: !!m.clerkId,
    ficha: {
      fullName: m.fullName ?? '',
      email: m.email ?? '',
      phone: m.phone ?? '',
      birthDate: soloFecha(m.birthDate),
      docType: m.docType ?? '',
      docNumber: m.docNumber ?? doc,
      guardianName: m.emergencyContact ?? '',
      guardianRelation: m.guardianRelation ?? '',
      guardianDocNumber: m.guardianDocNumber ?? '',
      guardianPhone: m.emergencyPhone ?? '',
      eps: m.eps ?? '',
      gender: m.gender ?? '',
      rh: m.rh ?? '',
      allergies: m.allergies ?? '',
      category: m.category ?? '',
      tipo: m.tipo ?? '',
      locationId: m.locations[0]?.locationId ?? '',
    },
  };
}

/**
 * Si el enlace esta recibiendo ahora mismo.
 *
 * El vencimiento no apaga el interruptor en la base: solo deja de responder. Asi
 * el club puede correr la fecha y el enlace vuelve a servir, con el mismo token
 * que ya repartio.
 */
export function inscripcionVigente(club: {
  active: boolean;
  inscripcionAbierta: boolean;
  inscripcionVenceAt: Date | null;
}): boolean {
  if (!club.active || !club.inscripcionAbierta) return false;
  if (club.inscripcionVenceAt && club.inscripcionVenceAt < new Date()) return false;
  return true;
}
