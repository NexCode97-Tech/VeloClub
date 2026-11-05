import * as Sentry from '@sentry/nextjs';

/**
 * Arranque de Sentry en el servidor de Next.
 *
 * Next llama `register` al iniciar cada entorno, y desde la versión 10 de
 * `@sentry/nextjs` es la única forma de que carguen `sentry.server.config.ts` y
 * `sentry.edge.config.ts`. Sin este archivo los dos existían y no se usaban.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('./sentry.server.config');
  if (process.env.NEXT_RUNTIME === 'edge') await import('./sentry.edge.config');
}

// Errores al renderizar en el servidor: páginas, rutas y acciones.
export const onRequestError = Sentry.captureRequestError;
