import { CATEGORIAS, NIVELES } from '@/lib/categorias';

/**
 * La ficha de un deportista: qué campos tiene, cuáles se exigen y cuándo
 * aparece cada sección.
 *
 * Vive aparte del formulario porque la llenan dos caminos distintos, el club
 * desde el dashboard y la familia desde el enlace público, y los dos tienen que
 * pedir exactamente lo mismo. Cuando la regla vive en un solo lado, mantenerlos
 * iguales deja de depender de que alguien se acuerde.
 */

export const DOC_TIPOS = ['CC', 'TI', 'RC', 'CE', 'PA', 'NIT', 'Otro'] as const;

/** Rama con la que compite. Las competencias de patinaje se dividen por sexo. */
export const GENEROS = ['Femenino', 'Masculino'] as const;

export const RH_TIPOS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'] as const;

export const PARENTESCOS = [
  'Padre', 'Madre', 'Abuelo', 'Abuela', 'Tío', 'Tía', 'Hermano', 'Hermana', 'Otro',
] as const;

export { CATEGORIAS, NIVELES };

export interface DatosFicha {
  fullName: string;
  email: string;
  phone: string;
  birthDate: string;
  docType: string;
  docNumber: string;
  guardianName: string;
  guardianRelation: string;
  guardianDocNumber: string;
  guardianPhone: string;
  eps: string;
  gender: string;
  rh: string;
  allergies: string;
  category: string;
  tipo: string;
  role: 'ADMIN' | 'COACH' | 'STUDENT';
  locationIds: string[];
}

export const FICHA_VACIA: DatosFicha = {
  fullName: '', email: '', phone: '', birthDate: '',
  docType: '', docNumber: '',
  guardianName: '', guardianRelation: '', guardianDocNumber: '', guardianPhone: '',
  eps: '', gender: '', rh: '', allergies: '', category: '', tipo: '',
  role: 'STUDENT', locationIds: [],
};

export const MAYORIA_DE_EDAD = 18;

/** Años cumplidos. Se calcula con la fecha, no restando años. */
export function edadDe(fechaISO: string): number | null {
  if (!fechaISO) return null;
  const nace = new Date(fechaISO);
  if (Number.isNaN(nace.getTime())) return null;
  const hoy = new Date();
  let años = hoy.getFullYear() - nace.getFullYear();
  const mes = hoy.getMonth() - nace.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < nace.getDate())) años--;
  return años;
}

/**
 * Si el bloque del acudiente es de acudiente o de contacto de emergencia.
 *
 * Sale de la edad y no del rol: hasta ahora aparecía para todo deportista,
 * tuviera 8 años o 40. Sin fecha de nacimiento no se puede saber, así que se
 * muestra la versión simple, que es lo que había antes.
 */
export function esMenorDeEdad(fechaISO: string): boolean {
  const años = edadDe(fechaISO);
  return años !== null && años < MAYORIA_DE_EDAD;
}

export type Seccion = 'identidad' | 'contacto' | 'acudiente' | 'deportiva' | 'sedes' | 'documentos';

export const TITULO_SECCION: Record<Seccion, string> = {
  identidad:  'Identidad',
  contacto:   'Contacto',
  acudiente:  'Acudiente',
  deportiva:  'Deportiva',
  sedes:      'Sedes',
  documentos: 'Documentos',
};

/**
 * Qué secciones aplican. Respeta lo que ya hacía el panel de pasos: un
 * administrador no tiene datos deportivos ni sedes, un entrenador sí tiene
 * sedes pero no categoría.
 */
export function seccionesDe(datos: DatosFicha, haySedes: boolean): Seccion[] {
  const s: Seccion[] = ['identidad', 'contacto'];
  if (datos.role === 'STUDENT') s.push('acudiente', 'deportiva');
  else if (datos.role === 'COACH') s.push('acudiente');
  if (haySedes && datos.role !== 'ADMIN') s.push('sedes');
  s.push('documentos');
  return s;
}

/** Cuántos campos de la sección están llenos, para el índice del formulario. */
export function llenosDe(seccion: Seccion, d: DatosFicha): { llenos: number; total: number } {
  const contar = (vals: string[]) => vals.filter(v => v.trim() !== '').length;

  switch (seccion) {
    case 'identidad':
      return { llenos: contar([d.fullName, d.birthDate, d.docType, d.docNumber]), total: 4 };
    case 'contacto':
      return { llenos: contar([d.email, d.phone, d.eps]), total: 3 };
    case 'acudiente':
      return esMenorDeEdad(d.birthDate)
        ? { llenos: contar([d.guardianName, d.guardianRelation, d.guardianDocNumber, d.guardianPhone]), total: 4 }
        : { llenos: contar([d.guardianName, d.guardianPhone]), total: 2 };
    case 'deportiva':
      return { llenos: contar([d.category, d.tipo]), total: 2 };
    case 'sedes':
      return { llenos: d.locationIds.length, total: Math.max(1, d.locationIds.length) };
    case 'documentos':
      return { llenos: 0, total: 2 };
  }
}

export interface ErroresFicha {
  fullName?: string;
  birthDate?: string;
  docNumber?: string;
  email?: string;
}

/**
 * Lo obligatorio para crear: nombre, nacimiento, documento y correo.
 *
 * Al editar a alguien que ya existe sin esos datos, `esNuevo` va en false: se
 * avisa pero no se bloquea. Si no, el club no podría corregirle el teléfono a
 * nadie de los que están incompletos.
 */
export function validarFicha(d: DatosFicha, esNuevo: boolean): ErroresFicha {
  const e: ErroresFicha = {};

  if (d.fullName.trim().length < 2) e.fullName = 'Escribe el nombre y los apellidos';

  if (!d.birthDate) {
    if (esNuevo) e.birthDate = 'Falta la fecha de nacimiento';
  } else if (new Date(d.birthDate) > new Date()) {
    e.birthDate = 'Esa fecha todavía no llega';
  }

  if (!d.docNumber.trim()) {
    if (esNuevo) e.docNumber = 'Falta el número de documento';
  }

  const correo = d.email.trim();
  if (!correo) {
    if (esNuevo) e.email = 'Falta el correo';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) {
    e.email = 'Ese correo no se ve bien escrito';
  }

  return e;
}

/** Los avisos que no bloquean: datos que faltan en alguien que ya existe. */
export function faltantesDe(d: DatosFicha): string[] {
  const faltan: string[] = [];
  if (!d.birthDate) faltan.push('fecha de nacimiento');
  if (!d.docNumber.trim()) faltan.push('documento');
  if (!d.email.trim()) faltan.push('correo');
  return faltan;
}
