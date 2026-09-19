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
