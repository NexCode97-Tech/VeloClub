'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { apiFetch } from '@/lib/api-client';
import ModuleLoader, { useCargaMinima } from '@/components/ui/module-loader';
import ClubDetail, { type Club, type Suscripcion } from '../club-detail';
import { useClubActivo } from '../../club-context';

// Pantalla comun a los modulos del club. Cada ruta (informacion, finanzas) la
// monta con su propia pestaña; lo unico que cambia es que bloque se pinta.
//
// No hay endpoint para traer un club suelto, asi que se pide la lista y se
// busca el que corresponde. Es la misma consulta que ya hacia la pantalla de
// clubes, de modo que no agrega carga al servidor.

export default function ClubScreen({ id, tab }: { id: string; tab: 'info' | 'finanzas' }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const { setClubActivo } = useClubActivo();

  const [club, setClub]   = useState<Club | null>(null);
  const [sus, setSus]     = useState<Suscripcion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mostrarCarga = useCargaMinima(loading);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const [clubsRes, susRes] = await Promise.all([
        apiFetch<{ clubs: Club[] }>('/superadmin/clubs', { token }),
        apiFetch<{ clubs: { id: string; suscripcion: Suscripcion | null }[] }>('/superadmin/suscripciones', { token }),
      ]);
      const encontrado = clubsRes.clubs.find(c => c.id === id) ?? null;
      if (!encontrado) { setError('Este club ya no existe'); return; }
      setClub(encontrado);
      setSus(susRes.clubs.find(c => c.id === id)?.suscripcion ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar el club');
    } finally { setLoading(false); }
  }, [getToken, id]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { router.push('/sign-in'); return; }
    load();
  }, [isLoaded, isSignedIn, load, router]);

  // Publica el club para que el sidebar muestre su nombre y su logo. No se
  // limpia al desmontar: cambiar de modulo desmonta esta pantalla y montaria la
  // siguiente con el dato vacio, haciendo parpadear el nombre en el sidebar.
  // Quien decide si el dato aplica es la ruta, comparando el id.
  useEffect(() => {
    if (club) setClubActivo({ id: club.id, name: club.name, logoUrl: club.logoUrl ?? null });
  }, [club, setClubActivo]);

  const volver = () => router.push('/superadmin/clubs');

  if (error) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center' }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1028', margin: 0 }}>{error}</p>
        <button onClick={volver}
          style={{ marginTop: 14, padding: '9px 16px', borderRadius: 12, border: '1px solid rgba(120,80,200,0.16)', background: '#fff', color: '#7C3AED', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
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
