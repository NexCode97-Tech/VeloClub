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
async function fetchLogoDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise<string>(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
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

// ── Factura de mensualidad ────────────────────────────────────────────────────
const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

interface PaymentInvoice {
  id: string;
  memberName: string;
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
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  const isPaid = payment.status === 'PAID';

  // ── 1. Banda superior con gradiente ────────────────────────────────────────
  gradientRect(doc, 0, 0, 210, 48);

  // ── 2. Logo del club ───────────────────────────────────────────────────────
  const LOGO_SIZE = 22;
  const LOGO_X    = 14;
  const LOGO_Y    = 10;
  let logoLoaded  = false;

  if (clubLogoUrl) {
    const dataUrl = await fetchLogoDataUrl(clubLogoUrl);
    if (dataUrl) {
      // Fondo blanco redondeado detrás del logo
      doc.setFillColor(...WHITE);
      doc.roundedRect(LOGO_X - 1, LOGO_Y - 1, LOGO_SIZE + 2, LOGO_SIZE + 2, 3, 3, 'F');
      const ext = clubLogoUrl.includes('.png') ? 'PNG' : 'JPEG';
      doc.addImage(dataUrl, ext, LOGO_X, LOGO_Y, LOGO_SIZE, LOGO_SIZE);
      logoLoaded = true;
    }
  }

  if (!logoLoaded) {
    // Fallback: cuadrado con inicial
    doc.setFillColor(255, 255, 255, 0.2);
    doc.roundedRect(LOGO_X, LOGO_Y, LOGO_SIZE, LOGO_SIZE, 3, 3, 'F');
    doc.setTextColor(...WHITE);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(clubName.charAt(0).toUpperCase(), LOGO_X + LOGO_SIZE / 2, LOGO_Y + LOGO_SIZE / 2 + 2, { align: 'center' });
  }

  // ── 3. Nombre del club ─────────────────────────────────────────────────────
  const nameX = LOGO_X + LOGO_SIZE + 8;
  doc.setTextColor(...WHITE);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(clubName, nameX, 20);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(220, 215, 255);
  doc.text('Sistema de gestión deportiva · VeloClub', nameX, 27);

  // ── 4. Etiqueta FACTURA (derecha) ──────────────────────────────────────────
  // Caja "FACTURA"
  doc.setFillColor(255, 255, 255, 0.15);
  doc.roundedRect(148, 9, 48, 12, 2, 2, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURA', 172, 17, { align: 'center' });

  // Fecha
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(220, 215, 255);
  doc.text(
    new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }),
    172, 25, { align: 'center' }
  );

  // ── 5. Título de la factura ────────────────────────────────────────────────
  // Banda gris suave
  doc.setFillColor(...BG);
  doc.rect(0, 48, 210, 20, 'F');

  doc.setTextColor(...DARK);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Factura de mensualidad', 14, 60);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED);
  doc.text(`${MONTH_NAMES[payment.month - 1]} ${payment.year}`, 14, 66);

  // ── 6. Tarjeta de MONTO destacado ─────────────────────────────────────────
  // Caja con borde sutil
  doc.setFillColor(...WHITE);
  doc.setDrawColor(...PURPLE);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, 74, 182, 28, 4, 4, 'FD');

  // Etiqueta MONTO TOTAL
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...MUTED);
  doc.text('MONTO TOTAL', 22, 83);

  // Valor grande
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PURPLE);
  doc.text(fmt.format(payment.amount), 22, 95);

  // Badge de estado (derecha)
  const statusColor = isPaid ? GREEN
    : payment.status === 'OVERDUE' ? [239, 71, 111] as [number,number,number]
    : [255, 183, 3] as [number,number,number];
  const statusLabel = STATUS_ES[payment.status] ?? payment.status;

  doc.setFillColor(...statusColor);
  doc.roundedRect(148, 80, 40, 14, 3, 3, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(statusLabel.toUpperCase(), 168, 89, { align: 'center' });

  // ── 7. Tabla de detalle ────────────────────────────────────────────────────
  const rows: [string, string][] = [
    ['DEPORTISTA',    payment.memberName],
    ['CONCEPTO',      `Mensualidad ${MONTH_NAMES[payment.month - 1]} ${payment.year}`],
    ['PERÍODO',       `${MONTH_NAMES[payment.month - 1]} ${payment.year}`],
    ['FECHA DE PAGO', payment.paidAt
      ? new Date(payment.paidAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
      : '—'],
  ];
  if (payment.notes) rows.push(['NOTAS', payment.notes]);

  let y = 114;
  const rowH = 13;

  // Cabecera sutil
  doc.setFillColor(245, 243, 255);
  doc.roundedRect(14, y - 6, 182, 8, 2, 2, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PURPLE);
  doc.text('DETALLE DEL COBRO', 22, y - 0.5);
  y += 6;

  rows.forEach(([label, value], i) => {
    // Alternating background
    if (i % 2 === 0) {
      doc.setFillColor(250, 249, 255);
      doc.rect(14, y - 4, 182, rowH, 'F');
    } else {
      doc.setFillColor(...WHITE);
      doc.rect(14, y - 4, 182, rowH, 'F');
    }

    // Línea divisoria suave
    doc.setDrawColor(230, 225, 248);
    doc.setLineWidth(0.15);
    doc.line(14, y + rowH - 4, 196, y + rowH - 4);

    // Label
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...MUTED);
    doc.text(label, 22, y + 3);

    // Value
    doc.setFontSize(9.5);
    doc.setFont('helvetica', label === 'DEPORTISTA' ? 'bold' : 'normal');
    doc.setTextColor(...DARK);
    doc.text(value, 90, y + 3);

    y += rowH;
  });

  // Borde exterior de la tabla
  doc.setDrawColor(...PURPLE);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, 120, 182, rows.length * rowH + 2, 3, 3, 'S');

  // ── 8. Sello PAGADO (watermark diagonal) ──────────────────────────────────
  if (isPaid) {
    // Fondo del sello
    doc.setFillColor(6, 214, 160, 0.06);
    doc.roundedRect(128, 148, 62, 22, 4, 4, 'F');
    doc.setDrawColor(...GREEN);
    doc.setLineWidth(1.8);
    doc.roundedRect(128, 148, 62, 22, 4, 4, 'S');

    doc.setTextColor(...GREEN);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('PAGADO', 159, 162, { align: 'center', angle: 0 });
  }

  // ── 9. Franja inferior de acento ──────────────────────────────────────────
  gradientRect(doc, 0, 278, 210, 5);

  footer(doc);
  doc.save(`mensualidad_${payment.memberName.replace(/\s+/g, '_')}_${MONTH_NAMES[payment.month - 1]}_${payment.year}.pdf`);
}
