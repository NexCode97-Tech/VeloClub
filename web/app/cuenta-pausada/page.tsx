'use client';

import { useAuth, useClerk } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { PauseCircle, Database } from 'lucide-react';

/**
 * Deportista desactivado por su club (pausa de vacaciones).
 *
 * Es una página aparte de /inactivo a propósito: ahí el club entero está
 * suspendido por falta de pago, aquí el club sigue funcionando y el único
 * pausado es él. Confundir los dos mensajes haría que un deportista de
 * vacaciones crea que su club cerró.
 */
export default function CuentaPausadaPage() {
  const { signOut } = useClerk();
  const { getToken } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const res = await apiFetch<{ status: string }>('/me', { token });
        // Si el club ya lo reactivó, entrar directo sin que tenga que hacer nada
        if (res.status === 'ok' || res.status === 'complete_profile') {
          router.replace('/dashboard');
          return;
        }
      } catch { /* se muestra la vista genérica */ }
      finally { setChecking(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (checking) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: 'rgba(56,29,160,0.10)' }}>
          <PauseCircle className="w-8 h-8" style={{ color: '#381DA0' }} />
        </div>
        <h1 className="text-2xl font-semibold text-slate-900 mb-2">Tu cuenta está en pausa</h1>
        <p className="text-slate-500 mb-4">
          Tu club pausó tu cuenta por ahora. Cuando vuelvas a entrenar, pídele al administrador que la reactive y entras de nuevo con todo tu historial.
        </p>
        <div className="flex items-center justify-center gap-1.5 text-[12px] font-semibold text-slate-600 mb-6">
          <Database className="w-3.5 h-3.5" style={{ color: '#06D6A0' }} />
          Tus asistencias, resultados y pagos siguen guardados
        </div>
        <Button variant="outline" onClick={() => signOut({ redirectUrl: '/' })}>
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}
