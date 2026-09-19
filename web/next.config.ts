import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// La API a la que habla este despliegue, sacada de su propia variable. La de
// producción va escrita abajo de todas formas; esta es para el entorno de
// demostración, que tiene su propia API y sin esto el navegador la bloquea.
// Si la variable no trae una dirección válida, no se agrega nada.
const API_ORIGEN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? '').origin;
  } catch {
    return '';
  }
})();
const PRODUCCION_API = 'https://veloclub-production.up.railway.app';
const API_EXTRA = API_ORIGEN && API_ORIGEN !== PRODUCCION_API ? ` ${API_ORIGEN}` : '';

const CSP = [
  "default-src 'self'",
  // Scripts: propio dominio + Clerk + Mercado Pago (SDK de tokenización de tarjeta) + Cloudflare (CAPTCHA anti-bot de Clerk)
  // Sin el comodín de googleapis: el único script de Google que se carga es el de
  // Maps, y un comodín convierte todo el ecosistema de APIs de Google en origen
  // de script confiable.
  "script-src 'self' 'unsafe-inline' https://clerk.veloclubtech.com https://*.clerk.accounts.dev https://challenges.cloudflare.com https://maps.googleapis.com https://sdk.mercadopago.com https://http2.mlstatic.com",
  // Estilos: propio dominio + inline (Tailwind/shadcn lo requieren)
  "style-src 'self' 'unsafe-inline'",
  // Imágenes: propio dominio + Clerk + Cloudinary + Google Maps + Google User Content (fotos de perfil OAuth)
  "img-src 'self' data: blob: https://img.clerk.com https://images.clerk.dev https://res.cloudinary.com https://maps.gstatic.com https://maps.googleapis.com https://*.googleapis.com https://*.googleusercontent.com https://purecatamphetamine.github.io https://http2.mlstatic.com https://www.mercadolibre.com https://www.mercadolivre.com",
  // Fuentes: solo propio dominio + Google Maps
  "font-src 'self' data: https://fonts.gstatic.com",
  // Conexiones: propio dominio + API Railway + Clerk + Cloudflare (CAPTCHA anti-bot) + Cloudinary + Google Maps + Nominatim (geocodificación) + Mercado Pago (tokenización de tarjeta y fingerprint anti-fraude desde el navegador)
  `connect-src 'self' ${PRODUCCION_API}${API_EXTRA} https://clerk.veloclubtech.com https://*.clerk.accounts.dev https://challenges.cloudflare.com https://api.cloudinary.com https://res.cloudinary.com https://maps.googleapis.com https://*.googleapis.com https://nominatim.openstreetmap.org https://*.sentry.io https://api.mercadopago.com https://sdk.mercadopago.com https://http2.mlstatic.com https://events.mercadopago.com https://www.mercadolibre.com https://www.mercadolivre.com`,
  // Frames: Clerk (UI embebida) + Cloudflare (CAPTCHA anti-bot) + Google Maps (embeds) + Mercado Pago (iframe de fingerprint anti-fraude)
  "frame-src https://clerk.veloclubtech.com https://*.clerk.accounts.dev https://challenges.cloudflare.com https://maps.google.com https://www.google.com https://www.mercadolibre.com https://www.mercadolivre.com",
  // No permitir embeber la app en iframes externos
  "frame-ancestors 'none'",
  // Workers: PWA service worker ('self') + Clerk web workers (blob:)
  "worker-src 'self' blob:",
  // No ejecutar plugins (Flash, etc.)
  "object-src 'none'",
  // Impide que una inyección de <base> reescriba el destino de las rutas relativas
  "base-uri 'self'",
  // Los formularios se envían por fetch a la API; ningún envío sale a otro origen
  "form-action 'self'",
  // Manifiesto de la PWA
  "manifest-src 'self'",
  // Video del feed: se sirve desde Cloudinary y se previsualiza como blob local
  "media-src 'self' blob: https://res.cloudinary.com",
  // Fuerza HTTPS en cualquier subrecurso que quedara apuntando a http
  "upgrade-insecure-requests",
].join('; ');

const nextConfig: NextConfig = {
  // Los modulos salieron de /dashboard y quedaron en la raiz. Esto es para los
  // que ya tenian la direccion vieja: un enlace guardado, una notificacion
  // enviada antes del cambio, o la app instalada en el telefono, que arranca
  // en la direccion que se le grabo el dia que se instalo.
  //
  // Permanente y no temporal porque la direccion vieja no vuelve.
  async redirects() {
    return [
      { source: '/dashboard', destination: '/inicio', permanent: true },
      { source: '/dashboard/:ruta*', destination: '/:ruta*', permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: CSP },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Se niegan las capacidades del navegador que la app no usa. La
          // geolocalización sí se conserva: el selector de sedes la necesita.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=(), usb=(), magnetometer=(), accelerometer=()' },
          // Evita resolver por DNS los dominios de terceros que aparezcan en enlaces
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'img.clerk.com' },
      { protocol: 'https', hostname: 'images.clerk.dev' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
};

// La PWA ya no pasa por aca. El worker lo arma el CLI de Serwist despues del
// build, con lo que hay en serwist.config.js, y asi el compilador queda libre.
const pwaConfig = nextConfig;

export default withSentryConfig(pwaConfig, {
  org: 'nexcode97',
  project: 'veloclub-web',
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
  automaticVercelMonitors: true,
});
