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

  // ── 6. Tabla de detalle PRIMERO ───────────────────────────────────────────
  const rows: [string, string][] = [
    ['DEPORTISTA',    payment.memberName],
    ['CONCEPTO',      `Mensualidad ${MONTH_NAMES[payment.month - 1]} ${payment.year}`],
    ['PERÍODO',       `${MONTH_NAMES[payment.month - 1]} ${payment.year}`],
    ['FECHA DE PAGO', payment.paidAt
      ? new Date(payment.paidAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
      : '—'],
  ];
  if (payment.notes) rows.push(['NOTAS', payment.notes]);

  const ROW_H   = 13;
  const TABLE_X = 14;
  const TABLE_W = 182;
  const TABLE_Y = 74; // justo debajo del título

  // Cabecera de sección
  doc.setFillColor(237, 233, 254);
  doc.roundedRect(TABLE_X, TABLE_Y, TABLE_W, 9, 2, 2, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PURPLE);
  doc.text('DETALLE DEL COBRO', TABLE_X + 8, TABLE_Y + 6);

  // Borde exterior (cabecera + filas)
  doc.setDrawColor(...PURPLE);
  doc.setLineWidth(0.3);
  doc.roundedRect(TABLE_X, TABLE_Y, TABLE_W, 9 + rows.length * ROW_H, 2, 2, 'S');

  // Filas
  rows.forEach(([label, value], i) => {
    const rowTop = TABLE_Y + 9 + i * ROW_H;
    doc.setFillColor(i % 2 === 0 ? 250 : 255, i % 2 === 0 ? 249 : 255, 255);
    doc.rect(TABLE_X, rowTop, TABLE_W, ROW_H, 'F');

    if (i < rows.length - 1) {
      doc.setDrawColor(225, 220, 245);
      doc.setLineWidth(0.15);
      doc.line(TABLE_X, rowTop + ROW_H, TABLE_X + TABLE_W, rowTop + ROW_H);
    }

    const textY = rowTop + ROW_H / 2 + 1.5;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...MUTED);
    doc.text(label, TABLE_X + 8, textY);

    doc.setFontSize(9.5);
    doc.setFont('helvetica', label === 'DEPORTISTA' ? 'bold' : 'normal');
    doc.setTextColor(...DARK);
    doc.text(value, TABLE_X + 78, textY);
  });

  // ── 7. Sello PAGADO — centrado sobre la tabla ─────────────────────────────
  if (isPaid) {
    const cx  = TABLE_X + TABLE_W - 44;
    const cy  = TABLE_Y + 9 + (rows.length * ROW_H) / 2;
    const DEG = 18;
    const RAD = (DEG * Math.PI) / 180;

    function rotPt(px: number, py: number): [number, number] {
      const dx = px - cx, dy = py - cy;
      return [
        cx + dx * Math.cos(-RAD) - dy * Math.sin(-RAD),
        cy + dx * Math.sin(-RAD) + dy * Math.cos(-RAD),
      ];
    }
    function rotRect(rx: number, ry: number, rw: number, rh: number) {
      const corners: [number, number][] = [
        rotPt(rx,      ry),      rotPt(rx + rw, ry),
        rotPt(rx + rw, ry + rh), rotPt(rx,      ry + rh),
      ];
      for (let i = 0; i < 4; i++) {
        const [x1, y1] = corners[i];
        const [x2, y2] = corners[(i + 1) % 4];
        doc.line(x1, y1, x2, y2);
      }
    }

    doc.setDrawColor(...GREEN);
    doc.setLineWidth(1.8);
    rotRect(cx - 32, cy - 10, 64, 20);
    doc.setLineWidth(0.6);
    rotRect(cx - 28, cy - 7,  56, 14);

    // Offset +8: compensa el desplazamiento visual que genera angle en jsPDF
    // (el anchor con angle positivo eleva visualmente el texto ~5mm)
    doc.setTextColor(...GREEN);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('PAGADO', cx, cy + 8, { align: 'center', angle: DEG });
  }

  // ── 8. Tarjeta MONTO TOTAL — debajo de la tabla ───────────────────────────
  const montoY = TABLE_Y + 9 + rows.length * ROW_H + 8;
  doc.setFillColor(...WHITE);
  doc.setDrawColor(...PURPLE);
  doc.setLineWidth(0.3);
  doc.roundedRect(TABLE_X, montoY, TABLE_W, 28, 4, 4, 'FD');

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...MUTED);
  doc.text('MONTO TOTAL', TABLE_X + 8, montoY + 9);

  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PURPLE);
  doc.text(fmt.format(payment.amount), TABLE_X + 8, montoY + 21);

  // ── 9. Franja inferior de acento ──────────────────────────────────────────
  gradientRect(doc, 0, 278, 210, 5);

  footer(doc);
  doc.save(`mensualidad_${payment.memberName.replace(/\s+/g, '_')}_${MONTH_NAMES[payment.month - 1]}_${payment.year}.pdf`);
}
