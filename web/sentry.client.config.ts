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
    // Lo provoca el traductor del navegador y las extensiones que reordenan el
    // DOM por debajo de React: el nodo que React quiere quitar ya no esta donde
    // lo dejo. Es el segundo issue mas numeroso del proyecto y no hay una sola
    // linea nuestra que cambiar; con el traductor apagado no ocurre.
    "Failed to execute 'removeChild' on 'Node'",
    // El script de Clerk vive en su CDN. Que no cargue es la conexion del
    // usuario o una caida de ellos, no un fallo de la app, y ya se maneja: la
    // pantalla de Ajustes espera a que Clerk este listo antes de dejar pulsar.
    'Failed to load Clerk',
  ],
  // Una respuesta 401 o 404 de la API no es un fallo de software: es la
  // respuesta correcta a una sesion que vencio o a un registro que ya no esta,
  // que es lo que pasa cuando alguien deja una pestaña abierta o borra algo en
  // otro dispositivo. Llegaban aca por el manejador global de promesas y eran
  // los issues mas numerosos del proyecto, con cero usuarios afectados; tapaban
  // los errores de verdad.
  //
  // Los 400 y 403 si se dejan pasar a proposito: significan que la interfaz
  // mando algo que la API rechazo, y eso si es un bug nuestro. Los 5xx tambien,
  // por razones obvias.
  beforeSend(evento, pista) {
    const err = pista?.originalException as
      { name?: string; status?: number; message?: string } | undefined;
    if (err?.name === 'ApiError' && (err.status === 401 || err.status === 404)) return null;

    // «Error: Rejected», sin mensaje ni traza util, en las pantallas de acceso.
    // Es una promesa que Clerk rechaza cuando alguien cierra su ventana o se
    // queda sin red a mitad del ingreso. Se descarta solo ahi y no por el texto
    // suelto, que es demasiado generico para filtrarlo en toda la aplicacion.
    const ruta = evento.transaction ?? '';
    if (err?.message === 'Rejected' && ruta.includes('sign-in')) return null;

    return evento;
  },
});
