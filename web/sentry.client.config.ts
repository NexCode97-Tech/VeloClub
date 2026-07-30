import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.05,
  // Las grabaciones de sesión salen a un tercero y las pantallas muestran datos
  // personales de deportistas (muchos menores de edad): nombres, teléfonos,
  // documentos, montos y comprobantes. Se enmascara todo por defecto.
  integrations: [
    Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
  ],
  // Cortes de red del dispositivo del usuario y cancelaciones del navegador. No
  // son fallos de la app y ya se mitigan con el reintento de apiFetch, así que
  // solo generarían ruido que tapa los errores reales.
  ignoreErrors: [
    'Failed to fetch',
    'NetworkError',
    'Network request failed',
    'Load failed',
    'ClerkJS: Network error',
    'AbortError',
  ],
});
