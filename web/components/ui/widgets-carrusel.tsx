'use client';

import Link from 'next/link';
import { IconCumpleanos, IconEvento } from '@/components/ui/custom-icons';

/**
 * Próximos eventos y Cumpleaños, en carrusel horizontal.
 *
 * Antes eran dos listas verticales. Con seis cumpleaños la tarjeta medía más de
 * 600 px y arrastraba a la de eventos, que se estiraba vacía para igualarla:
 * media pantalla de Inicio se iba en dos listas que casi nadie recorre entera.
 * En horizontal cada una ocupa una fila y lo que sobra se desplaza al lado.
 *
 * Es el mismo componente en las tres medidas. Antes había una versión de móvil
 * y otra de escritorio con el mismo contenido escrito dos veces, y cualquier
 * arreglo había que acordarse de hacerlo en las dos.
 */

const MUDO = '#8E87A8';

interface Evento {
  id: string; title: string; type: string; startDate: string; allDay: boolean;
  location?: { name: string } | null;
}

interface Cumple {
  id: string; fullName: string; birthDate: string; daysUntil: number;
}

const COLOR_EVENTO: Record<string, { bg: string; text: string }> = {
  TRAINING:    { bg: 'rgba(6,214,160,0.10)',  text: '#06D6A0' },
  MEETUP:      { bg: 'rgba(67,97,238,0.10)',  text: '#4361EE' },
  COMPETITION: { bg: 'rgba(239,71,111,0.10)', text: '#EF476F' },
};

const ETIQUETA_EVENTO: Record<string, string> = {
  TRAINING: 'Entrenamiento', MEETUP: 'Reunión', COMPETITION: 'Competencia',
};

function tituloDe(t: string) {
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

/** El carril. Se desplaza con el dedo, con la rueda o con las flechas. */
function Carril({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex gap-2 overflow-x-auto px-3 pb-3 sm:px-4 sm:pb-4"
      style={{
        // La barra se esconde: en escritorio robaba alto a una tarjeta que
        // justamente existe para ocupar poco, y el desplazamiento se entiende
        // igual porque la última ficha queda cortada a la vista.
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        scrollSnapType: 'x proximity',
        WebkitOverflowScrolling: 'touch',
        overscrollBehaviorX: 'contain',
      }}
    >
      {children}
    </div>
  );
}

function Ficha({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="shrink-0 flex flex-col items-center text-center rounded-xl px-2 pt-2 pb-2.5 transition-colors hover:bg-secondary/60"
      style={{ width: 88, scrollSnapAlign: 'start' }}
    >
      {children}
    </div>
  );
}

function Vacio({ icono: Icono, texto }: { icono: typeof IconEvento; texto: string }) {
  return (
    <div className="flex items-center gap-2 px-4 pb-4 pt-1">
      <Icono className="w-5 h-5 shrink-0" style={{ color: '#C4BFDB' }} />
      <p className="text-[11.5px]" style={{ color: MUDO }}>{texto}</p>
    </div>
  );
}

function Cargando() {
  return (
    <div className="flex gap-2 px-3 pb-3 sm:px-4 sm:pb-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="shrink-0 rounded-xl bg-secondary animate-pulse" style={{ width: 88, height: 72 }} />
      ))}
    </div>
  );
}

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl bg-white border border-border overflow-hidden"
      style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}
    >
      {children}
    </div>
  );
}

export function CarruselEventos({ eventos, cargando }: { eventos: Evento[]; cargando: boolean }) {
  return (
    <Marco>
      <div className="flex items-center justify-between px-3 pt-3 pb-2 sm:px-4 sm:pt-4">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: '#381DA0' }}
          >
            <IconEvento className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
          </div>
          <p className="text-[12px] sm:text-[13px] font-semibold text-foreground truncate">Próximos eventos</p>
        </div>
        <Link
          href="/dashboard/calendario"
          className="text-[11px] font-semibold text-purple-600 hover:underline shrink-0 ml-2"
        >
          Ver todos
        </Link>
      </div>

      {cargando ? <Cargando />
        : eventos.length === 0 ? <Vacio icono={IconEvento} texto="Sin eventos próximos" />
        : (
          <Carril>
            {eventos.map(ev => {
              const d = new Date(ev.startDate);
              const c = COLOR_EVENTO[ev.type] ?? COLOR_EVENTO.MEETUP;
              return (
                <Ficha key={ev.id}>
                  <div
                    className="flex flex-col items-center justify-center w-10 h-10 rounded-xl shrink-0"
                    style={{ background: c.bg }}
                  >
                    <span className="text-[13px] font-semibold leading-none" style={{ color: c.text }}>
                      {d.getDate()}
                    </span>
                    <span className="text-[8.5px] font-semibold uppercase leading-none mt-0.5" style={{ color: c.text }}>
                      {d.toLocaleDateString('es-CO', { month: 'short' })}
                    </span>
                  </div>
                  {/* Dos renglones como tope: con uno, la mitad de los títulos
                      quedan cortados; con tres, la tarjeta vuelve a crecer. */}
                  <p
                    className="text-[11px] font-semibold text-foreground mt-1.5 leading-tight w-full"
                    style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                    title={tituloDe(ev.title)}
                  >
                    {tituloDe(ev.title)}
                  </p>
                  <p className="text-[9.5px] font-semibold mt-0.5 truncate w-full" style={{ color: c.text }}>
                    {ETIQUETA_EVENTO[ev.type] ?? ev.type}
                  </p>
                </Ficha>
              );
            })}
          </Carril>
        )}
    </Marco>
  );
}

export function CarruselCumpleanos({ cumples, cargando }: { cumples: Cumple[]; cargando: boolean }) {
  return (
    <Marco>
      <div className="flex items-center gap-2 px-3 pt-3 pb-2 sm:px-4 sm:pt-4">
        <div
          className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg,#EF476F,#FFB703)' }}
        >
          <IconCumpleanos className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
        </div>
        <p className="text-[12px] sm:text-[13px] font-semibold text-foreground">Cumpleaños</p>
      </div>

      {cargando ? <Cargando />
        : cumples.length === 0 ? <Vacio icono={IconCumpleanos} texto="Sin cumpleaños en 30 días" />
        : (
          <Carril>
            {cumples.map(b => {
              const hoy    = b.daysUntil === 0;
              const mañana = b.daysUntil === 1;
              const fondo  = hoy ? 'rgba(239,71,111,0.12)' : 'rgba(56,29,160,0.10)';
              const tinta  = hoy ? '#EF476F' : '#381DA0';
              // Solo el nombre de pila: el apellido no cabe en 88 px y lo que
              // hace falta saber es de quién es el cumpleaños, no su ficha.
              const nombre = b.fullName.trim().split(/\s+/)[0];
              return (
                <Ficha key={b.id}>
                  <div
                    className="w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0"
                    style={{ background: fondo }}
                  >
                    {hoy ? (
                      <span className="text-[17px] leading-none">🎂</span>
                    ) : (
                      <>
                        <p className="text-[14px] font-semibold leading-none" style={{ color: tinta }}>
                          {mañana ? '1' : b.daysUntil}
                        </p>
                        <p className="text-[7.5px] font-semibold uppercase leading-none mt-0.5" style={{ color: tinta }}>
                          {mañana ? 'mañana' : 'días'}
                        </p>
                      </>
                    )}
                  </div>
                  <p
                    className="text-[11px] font-semibold text-foreground mt-1.5 truncate w-full"
                    title={b.fullName}
                  >
                    {nombre}
                  </p>
                  <p className="text-[9.5px] mt-0.5 truncate w-full" style={{ color: hoy ? '#EF476F' : MUDO }}>
                    {new Date(b.birthDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                  </p>
                </Ficha>
              );
            })}
          </Carril>
        )}
    </Marco>
  );
}
