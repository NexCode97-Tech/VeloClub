import { CATEGORIAS } from '@/lib/categorias';
import * as XLSX from 'xlsx';

interface LocationOption {
  id: string;
  name: string;
}

// Los roles se llamaban COACH y STUDENT. Se conservan como entrada valida para
// que las plantillas ya descargadas sigan sirviendo; de salida solo se generan
// los nombres nuevos.
const ROLES_VIEJOS: Record<string, string> = {
  COACH: 'ENTRENADOR',
  STUDENT: 'DEPORTISTA',
};

export function downloadMembersTemplate(
  locations: LocationOption[] = [],
) {
  const ROLES      = ['ADMIN', 'ENTRENADOR', 'DEPORTISTA'];

  const NIVELES    = ['Escuela', 'Novatos', 'Intermedio', 'Avanzados', 'Federados'];
  const SEDES      = locations.map(l => l.name);

  const DOC_TYPES = ['CC', 'TI', 'RC', 'CE', 'Pasaporte', 'NIT', 'Otro'];

  const headers = [
    'Nombre Completo *',
    'Correo electrónico',
    'Teléfono',
    'Fecha de nacimiento (YYYY-MM-DD)',
    'Tipo de documento',
    'Número de documento',
    'Contacto de emergencia',
    'Teléfono de emergencia',
    'EPS',
    'Categoría',
    'Nivel / Tipo',
    'Rol (ADMIN / ENTRENADOR / DEPORTISTA)',
    'Día de corte mensualidad (1-31)',
    'Sede',
  ];

  const example = [
    'Juan Carlos Pérez',
    'juan@ejemplo.com',
    '3001234567',
    '2005-03-15',
    'CC',
    '1023456789',
    'María Pérez',
    '3109876543',
    'Sura',
    'Menores 3-10 años',
    'Escuela',
    'DEPORTISTA',
    '15',
    SEDES[0] ?? '',
  ];

  const notes = [
    '* Campos obligatorios',
    '* El correo es opcional, pero sin él no se le puede enviar la invitación a la app',
    '* Si lo pones, debe ser único por deportista',
    '* Rol: ADMIN = Administrador, ENTRENADOR = Entrenador, DEPORTISTA = Deportista',
    '* Tipo de documento: CC, TI, RC (Registro Civil), CE, Pasaporte, NIT u Otro',
    '* Categoría y Nivel son opcionales (solo aplican a DEPORTISTA)',
    '* Día de corte: número entre 1 y 31',
    '* Sede: selecciona de la lista desplegable (opcional)',
    '',
    'SOBRE LA FECHA DE NACIMIENTO',
    '* Escríbela como prefieras: 15/03/2005, 2005-03-15, 15-03-05 o 15 de marzo de 2005.',
    '* También sirve si Excel la convierte a fecha automáticamente.',
    '* Si el día y el mes se pueden confundir (por ejemplo 05/03/2005), se toma como día/mes.',
    '* Es un dato opcional: si lo dejas vacío, el deportista se importa igual.',
  ];

  const wb = XLSX.utils.book_new();

  // ── Hoja principal ─────────────────────────────────────────────────────────
  const wsData = [headers, example];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws['!cols'] = [
    { wch: 25 }, { wch: 28 }, { wch: 14 }, { wch: 28 },
    { wch: 18 }, { wch: 20 }, { wch: 25 }, { wch: 24 },
    { wch: 14 }, { wch: 22 }, { wch: 16 }, { wch: 28 }, { wch: 30 }, { wch: 25 }, { wch: 22 },
  ];

  // ── Hoja oculta "Listas": las sedes, en la columna A ───────────────────────
  if (SEDES.length > 0) {
    const wsListas = XLSX.utils.aoa_to_sheet(SEDES.map(s => [s]));
    wsListas['!cols'] = [{ wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsListas, 'Listas');
  }

  // ── Validaciones de datos (dropdowns) ──────────────────────────────────────
  // Columnas: E=TipoDoc(4), J=Categoría(9), K=Nivel(10), L=Rol(11), N=Sede(13)
  const validations: object[] = [
    {
      sqref: 'E2:E1000',
      type: 'list',
      formula1: `"${DOC_TYPES.join(',')}"`,
      showErrorMessage: true,
      errorTitle: 'Tipo de documento inválido',
      error: 'Selecciona CC, TI, RC, CE, Pasaporte, NIT u Otro',
    },
    {
      sqref: 'L2:L1000',
      type: 'list',
      formula1: `"${ROLES.join(',')}"`,
      showErrorMessage: true,
      errorTitle: 'Rol inválido',
      error: 'Selecciona ADMIN, ENTRENADOR o DEPORTISTA de la lista',
    },
    {
      sqref: 'J2:J1000',
      type: 'list',
      formula1: `"${CATEGORIAS.join(',')}"`,
      showErrorMessage: true,
      errorTitle: 'Categoría inválida',
      error: 'Selecciona una categoría de la lista',
    },
    {
      sqref: 'K2:K1000',
      type: 'list',
      formula1: `"${NIVELES.join(',')}"`,
      showErrorMessage: true,
      errorTitle: 'Nivel inválido',
      error: 'Selecciona un nivel de la lista',
    },
  ];

  if (SEDES.length > 0) {
    validations.push({
      sqref: 'N2:N1000',
      type: 'list',
      formula1: `Listas!$A$1:$A$${SEDES.length}`,
      showErrorMessage: true,
      errorTitle: 'Sede inválida',
      error: 'Selecciona una sede de la lista',
    });
  }


  ws['!dataValidations'] = validations;

  XLSX.utils.book_append_sheet(wb, ws, 'Deportistas');

  // ── Hoja de instrucciones ──────────────────────────────────────────────────
  const wsNotes = XLSX.utils.aoa_to_sheet(notes.map(n => [n]));
  wsNotes['!cols'] = [{ wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsNotes, 'Instrucciones');

  // ── Ocultar hoja Listas ────────────────────────────────────────────────────
  if (SEDES.length > 0) {
    wb.Workbook = wb.Workbook ?? {};
    wb.Workbook.Sheets = wb.Workbook.Sheets ?? [];
    // Índices: 0=Listas, 1=Deportistas, 2=Instrucciones
    wb.Workbook.Sheets[0] = { ...wb.Workbook.Sheets[0], Hidden: 1 };
  }

  XLSX.writeFile(wb, 'plantilla_deportistas_veloclub.xlsx');
}

export interface MemberImportRow {
  fullName: string;
  email?: string;
  phone?: string;
  birthDate?: string;
  docType?: string;
  docNumber?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  eps?: string;
  category?: string;
  tipo?: string;
  role: 'ADMIN' | 'ENTRENADOR' | 'DEPORTISTA';
  paymentDueDay?: number;
  locationName?: string;
}

const MESES: Record<string, number> = {
  ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7,
  ago: 8, aug: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12, dec: 12,
};

const armar = (y: number, m: number, d: number): string | undefined => {
  if (m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  // Descarta combinaciones imposibles como el 31 de febrero
  const prueba = new Date(Date.UTC(y, m - 1, d));
  if (prueba.getUTCMonth() !== m - 1 || prueba.getUTCDate() !== d) return undefined;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

/** Un año de dos cifras se interpreta como pasado: son fechas de nacimiento. */
function anioCompleto(yy: number): number {
  if (yy >= 100) return yy;
  const corte = new Date().getFullYear() % 100;
  return yy <= corte ? 2000 + yy : 1900 + yy;
}

/**
 * Interpreta la fecha de nacimiento venga como venga desde Excel.
 *
 * El caso importante es la celda que Excel guarda como fecha de verdad: se lee
 * con `cellDates`, así llega como objeto Date y su formato de pantalla deja de
 * importar. Antes se leía el texto ya formateado, de modo que un mismo día podía
 * llegar como "15/3/05", "3/15/05" o "15-Mar-05", y todos esos se perdían.
 *
 * Para las celdas escritas como texto se aceptan los separadores habituales, los
 * años de dos cifras y los meses con nombre. Cuando el orden es ambiguo
 * (11/10/2005) se asume día/mes, que es como se escribe en Colombia.
 */
export function parseBirthDate(raw: unknown): string | undefined {
  if (raw === null || raw === undefined || raw === '') return undefined;

  // Celda de fecha real: sin ambigüedad posible
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return armar(raw.getFullYear(), raw.getMonth() + 1, raw.getDate());
  }

  // Número suelto: serial de Excel
  if (typeof raw === 'number' && isFinite(raw) && raw > 1000) {
    const d = XLSX.SSF.parse_date_code(raw);
    if (d) return armar(d.y, d.m, d.d);
  }

  let str = String(raw).trim();
  if (!str) return undefined;

  // Quita la hora si el formato la arrastró ("15/03/2005 05:00")
  str = str.replace(/[T\s]+\d{1,2}:\d{2}(:\d{2})?(\.\d+)?\s*(a\.?m\.?|p\.?m\.?|Z)?$/i, '').trim();

  // Serial de Excel escrito como texto
  if (/^\d+(\.\d+)?$/.test(str)) {
    const n = Number(str);
    if (n > 1000) {
      const d = XLSX.SSF.parse_date_code(n);
      if (d) return armar(d.y, d.m, d.d);
    }
  }

  // Año primero: 2005-03-15, 2005/03/15
  const aMd = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (aMd) return armar(+aMd[1], +aMd[2], +aMd[3]);

  // Mes con nombre: 15-Mar-05, 15 de marzo de 2005
  const conNombre = str.match(/^(\d{1,2})[\s\-/.]+(?:de\s+)?([a-záéíóúñ]{3,})[\s\-/.]+(?:de\s+)?(\d{2,4})$/i);
  if (conNombre) {
    const mes = MESES[conNombre[2].slice(0, 3).toLowerCase()];
    if (mes) return armar(anioCompleto(+conNombre[3]), mes, +conNombre[1]);
  }

  // Dos números y un año: separadores / - . o espacio
  const partes = str.match(/^(\d{1,2})[-/.\s](\d{1,2})[-/.\s](\d{2,4})$/);
  if (partes) {
    const p1 = +partes[1];
    const p2 = +partes[2];
    const anio = anioCompleto(+partes[3]);
    // Si un número pasa de 12 solo puede ser el día; si no, se asume día/mes
    if (p1 > 12 && p2 <= 12) return armar(anio, p2, p1);
    if (p2 > 12 && p1 <= 12) return armar(anio, p1, p2);
    return armar(anio, p2, p1);
  }

  return undefined;
}

/** Quita tildes, signos y espacios de más para comparar textos escritos a mano. */
const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Busca una columna aunque el encabezado venga con otra tilde, otra mayúscula o
 * un espacio de más. Sin esto, retocar el encabezado dejaba la columna vacía sin
 * ningún aviso.
 */
function columna(fila: Record<string, unknown>, ...nombres: string[]): unknown {
  for (const n of nombres) {
    if (n in fila) return fila[n];
  }
  const buscados = nombres.map(normalizar);
  for (const clave of Object.keys(fila)) {
    const k = normalizar(clave);
    if (buscados.some(b => k === b || k.startsWith(b) || b.startsWith(k))) return fila[clave];
  }
  return undefined;
}

/**
 * Lleva el tipo de documento al código que usa la app.
 *
 * La plantilla ofrece etiquetas legibles ("Pasaporte") mientras que la pantalla
 * de miembros trabaja con códigos ("PA"). Sin esta conversión, un deportista
 * importado quedaba con un tipo que el formulario de edición no reconocía y
 * mostraba en blanco.
 */
export function normalizarTipoDoc(raw: unknown): string | undefined {
  const v = normalizar(String(raw ?? ''));
  if (!v) return undefined;
  if (/^(cc|cedula|cedula de ciudadania|c c)$/.test(v)) return 'CC';
  if (/^(ti|tarjeta de identidad)$/.test(v)) return 'TI';
  if (/^(rc|registro civil)$/.test(v)) return 'RC';
  if (/^(ce|cedula de extranjeria)$/.test(v)) return 'CE';
  if (/^(pa|pasaporte|passport)$/.test(v)) return 'PA';
  if (/^nit$/.test(v)) return 'NIT';
  if (/^(otro|otra|other)$/.test(v)) return 'Otro';
  return String(raw).trim() || undefined;
}

export function parseMembersExcel(
  file: File,
): Promise<{ rows: MemberImportRow[]; errors: string[]; warnings: string[] }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      // cellDates + raw hacen que las celdas de fecha lleguen como Date en vez de
      // como texto ya formateado, que era lo que hacía perder las fechas según el
      // formato que tuviera la columna en Excel.
      const wb = XLSX.read(data, { type: 'array', cellDates: true });
      // Leer siempre la hoja 'Deportistas' — si no existe, usar la primera
      const ws = wb.Sheets['Deportistas'] ?? wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: true });

      const rows: MemberImportRow[] = [];
      const errors: string[] = [];
      const warnings: string[] = [];

      const texto = (fila: Record<string, unknown>, ...nombres: string[]) =>
        String(columna(fila, ...nombres) ?? '').trim() || undefined;

      raw.forEach((r, i) => {
        const rowNum = i + 2;
        const fullName = texto(r, 'Nombre Completo *', 'Nombre Completo', 'Nombre') ?? '';
        const email    = texto(r, 'Correo electrónico *', 'Correo electrónico', 'Correo', 'Email') ?? '';
        // Se acepta la cabecera vieja y los nombres viejos de los roles: los
        // clubes que descargaron la plantilla antes del cambio al español
        // tienen archivos que dicen COACH y STUDENT, y esos siguen importando.
        const rolEscrito = (texto(r, 'Rol (ADMIN / ENTRENADOR / DEPORTISTA)',
                                     'Rol (ADMIN / COACH / STUDENT)',
                                     'Rol') ?? 'DEPORTISTA').toUpperCase();
        const roleRaw  = ROLES_VIEJOS[rolEscrito] ?? rolEscrito;

        if (!fullName) { errors.push(`Fila ${rowNum}: Nombre completo es obligatorio`); return; }
        // Un correo mal escrito si se rechaza: importarlo dejaria una
        // invitacion que nunca llega y nadie sabria por que.
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
          errors.push(`Fila ${rowNum}: el correo "${email}" no es válido`); return;
        }
        // El correo NO es obligatorio: en la base `Member.email` es opcional y
        // creando a mano se puede dejar vacio. Exigirlo solo aca hacia que la
        // importacion fuera mas estricta que el propio producto, y justo en el
        // caso que mas lo necesita: un club cargando de una vez la lista de
        // ninos de seis anos, de los que nadie tiene correo. Sin correo el
        // deportista queda registrado pero no se le puede enviar la invitacion.
        if (!['ADMIN', 'ENTRENADOR', 'DEPORTISTA'].includes(roleRaw)) {
          errors.push(`Fila ${rowNum}: Rol inválido "${roleRaw}" — usa ADMIN, ENTRENADOR o DEPORTISTA`); return;
        }

        const dueDayRaw = parseInt(texto(r, 'Día de corte mensualidad (1-31)', 'Día de corte') ?? '');
        const paymentDueDay = !isNaN(dueDayRaw) && dueDayRaw >= 1 && dueDayRaw <= 31 ? dueDayRaw : undefined;

        const locationName = texto(r, 'Sede');

        // Si la celda traía algo y no se pudo interpretar, se avisa en vez de
        // descartar la fecha en silencio, que era lo que pasaba antes.
        const fechaCruda = columna(r, 'Fecha de nacimiento (YYYY-MM-DD)', 'Fecha de nacimiento');
        const birthDate = parseBirthDate(fechaCruda);
        if (!birthDate && fechaCruda !== '' && fechaCruda !== null && fechaCruda !== undefined) {
          const visible = fechaCruda instanceof Date ? fechaCruda.toLocaleDateString() : String(fechaCruda);
          warnings.push(`Fila ${rowNum}: no se entendió la fecha "${visible}", el deportista se importa sin fecha de nacimiento`);
        }

        rows.push({
          fullName,
          email:            email || undefined,
          phone:            texto(r, 'Teléfono'),
          birthDate,
          docType:          normalizarTipoDoc(columna(r, 'Tipo de documento')),
          docNumber:        texto(r, 'Número de documento'),
          emergencyContact: texto(r, 'Contacto de emergencia'),
          emergencyPhone:   texto(r, 'Teléfono de emergencia'),
          eps:              texto(r, 'EPS'),
          category:         texto(r, 'Categoría'),
          tipo:             texto(r, 'Nivel / Tipo'),
          role:             roleRaw as 'ADMIN' | 'ENTRENADOR' | 'DEPORTISTA',
          paymentDueDay,
          locationName,
        });
      });

      // Quien no trae correo se importa igual, pero conviene decir cuantos
      // son: sin el no se les puede mandar la invitacion a la app, y el club
      // deberia enterarse ahora y no cuando intente invitarlos.
      const sinCorreo = rows.filter(r => !r.email).length;
      if (sinCorreo > 0) {
        warnings.push(
          sinCorreo === 1
            ? '1 deportista quedó sin correo: podrás registrarlo y llevarle asistencia y pagos, pero no invitarlo a la app hasta que se lo agregues.'
            : `${sinCorreo} deportistas quedaron sin correo: podrás registrarlos y llevarles asistencia y pagos, pero no invitarlos a la app hasta que se los agregues.`
        );
      }

      resolve({ rows, errors, warnings });
    };
    reader.readAsArrayBuffer(file);
  });
}
