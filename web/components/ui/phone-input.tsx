'use client';

import { useState, useRef, useEffect } from 'react';
import {
  defaultCountries,
  parseCountry,
  usePhoneInput,
} from 'react-international-phone';
import { ChevronDown, Search } from 'lucide-react';

// Convierte iso2 → emoji de bandera (ej: "co" → 🇨🇴)
function flagEmoji(iso2: string): string {
  return iso2.toUpperCase().split('').map(c => String.fromCodePoint(c.charCodeAt(0) + 127397)).join('');
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function PhoneInput({ value, onChange, placeholder = 'Número de teléfono', className = '' }: Props) {
  const { inputValue, handlePhoneValueChange, inputRef, country, setCountry } = usePhoneInput({
    defaultCountry: 'co',
    value,
    countries: defaultCountries,
    onChange: (data) => onChange(data.phone),
  });

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // usePhoneInput devuelve country como CountryData (tuple), parseCountry lo procesa
  const parsed = parseCountry(country as unknown as Parameters<typeof parseCountry>[0]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus en búsqueda al abrir
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  const filtered = defaultCountries
    .map(c => parseCountry(c))
    .filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.dialCode.includes(search)
    );

  return (
    <div className={`relative flex h-12 rounded-xl border border-input bg-background focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary transition-all ${className}`}>
      {/* Selector de país */}
      <div ref={dropdownRef} className="relative flex-shrink-0">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1.5 h-full px-3 rounded-l-xl hover:bg-secondary/60 transition-colors border-r border-input"
        >
          <span className="text-lg leading-none">{flagEmoji(parsed.iso2)}</span>
          <span className="text-[12px] font-medium text-foreground">+{parsed.dialCode}</span>
          <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown — portal-like con fixed */}
        {open && (
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => { setOpen(false); setSearch(''); }} />
            <div
              className="absolute left-0 top-full mt-1.5 z-[9999] bg-white border border-border rounded-2xl shadow-xl overflow-hidden"
              style={{ width: 260 }}
            >
              {/* Búsqueda */}
              <div className="p-2 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar país..."
                    className="w-full pl-8 pr-3 py-1.5 text-[13px] rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                </div>
              </div>

              {/* Lista */}
              <div className="overflow-y-auto" style={{ maxHeight: 220 }}>
                {filtered.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground text-center py-4">Sin resultados</p>
                ) : (
                  filtered.map(p => {
                    const isSelected = p.iso2 === parsed.iso2;
                    return (
                      <button
                        key={p.iso2}
                        type="button"
                        onClick={() => { setCountry(p.iso2); setOpen(false); setSearch(''); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-secondary/60 ${isSelected ? 'bg-primary/5' : ''}`}
                      >
                        <span className="text-lg leading-none w-6 text-center">{flagEmoji(p.iso2)}</span>
                        <span className="text-[13px] text-foreground flex-1 truncate">{p.name}</span>
                        <span className="text-[12px] text-muted-foreground font-mono">+{p.dialCode}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Input de número */}
      <input
        ref={inputRef}
        type="tel"
        value={inputValue}
        onChange={handlePhoneValueChange}
        placeholder={placeholder}
        className="flex-1 h-full px-3 text-sm bg-transparent rounded-r-xl focus:outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
