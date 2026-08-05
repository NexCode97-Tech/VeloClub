import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

/**
 * Consolidado de asistencia descargable, en PDF y en Excel.
 *
 * El porcentaje cuenta las tardanzas como asistencia (llegar tarde sigue siendo
 * entrenar) y saca las excusas médicas de la base en vez de contarlas como
 * falta, para no castigar a un lesionado. El cálculo lo hace el servidor: aquí
 * solo se pinta, para que el número del PDF y el de la pantalla nunca difieran.
 */

// ── Paleta VeloClub (misma que pdf.ts) ───────────────────────────────────────
const PURPLE = [124, 58, 237]  as [number, number, number];
const BLUE   = [67, 97, 238]   as [number, number, number];
const DARK   = [26, 16, 40]    as [number, number, number];
const MUTED  = [142, 135, 168] as [number, number, number];
const WHITE  = [255, 255, 255] as [number, number, number];

export interface FilaAsistencia {
  id: string;
  fullName: string;
  category?: string | null;
  dias: Record<string, string>;
  presentes: number;
  tardanzas: number;
  ausencias: number;
  excusas: number;
  porcentaje: number | null;
}

export interface ReporteAsistencia {
  dias: string[];
  filas: FilaAsistencia[];
}

export interface OpcionesReporte {
  clubName: string;
  sedeName: string;
  desde: string;
  hasta: string;
}

// Una letra por estado: con 22 columnas de días no cabe ni "Presente" ni "P."
const SIGLA: Record<string, string> = {
  PRESENT: 'P', LATE: 'T', ABSENT: 'A', MEDICAL_EXCUSE: 'E',
};
const NOMBRE_ESTADO: Record<string, string> = {
  PRESENT: 'Presente', LATE: 'Tardanza', ABSENT: 'Ausente', MEDICAL_EXCUSE: 'Excusa médica',
};

// Pasado un mes, la cuadrícula día por día no cabe en ninguna hoja: el PDF
// cambia solo al resumen por deportista.
const MAX_DIAS_CUADRICULA = 31;

function fechaCorta(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function fechaLarga(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function pct(valor: number | null): string {
  return valor === null ? '—' : `${valor}%`;
}

function nombreArchivo(opts: OpcionesReporte, ext: string): string {
  const club = opts.clubName.replace(/\s+/g, '_');
  return `asistencia_${club}_${opts.desde}_a_${opts.hasta}.${ext}`;
}

// ── PDF ──────────────────────────────────────────────────────────────────────
export function descargarAsistenciaPDF(rep: ReporteAsistencia, opts: OpcionesReporte) {
  const conCuadricula = rep.dias.length > 0 && rep.dias.length <= MAX_DIAS_CUADRICULA;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const ANCHO = 297;

  // Encabezado de marca
  for (let i = 0; i < 40; i++) {
    const t = i / 39;
    doc.setFillColor(
      Math.round(PURPLE[0] + (BLUE[0] - PURPLE[0]) * t),
      Math.round(PURPLE[1] + (BLUE[1] - PURPLE[1]) * t),
      Math.round(PURPLE[2] + (BLUE[2] - PURPLE[2]) * t),
    );
    doc.rect((ANCHO / 40) * i, 0, ANCHO / 40 + 0.5, 18, 'F');
  }
  doc.setTextColor(...WHITE);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(opts.clubName, 12, 12);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(
    new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }),
    ANCHO - 12, 12, { align: 'right' },
  );

  doc.setTextColor(...DARK);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('Consolidado de asistencia', 12, 29);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED);
  doc.text(`Del ${fechaLarga(opts.desde)} al ${fechaLarga(opts.hasta)}`, 12, 35);
  doc.text(
    `${opts.sedeName} · ${rep.filas.length} deportista${rep.filas.length !== 1 ? 's' : ''} · ` +
    `${rep.dias.length} día${rep.dias.length !== 1 ? 's' : ''} con entrenamiento`,
    12, 40,
  );

  if (rep.dias.length === 0) {
    doc.setFontSize(11);
    doc.setTextColor(...DARK);
    doc.text('No hay asistencia registrada en este rango.', 12, 55);
    pie(doc, ANCHO);
    doc.save(nombreArchivo(opts, 'pdf'));
    return;
  }

  if (conCuadricula) {
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text('P presente · T tardanza · A ausente · E excusa médica', 12, 45);

    autoTable(doc, {
      startY: 49,
      head: [['Deportista', ...rep.dias.map(fechaCorta), '%']],
      body: rep.filas.map(f => [
        f.fullName,
        ...rep.dias.map(d => SIGLA[f.dias[d]] ?? '·'),
        pct(f.porcentaje),
      ]),
      headStyles: { fillColor: PURPLE, textColor: WHITE, fontStyle: 'bold', fontSize: 6.5, halign: 'center' },
      bodyStyles: { fontSize: 6.5, textColor: DARK, halign: 'center', cellPadding: 1 },
      alternateRowStyles: { fillColor: [245, 243, 255] },
      columnStyles: {
        0: { cellWidth: 42, halign: 'left', fontStyle: 'bold' },
        [rep.dias.length + 1]: { cellWidth: 12, fontStyle: 'bold' },
      },
      margin: { left: 12, right: 12 },
      tableLineColor: [220, 215, 240],
      tableLineWidth: 0.2,
    });
  } else {
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(
      'El rango supera un mes, así que se muestra el resumen por deportista. El detalle día por día está en la versión de Excel.',
      12, 45,
    );

    autoTable(doc, {
      startY: 49,
      head: [['Deportista', 'Categoría', 'Presentes', 'Tardanzas', 'Ausencias', 'Excusas', '% asistencia']],
      body: rep.filas.map(f => [
        f.fullName, f.category ?? '—',
        String(f.presentes), String(f.tardanzas), String(f.ausencias), String(f.excusas),
        pct(f.porcentaje),
      ]),
      headStyles: { fillColor: PURPLE, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: DARK },
      alternateRowStyles: { fillColor: [245, 243, 255] },
      columnStyles: {
        0: { cellWidth: 70, fontStyle: 'bold' },
        1: { cellWidth: 45 },
        2: { cellWidth: 24, halign: 'center' },
        3: { cellWidth: 24, halign: 'center' },
        4: { cellWidth: 24, halign: 'center' },
        5: { cellWidth: 24, halign: 'center' },
        6: { cellWidth: 26, halign: 'center', fontStyle: 'bold' },
      },
      margin: { left: 12, right: 12 },
      tableLineColor: [220, 215, 240],
      tableLineWidth: 0.2,
    });
  }

  pie(doc, ANCHO);
  doc.save(nombreArchivo(opts, 'pdf'));
}

function pie(doc: jsPDF, ancho: number) {
  const pages = (doc as jsPDF & { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...MUTED);
    doc.setLineWidth(0.2);
    doc.line(12, 196, ancho - 12, 196);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    doc.text(`Página ${i} de ${pages}`, 12, 201);
    doc.text('VeloClub · Sistema de gestión deportiva', ancho - 12, 201, { align: 'right' });
  }
}

// ── Excel ────────────────────────────────────────────────────────────────────
export function descargarAsistenciaExcel(rep: ReporteAsistencia, opts: OpcionesReporte) {
  const libro = XLSX.utils.book_new();

  // Hoja 1 — cuadrícula completa. Excel se desplaza, así que aquí no hay límite
  // de rango: siempre va el detalle día por día.
  const encabezado = ['Deportista', 'Categoría', ...rep.dias.map(fechaCorta), '% asistencia'];
  const cuerpo = rep.filas.map(f => [
    f.fullName,
    f.category ?? '',
    ...rep.dias.map(d => (f.dias[d] ? NOMBRE_ESTADO[f.dias[d]] : '')),
    f.porcentaje === null ? 'Sin base' : f.porcentaje / 100,
  ]);

  const hoja = XLSX.utils.aoa_to_sheet([
    [opts.clubName],
    [`Consolidado de asistencia · ${opts.sedeName}`],
    [`Del ${fechaLarga(opts.desde)} al ${fechaLarga(opts.hasta)}`],
    [],
    encabezado,
    ...cuerpo,
  ]);

  // El porcentaje va como número con formato, no como texto: así el club puede
  // ordenar por esa columna y hacer sus propias fórmulas encima.
  const colPct = encabezado.length - 1;
  for (let i = 0; i < cuerpo.length; i++) {
    const ref = XLSX.utils.encode_cell({ r: 5 + i, c: colPct });
    const celda = hoja[ref];
    if (celda && typeof celda.v === 'number') celda.z = '0%';
  }

  hoja['!cols'] = [
    { wch: 28 }, { wch: 18 },
    ...rep.dias.map(() => ({ wch: 13 })),
    { wch: 13 },
  ];
  hoja['!freeze'] = { xSplit: 2, ySplit: 5 };
  XLSX.utils.book_append_sheet(libro, hoja, 'Detalle');

  // Hoja 2 — resumen, que es lo que se mira primero
  const resumen = XLSX.utils.aoa_to_sheet([
    ['Deportista', 'Categoría', 'Presentes', 'Tardanzas', 'Ausencias', 'Excusas', '% asistencia'],
    ...rep.filas.map(f => [
      f.fullName, f.category ?? '',
      f.presentes, f.tardanzas, f.ausencias, f.excusas,
      f.porcentaje === null ? 'Sin base' : f.porcentaje / 100,
    ]),
  ]);
  for (let i = 0; i < rep.filas.length; i++) {
    const celda = resumen[XLSX.utils.encode_cell({ r: 1 + i, c: 6 })];
    if (celda && typeof celda.v === 'number') celda.z = '0%';
  }
  resumen['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 13 }];
  XLSX.utils.book_append_sheet(libro, resumen, 'Resumen');

  XLSX.writeFile(libro, nombreArchivo(opts, 'xlsx'));
}
