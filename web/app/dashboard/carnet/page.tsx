'use client';

import { useSession } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import ModuleLoader, { useCargaMinima } from '@/components/ui/module-loader';
import ModuleReveal from '@/components/ui/module-reveal';
import { DatosCarnet } from '@/lib/carnet';
import { CarnetTarjetas, BotonesCarnet } from '@/components/miembros/carnet-tarjetas';

/**
 * Mi carnet.
 *
 * El carnet que el club puede sacar de la lista de miembros no sirve el domingo
 * en una pista, que es justo cuando se necesita. Por eso el deportista tiene el
 * suyo, en su propia app y sin pedírselo a nadie.
 *
 * Es pantalla y no una ventana como en Miembros, porque acá el carnet es el
 * contenido, no un detalle de otra cosa.
 */

export default function CarnetPage() {
  const { session } = useSession();
  const [datos, setDatos] = useState<DatosCarnet | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const mostrarCarga = useCargaMinima(cargando);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const token = await session?.getToken();
        // La ficha propia primero: la ruta del carnet va por id, y el
        // deportista no conoce el suyo.
        const yo = await apiFetch<{ member: { id: string } | null }>('/members/me', { token });
        const id = yo.member?.id;
        if (!id) {
          if (vivo) setError('Tu cuenta todavía no está vinculada a una ficha del club.');
          return;
        }
        const res = await apiFetch<{ carnet: DatosCarnet }>(`/members/${id}/carnet`, { token });
        if (vivo) setDatos(res.carnet);
      } catch {
        if (vivo) setError('No se pudo cargar tu carnet.');
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => { vivo = false; };
  }, [session]);

  if (mostrarCarga) return <ModuleLoader />;

  return (
    <ModuleReveal>
      <div className="px-5 pt-4 pb-8 max-w-3xl mx-auto w-full flex flex-col gap-4">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight text-foreground m-0">Mi carnet</h1>
          <p className="text-[12.5px] text-muted-foreground m-0 mt-0.5">
            Guárdalo en el celular. El reverso es el que hace falta si pasa algo en un entrenamiento.
          </p>
        </div>

        {error && (
          <p className="text-[12.5px] m-0 rounded-xl px-3 py-2.5"
            style={{ background: 'rgba(198,47,80,0.08)', color: '#C62F50' }}>
            {error}
          </p>
        )}

        {datos && (
          <>
            <CarnetTarjetas datos={datos} />
            <BotonesCarnet datos={datos} onError={setError} />
          </>
        )}
      </div>
    </ModuleReveal>
  );
}
