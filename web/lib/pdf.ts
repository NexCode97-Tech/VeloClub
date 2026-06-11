import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Paleta VeloClub ───────────────────────────────────────────────────────────
const PURPLE  = [124, 58,  237] as [number,number,number]; // #7C3AED
const BLUE    = [67,  97,  238] as [number,number,number]; // #4361EE
const GREEN   = [6,   214, 160] as [number,number,number]; // #06D6A0
const DARK    = [26,  16,  40]  as [number,number,number]; // #1A1028
const MUTED   = [142, 135, 168] as [number,number,number]; // #8E87A8
const BG      = [247, 247, 251] as [number,number,number]; // #F7F7FB
const WHITE   = [255, 255, 255] as [number,number,number];

// ── Helper: fetch logo como dataURL ──────────────────────────────────────────
async function fetchLogoDataUrl(url: string): Promise<{ dataUrl: string; format: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
    // Detectar formato desde el mime type real del blob
    const mime = blob.type.toLowerCase();
    let format = 'JPEG';
    if (mime.includes('png'))  format = 'PNG';
    if (mime.includes('webp')) format = 'WEBP';
    return { dataUrl, format };
  } catch { return null; }
}

// ── Helper: degradado horizontal manual ──────────────────────────────────────
function gradientRect(doc: jsPDF, x: number, y: number, w: number, h: number, steps = 40) {
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const r = Math.round(PURPLE[0] + (BLUE[0] - PURPLE[0]) * t);
    const g = Math.round(PURPLE[1] + (BLUE[1] - PURPLE[1]) * t);
    const b = Math.round(PURPLE[2] + (BLUE[2] - PURPLE[2]) * t);
    doc.setFillColor(r, g, b);
    doc.rect(x + (w / steps) * i, y, w / steps + 0.5, h, 'F');
  }
}

// ── Footer compartido ─────────────────────────────────────────────────────────
function footer(doc: jsPDF) {
  const pages = (doc as jsPDF & { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    // Línea separadora
    doc.setDrawColor(...MUTED);
    doc.setLineWidth(0.2);
    doc.line(14, 284, 196, 284);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    doc.text(`Página ${i} de ${pages}`, 14, 289);
    doc.text('VeloClub · Sistema de gestión deportiva', 196, 289, { align: 'right' });
  }
}

// ── Lista de miembros ─────────────────────────────────────────────────────────
interface MemberRow {
  fullName: string; email?: string; phone?: string;
  category?: string; tipo?: string;
  locations: { location: { name: string } }[];
  role: string;
}
const ROLES: Record<string, string> = { ADMIN: 'Admin', COACH: 'Entrenador', STUDENT: 'Deportista' };

export function downloadMembersPDF(members: MemberRow[], clubName: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Header
  gradientRect(doc, 0, 0, 210, 20);
  doc.setTextColor(...WHITE);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(clubName, 14, 13);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }), 196, 13, { align: 'right' });

  doc.setTextColor(...DARK);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Lista de miembros', 14, 32);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED);
  doc.text(`${members.length} miembro${members.length !== 1 ? 's' : ''} registrado${members.length !== 1 ? 's' : ''}`, 14, 39);

  autoTable(doc, {
    startY: 45,
    head: [['Nombre', 'Correo', 'Teléfono', 'Rol', 'Categoría', 'Nivel', 'Sedes']],
    body: members.map(m => [
      m.fullName, m.email ?? '—', m.phone ?? '—',
      ROLES[m.role] ?? m.role, m.category ?? '—', m.tipo ?? '—',
      m.locations.map(l => l.location.name).join(', ') || '—',
    ]),
    headStyles: { fillColor: PURPLE, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: DARK },
    alternateRowStyles: { fillColor: [245, 243, 255] },
    columnStyles: {
      0: { cellWidth: 38 }, 1: { cellWidth: 40 }, 2: { cellWidth: 24 },
      3: { cellWidth: 22 }, 4: { cellWidth: 26 }, 5: { cellWidth: 20 }, 6: { cellWidth: 22 },
    },
    margin: { left: 14, right: 14 },
    tableLineColor: [220, 215, 240],
    tableLineWidth: 0.2,
  });

  footer(doc);
  doc.save(`miembros_${clubName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ── Recibo de pago ────────────────────────────────────────────────────────
const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

interface PaymentInvoice {
  id: string;
  memberName: string;
  docType?: string | null;
  docNumber?: string | null;
  amount: number;
  month: number;
  year: number;
  status: string;
  paidAt?: string;
  notes?: string;
}

const STATUS_ES: Record<string, string> = {
  PAID: 'Pagado', PENDING: 'Pendiente', OVERDUE: 'Vencido', REFUNDED: 'Reembolsado',
};

export async function downloadInvoicePDF(
  payment: PaymentInvoice,
  clubName: string,
  clubLogoUrl?: string | null,
) {
  // A5 (148 × 210 mm) — tamaño compacto ideal para imprimir un recibo
  const W = 148, H = 210;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [W, H] });
  const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  const CX  = W / 2; // centro horizontal
  const MX  = 12;    // margen lateral

  // ── 1. Cabecera: logo centrado + nombre del club ──────────────────────────
  const LOGO_SIZE = 18;
  const LOGO_X    = CX - LOGO_SIZE / 2;
  const LOGO_Y    = 10;
  let   logoLoaded = false;

  if (clubLogoUrl) {
    const result = await fetchLogoDataUrl(clubLogoUrl);
    if (result) {
      doc.addImage(result.dataUrl, result.format, LOGO_X, LOGO_Y, LOGO_SIZE, LOGO_SIZE);
      logoLoaded = true;
    }
  }
  if (!logoLoaded) {
    doc.setFillColor(...PURPLE);
    doc.roundedRect(LOGO_X, LOGO_Y, LOGO_SIZE, LOGO_SIZE, 3, 3, 'F');
    doc.setTextColor(...WHITE);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(clubName.charAt(0).toUpperCase(), CX, LOGO_Y + LOGO_SIZE / 2 + 2, { align: 'center' });
  }

  let cy = LOGO_Y + LOGO_SIZE + 5;
  doc.setTextColor(...DARK);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(clubName, CX, cy, { align: 'center' });

  // ── 2. Línea divisora ─────────────────────────────────────────────────────
  cy += 5;
  doc.setDrawColor(...MUTED);
  doc.setLineWidth(0.2);
  doc.line(MX, cy, W - MX, cy);

  // ── 3. Título del comprobante ─────────────────────────────────────────────
  cy += 7;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text('RECIBO DE PAGO', CX, cy, { align: 'center' });

  cy += 5;
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED);
  doc.text(`No. ${payment.id.slice(-10).toUpperCase()}`, CX, cy, { align: 'center' });

  // ── 4. Línea divisora ─────────────────────────────────────────────────────
  cy += 5;
  doc.setDrawColor(...MUTED);
  doc.setLineWidth(0.2);
  doc.line(MX, cy, W - MX, cy);

  // ── 5. Filas de detalle ───────────────────────────────────────────────────
  const COL_LABEL = MX + 2;
  const COL_VALUE = W - MX - 2;
  const ROW_H     = 12; // un poco más de altura para la fila de fecha con hora

  // Fecha formateada + hora por separado
  const paidDate = payment.paidAt ? new Date(payment.paidAt) : null;
  const paidDateStr = paidDate
    ? paidDate.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—';
  const paidTimeStr = paidDate
    ? paidDate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  // [label, value, isStatus, isDate]
  type Row = [string, string, boolean, boolean];
  const rows: Row[] = [
    ['ESTADO DEL PAGO', STATUS_ES[payment.status] ?? payment.status, payment.status === 'PAID', false],
    ['DEPORTISTA',      payment.memberName,                          false,                      false],
    ...(payment.docType || payment.docNumber
      ? [[(payment.docType ?? 'DOCUMENTO').toUpperCase(), payment.docNumber ?? '—', false, false] as Row]
      : []),
    ['CONCEPTO',        `Mensualidad ${MONTH_NAMES[payment.month - 1]} ${payment.year}`, false, false],
    ['PERÍODO',         `${MONTH_NAMES[payment.month - 1]} ${payment.year}`,             false, false],
    ['FECHA DE PAGO',   paidDateStr, false, true],
    ...(payment.notes ? [['NOTAS', payment.notes, false, false] as Row] : []),
  ];

  cy += 3;
  rows.forEach(([label, value, isStatus, isDate], i) => {
    const rowY  = cy + i * ROW_H;
    const textY = rowY + ROW_H / 2 + (isDate && paidTimeStr ? 0 : 1.5);

    // Label — CAPS pequeño gris
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...MUTED);
    doc.text(label, COL_LABEL, textY);

    // Valor
    if (isStatus) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...GREEN);
      doc.text(value, COL_VALUE, textY, { align: 'right' });
    } else if (isDate && paidTimeStr) {
      // Fecha en bold + hora debajo en pequeño
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...DARK);
      doc.text(value, COL_VALUE, rowY + ROW_H / 2 - 0.5, { align: 'right' });
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...MUTED);
      doc.text(paidTimeStr, COL_VALUE, rowY + ROW_H / 2 + 4, { align: 'right' });
    } else {
      doc.setFontSize(9);
      doc.setFont('helvetica', label === 'DEPORTISTA' ? 'bold' : 'normal');
      doc.setTextColor(...DARK);
      doc.text(value, COL_VALUE, textY, { align: 'right' });
    }

    // Línea separadora
    if (i < rows.length - 1) {
      doc.setDrawColor(225, 220, 245);
      doc.setLineWidth(0.15);
      doc.line(MX, rowY + ROW_H, W - MX, rowY + ROW_H);
    }
  });

  // ── 6. Caja total con gradiente ───────────────────────────────────────────
  const totalY = cy + rows.length * ROW_H + 6;
  const BOX_H  = 20;
  gradientRect(doc, MX, totalY, W - MX * 2, BOX_H, 20);

  // "Total transferido:" a la izquierda
  doc.setTextColor(...WHITE);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Total transferido:', MX + 5, totalY + BOX_H / 2 + 1.5);

  // Monto grande + "COP" pequeño a la derecha (dentro del margen)
  const amountRaw = fmt.format(payment.amount).replace(/\s?COP/, '').trim();
  const RIGHT_EDGE = W - MX - 3;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('COP', RIGHT_EDGE, totalY + BOX_H / 2 + 2.5, { align: 'right' });
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(amountRaw, RIGHT_EDGE - 10, totalY + BOX_H / 2 + 2.5, { align: 'right' });

  // ── 7. Pie de página ──────────────────────────────────────────────────────
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED);
  doc.text('Generado por VeloClub · Sistema de gestión deportiva', CX, H - 6, { align: 'center' });

  doc.save(`recibo_${payment.memberName.replace(/\s+/g, '_')}_${MONTH_NAMES[payment.month - 1]}_${payment.year}.pdf`);
}
