'use client';

import { useClerk } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { ShieldX } from 'lucide-react';

export default function NoAccessPage() {
  const { signOut } = useClerk();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldX className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Sin acceso</h1>
        <p className="text-slate-500 mb-6">
          Tu correo no está registrado en ningún club. Contacta a tu entrenador para que te agregue.
        </p>
        <Button variant="outline" onClick={() => signOut({ redirectUrl: '/' })}>
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}
