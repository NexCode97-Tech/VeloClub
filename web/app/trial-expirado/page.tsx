'use client';

import { useClerk } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Timer } from 'lucide-react';

export default function TrialExpiradoPage() {
  const { signOut } = useClerk();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: 'rgba(255,183,3,0.12)' }}>
          <Timer className="w-8 h-8" style={{ color: '#FFB703' }} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          Período de prueba vencido
        </h1>
        <p className="text-slate-500 mb-2">
          Tu período de prueba de 15 días ha terminado.
        </p>
        <p className="text-slate-500 mb-6">
          Contacta a{' '}
          <a
            href="https://nexcode97.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-violet-600 hover:underline"
          >
            NexCode97
          </a>{' '}
          para activar tu plan y continuar usando VeloClub.
        </p>
        <Button variant="outline" onClick={() => signOut({ redirectUrl: '/' })}>
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}
