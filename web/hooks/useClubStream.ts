'use client';

import { useEffect, useRef } from 'react';
import { useSession } from '@clerk/nextjs';
import { apiFetch } from '@/lib/api-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const SSE_EVENTS = [
  'members', 'payments', 'attendance', 'cashflow',
  'calendar', 'competitions', 'training', 'posts', 'notifications',
] as const;

export type SSEEvent = typeof SSE_EVENTS[number];

/**
 * Suscribe al stream SSE del club autenticado.
 * Cuando el servidor emite un evento, llama onEvent con el nombre del evento.
 * Se reconecta automáticamente si la conexión se cae.
 */
export function useClubStream(onEvent: (event: SSEEvent) => void) {
  const { session, isLoaded } = useSession();
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!isLoaded || !session) return;

    let es: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let destroyed = false;
    let intentos = 0;

    // Retroceso exponencial: cada reconexión pide un ticket y abre el stream, así
    // que reintentar cada 3s indefinidamente agotaba el límite de peticiones.
    function reintentar() {
      if (destroyed) return;
      const espera = Math.min(3_000 * 2 ** intentos, 60_000);
      intentos++;
      retryTimeout = setTimeout(connect, espera);
    }

    async function connect() {
      if (destroyed) return;
      try {
        const token = await session!.getToken();
        if (destroyed || !token) return;

        // El JWT viaja en la cabecera y solo el ticket, de un uso y un minuto de
        // vida, queda en la URL del stream.
        const { ticket } = await apiFetch<{ ticket: string }>('/stream/ticket', {
          method: 'POST', token,
        });
        if (destroyed || !ticket) return;

        es = new EventSource(`${API_URL}/stream?ticket=${encodeURIComponent(ticket)}`);

        es.addEventListener('connected', () => { intentos = 0; });

        SSE_EVENTS.forEach(ev => {
          es!.addEventListener(ev, () => {
            if (!destroyed) onEventRef.current(ev);
          });
        });

        es.onerror = () => {
          es?.close();
          es = null;
          reintentar();
        };
      } catch {
        reintentar();
      }
    }

    connect();

    return () => {
      destroyed = true;
      if (retryTimeout) clearTimeout(retryTimeout);
      es?.close();
    };
  }, [isLoaded, session]);
}
