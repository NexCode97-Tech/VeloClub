'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, Check } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
   SearchableSelect — select con buscador integrado

   El Select de base-ui no filtra: con 100 deportistas en la lista
   hay que bajar hasta encontrar el nombre. Este componente reusa el
   posicionamiento del PhoneInput (portal + fixed + clamp al viewport)
   para que el dropdown no lo recorte el overflow del modal.
   ───────────────────────────────────────────────────────────── */

export interface OpcionBuscable {
  value: string;
  label: string;
}

interface Props {
  options: OpcionBuscable[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
}

// Ignora tildes para que "nunez" encuentre a "Núñez"
function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Seleccionar',
  searchPlaceholder = 'Buscar...',
  emptyMessage = 'Sin resultados',
  className = '',
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [coords, setCoords] = useState<{
    left: number; width: number; top?: number; bottom?: number; maxHeight: number; openUp: boolean;
  } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef    = useRef<HTMLDivElement>(null);
  const searchRef  = useRef<HTMLInputElement>(null);

  const seleccionada = options.find(o => o.value === value);

  // Ancla la lista al botón con clamp al viewport. Abre hacia arriba si abajo no cabe.
  function recalc() {
    const el = triggerRef.current;
    if (!el) return;
    const r  = el.getBoundingClientRect();
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const vw = window.innerWidth;
    const GAP = 6;
    const width = Math.min(Math.max(r.width, 220), vw - 16);
    const spaceBelow = vh - r.bottom;
    const spaceAbove = r.top;
    const openUp = spaceBelow < 260 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(180, (openUp ? spaceAbove : spaceBelow) - GAP - 10);
    const left = Math.max(8, Math.min(r.left, vw - width - 8));
    setCoords({
      left, width, maxHeight, openUp,
      top:    openUp ? undefined : r.bottom + GAP,
      bottom: openUp ? vh - r.top + GAP : undefined,
    });
  }

  useEffect(() => {
    if (!open) return;
    recalc();
    const on = () => recalc();
    window.addEventListener('scroll', on, true);
    window.addEventListener('resize', on);
    window.visualViewport?.addEventListener('resize', on);
    return () => {
      window.removeEventListener('scroll', on, true);
      window.removeEventListener('resize', on);
      window.visualViewport?.removeEventListener('resize', on);
    };
  }, [open]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handler(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
      setSearch('');
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Cerrar con Escape sin arrastrar el modal que lo contiene
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
      setSearch('');
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  const filtradas = useMemo(() => {
    const q = normalizar(search.trim());
    if (!q) return options;
    return options.filter(o => normalizar(o.label).includes(q));
  }, [options, search]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex h-12 w-full items-center justify-between gap-2 rounded-xl border border-input bg-transparent px-3 text-left transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none ${className}`}
      >
        <span className={`text-sm truncate ${seleccionada ? 'text-foreground' : 'text-muted-foreground'}`}>
          {seleccionada?.label ?? placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && coords && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          className="bg-white border border-border rounded-2xl shadow-xl overflow-hidden"
          style={{
            position: 'fixed', left: coords.left, width: coords.width, zIndex: 9999,
            ...(coords.openUp ? { bottom: coords.bottom } : { top: coords.top }),
          }}
        >
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-3 py-1.5 text-[13px] rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
          </div>
          <div
            className="overflow-y-auto p-1"
            style={{ maxHeight: Math.max(140, coords.maxHeight - 56), WebkitOverflowScrolling: 'touch' }}
          >
            {filtradas.length === 0 ? (
              <p className="text-[12px] text-muted-foreground text-center py-4">{emptyMessage}</p>
            ) : filtradas.map(o => {
              const activa = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false); setSearch(''); }}
                  className={`w-full flex items-center gap-2 rounded-lg pl-3 pr-2 py-2 text-left text-[13px] font-medium transition-colors hover:bg-[rgba(124,58,237,0.07)] hover:text-[#7C3AED] ${activa ? 'font-semibold text-[#7C3AED] bg-[rgba(124,58,237,0.07)]' : 'text-[#1A1028]'}`}
                >
                  <span className="flex-1 truncate">{o.label}</span>
                  {activa && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: '#7C3AED' }} />}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export default SearchableSelect;
