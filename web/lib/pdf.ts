import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const PRIMARY   = [67, 97, 238]  as [number, number, number];
const DARK      = [26, 16, 40]   as [number, number, number];
const MUTED     = [142, 135, 168] as [number, number, number];

function header(doc: jsPDF, clubName: string, title: string, subtitle?: string) {
  // Barra superior
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, 210, 18, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(clubName, 14, 12);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }), 196, 12, { align: 'right' });

  // Título
  doc.setTextColor(...DARK);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 30);
  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    doc.text(subtitle, 14, 37);
  }
}

function footer(doc: jsPDF) {
  const pageCount = (doc as jsPDF & { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(`Página ${i} de ${pageCount}  ·  VeloClub`, 105, 290, { align: 'center' });
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

  header(doc, clubName, 'Lista de miembros', `${members.length} miembro${members.length !== 1 ? 's' : ''} registrado${members.length !== 1 ? 's' : ''}`);

  autoTable(doc, {
    startY: 43,
    head: [['Nombre', 'Correo', 'Teléfono', 'Rol', 'Categoría', 'Nivel', 'Sedes']],
    body: members.map(m => [
      m.fullName,
      m.email ?? '—',
      m.phone ?? '—',
      ROLES[m.role] ?? m.role,
      m.category ?? '—',
      m.tipo ?? '—',
      m.locations.map(l => l.location.name).join(', ') || '—',
    ]),
    headStyles: {
      fillColor: PRIMARY,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: { fontSize: 8, textColor: DARK },
    alternateRowStyles: { fillColor: [245, 243, 255] },
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 40 },
      2: { cellWidth: 24 },
      3: { cellWidth: 22 },
      4: { cellWidth: 26 },
      5: { cellWidth: 20 },
      6: { cellWidth: 22 },
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

export function downloadInvoicePDF(payment: PaymentInvoice, clubName: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

  header(doc, clubName, 'Factura de mensualidad', `${MONTH_NAMES[payment.month - 1]} ${payment.year}`);

  // Recuadro principal
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.4);
  doc.roundedRect(14, 44, 182, 80, 3, 3, 'S');

  // Contenido del recuadro
  const rows: [string, string][] = [
    ['Deportista',    payment.memberName],
    ['Concepto',      `Mensualidad ${MONTH_NAMES[payment.month - 1]} ${payment.year}`],
    ['Monto',         fmt.format(payment.amount)],
    ['Estado',        STATUS_ES[payment.status] ?? payment.status],
    ['Fecha de pago', payment.paidAt
      ? new Date(payment.paidAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
      : '—'],
    ['Referencia',    `#${payment.id.slice(-8).toUpperCase()}`],
  ];

  if (payment.notes) rows.push(['Notas', payment.notes]);

  let y = 54;
  rows.forEach(([label, value], i) => {
    if (i % 2 === 0) {
      doc.setFillColor(245, 243, 255);
      doc.rect(14, y - 5, 182, 10, 'F');
    }
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...MUTED);
    doc.text(label.toUpperCase(), 20, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK);
    doc.setFontSize(10);
    if (label === 'Monto') {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...PRIMARY);
    }
    doc.text(value, 80, y);
    y += 12;
  });

  // Sello de estado
  if (payment.status === 'PAID') {
    doc.setDrawColor(6, 214, 160);
    doc.setLineWidth(1.5);
    doc.setTextColor(6, 214, 160);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('PAGADO', 150, 100, { angle: 20 });
    doc.roundedRect(136, 80, 48, 20, 3, 3, 'S');
  }

  footer(doc);
  doc.save(`mensualidad_${payment.memberName.replace(/\s+/g, '_')}_${MONTH_NAMES[payment.month - 1]}_${payment.year}.pdf`);
}
