import * as XLSX from 'xlsx';

export function downloadMembersTemplate() {
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
    'Juvenil',
    'Velocidad',
    'STUDENT',
    '15',
  ];

  const notes = [
    '* Campos obligatorios',
    '* El correo debe ser único por deportista',
    '* Rol: ADMIN = Administrador, COACH = Entrenador, STUDENT = Deportista',
    '* Categoría y Nivel son opcionales',
    '* Día de corte: número entre 1 y 31',
  ];

  const wb = XLSX.utils.book_new();

  // Hoja principal con plantilla
  const wsData = [headers, example];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Ancho de columnas
  ws['!cols'] = [
    { wch: 25 }, { wch: 28 }, { wch: 14 }, { wch: 28 },
    { wch: 20 }, { wch: 25 }, { wch: 24 }, { wch: 14 },
    { wch: 14 }, { wch: 16 }, { wch: 28 }, { wch: 30 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Deportistas');

  // Hoja de instrucciones
  const wsNotes = XLSX.utils.aoa_to_sheet(notes.map(n => [n]));
  wsNotes['!cols'] = [{ wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsNotes, 'Instrucciones');

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

  return undefined; // formato desconocido, ignorar
}

export function parseMembersExcel(file: File): Promise<{ rows: MemberImportRow[]; errors: string[] }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
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
        });
      });

      resolve({ rows, errors });
    };
    reader.readAsArrayBuffer(file);
  });
}
