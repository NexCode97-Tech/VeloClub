'use client';

import { useState } from 'react';
import { Check, ChevronDown, Paperclip } from 'lucide-react';

/**
 * Los campos de la ficha de un deportista.
 *
 * Viven aparte porque los usan los dos formularios que la llenan: el del club,
 * que muestra todo por secciones, y el público, que lo reparte en pasos. El
 * aspecto de un campo no puede depender de cuál de los dos lo esté pintando.
 */

export function entrada(hayError: boolean): string {
  return `w-full px-3 py-2 rounded-lg border bg-background text-[13px] outline-none transition-colors ${
    hayError ? 'border-[#EF476F]' : 'border-border focus:border-primary'
  }`;
}

export function Campo({ etiqueta, obligatorio, error, children }: {
  etiqueta: string; obligatorio?: boolean; error?: string | null; children: React.ReactNode;
}) {
  return (
    <div className="mb-2.5">
      <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
        {etiqueta}
        {obligatorio && <span className="text-[#EF476F] ml-0.5">*</span>}
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
 * Desplegable de catálogo. Es un `select` de verdad y no un menú dibujado a
 * mano: en móvil abre la rueda nativa, que es más rápida de usar que cualquier
 * lista propia, y no hay que resolverle el recorte ni el apilamiento.
 */
export type Opcion = string | { valor: string; texto: string };

export function Desplegable({ valor, opciones, vacio, error, onElegir }: {
  valor: string;
  /** Un catálogo de textos, o pares valor/texto cuando lo que se guarda no es
   *  lo que se lee: las sedes guardan un id y muestran su nombre. */
  opciones: Opcion[];
  vacio: string;
  error?: boolean;
  onElegir: (v: string) => void;
}) {
  const normal = opciones.map(o => (typeof o === 'string' ? { valor: o, texto: o } : o));
  return (
    <div className="relative">
      <select
        value={valor}
        onChange={e => onElegir(e.target.value)}
        className={`${entrada(!!error)} appearance-none pr-8 ${valor ? '' : 'text-muted-foreground'}`}
      >
        <option value="">{vacio}</option>
        {normal.map(o => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
      </select>
      <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
    </div>
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
