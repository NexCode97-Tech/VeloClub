'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

// El sidebar vive en el layout y la pantalla del club vive una capa mas abajo,
// asi que no puede leerle el estado. La URL ya dice a que club entramos, pero
// no su nombre ni su logo, y volver a pedirlos desde el layout significaria
// repetir la misma consulta que la pantalla ya hizo. Este contexto es el puente:
// la pantalla publica lo que cargo y el sidebar lo lee.

export interface ClubActivo {
  id: string;
  name: string;
  logoUrl: string | null;
}

interface ClubContextValue {
  clubActivo: ClubActivo | null;
  setClubActivo: (c: ClubActivo | null) => void;
}

const ClubContext = createContext<ClubContextValue>({
  clubActivo: null,
  setClubActivo: () => {},
});

export function ClubProvider({ children }: { children: ReactNode }) {
  const [clubActivo, setClubActivo] = useState<ClubActivo | null>(null);
  const value = useMemo(() => ({ clubActivo, setClubActivo }), [clubActivo]);
  return <ClubContext.Provider value={value}>{children}</ClubContext.Provider>;
}

export function useClubActivo(): ClubContextValue {
  return useContext(ClubContext);
}

/**
 * Extrae el id del club de la ruta. Devuelve null fuera del detalle de un club,
 * incluida la lista, para que el sidebar sepa cuando volver a su forma global.
 */
export function idClubDeRuta(pathname: string): string | null {
  const m = pathname.match(/^\/superadmin\/clubs\/([^/]+)/);
  return m ? m[1] : null;
}

/** Modulos que se muestran en el sidebar mientras estas dentro de un club. */
export const MODULOS_CLUB = [
  { slug: '',         label: 'Información' },
  { slug: 'finanzas', label: 'Finanzas'    },
] as const;
