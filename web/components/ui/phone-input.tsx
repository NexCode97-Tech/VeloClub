'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';

// Emoji de bandera a partir de iso2
function flag(iso2: string): string {
  return iso2.toUpperCase().split('').map(c => String.fromCodePoint(c.charCodeAt(0) + 127397)).join('');
}

interface Country { iso2: string; name: string; dialCode: string }

// Lista de países más usados primero, luego el resto
const COUNTRIES: Country[] = [
  { iso2: 'co', name: 'Colombia',            dialCode: '57' },
  { iso2: 'mx', name: 'México',              dialCode: '52' },
  { iso2: 'ar', name: 'Argentina',           dialCode: '54' },
  { iso2: 'cl', name: 'Chile',               dialCode: '56' },
  { iso2: 'pe', name: 'Perú',                dialCode: '51' },
  { iso2: 've', name: 'Venezuela',           dialCode: '58' },
  { iso2: 'ec', name: 'Ecuador',             dialCode: '593' },
  { iso2: 'bo', name: 'Bolivia',             dialCode: '591' },
  { iso2: 'py', name: 'Paraguay',            dialCode: '595' },
  { iso2: 'uy', name: 'Uruguay',             dialCode: '598' },
  { iso2: 'br', name: 'Brasil',              dialCode: '55' },
  { iso2: 'us', name: 'Estados Unidos',      dialCode: '1' },
  { iso2: 'ca', name: 'Canadá',              dialCode: '1' },
  { iso2: 'es', name: 'España',              dialCode: '34' },
  { iso2: 'pt', name: 'Portugal',            dialCode: '351' },
  { iso2: 'gb', name: 'Reino Unido',         dialCode: '44' },
  { iso2: 'fr', name: 'Francia',             dialCode: '33' },
  { iso2: 'de', name: 'Alemania',            dialCode: '49' },
  { iso2: 'it', name: 'Italia',              dialCode: '39' },
  { iso2: 'pa', name: 'Panamá',              dialCode: '507' },
  { iso2: 'cr', name: 'Costa Rica',          dialCode: '506' },
  { iso2: 'gt', name: 'Guatemala',           dialCode: '502' },
  { iso2: 'hn', name: 'Honduras',            dialCode: '504' },
  { iso2: 'sv', name: 'El Salvador',         dialCode: '503' },
  { iso2: 'ni', name: 'Nicaragua',           dialCode: '505' },
  { iso2: 'do', name: 'Rep. Dominicana',     dialCode: '1809' },
  { iso2: 'cu', name: 'Cuba',                dialCode: '53' },
  { iso2: 'mx', name: 'México',              dialCode: '52' },
  { iso2: 'au', name: 'Australia',           dialCode: '61' },
  { iso2: 'jp', name: 'Japón',               dialCode: '81' },
  { iso2: 'cn', name: 'China',               dialCode: '86' },
  { iso2: 'in', name: 'India',               dialCode: '91' },
  { iso2: 'ru', name: 'Rusia',               dialCode: '7' },
  { iso2: 'za', name: 'Sudáfrica',           dialCode: '27' },
  { iso2: 'ng', name: 'Nigeria',             dialCode: '234' },
  { iso2: 'ke', name: 'Kenia',               dialCode: '254' },
];

// Eliminar duplicados por iso2
const UNIQUE_COUNTRIES = COUNTRIES.filter((c, i, arr) => arr.findIndex(x => x.iso2 === c.iso2) === i);

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function PhoneInput({ value, onChange, placeholder = 'Número de teléfono', className = '' }: Props) {
  const [selected, setSelected] = useState<Country>(UNIQUE_COUNTRIES[0]);
  const [number, setNumber] = useState('');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Sincronizar valor externo → estado interno al montar
  useEffect(() => {
    if (!value) return;
    const match = UNIQUE_COUNTRIES.find(c => value.startsWith('+' + c.dialCode));
    if (match) {
      setSelected(match);
      setNumber(value.slice(match.dialCode.length + 1));
    } else {
      setNumber(value);
    }
  }, []);

  function handleNumberChange(n: string) {
    const clean = n.replace(/[^\d\s\-()]/g, '');
    setNumber(clean);
    onChange(clean ? `+${selected.dialCode}${clean.replace(/\D/g, '')}` : '');
  }

  function handleSelectCountry(c: Country) {
    setSelected(c);
    setOpen(false);
    setSearch('');
    onChange(number ? `+${c.dialCode}${number.replace(/\D/g, '')}` : '');
  }

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

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  const filtered = UNIQUE_COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.dialCode.includes(search)
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
          <span className="text-lg leading-none">{flag(selected.iso2)}</span>
          <span className="text-[12px] font-medium text-foreground">+{selected.dialCode}</span>
          <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => { setOpen(false); setSearch(''); }} />
            <div
              className="absolute left-0 top-full mt-1.5 z-[9999] bg-white border border-border rounded-2xl shadow-xl overflow-hidden"
              style={{ width: 260 }}
            >
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
              <div className="overflow-y-auto" style={{ maxHeight: 220 }}>
                {filtered.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground text-center py-4">Sin resultados</p>
                ) : filtered.map(c => (
                  <button
                    key={c.iso2 + c.dialCode}
                    type="button"
                    onClick={() => handleSelectCountry(c)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-secondary/60 ${c.iso2 === selected.iso2 ? 'bg-primary/5' : ''}`}
                  >
                    <span className="text-lg leading-none w-6 text-center">{flag(c.iso2)}</span>
                    <span className="text-[13px] text-foreground flex-1 truncate">{c.name}</span>
                    <span className="text-[12px] text-muted-foreground font-mono">+{c.dialCode}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Input número */}
      <input
        type="tel"
        value={number}
        onChange={e => handleNumberChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 h-full px-3 text-sm bg-transparent rounded-r-xl focus:outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
