'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
const BORDE = 'rgba(120,80,200,0.10)';

/**
 * Lo mínimo que tiene que sobrar para que valga la pena desplazar: media
 * ficha. Por debajo de eso lo que queda fuera es el filo de una ficha, no
 * información, y encender las flechas por ese pedazo cuesta más de lo que
 * devuelve: la flecha tapa media ficha para recuperar quince píxeles.
 */
const MINIMO_PARA_DESPLAZAR = 48;

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

/** Una flecha, con la máscara que desvanece las fichas por debajo. */
function Flecha({ lado, onClick }: { lado: 'izq' | 'der'; onClick: () => void }) {
  const izq = lado === 'izq';
  const Icono = izq ? ChevronLeft : ChevronRight;
  return (
    <div
      className={`absolute top-0 bottom-3 sm:bottom-4 flex items-center pointer-events-none ${izq ? 'left-0 pl-1.5 sm:pl-2 justify-start' : 'right-0 pr-1.5 sm:pr-2 justify-end'}`}
      style={{
        width: 56,
        // No es un degradado de marca: es la máscara que avisa que el carril
        // sigue. Sin ella la flecha flota sobre una ficha cortada a la mitad.
        background: `linear-gradient(to ${izq ? 'right' : 'left'}, #fff 55%, rgba(255,255,255,0))`,
      }}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={izq ? 'Ver anteriores' : 'Ver siguientes'}
        className="pointer-events-auto w-7 h-7 rounded-full bg-white flex items-center justify-center transition-colors hover:bg-secondary active:scale-95"
        style={{ border: `1px solid ${BORDE}`, boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }}
      >
        <Icono className="w-4 h-4" style={{ color: '#381DA0' }} strokeWidth={2.5} />
      </button>
    </div>
  );
}

/**
 * El carril. Se desplaza con el dedo, con la rueda o con las flechas.
 *
 * Las flechas no son un adorno: la barra de scroll está escondida —en
 * escritorio le robaba alto a una tarjeta que existe justamente para ocupar
 * poco— y sin ellas, con mouse, no había forma de llegar a las fichas de la
 * derecha. Cada una aparece solo cuando queda algo hacia ese lado.
 */
function Carril({ children }: { children: React.ReactNode }) {
  const carril = useRef<HTMLDivElement>(null);
  const [hayIzq, setHayIzq] = useState(false);
  const [hayDer, setHayDer] = useState(false);

  const medir = useCallback(() => {
    const el = carril.current;
    if (!el) return;
    const sobra = el.scrollWidth - el.clientWidth;
    if (sobra < MINIMO_PARA_DESPLAZAR) {
      setHayIzq(false);
      setHayDer(false);
      return;
    }
    // El margen de 1 px absorbe los anchos fraccionarios del zoom del
    // navegador, que si no dejan la flecha derecha encendida para siempre.
    setHayIzq(el.scrollLeft > 1);
    setHayDer(sobra - el.scrollLeft > 1);
  }, []);

  // Sin dependencias a propósito: corre en cada render, que es justo cuando
  // llegan los datos y el carril cambia de ancho. Medir cuesta dos lecturas.
  useEffect(medir);

  useEffect(() => {
    const el = carril.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, [medir]);

  const mover = (signo: 1 | -1) => {
    const el = carril.current;
    if (!el) return;

    // El salto va por fichas enteras, no por un porcentaje del ancho: con un
    // 80 % suelto el carril quedaba a mitad de ficha y al devolverse la
    // primera se veía cortada. El paso se mide del propio DOM para que siga
    // sirviendo si algún día la ficha cambia de ancho.
    const fichas = el.children;
    const primera = fichas[0] as HTMLElement | undefined;
    if (!primera) return;
    const segunda = fichas[1] as HTMLElement | undefined;
    const paso = segunda ? segunda.offsetLeft - primera.offsetLeft : primera.offsetWidth + 8;
    if (paso <= 0) return;

    // Cuántas caben a la vista, mínimo una: así el golpe nunca se queda corto
    // ni se salta fichas sin que se vean.
    const cuantas = Math.max(1, Math.floor(el.clientWidth / paso));
    const actual = Math.round(el.scrollLeft / paso);
    // scrollTo recorta solo lo que se pase de los extremos.
    el.scrollTo({ left: (actual + signo * cuantas) * paso, behavior: 'smooth' });
  };

  return (
    <div className="relative">
      {/* El scroll-padding iguala al padding: sin él, «start» alinea la ficha
          con el borde del carril y se come el margen, así que volver al
          principio dejaba la primera ficha cortada y la flecha izquierda
          encendida como si faltara algo hacia atrás. */}
      <div
        ref={carril}
        onScroll={medir}
        className="no-scrollbar flex gap-2 overflow-x-auto px-3 pb-3 scroll-px-3 sm:px-4 sm:pb-4 sm:scroll-px-4"
        style={{
          scrollSnapType: 'x proximity',
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorX: 'contain',
        }}
      >
        {children}
      </div>
      {hayIzq && <Flecha lado="izq" onClick={() => mover(-1)} />}
      {hayDer && <Flecha lado="der" onClick={() => mover(1)} />}
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
            className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center shrink-0"
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
                    className="flex flex-col items-center justify-center w-10 h-10 rounded-full shrink-0"
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
          className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center shrink-0"
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
                    className="w-10 h-10 rounded-full flex flex-col items-center justify-center shrink-0"
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
