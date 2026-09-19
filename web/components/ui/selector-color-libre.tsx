'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { hexARgb, hsvARgb, rgbAHex, rgbAHsv, HEX } from '@/lib/color';
import { useEsCliente } from '@/hooks/use-cliente';

/**
 * El selector de color sin lista cerrada.
 *
 * Es el hermano de `SelectorColor`, el de la rejilla de cincuenta tonos, y no
 * lo reemplaza. Aquel existe para el color de una clase, donde la rejilla es
 * una virtud: limita a lo que se ve bien y deja fuera el rojo y el azul que el
 * calendario tiene reservados. Este existe para **el color del club**, que es
 * suyo y no nuestro, así que ahí sí va cualquiera.
 *
 * Del navegador no se usa nada, por lo mismo que no se usan sus calendarios ni
 * sus listas. Lleva cuadro de saturación, barra de tono, el código escrito y
 * una fila de colores frecuentes, que es un atajo y no un límite.
 */

const FRECUENTES = [
  '#1F2430', '#C0392B', '#E8791A', '#F2C012', '#159A5B', '#0F7B6C', '#1B62C4', '#5B2BB8',
  '#FFFFFF', '#E23D5A', '#F0954A', '#FFE066', '#3BC47D', '#27C0AE', '#4E90E8', '#9A6BE8',
];

interface Props {
  /** El color que se está editando, en hexadecimal de seis dígitos. */
  valor: string;
  onChange: (hex: string) => void;
  onCerrar: () => void;
  /** Dónde se pinta el panel, ya calculado por quien lo abre. */
  anclaje: { top: number; left: number } | null;
}

export function SelectorColorLibre({ valor, onChange, onCerrar, anclaje }: Props) {
  const inicial = hexARgb(valor);
  const [hsv, setHsv] = useState(() => rgbAHsv(inicial.r, inicial.g, inicial.b));
  const [texto, setTexto] = useState(valor.toUpperCase());
  const panel = useRef<HTMLDivElement>(null);
  const cuadro = useRef<HTMLDivElement>(null);
  const montado = useEsCliente();

  // Cerrar al tocar afuera o con Escape. El panel vive en un portal, así que
  // «afuera» se decide con contains y no con el árbol de React. El botón que lo
  // abrió cuenta como dentro, o el clic lo cerraría y lo volvería a abrir.
  useEffect(() => {
    const fuera = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (panel.current?.contains(t)) return;
      if (t.closest?.('[data-slot-color]')) return;
      onCerrar();
    };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [onCerrar]);

  function emitir(siguiente: { h: number; s: number; v: number }) {
    setHsv(siguiente);
    const rgb = hsvARgb(siguiente.h, siguiente.s, siguiente.v);
    const hex = rgbAHex(rgb.r, rgb.g, rgb.b);
    setTexto(hex.toUpperCase());
    onChange(hex);
  }

  function desdeHex(hex: string) {
    const rgb = hexARgb(hex);
    setHsv(rgbAHsv(rgb.r, rgb.g, rgb.b));
    setTexto(hex.toUpperCase());
    onChange(hex);
  }

  function desdeCuadro(e: React.PointerEvent) {
    const r = cuadro.current?.getBoundingClientRect();
    if (!r) return;
    const x = Math.min(Math.max(e.clientX - r.left, 0), r.width);
    const y = Math.min(Math.max(e.clientY - r.top, 0), r.height);
    emitir({ h: hsv.h, s: (x / r.width) * 100, v: 100 - (y / r.height) * 100 });
  }

  if (!montado || !anclaje) return null;

  const rgb = hsvARgb(hsv.h, hsv.s, hsv.v);
  const actual = rgbAHex(rgb.r, rgb.g, rgb.b);

  return createPortal(
    <div
      ref={panel}
      role="dialog"
      aria-label="Elegir color"
      className="fixed z-[9999] w-[236px] rounded-2xl p-3 flex flex-col gap-2.5"
      style={{
        top: anclaje.top,
        left: anclaje.left,
        background: '#fff',
        border: '1px solid rgba(56,29,160,0.14)',
        boxShadow: '0 12px 32px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)',
      }}
    >
      {/* Saturación y brillo */}
      <div
        ref={cuadro}
        onPointerDown={e => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); desdeCuadro(e); }}
        onPointerMove={e => { if (e.buttons === 1) desdeCuadro(e); }}
        className="relative h-[130px] rounded-xl overflow-hidden cursor-crosshair touch-none"
        style={{ background: `hsl(${hsv.h},100%,50%)`, boxShadow: 'inset 0 0 0 1px rgba(26,16,40,0.1)' }}
      >
        <span className="absolute inset-0" style={{ background: 'linear-gradient(90deg,#fff,rgba(255,255,255,0))' }} />
        <span className="absolute inset-0" style={{ background: 'linear-gradient(0deg,#000,rgba(0,0,0,0))' }} />
        <span
          className="absolute w-[14px] h-[14px] rounded-full pointer-events-none"
          style={{
            left: `${hsv.s}%`,
            top: `${100 - hsv.v}%`,
            transform: 'translate(-50%,-50%)',
            border: '2px solid #fff',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.35)',
          }}
        />
      </div>

      {/* El tono va en un rango y no en una barra dibujada a mano para que las
          flechas del teclado lo muevan sin tener que programarlo. */}
      <input
        type="range"
        min={0}
        max={360}
        value={Math.round(hsv.h)}
        aria-label="Tono"
        onChange={e => emitir({ ...hsv, h: Number(e.target.value) })}
        className="vc-tono w-full h-3 rounded-full cursor-pointer appearance-none"
        style={{ background: 'linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)' }}
      />

      <div className="flex items-center gap-2">
        <span className="w-8 h-8 rounded-[9px] shrink-0"
          style={{ background: actual, boxShadow: 'inset 0 0 0 1px rgba(26,16,40,0.12)' }} />
        <input
          type="text"
          value={texto}
          maxLength={7}
          aria-label="Código del color"
          onChange={e => {
            const v = e.target.value.trim();
            setTexto(v.toUpperCase());
            const conNumeral = v.startsWith('#') ? v : `#${v}`;
            if (HEX.test(conNumeral)) desdeHex(conNumeral);
          }}
          className="flex-1 min-w-0 text-[12.5px] font-mono uppercase tracking-wide rounded-[10px] px-2.5 py-1.5"
          style={{ border: '1.5px solid rgba(120,80,200,0.26)', color: '#1A1028' }}
        />
      </div>

      <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(8, 1fr)' }}>
        {FRECUENTES.map(c => (
          <button
            key={c}
            type="button"
            title={c}
            aria-label={`Usar ${c}`}
            onClick={() => desdeHex(c)}
            className="rounded-md transition-transform hover:scale-110"
            style={{ background: c, aspectRatio: '1', boxShadow: 'inset 0 0 0 1px rgba(26,16,40,0.12)' }}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={onCerrar}
        className="w-full rounded-[10px] py-2 text-[12px] font-semibold text-white"
        style={{ background: '#381DA0' }}
      >
        Listo
      </button>
    </div>,
    document.body,
  );
}
