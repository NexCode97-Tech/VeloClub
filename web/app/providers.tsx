'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
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
