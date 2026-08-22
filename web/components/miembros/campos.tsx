'use client';

import { useState } from 'react';
import { Check, Paperclip } from 'lucide-react';
import { Desplegable as DesplegableUI } from '@/components/ui/desplegable';

/**
 * Los campos de la ficha de un deportista.
 *
 * Viven aparte porque los usan los dos formularios que la llenan: el del club,
 * que muestra todo por secciones, y el público, que lo reparte en pasos. El
 * aspecto de un campo no puede depender de cuál de los dos lo esté pintando.
 */

/**
 * El aspecto de una casilla.
 *
 * `falta` es para el formulario público cuando alguien vuelve a completar su
 * ficha: la casilla vacía se pinta en ámbar para que se vea de un vistazo qué
 * le falta, sin tener que leer campo por campo. No es un error, así que no usa
 * el rojo: nadie hizo nada mal, simplemente ese dato nunca se llenó.
 */
export function entrada(hayError: boolean, falta?: boolean): string {
  const borde = hayError
    ? 'border-[#EF476F]'
    : falta
      ? 'border-[#D9A227] bg-[#FDF7E8] focus:border-primary'
      : 'border-border focus:border-primary';
  return `w-full px-3 py-2 rounded-lg border text-[13px] outline-none transition-colors ${
    falta && !hayError ? '' : 'bg-background'
  } ${borde}`;
}

export function Campo({ etiqueta, obligatorio, error, falta, listo, children }: {
  etiqueta: string;
  obligatorio?: boolean;
  error?: string | null;
  /** Vacío en la ficha que el club ya tiene. */
  falta?: boolean;
  /** Ya venía lleno del club. */
  listo?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2.5">
      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground mb-1">
        <span>
          {etiqueta}
          {obligatorio && <span className="text-[#EF476F] ml-0.5">*</span>}
        </span>
        {falta && (
          <span className="text-[9.5px] font-bold px-1.5 py-px rounded"
            style={{ background: '#F7E9C4', color: '#8A6216' }}>
            Falta
          </span>
        )}
        {listo && !falta && <Check className="w-3 h-3 text-[#0E7C57]" />}
      </label>
      {children}
      {error && <p className="text-[11px] text-[#EF476F] mt-1 m-0">{error}</p>}
    </div>
  );
}

export function Ayuda({ children }: { children: React.ReactNode }) {
  return <p className="text-[10.5px] text-muted-foreground mt-1 m-0">{children}</p>;
}

/**
 * Desplegable de catálogo.
 *
 * Es el desplegable propio del proyecto y no un `select` nativo: el nativo se ve
 * bien cerrado, pero al abrirlo el navegador pinta su lista con su fuente y su
 * resaltado azul de sistema. Acá solo se traduce el catálogo y se delega.
 */
export type Opcion = string | { valor: string; texto: string; nota?: string };

export function Desplegable({ valor, opciones, vacio, error, falta, titulo, onElegir }: {
  valor: string;
  /** Un catálogo de textos, o pares valor/texto cuando lo que se guarda no es
   *  lo que se lee: las sedes guardan un id y muestran su nombre. */
  opciones: Opcion[];
  vacio: string;
  error?: boolean;
  falta?: boolean;
  /** Encabezado de la hoja en el celular. Por defecto usa `vacio`. */
  titulo?: string;
  onElegir: (v: string) => void;
}) {
  const normal = opciones.map(o => (typeof o === 'string' ? { valor: o, texto: o } : o));
  return (
    <DesplegableUI
      valor={valor}
      opciones={normal}
      vacio={vacio}
      error={error}
      falta={falta}
      titulo={titulo}
      onElegir={onElegir}
    />
  );
}

export function Adjunto({ etiqueta, actual, onElegir }: {
  etiqueta: string; actual?: string; onElegir: (f: File) => void;
}) {
  const [nombre, setNombre] = useState<string | null>(null);
  const puesto = !!actual || !!nombre;

  return (
    <div className="mb-2.5">
      <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
        {etiqueta} <span className="font-normal opacity-70">· opcional</span>
      </label>
      <label
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border-[1.5px] border-dashed cursor-pointer text-[11.5px] transition-colors ${
          puesto
            ? 'border-solid border-[#0E7C57]/40 bg-[#0E7C57]/5 text-[#0E7C57]'
            : 'border-border bg-secondary/40 text-muted-foreground hover:border-primary/40'
        }`}
      >
        {puesto ? <Check className="w-3.5 h-3.5 shrink-0" /> : <Paperclip className="w-3.5 h-3.5 shrink-0" />}
        <span className="truncate">{nombre ?? (actual ? 'Ya está cargado' : 'Foto o PDF, hasta 5 MB')}</span>
        <input
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) { setNombre(f.name); onElegir(f); }
          }}
        />
      </label>
    </div>
  );
}

/** Chips de selección múltiple. Se usa para las sedes donde entrena. */
export function Chips({ opciones, elegidas, onCambio }: {
  opciones: { id: string; name: string }[];
  elegidas: string[];
  onCambio: (ids: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {opciones.map(o => {
        const on = elegidas.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onCambio(on ? elegidas.filter(x => x !== o.id) : [...elegidas, o.id])}
            className={`inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-3 py-1.5 rounded-full border transition-colors ${
              on
                ? 'bg-primary/10 border-primary text-primary'
                : 'bg-background border-border text-muted-foreground hover:bg-secondary'
            }`}
          >
            {on && <Check className="w-3 h-3" />}
            {o.name}
          </button>
        );
      })}
    </div>
  );
}
