/**
 * Directivas de la Content Security Policy.
 *
 * Vive aquí y no en next.config.ts porque la política se emite desde el
 * middleware de Clerk: solo ahí se puede generar un nonce por petición, y el
 * nonce es lo que permite quitar el peso a `'unsafe-inline'` en script-src.
 * Clerk fusiona estas directivas con las suyas, agrega `'strict-dynamic'` y el
 * nonce, y pone la cabecera tanto en la respuesta como en la petición, que es
 * como Next firma sus propios scripts.
 *
 * Con `'strict-dynamic'` los navegadores modernos ignoran la lista de dominios de
 * script-src y confían en los scripts que cargue un script ya confiable. La lista
 * se conserva de todos modos como respaldo para navegadores viejos.
 */
type Directivas = Record<string, string[]>;

export const CSP_DIRECTIVES: Directivas = {
  'default-src': ["'self'"],

  // Clerk (dominio propio), Cloudflare (CAPTCHA de Clerk), Google Maps y el SDK
  // de tokenización de tarjeta de Mercado Pago.
  'script-src': [
    "'self'",
    'https://clerk.veloclubtech.com',
    'https://*.clerk.accounts.dev',
    'https://challenges.cloudflare.com',
    'https://maps.googleapis.com',
    'https://sdk.mercadopago.com',
    'https://http2.mlstatic.com',
  ],

  // Tailwind y framer-motion escriben estilos en línea; no hay forma de evitarlo
  // y el riesgo no es comparable al de un script.
  'style-src': ["'self'", "'unsafe-inline'"],

  'img-src': [
    "'self'", 'data:', 'blob:',
    'https://img.clerk.com',
    'https://images.clerk.dev',
    'https://res.cloudinary.com',
    'https://maps.gstatic.com',
    'https://maps.googleapis.com',
    'https://*.googleapis.com',
    'https://*.googleusercontent.com',
    'https://purecatamphetamine.github.io',
    'https://http2.mlstatic.com',
    'https://www.mercadolibre.com',
    'https://www.mercadolivre.com',
  ],

  'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],

  'connect-src': [
    "'self'",
    'https://veloclub-production.up.railway.app',
    'https://clerk.veloclubtech.com',
    'https://*.clerk.accounts.dev',
    'https://challenges.cloudflare.com',
    'https://api.cloudinary.com',
    'https://res.cloudinary.com',
    'https://maps.googleapis.com',
    'https://*.googleapis.com',
    'https://nominatim.openstreetmap.org',
    'https://*.sentry.io',
    'https://api.mercadopago.com',
    'https://sdk.mercadopago.com',
    'https://http2.mlstatic.com',
    'https://events.mercadopago.com',
    'https://www.mercadolibre.com',
    'https://www.mercadolivre.com',
  ],

  'frame-src': [
    "'self'",
    'https://clerk.veloclubtech.com',
    'https://*.clerk.accounts.dev',
    'https://challenges.cloudflare.com',
    'https://maps.google.com',
    'https://www.google.com',
    'https://www.mercadolibre.com',
    'https://www.mercadolivre.com',
  ],

  // Video del feed: se sirve desde Cloudinary y se previsualiza como blob local
  'media-src': ["'self'", 'blob:', 'https://res.cloudinary.com'],

  // Service worker de la PWA ('self') y workers de Clerk (blob:)
  'worker-src': ["'self'", 'blob:'],

  'manifest-src': ["'self'"],

  // La app no se puede embeber en iframes externos ni ejecuta plugins
  'frame-ancestors': ["'none'"],
  'object-src': ["'none'"],

  // Impide que una inyección de <base> reescriba las rutas relativas
  'base-uri': ["'self'"],
  // Los formularios se envían por fetch a la API; nada sale a otro origen
  'form-action': ["'self'"],

  // Sin valores: fuerza HTTPS en cualquier subrecurso que quedara en http
  'upgrade-insecure-requests': [],
};
