// Con qué pasarela paga cada club su suscripción.
//
// El cambio de Mercado Pago a Whop se prende por partes:
// - `PAGOS_WHOP_CLUBES`: ids de club separados por coma que ya pagan con Whop.
//   Sirve para probar en producción con un club antes de pasar a todos.
// - `PAGOS_PROVEEDOR=whop`: todos los clubes pagan con Whop.
//
// La decisión vive aquí, en la API, y la pantalla la recibe en
// /mercadopago/mi-suscripcion. Así se prende o se apaga sin desplegar la web.

export type Pasarela = 'whop' | 'mercadopago';

export function pasarelaDe(clubId: string): Pasarela {
  if (process.env.PAGOS_PROVEEDOR === 'whop') return 'whop';
  const lista = (process.env.PAGOS_WHOP_CLUBES ?? '').split(',').map(s => s.trim()).filter(Boolean);
  return lista.includes(clubId) ? 'whop' : 'mercadopago';
}
