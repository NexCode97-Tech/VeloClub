// Recordatorio de mensualidad por WhatsApp. Abre el WhatsApp del propio admin
// con el mensaje ya escrito; el remitente es su número, no un número del sistema.
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const fmtCOP = new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0,
});

export function buildWhatsAppUrl(
  phone: string,
  memberName: string,
  amount: number,
  month: number,
  year: number,
  clubName: string,
): string {
  const clean = phone.replace(/\D/g, '');
  const normalized = clean.startsWith('57') ? clean : `57${clean}`;
  const monto = fmtCOP.format(amount);
  const text = encodeURIComponent(
    `Hola, soy del ${clubName}. Le recordamos que la mensualidad de ${memberName} de ${MONTH_NAMES[month - 1]} ${year} por ${monto} está pendiente. Por favor comuníquese con nosotros. ¡Gracias!`
  );
  return `https://wa.me/${normalized}?text=${text}`;
}
