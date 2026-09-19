'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { apiFetch } from '@/lib/api-client';
import ModuleLoader, { useCargaMinima } from '@/components/ui/module-loader';
import ClubDetail, { type Club, type Suscripcion } from '../club-detail';

// Pantalla comun a los modulos del club. Cada ruta (informacion, finanzas) la
// monta con su propia pestaña; lo unico que cambia es que bloque se pinta.
//
// No hay endpoint para traer un club suelto, asi que se pide la lista y se
// busca el que corresponde. Es la misma consulta que ya hacia la pantalla de
// clubes, de modo que no agrega carga al servidor.

export default function ClubScreen({ id, tab }: { id: string; tab: 'info' | 'finanzas' }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  const { data, isPending: loading, error: fallo, refetch } = useQuery({
    queryKey: ['superadmin', 'club', id],
    queryFn: async () => {
      const token = await getToken();
      const [clubsRes, susRes] = await Promise.all([
        apiFetch<{ clubs: Club[] }>('/superadmin/clubs', { token }),
        apiFetch<{ clubs: { id: string; suscripcion: Suscripcion | null }[] }>('/superadmin/suscripciones', { token }),
      ]);
      const encontrado = clubsRes.clubs.find(c => c.id === id) ?? null;
      if (!encontrado) throw new Error('Este club ya no existe');
      return {
        club: encontrado,
        sus: susRes.clubs.find(c => c.id === id)?.suscripcion ?? null,
      };
    },
    enabled: isLoaded && isSignedIn,
    retry: false,
  });
  const club = data?.club ?? null;
  const sus  = data?.sus ?? null;
  const error = fallo ? (fallo instanceof Error ? fallo.message : 'Error al cargar el club') : null;
  const mostrarCarga = useCargaMinima(loading);
  const load = async () => { await refetch(); };

  // Sin sesion no hay pantalla que mostrar.
  useEffect(() => {
    if (isLoaded && !isSignedIn) router.push('/sign-in');
  }, [isLoaded, isSignedIn, router]);

  const volver = () => router.push('/superadmin/clubs');

  if (error) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center' }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1028', margin: 0 }}>{error}</p>
        <button onClick={volver}
          style={{ marginTop: 14, padding: '9px 16px', borderRadius: 12, border: '1px solid rgba(120,80,200,0.16)', background: '#fff', color: '#381DA0', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          Volver a clubes
        </button>
      </div>
    );
  }

  if (mostrarCarga || !club) return <ModuleLoader />;

  return (
    <div style={{ background: '#F7F7FB', minHeight: '100%' }}>
      <div style={{ padding: '12px 16px 80px', maxWidth: 1100, margin: '0 auto' }}>
        <ClubDetail
          club={club}
          suscripcion={sus}
          tab={tab}
          onReload={load}
          onDeleted={volver}
        />
      </div>
    </div>
  );
}
