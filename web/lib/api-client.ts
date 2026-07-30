const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
        const text = await res.text();
        throw new ApiError(res.status, `API error ${res.status}: ${text}`);
      }
      return res.json();
    } catch (err) {
      if (err instanceof ApiError || isLastAttempt || !isIdempotent) throw err;
      await sleep(800);
    }
  }

  throw new ApiError(0, 'No se pudo conectar con el servidor');
}
