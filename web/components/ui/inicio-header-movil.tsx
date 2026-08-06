'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Search, Settings, BadgeCheck } from 'lucide-react';
import { NotificationsBell } from '@/components/ui/notifications-bell';
import { useMembers } from '@/hooks/useVeloQuery';

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
  verified?: boolean;
  onBuscar: () => void;
}

function iniciales(nombre: string): string {
  return nombre.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

const FONDOS = ['#F0997B', '#9FE1CB', '#FAC775', '#CECBF6', '#F4C0D1'];

export function InicioHeaderMovil({ clubName, clubLogoUrl, userName, verified, onBuscar }: Props) {
  const { data } = useMembers();
  const miembros = (data?.members ?? []) as MiembroMin[];
  const deportistas = miembros.filter(m => !m.role || m.role === 'STUDENT');
  const visibles = deportistas.slice(0, 3);
  const restantes = deportistas.length - visibles.length;

  return (
    <header
      className="md:hidden shrink-0 px-4 pt-3 pb-8"
      style={{
        background: 'linear-gradient(150deg,#7C3AED 0%,#5B4AD8 45%,#4361EE 100%)',
        borderRadius: '0 0 24px 24px',
      }}
    >
      {/* Fila 1 — buscador como campo ancho, campana separada a la derecha */}
      <div className="flex items-center gap-2 mb-3.5">
        <button
          onClick={onBuscar}
          className="flex-1 min-w-0 flex items-center gap-2 h-9 px-3 rounded-full text-left transition-colors"
          style={{ background: 'rgba(255,255,255,0.18)' }}
        >
          <Search size={15} strokeWidth={2} className="shrink-0" style={{ color: 'rgba(255,255,255,0.9)' }} />
          <span className="text-[13px] truncate" style={{ color: 'rgba(255,255,255,0.9)' }}>
            Buscar deportistas, pagos...
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
    </header>
  );
}

export default InicioHeaderMovil;
