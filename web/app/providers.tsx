'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

// Limpia una única vez los service workers y cachés heredados de versiones
// anteriores. Hacerlo en cada carga competía con el registro del worker de la
// PWA y provocaba AbortError al registrar /sw.js.
function usePurgeLegacyServiceWorkers() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (localStorage.getItem('sw-purged')) return;
    localStorage.setItem('sw-purged', '1');
    navigator.serviceWorker.getRegistrations()
      .then(regs => regs.forEach(reg => reg.unregister()))
      .catch(() => {});
    caches.keys()
      .then(keys => keys.forEach(key => caches.delete(key)))
      .catch(() => {});
  }, []);
}

export function Providers({ children }: { children: React.ReactNode }) {
  usePurgeLegacyServiceWorkers();
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,   // 5 min: muestra caché al navegar, refetch en bg si es necesario
        gcTime:   10 * 60 * 1000,   // 10 min: mantiene datos en memoria aunque el componente se desmonte
        retry: 1,
        refetchOnWindowFocus: false, // no refetch al volver al tab — SSE ya notifica cambios
      },
    },
  }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
