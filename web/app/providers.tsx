'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

// El worker de la PWA vive en /sw.js. Cualquier otro registro es heredado de
// versiones anteriores y es el que hay que limpiar.
const SW_ACTUAL = '/sw.js';

function esHeredado(reg: ServiceWorkerRegistration) {
  const sw = reg.active ?? reg.waiting ?? reg.installing;
  if (!sw) return false;      // sin worker todavía: se está registrando, no se toca
  try {
    return new URL(sw.scriptURL).pathname !== SW_ACTUAL;
  } catch {
    return false;
  }
}

// Limpia una única vez los service workers y cachés heredados de versiones
// anteriores. Hacerlo en cada carga competía con el registro del worker de la
// PWA y provocaba AbortError al registrar /sw.js.
//
// Y desregistrarlos todos, incluido el de la PWA, provocaba otra cosa peor:
// workbox se quedaba con un registro que ya no existía y reventaba al leer
// registration.waiting dentro de su handler de statechange. Le pasaba sobre
// todo a quien entraba por primera vez, que es justo quien no tiene nada
// heredado que limpiar. Por eso ahora se filtra por el script del worker: el
// de la PWA se deja en paz y solo se van los que apuntan a otro archivo.
function usePurgeLegacyServiceWorkers() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (localStorage.getItem('sw-purged')) return;
    localStorage.setItem('sw-purged', '1');
    navigator.serviceWorker.getRegistrations()
      .then(regs => {
        const heredados = regs.filter(esHeredado);
        if (!heredados.length) return;     // nada que limpiar: no se toca nada
        heredados.forEach(reg => reg.unregister());
        // Las cachés solo se vacían si de verdad había algo viejo. Borrarlas
        // siempre le tiraba abajo la caché recién creada a cada visitante nuevo.
        caches.keys()
          .then(keys => keys.forEach(key => caches.delete(key)))
          .catch(() => {});
      })
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
