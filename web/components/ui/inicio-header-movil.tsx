'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Settings, BadgeCheck } from 'lucide-react';
import { NotificationsBell } from '@/components/ui/notifications-bell';
import { SearchModal } from '@/components/ui/search-modal';
import { useMembers } from '@/hooks/useVeloQuery';
import { IconBuscar } from '@/components/ui/custom-icons';

/**
 * Encabezado de Inicio en móvil.
 *
 * Va aparte del layout a propósito: solo se monta en Inicio, así que la
 * consulta de deportistas (para los avatares y el conteo) no se dispara en los
 * demás módulos.
 *
 * El club es el protagonista, no el saludo: antes lo primero que se leía era
 * "Bienvenido, Hotman", que es justo lo que el usuario ya sabe.
 */

interface MiembroMin {
  id: string;
  fullName: string;
  pictureUrl?: string | null;
  role?: string;
}

interface Props {
  clubName: string | null;
  clubLogoUrl: string | null;
  userName: string | null;
  userPicture?: string | null;
  verified?: boolean;
}

function iniciales(nombre: string): string {
  return nombre.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

const FONDOS = ['#F0997B', '#9FE1CB', '#FAC775', '#CECBF6', '#F4C0D1'];

export function InicioHeaderMovil({ clubName, clubLogoUrl, userName, userPicture, verified }: Props) {
  // El buscador se abre desde aqui y no desde el layout: este encabezado se
  // renderiza dentro de la pagina para que la tarjeta de la prueba pueda
  // montarse sobre el degradado sin que el area con scroll la recorte.
  const [buscarAbierto, setBuscarAbierto] = useState(false);
  const { data } = useMembers();
  const miembros = (data?.members ?? []) as MiembroMin[];
  const deportistas = miembros.filter(m => !m.role || m.role === 'DEPORTISTA');
  const visibles = deportistas.slice(0, 3);
  const restantes = deportistas.length - visibles.length;

  return (
    <header
      className="md:hidden px-4 pt-3 pb-4 sticky top-0 z-30"
      style={{
        background: '#381DA0',
        borderRadius: '0 0 24px 24px',
      }}
    >
      {/* Fila 1 — buscador como campo ancho, campana separada a la derecha */}
      <div className="flex items-center gap-2 mb-3.5">
        <button
          onClick={() => setBuscarAbierto(true)}
          className="flex-1 min-w-0 flex items-center gap-2 h-9 px-3 rounded-full text-left transition-colors"
          style={{ background: 'rgba(255,255,255,0.18)' }}
        >
          <IconBuscar width={15} height={15} className="shrink-0" style={{ color: 'rgba(255,255,255,0.9)' }} />
          <span className="text-[13px] truncate" style={{ color: 'rgba(255,255,255,0.9)' }}>
            Buscar clubes, deportistas
          </span>
        </button>
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{ background: 'rgba(255,255,255,0.18)' }}
        >
          <NotificationsBell sobreOscuro />
        </div>
        <Link
          href="/dashboard/ajustes"
          aria-label="Ajustes"
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{ background: 'rgba(255,255,255,0.18)' }}
        >
          <Settings size={17} strokeWidth={1.8} style={{ color: '#fff' }} />
        </Link>
      </div>

      {/* Fila 2 — identidad del club */}
      <div className="flex items-center gap-3 mb-3.5">
        {clubLogoUrl ? (
          <div
            className="shrink-0 overflow-hidden"
            style={{ width: 46, height: 46, borderRadius: '50%', background: '#fff', boxShadow: '0 2px 10px rgba(0,0,0,0.18)' }}
          >
            <Image
              src={clubLogoUrl}
              alt={clubName ?? 'Club'}
              width={46}
              height={46}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div
            className="shrink-0 flex items-center justify-center text-[16px] font-semibold"
            style={{ width: 46, height: 46, borderRadius: '50%', background: '#fff', color: '#534AB7', boxShadow: '0 2px 10px rgba(0,0,0,0.18)' }}
          >
            {clubName?.charAt(0)?.toUpperCase() ?? 'V'}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="text-[17px] font-semibold text-white truncate" style={{ fontFamily: 'inherit' }}>
              {clubName ?? 'VeloClub'}
            </p>
            {verified && <BadgeCheck className="w-4 h-4 shrink-0" style={{ color: '#9FE1CB' }} />}
          </div>
          {userName && (
            <p className="text-[12px] truncate" style={{ color: 'rgba(255,255,255,0.75)' }}>
              Hola, {userName.split(' ')[0]}
            </p>
          )}
        </div>

        {/* Mi perfil. Va aqui y no arriba para no dejar cuatro circulos
            seguidos: el club a la izquierda, la persona a la derecha. Es la
            unica entrada a /dashboard/perfil en movil. */}
        <Link
          href="/dashboard/perfil"
          aria-label="Mi perfil"
          className="shrink-0 rounded-full overflow-hidden flex items-center justify-center"
          style={{ width: 34, height: 34, border: '2px solid rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.18)' }}
        >
          {userPicture
            ? <img src={userPicture} alt="" className="w-full h-full object-cover" />
            : <span className="text-[12px] font-semibold text-white">{userName ? iniciales(userName) : '?'}</span>}
        </Link>
      </div>

      {/* Fila 3 — avatares apilados. Le dan cara al club en vez de solo un número */}
      {deportistas.length > 0 && (
        <div className="flex items-center gap-2.5">
          <div className="flex">
            {visibles.map((m, i) => (
              <div
                key={m.id}
                className="rounded-full overflow-hidden flex items-center justify-center text-[9px] font-semibold shrink-0"
                style={{
                  width: 26, height: 26,
                  marginLeft: i === 0 ? 0 : -9,
                  border: '2px solid #5B4AD8',
                  background: FONDOS[i % FONDOS.length],
                  color: '#3C3489',
                }}
              >
                {m.pictureUrl
                  ? <img src={m.pictureUrl} alt="" className="w-full h-full object-cover" />
                  : iniciales(m.fullName)}
              </div>
            ))}
            {restantes > 0 && (
              <div
                className="rounded-full flex items-center justify-center text-[9px] font-semibold shrink-0"
                style={{
                  width: 26, height: 26, marginLeft: -9,
                  border: '2px solid #5B4AD8',
                  background: 'rgba(255,255,255,0.28)',
                  color: '#fff',
                }}
              >
                +{restantes}
              </div>
            )}
          </div>
          <span className="text-[12px]" style={{ color: 'rgba(255,255,255,0.8)' }}>
            {deportistas.length} deportista{deportistas.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
      <SearchModal open={buscarAbierto} onClose={() => setBuscarAbierto(false)} />
    </header>
  );
}

export default InicioHeaderMovil;
