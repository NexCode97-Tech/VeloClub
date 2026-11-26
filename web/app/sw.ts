/// <reference lib="webworker" />
/// <reference types="@serwist/next/typings" />

/**
 * El service worker de la aplicación instalada.
 *
 * Lo arma Serwist al compilar y queda en `public/sw.js`, la misma dirección de
 * siempre: los celulares que ya tienen la app instalada llevan ese worker
 * registrado, y moverlo de sitio dejaría dos vivos a la vez, el viejo sirviendo
 * lo que ya no existe.
 *
 * Reemplaza a @ducanh2912/next-pwa, que no se actualiza desde 2024.
 */
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { CacheFirst, ExpirationPlugin, NetworkOnly, Serwist, StaleWhileRevalidate } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Clerk nunca se guarda: una sesión servida de caché es una sesión vieja.
    {
      matcher: /^https:\/\/clerk\.veloclubtech\.com\/.*/i,
      handler: new NetworkOnly(),
    },
    {
      matcher: /^https:\/\/[\w-]+\.clerk\.accounts\.dev\/.*/i,
      handler: new NetworkOnly(),
    },
    // La API tampoco. Van las dos, producción y la de demostración: la segunda
    // faltaba en la configuración vieja.
    {
      matcher: /^https:\/\/[\w-]*veloclub[\w-]*\.up\.railway\.app\/.*/i,
      handler: new NetworkOnly(),
    },
    // Los archivos de Next llevan el hash en el nombre, así que el que está
    // guardado siempre es el que se pidió.
    {
      matcher: /^\/_next\/static\/.*/i,
      handler: new CacheFirst({
        cacheName: 'next-static',
        plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 })],
      }),
    },
    {
      matcher: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
      handler: new StaleWhileRevalidate({
        cacheName: 'images',
        plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 })],
      }),
    },
  ],
});

serwist.addEventListeners();

// ── Notificaciones push ──────────────────────────────────────────────────────
// Las manda el servidor (api/src/lib/push.ts) y llegan aunque la app esté
// cerrada. En iPhone y iPad solo con VeloClub en la pantalla de inicio.

interface AvisoPush {
  titulo?: string;
  cuerpo?: string;
  link?: string;
  etiqueta?: string;
}

/** Solo rutas de la propia app: un enlace de afuera no se abre desde un aviso. */
function rutaSegura(link: unknown): string {
  return typeof link === 'string' && link.startsWith('/') && !link.startsWith('//') ? link : '/inicio';
}

self.addEventListener('push', (event) => {
  let aviso: AvisoPush = {};
  try {
    aviso = event.data?.json() ?? {};
  } catch {
    aviso = { cuerpo: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(aviso.titulo || 'VeloClub', {
      body: aviso.cuerpo || '',
      icon: '/icon-desktop-192.png',
      badge: '/favicon.png',
      // Un aviso nuevo del mismo asunto reemplaza al anterior en vez de apilarse.
      tag: aviso.etiqueta,
      data: { link: rutaSegura(aviso.link) },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = new URL(rutaSegura((event.notification.data as { link?: string } | null)?.link), self.location.origin).href;
  event.waitUntil((async () => {
    // Si la app ya está abierta, se usa esa ventana en vez de abrir otra.
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const v of ventanas) {
      if (new URL(v.url).origin === self.location.origin && 'focus' in v) {
        await v.navigate(destino).catch(() => undefined);
        return v.focus();
      }
    }
    return self.clients.openWindow(destino);
  })());
});
