'use client';

import { useAuth, useClerk } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { PauseCircle, ShieldCheck, Database, ArrowRight } from 'lucide-react';
import SuscripcionCard from '@/components/ajustes/suscripcion-card';

export default function InactivoPage() {
  const { signOut } = useClerk();
  const { getToken } = useAuth();
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const res = await apiFetch<{ status: string; role?: string }>('/me', { token });
        // Si ya no está inactivo (pagó, o el superadmin lo reactivó), volver al panel
        if (res.status === 'ok' || res.status === 'complete_profile') {
          router.replace('/dashboard');
          return;
        }
        setRole(res.role ?? null);
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

  // ── Admin: pantalla de reactivación con pago dentro de la página ───────────
  if (role === 'ADMIN') {
    return (
      <div className="min-h-screen bg-slate-50 py-10 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ background: 'rgba(239,71,111,0.10)' }}>
              <PauseCircle className="w-7 h-7" style={{ color: '#EF476F' }} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-1">
              Tu club está pausado
            </h1>
            <p className="text-slate-500 text-sm">
              Tu plan venció y no se recibió un nuevo pago. Actívalo aquí mismo para retomar donde quedaste.
            </p>
          </div>

          <div className="flex justify-center gap-5 mb-6">
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-600">
              <Database className="w-3.5 h-3.5" style={{ color: '#06D6A0' }} />
              Tus datos están intactos
            </div>
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-600">
              <ShieldCheck className="w-3.5 h-3.5" style={{ color: '#06D6A0' }} />
              Pago seguro con Mercado Pago
            </div>
          </div>

          <SuscripcionCard />

          <div className="flex items-center justify-center gap-4 mt-6">
            <Button variant="outline" onClick={() => router.push('/dashboard')} className="gap-1.5">
              Ya activé mi plan — entrar al panel <ArrowRight className="w-3.5 h-3.5" />
            </Button>
            <button
              onClick={() => signOut({ redirectUrl: '/' })}
              className="text-[13px] font-semibold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Coach / deportista: no pueden pagar — avisar al admin ──────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: 'rgba(239,71,111,0.10)' }}>
          <PauseCircle className="w-8 h-8" style={{ color: '#EF476F' }} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Suscripción inactiva</h1>
        <p className="text-slate-500 mb-6">
          El acceso de tu club está temporalmente suspendido. Pídele al administrador que active el plan desde Ajustes para seguir usando VeloClub.
        </p>
        <Button variant="outline" onClick={() => signOut({ redirectUrl: '/' })}>
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}
