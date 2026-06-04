import * as XLSX from 'xlsx';

interface LocationOption {
  id: string;
  name: string;
}

export function downloadMembersTemplate(locations: LocationOption[] = []) {
  const ROLES      = ['ADMIN', 'COACH', 'STUDENT'];
  const CATEGORIAS = ['Menores 3-10 años', 'Transición 11-13 años', 'Mayores 14+ años'];
  const NIVELES    = ['Escuela', 'Novatos', 'Intermedio', 'Avanzados', 'Federados'];
  const SEDES      = locations.map(l => l.name);

  const headers = [
    'Nombre Completo *',
    'Correo electrónico *',
    'Teléfono',
    'Fecha de nacimiento (YYYY-MM-DD)',
    'Número de documento',
    'Contacto de emergencia',
    'Teléfono de emergencia',
    'EPS',
    'Categoría',
    'Nivel / Tipo',
    'Rol (ADMIN / COACH / STUDENT)',
    'Día de corte mensualidad (1-31)',
    'Sede',
  ];

  const example = [
    'Juan Carlos Pérez',
    'juan@ejemplo.com',
    '3001234567',
    '2005-03-15',
    '1023456789',
    'María Pérez',
    '3109876543',
    'Sura',
    'Menores 3-10 años',
    'Escuela',
    'STUDENT',
    '15',
    SEDES[0] ?? '',
  ];

  const notes = [
    '* Campos obligatorios',
    '* El correo debe ser único por deportista',
    '* Rol: ADMIN = Administrador, COACH = Entrenador, STUDENT = Deportista',
    '* Categoría y Nivel son opcionales (solo aplican a STUDENT)',
    '* Día de corte: número entre 1 y 31',
    '* Sede: selecciona de la lista desplegable (opcional)',
  ];

  const wb = XLSX.utils.book_new();

  // ── Hoja principal ─────────────────────────────────────────────────────────
  const wsData = [headers, example];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws['!cols'] = [
    { wch: 25 }, { wch: 28 }, { wch: 14 }, { wch: 28 },
    { wch: 20 }, { wch: 25 }, { wch: 24 }, { wch: 14 },
    { wch: 22 }, { wch: 16 }, { wch: 28 }, { wch: 30 }, { wch: 25 },
  ];

  // ── Hoja oculta "Listas" con las sedes del club ────────────────────────────
  if (SEDES.length > 0) {
    const wsListas = XLSX.utils.aoa_to_sheet(SEDES.map(s => [s]));
    wsListas['!cols'] = [{ wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsListas, 'Listas');
  }

  // ── Validaciones de datos (dropdowns) ──────────────────────────────────────
  // Columnas: I=Categoría(8), J=Nivel(9), K=Rol(10), M=Sede(12)
  const validations: object[] = [
    {
      sqref: 'K2:K1000',
      type: 'list',
      formula1: `"${ROLES.join(',')}"`,
      showErrorMessage: true,
      errorTitle: 'Rol inválido',
      error: 'Selecciona ADMIN, COACH o STUDENT de la lista',
    },
    {
      sqref: 'I2:I1000',
      type: 'list',
      formula1: `"${CATEGORIAS.join(',')}"`,
      showErrorMessage: true,
      errorTitle: 'Categoría inválida',
      error: 'Selecciona una categoría de la lista',
    },
    {
      sqref: 'J2:J1000',
      type: 'list',
      formula1: `"${NIVELES.join(',')}"`,
      showErrorMessage: true,
      errorTitle: 'Nivel inválido',
      error: 'Selecciona un nivel de la lista',
    },
  ];

  if (SEDES.length > 0) {
    validations.push({
      sqref: 'M2:M1000',
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
  docNumber?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  eps?: string;
  category?: string;
  tipo?: string;
  role: 'ADMIN' | 'COACH' | 'STUDENT';
  paymentDueDay?: number;
  locationName?: string;
}

function parseBirthDate(raw: unknown): string | undefined {
  if (!raw) return undefined;
  const str = String(raw).trim();
  if (!str) return undefined;

  // Serial numérico de Excel (ej: "45123" o 45123)
  const serial = Number(str);
  if (!isNaN(serial) && serial > 1000) {
    const date = XLSX.SSF.parse_date_code(serial);
    if (date) {
      const mm = String(date.m).padStart(2, '0');
      const dd = String(date.d).padStart(2, '0');
      return `${date.y}-${mm}-${dd}`;
    }
  }

  // Formatos DD/MM/YYYY o DD-MM-YYYY
  const dmY = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmY) return `${dmY[3]}-${dmY[2].padStart(2, '0')}-${dmY[1].padStart(2, '0')}`;

  // Ya viene en YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  return undefined;
}

export function parseMembersExcel(file: File): Promise<{ rows: MemberImportRow[]; errors: string[] }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      // Leer siempre la hoja 'Deportistas' — si no existe, usar la primera
      const ws = wb.Sheets['Deportistas'] ?? wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false });

      const rows: MemberImportRow[] = [];
      const errors: string[] = [];

      raw.forEach((r, i) => {
        const rowNum = i + 2;
        const fullName = String(r['Nombre Completo *'] ?? '').trim();
        const email    = String(r['Correo electrónico *'] ?? '').trim();
        const roleRaw  = String(r['Rol (ADMIN / COACH / STUDENT)'] ?? 'STUDENT').trim().toUpperCase();

        if (!fullName) { errors.push(`Fila ${rowNum}: Nombre completo es obligatorio`); return; }
        if (!email)    { errors.push(`Fila ${rowNum}: Correo es obligatorio`); return; }
        if (!['ADMIN', 'COACH', 'STUDENT'].includes(roleRaw)) {
          errors.push(`Fila ${rowNum}: Rol inválido "${roleRaw}" — usa ADMIN, COACH o STUDENT`); return;
        }

        const dueDayRaw = parseInt(String(r['Día de corte mensualidad (1-31)'] ?? ''));
        const paymentDueDay = !isNaN(dueDayRaw) && dueDayRaw >= 1 && dueDayRaw <= 31 ? dueDayRaw : undefined;

        const locationName = String(r['Sede'] ?? '').trim() || undefined;

        rows.push({
          fullName,
          email:            email || undefined,
          phone:            String(r['Teléfono'] ?? '').trim() || undefined,
          birthDate:        parseBirthDate(r['Fecha de nacimiento (YYYY-MM-DD)']),
          docNumber:        String(r['Número de documento'] ?? '').trim() || undefined,
          emergencyContact: String(r['Contacto de emergencia'] ?? '').trim() || undefined,
          emergencyPhone:   String(r['Teléfono de emergencia'] ?? '').trim() || undefined,
          eps:              String(r['EPS'] ?? '').trim() || undefined,
          category:         String(r['Categoría'] ?? '').trim() || undefined,
          tipo:             String(r['Nivel / Tipo'] ?? '').trim() || undefined,
          role:             roleRaw as 'ADMIN' | 'COACH' | 'STUDENT',
          paymentDueDay,
          locationName,
        });
      });

      resolve({ rows, errors });
    };
    reader.readAsArrayBuffer(file);
  });
}
