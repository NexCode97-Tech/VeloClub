'use client';

import { useClerk } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { PauseCircle } from 'lucide-react';

export default function InactivoPage() {
  const { signOut } = useClerk();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <PauseCircle className="w-8 h-8 text-orange-500" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Suscripción inactiva</h1>
        <p className="text-slate-500 mb-6">
          El acceso de tu club está temporalmente suspendido. Contacta al administrador de VeloClub para reactivarlo.
        </p>
        <Button variant="outline" onClick={() => signOut({ redirectUrl: '/' })}>
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}
