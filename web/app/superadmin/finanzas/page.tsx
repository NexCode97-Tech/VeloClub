'use client';

// El módulo de Finanzas se fusionó dentro de Clubs: cada club abre su detalle
// con los tabs Información / Finanzas. Este archivo solo redirige por si alguien
// tiene el enlace antiguo guardado.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FinanzasRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/superadmin/clubs'); }, [router]);
  return (
    <div style={{ background: '#F7F7FB', minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(124,58,237,0.15)', borderTopColor: '#7C3AED', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );
}
