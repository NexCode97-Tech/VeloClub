'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

/* ─────────────────────────────────────────────────────────────
   TimePicker — selector de hora del proyecto

   Reemplaza al `<input type="time">`, que abre la lista azul del navegador:
   otra tipografía, otro azul y otro comportamiento en cada computador. Es la
   misma regla que ya vale para las fechas y para los desplegables.

   value:    "HH:mm" en 24 horas, que es como la guarda la base
   onChange: (hora: "HH:mm") => void

   Se muestra en 12 horas con a. m. y p. m. porque es como lo dice un club, y
   se guarda en 24 porque es como se ordena sin ambigüedad. La conversión vive
   acá y no en quien lo usa.
   ───────────────────────────────────────────────────────────── */

/** Reloj. Propio y no de Lucide, para no mezclar dos trazos en el mismo campo. */
function IconReloj({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 28 28" fill="currentColor"
      className={className} aria-hidden="true">
      <path d="M12,0C5.383,0,0,5.383,0,12s5.383,12,12,12,12-5.383,12-12S18.617,0,12,0Zm0,22c-5.514,0-10-4.486-10-10S6.486,2,12,2s10,4.486,10,10-4.486,10-10,10Zm5-10c0,.552-.448,1-1,1h-4c-.552,0-1-.448-1-1v-6c0-.552,.448-1,1-1s1,.448,1,1v5h3c.552,0,1,.448,1,1Z"/>
    </svg>
  );
}

/**
 * Los minutos van de cinco en cinco. Una clase empieza a las 6:00 o a las 6:30,
 * nunca a las 6:47, y ofrecer los sesenta minutos convierte una lista de doce
 * renglones en una de sesenta que hay que recorrer para llegar a la de siempre.
 */
const PASO_MINUTOS = 5;
const HORAS = Array.from({ length: 12 }, (_, i) => (i === 0 ? 12 : i));
const MINUTOS = Array.from({ length: 60 / PASO_MINUTOS }, (_, i) => i * PASO_MINUTOS);

/** "06:30" → { h12: 6, min: 30, tarde: false } */
function descomponer(hhmm: string) {
  const [h, m] = (hhmm || '06:00').split(':').map(Number);
  const hora = Number.isNaN(h) ? 6 : h;
  const min  = Number.isNaN(m) ? 0 : m;
  return {
    h12:   hora % 12 === 0 ? 12 : hora % 12,
    min:   Math.round(min / PASO_MINUTOS) * PASO_MINUTOS % 60,
    tarde: hora >= 12,
  };
}

/** { 6, 30, tarde } → "18:30" */
function componer(h12: number, min: number, tarde: boolean): string {
  const h24 = tarde
    ? (h12 === 12 ? 12 : h12 + 12)
    : (h12 === 12 ? 0  : h12);
  return `${String(h24).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

const BRAND = '#381DA0';
const SELECCION = { background: 'rgba(56,29,160,0.08)', color: BRAND, fontWeight: 600 };

interface Columna {
  etiqueta: string;
  valores: number[];
  activo: number;
  onElegir: (v: number) => void;
  formato: (v: number) => string;
}

function Columna({ etiqueta, valores, activo, onElegir, formato }: Columna) {
  const carril = useRef<HTMLDivElement>(null);

  // Al abrir, el valor puesto tiene que quedar a la vista. Sin esto, elegir las
  // 6 p. m. arranca mostrando las 12 y hay que desplazarse a ciegas.
  useEffect(() => {
    const el = carril.current?.querySelector<HTMLElement>('[data-activo="true"]');
    el?.scrollIntoView({ block: 'center' });
  }, []);

  return (
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-semibold text-muted-foreground px-1 pb-1.5">{etiqueta}</p>
      <div
        ref={carril}
        className="overflow-y-auto overscroll-contain flex flex-col gap-0.5 pr-1"
        style={{ maxHeight: 176 }}
      >
        {valores.map(v => {
          const on = v === activo;
          return (
            <button
              key={v}
              type="button"
              data-activo={on}
              onClick={() => onElegir(v)}
              className="shrink-0 h-9 rounded-lg text-[13px] transition-colors hover:bg-secondary"
              style={on ? SELECCION : { color: '#1A1028' }}
            >
              {formato(v)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface Props {
  value: string;
  onChange: (hora: string) => void;
  className?: string;
  /** Alto de campo denso, igual que en `DatePicker`. */
  compacto?: boolean;
}

export function TimePicker({ value, onChange, className = '', compacto = false }: Props) {
  const [open, setOpen] = useState(false);
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({});
  const ref        = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const portalRef  = useRef<HTMLDivElement>(null);

  const { h12, min, tarde } = descomponer(value);

  // Cerrar al tocar fuera, contando el portal como «dentro»
  useEffect(() => {
    function h(e: MouseEvent) {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !portalRef.current?.contains(t)) setOpen(false);
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Cerrar con Escape: dentro de un modal es el gesto que la gente ya hace.
  useEffect(() => {
    if (!open) return;
    function h(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); }
    }
    document.addEventListener('keydown', h, true);
    return () => document.removeEventListener('keydown', h, true);
  }, [open]);

  // Posición fija calculada a mano, para escapar del `overflow` del modal. Es
  // el mismo procedimiento que usa `DatePicker`, y por la misma razón.
  const abrir = useCallback(() => {
    const t = triggerRef.current;
    if (t) {
      const r     = t.getBoundingClientRect();
      const ALTO  = 250;
      const vh    = window.visualViewport?.height ?? window.innerHeight;
      const vw    = window.innerWidth;
      const ancho = Math.max(r.width, 232);
      const left  = Math.max(8, Math.min(r.left, vw - ancho - 8));
      const arriba = vh - r.bottom - 16 < ALTO;
      setDropStyle(arriba
        ? { position: 'fixed', bottom: vh - r.top + 6, left, width: ancho }
        : { position: 'fixed', top: r.bottom + 6,      left, width: ancho });
    }
    setOpen(o => !o);
  }, []);

  const poner = (h: number, m: number, t: boolean) => onChange(componer(h, m, t));

  const etiqueta = `${h12}:${String(min).padStart(2, '0')} ${tarde ? 'p. m.' : 'a. m.'}`;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={abrir}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`w-full flex items-center gap-2 px-3 rounded-xl border border-input bg-white hover:border-ring transition-colors text-left ${
          compacto ? 'h-[38px]' : 'h-12'
        }`}
      >
        <IconReloj className="w-4 h-4 shrink-0 text-muted-foreground" />
        <span className={`flex-1 ${compacto ? 'text-[13px]' : 'text-sm'} text-foreground`}>
          {etiqueta}
        </span>
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={portalRef}
          className="z-[9999] rounded-xl p-2.5"
          role="dialog"
          aria-label="Elegir hora"
          style={{
            ...dropStyle,
            background: '#fff',
            border:     '1px solid rgba(56,29,160,0.14)',
            boxShadow:  '0 12px 32px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)',
          }}
        >
          {/* a. m. / p. m. arriba y no en una tercera columna: son dos opciones,
              y una columna de dos renglones al lado de dos de doce se lee como
              si le faltara contenido. */}
          <div className="flex gap-1 p-0.5 rounded-lg mb-2" style={{ background: '#F7F7FB' }}>
            {[false, true].map(t => (
              <button
                key={String(t)}
                type="button"
                onClick={() => poner(h12, min, t)}
                className="flex-1 h-8 rounded-md text-[12px] font-semibold transition-colors"
                style={t === tarde
                  ? { background: BRAND, color: '#fff' }
                  : { color: '#8E87A8' }}
              >
                {t ? 'p. m.' : 'a. m.'}
              </button>
            ))}
          </div>

          <div className="flex gap-1.5">
            <Columna
              etiqueta="Hora"
              valores={HORAS}
              activo={h12}
              onElegir={h => poner(h, min, tarde)}
              formato={v => String(v)}
            />
            <Columna
              etiqueta="Minuto"
              valores={MINUTOS}
              activo={min}
              onElegir={m => poner(h12, m, tarde)}
              formato={v => String(v).padStart(2, '0')}
            />
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full h-9 mt-2 rounded-lg text-[12.5px] font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: BRAND }}
          >
            Listo
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}

export default TimePicker;
