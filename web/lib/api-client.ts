const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export class ApiError extends Error {
  /** Cuerpo crudo de la respuesta, para diagnóstico. Nunca se muestra al usuario. */
  readonly details?: string;

  constructor(public status: number, message: string, details?: string) {
    super(message);
    this.name = 'ApiError';
    this.details = details;
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const MENSAJES_POR_ESTADO: Record<number, string> = {
  400: 'Los datos enviados no son válidos.',
  401: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  403: 'No tienes permisos para hacer esto.',
  404: 'No encontramos lo que buscabas.',
  409: 'Ese registro ya existe.',
  413: 'El archivo es demasiado grande.',
  429: 'Demasiadas solicitudes. Espera un momento e intenta de nuevo.',
};

/**
 * El mensaje que ve el usuario sale del campo `error` del backend, que está
 * redactado para personas. El cuerpo crudo se guarda aparte: antes se mostraba
 * tal cual, así que un fallo interno se filtraba a la pantalla como
 * "API error 500: {...}".
 */
function construirError(status: number, cuerpo: string): ApiError {
  let mensaje: string | undefined;
  try {
    const json = JSON.parse(cuerpo) as { error?: unknown };
    if (typeof json.error === 'string' && json.error.trim()) mensaje = json.error;
  } catch { /* no era JSON */ }

  return new ApiError(
    status,
    mensaje ?? MENSAJES_POR_ESTADO[status] ?? 'No pudimos completar la operación. Intenta de nuevo.',
    cuerpo,
  );
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const { token, headers, ...rest } = options;
  const init: RequestInit = {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  };

  // Un fallo de red deja el resultado en duda, así que solo se reintenta cuando
  // repetir la petición no puede duplicar datos. El 429 sí se reintenta siempre:
  // la petición fue rechazada sin llegar a ejecutarse.
  const method = (init.method ?? 'GET').toUpperCase();
  const isIdempotent = method === 'GET' || method === 'HEAD';

  for (let attempt = 0; attempt < 2; attempt++) {
    const isLastAttempt = attempt === 1;
    try {
      const res = await fetch(`${API_URL}${path}`, init);
      if (!res.ok) {
        if (res.status === 429 && !isLastAttempt) {
          await sleep(1500);
          continue;
        }
        throw construirError(res.status, await res.text());
      }
      return res.json();
    } catch (err) {
      if (err instanceof ApiError || isLastAttempt || !isIdempotent) throw err;
      await sleep(800);
    }
  }

  throw new ApiError(0, 'No se pudo conectar con el servidor');
}
