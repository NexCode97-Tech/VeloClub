'use client';

import { useEffect, useRef } from 'react';
import { useSession } from '@clerk/nextjs';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const SSE_EVENTS = [
  'members', 'payments', 'attendance', 'cashflow',
  'calendar', 'competitions', 'training', 'posts',
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

    async function connect() {
      if (destroyed) return;
      try {
        const token = await session!.getToken();
        if (destroyed || !token) return;

        es = new EventSource(`${API_URL}/stream?token=${token}`);

        SSE_EVENTS.forEach(ev => {
          es!.addEventListener(ev, () => {
            if (!destroyed) onEventRef.current(ev);
          });
        });

        es.onerror = () => {
          es?.close();
          es = null;
          if (!destroyed) {
            // Reintentar en 3s
            retryTimeout = setTimeout(connect, 3_000);
          }
        };
      } catch {
        if (!destroyed) {
          retryTimeout = setTimeout(connect, 5_000);
        }
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
