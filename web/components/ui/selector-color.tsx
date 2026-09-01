'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * El selector de color del proyecto.
 *
 * No usa `<input type="color">`. Ese abre la rueda del sistema operativo, que
 * se ve distinta en Windows, en Mac y en cada celular, y es la misma razón por
 * la que acá tampoco se usa el calendario ni la lista desplegable del
 * navegador: lo que el usuario ve tiene que ser lo mismo en todas las máquinas.
 *
 * Cincuenta tonos —diez colores en cinco intensidades— cubren lo que un club va
 * a querer sin obligarlo a escribir nada. El campo de código está para el que
 * necesita uno exacto, no para el caso normal.
 */

/**
 * Ocho familias en cinco intensidades. Las columnas van de oscuro a claro para
 * que la rejilla se lea como una escala y no como un revoltijo.
 *
 * **No hay rojo ni azul, y es a propósito.** El calendario los tiene reservados
 * para decir de qué tipo es un evento —rojo competencia, azul entrenamiento— y
 * lo declara en su leyenda. Un grupo rojo haría que un punto rojo dejara de
 * significar «competencia», y la leyenda estaría mintiendo.
 *
 * Las dos primeras intensidades son las únicas que se leen bien como texto sobre
 * blanco, y la hora de la clase va escrita en este color. Por eso son las que
 * ofrece la primera columna, que es donde cae el dedo.
 */
const TONOS: string[] = [
  '#0A4D1C', '#117F2D', '#2BAE4E', '#7DD494', '#D3F0DB',
  '#7A3B05', '#EF7D0D', '#F6A83F', '#FBCB8F', '#FDEBD5',
  '#4A1B7A', '#6B2FBB', '#8F55DC', '#BC96EC', '#E6D8F8',
  '#08414F', '#0E7490', '#1CA3C4', '#7CCEE0', '#D2EEF5',
  '#5F0F38', '#A11D5C', '#C93F84', '#E28FB6', '#F6DAE7',
  '#3B2412', '#71491E', '#9C6B34', '#C29A6E', '#E7D7C4',
  '#063F35', '#0A6E5E', '#199C87', '#7FCFC1', '#D5EEE9',
  '#1E2226', '#3F474E', '#69737C', '#A3ACB4', '#DDE1E5',
];

/**
 * Los que el calendario ya usa para el tipo de evento. Un color escrito a mano
 * en el campo de código que caiga en uno de estos se rechaza: es la única vía
 * por la que se podrían colar, ya que la rejilla no los ofrece.
 */
const RESERVADOS = ['#EF476F', '#4361EE'];

const HEX = /^#[0-9a-fA-F]{6}$/;

interface Props {
  /** "#RRGGBB". El que se muestra en el botón. */
  value: string;
  onChange: (color: string) => void;
  /** Para lectores de pantalla: «Color del grupo», «Color de la clase». */
  etiqueta: string;
}

export function SelectorColor({ value, onChange, etiqueta }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState<React.CSSProperties>({});
  const [texto, setTexto] = useState(value.replace('#', ''));
  const boton  = useRef<HTMLButtonElement>(null);
  const panel  = useRef<HTMLDivElement>(null);

  useEffect(() => { setTexto(value.replace('#', '')); }, [value]);

  // Cerrar al tocar fuera, contando el panel como «dentro»
  useEffect(() => {
    function h(e: MouseEvent) {
      const t = e.target as Node;
      if (!boton.current?.contains(t) && !panel.current?.contains(t)) setAbierto(false);
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    if (!abierto) return;
    function h(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.stopPropagation(); setAbierto(false); }
    }
    document.addEventListener('keydown', h, true);
    return () => document.removeEventListener('keydown', h, true);
  }, [abierto]);

  // Posición fija calculada a mano, igual que `DatePicker` y `TimePicker`: sin
  // esto el panel queda atrapado en el `overflow` del modal que lo contiene.
  const abrir = useCallback(() => {
    const b = boton.current;
    if (b) {
      const r = b.getBoundingClientRect();
      const ALTO = 260, ANCHO = 244;
      const vh = window.visualViewport?.height ?? window.innerHeight;
      const vw = window.innerWidth;
      const left = Math.max(8, Math.min(r.right - ANCHO, vw - ANCHO - 8));
      const arriba = vh - r.bottom - 16 < ALTO;
      setPos(arriba
        ? { position: 'fixed', bottom: vh - r.top + 6, left, width: ANCHO }
        : { position: 'fixed', top: r.bottom + 6,      left, width: ANCHO });
    }
    setAbierto(a => !a);
  }, []);

  const [choca, setChoca] = useState(false);

  function escribir(v: string) {
    const limpio = v.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
    setTexto(limpio);
    if (limpio.length !== 6) { setChoca(false); return; }
    const hex = '#' + limpio.toUpperCase();
    if (RESERVADOS.includes(hex)) { setChoca(true); return; }
    setChoca(false);
    onChange(hex);
  }

  return (
    <>
      <button
        ref={boton}
        type="button"
        onClick={abrir}
        aria-label={etiqueta}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        className="w-[42px] h-[42px] rounded-xl shrink-0 grid place-items-center transition-colors hover:border-ring"
        style={{ background: '#fff', border: '1.5px solid rgba(120,80,200,0.26)' }}
      >
        <span className="w-[18px] h-[18px] rounded-full block"
          style={{ background: HEX.test(value) ? value : '#8E87A8' }} />
      </button>

      {abierto && typeof document !== 'undefined' && createPortal(
        <div
          ref={panel}
          role="dialog"
          aria-label={etiqueta}
          className="rounded-xl p-3"
          style={{
            ...pos,
            zIndex: 9999,
            background: '#fff',
            border: '1px solid rgba(56,29,160,0.14)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)',
          }}
        >
          <p className="text-[10px] font-bold m-0 mb-2" style={{ color: '#8E87A8', letterSpacing: '.05em' }}>
            ELIGE UN COLOR
          </p>
          <div className="grid gap-[5px]" style={{ gridTemplateColumns: 'repeat(8, 1fr)' }}>
            {TONOS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => onChange(c)}
                aria-label={c}
                className="rounded-[7px] transition-transform hover:scale-110"
                style={{
                  background: c,
                  aspectRatio: '1',
                  border: `2px solid ${c.toLowerCase() === value.toLowerCase() ? '#1A1028' : 'transparent'}`,
                }}
              />
            ))}
          </div>

          {/* Para el que necesita uno exacto. No es el camino normal, por eso va
              abajo y detrás de una línea. */}
          <div className="flex items-center gap-2 mt-2.5 pt-2.5"
            style={{ borderTop: '1px solid rgba(120,80,200,0.14)' }}>
            <label htmlFor="sc-hex" className="text-[10.5px] font-bold" style={{ color: '#8E87A8' }}>#</label>
            <input
              id="sc-hex"
              type="text"
              value={texto}
              onChange={e => escribir(e.target.value)}
              placeholder="C51111"
              maxLength={6}
              aria-label="Código del color"
              className="flex-1 min-w-0 text-[12.5px] px-2.5 py-1.5 rounded-lg uppercase"
              style={{
                border: `1.5px solid ${choca ? '#EF476F' : 'rgba(120,80,200,0.26)'}`,
                color: '#1A1028',
              }}
            />
          </div>
          {choca && (
            <p className="text-[10.5px] m-0 mt-1.5" style={{ color: '#B02A47' }}>
              Ese color lo usa el calendario para los eventos. Elige otro.
            </p>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

export default SelectorColor;
