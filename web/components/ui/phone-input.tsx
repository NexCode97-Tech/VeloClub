'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
   Bandera SVG desde CDN pública (mismo enfoque que APP NTRL)
   No requiere instalación de librerías
   ───────────────────────────────────────────────────────────── */
function FlagImg({ code, size = 22 }: { code: string; size?: number }) {
  const h = Math.round(size * 0.75);
  return (
    <img
      src={`https://purecatamphetamine.github.io/country-flag-icons/3x2/${code.toUpperCase()}.svg`}
      width={size}
      height={h}
      alt={code}
      className="rounded-sm shrink-0 object-cover"
      style={{ width: size, height: h, display: 'inline-block' }}
    />
  );
}

/* ─────────────────────────────────────────────────────────────
   COUNTRIES — 195 países, Colombia primero
   ───────────────────────────────────────────────────────────── */
interface Country { iso2: string; name: string; dialCode: string }

const COUNTRIES: Country[] = [
  { iso2: 'CO', dialCode: '57',   name: 'Colombia' },
  { iso2: 'AF', dialCode: '93',   name: 'Afganistán' },
  { iso2: 'AL', dialCode: '355',  name: 'Albania' },
  { iso2: 'DE', dialCode: '49',   name: 'Alemania' },
  { iso2: 'AD', dialCode: '376',  name: 'Andorra' },
  { iso2: 'AO', dialCode: '244',  name: 'Angola' },
  { iso2: 'AG', dialCode: '1268', name: 'Antigua y Barbuda' },
  { iso2: 'SA', dialCode: '966',  name: 'Arabia Saudita' },
  { iso2: 'DZ', dialCode: '213',  name: 'Argelia' },
  { iso2: 'AR', dialCode: '54',   name: 'Argentina' },
  { iso2: 'AM', dialCode: '374',  name: 'Armenia' },
  { iso2: 'AU', dialCode: '61',   name: 'Australia' },
  { iso2: 'AT', dialCode: '43',   name: 'Austria' },
  { iso2: 'AZ', dialCode: '994',  name: 'Azerbaiyán' },
  { iso2: 'BS', dialCode: '1242', name: 'Bahamas' },
  { iso2: 'BH', dialCode: '973',  name: 'Baréin' },
  { iso2: 'BD', dialCode: '880',  name: 'Bangladesh' },
  { iso2: 'BB', dialCode: '1246', name: 'Barbados' },
  { iso2: 'BE', dialCode: '32',   name: 'Bélgica' },
  { iso2: 'BZ', dialCode: '501',  name: 'Belice' },
  { iso2: 'BJ', dialCode: '229',  name: 'Benín' },
  { iso2: 'BY', dialCode: '375',  name: 'Bielorrusia' },
  { iso2: 'MM', dialCode: '95',   name: 'Birmania' },
  { iso2: 'BO', dialCode: '591',  name: 'Bolivia' },
  { iso2: 'BA', dialCode: '387',  name: 'Bosnia y Herzegovina' },
  { iso2: 'BW', dialCode: '267',  name: 'Botsuana' },
  { iso2: 'BR', dialCode: '55',   name: 'Brasil' },
  { iso2: 'BN', dialCode: '673',  name: 'Brunéi' },
  { iso2: 'BG', dialCode: '359',  name: 'Bulgaria' },
  { iso2: 'BF', dialCode: '226',  name: 'Burkina Faso' },
  { iso2: 'BI', dialCode: '257',  name: 'Burundi' },
  { iso2: 'BT', dialCode: '975',  name: 'Bután' },
  { iso2: 'CV', dialCode: '238',  name: 'Cabo Verde' },
  { iso2: 'KH', dialCode: '855',  name: 'Camboya' },
  { iso2: 'CM', dialCode: '237',  name: 'Camerún' },
  { iso2: 'CA', dialCode: '1',    name: 'Canadá' },
  { iso2: 'QA', dialCode: '974',  name: 'Catar' },
  { iso2: 'TD', dialCode: '235',  name: 'Chad' },
  { iso2: 'CL', dialCode: '56',   name: 'Chile' },
  { iso2: 'CN', dialCode: '86',   name: 'China' },
  { iso2: 'CY', dialCode: '357',  name: 'Chipre' },
  { iso2: 'VA', dialCode: '379',  name: 'Ciudad del Vaticano' },
  { iso2: 'KM', dialCode: '269',  name: 'Comoras' },
  { iso2: 'CG', dialCode: '242',  name: 'Congo' },
  { iso2: 'CD', dialCode: '243',  name: 'Congo (RDC)' },
  { iso2: 'KP', dialCode: '850',  name: 'Corea del Norte' },
  { iso2: 'KR', dialCode: '82',   name: 'Corea del Sur' },
  { iso2: 'CR', dialCode: '506',  name: 'Costa Rica' },
  { iso2: 'CI', dialCode: '225',  name: 'Costa de Marfil' },
  { iso2: 'HR', dialCode: '385',  name: 'Croacia' },
  { iso2: 'CU', dialCode: '53',   name: 'Cuba' },
  { iso2: 'DK', dialCode: '45',   name: 'Dinamarca' },
  { iso2: 'DJ', dialCode: '253',  name: 'Djibouti' },
  { iso2: 'DM', dialCode: '1767', name: 'Dominica' },
  { iso2: 'EC', dialCode: '593',  name: 'Ecuador' },
  { iso2: 'EG', dialCode: '20',   name: 'Egipto' },
  { iso2: 'SV', dialCode: '503',  name: 'El Salvador' },
  { iso2: 'AE', dialCode: '971',  name: 'Emiratos Árabes Unidos' },
  { iso2: 'ER', dialCode: '291',  name: 'Eritrea' },
  { iso2: 'SK', dialCode: '421',  name: 'Eslovaquia' },
  { iso2: 'SI', dialCode: '386',  name: 'Eslovenia' },
  { iso2: 'ES', dialCode: '34',   name: 'España' },
  { iso2: 'US', dialCode: '1',    name: 'Estados Unidos' },
  { iso2: 'EE', dialCode: '372',  name: 'Estonia' },
  { iso2: 'ET', dialCode: '251',  name: 'Etiopía' },
  { iso2: 'PH', dialCode: '63',   name: 'Filipinas' },
  { iso2: 'FI', dialCode: '358',  name: 'Finlandia' },
  { iso2: 'FJ', dialCode: '679',  name: 'Fiyi' },
  { iso2: 'FR', dialCode: '33',   name: 'Francia' },
  { iso2: 'GA', dialCode: '241',  name: 'Gabón' },
  { iso2: 'GM', dialCode: '220',  name: 'Gambia' },
  { iso2: 'GE', dialCode: '995',  name: 'Georgia' },
  { iso2: 'GH', dialCode: '233',  name: 'Ghana' },
  { iso2: 'GD', dialCode: '1473', name: 'Granada' },
  { iso2: 'GR', dialCode: '30',   name: 'Grecia' },
  { iso2: 'GT', dialCode: '502',  name: 'Guatemala' },
  { iso2: 'GN', dialCode: '224',  name: 'Guinea' },
  { iso2: 'GW', dialCode: '245',  name: 'Guinea-Bisáu' },
  { iso2: 'GQ', dialCode: '240',  name: 'Guinea Ecuatorial' },
  { iso2: 'GY', dialCode: '592',  name: 'Guyana' },
  { iso2: 'HT', dialCode: '509',  name: 'Haití' },
  { iso2: 'HN', dialCode: '504',  name: 'Honduras' },
  { iso2: 'HU', dialCode: '36',   name: 'Hungría' },
  { iso2: 'IN', dialCode: '91',   name: 'India' },
  { iso2: 'ID', dialCode: '62',   name: 'Indonesia' },
  { iso2: 'IQ', dialCode: '964',  name: 'Irak' },
  { iso2: 'IR', dialCode: '98',   name: 'Irán' },
  { iso2: 'IE', dialCode: '353',  name: 'Irlanda' },
  { iso2: 'IS', dialCode: '354',  name: 'Islandia' },
  { iso2: 'IL', dialCode: '972',  name: 'Israel' },
  { iso2: 'IT', dialCode: '39',   name: 'Italia' },
  { iso2: 'JM', dialCode: '1876', name: 'Jamaica' },
  { iso2: 'JP', dialCode: '81',   name: 'Japón' },
  { iso2: 'JO', dialCode: '962',  name: 'Jordania' },
  { iso2: 'KZ', dialCode: '7',    name: 'Kazajistán' },
  { iso2: 'KE', dialCode: '254',  name: 'Kenia' },
  { iso2: 'KG', dialCode: '996',  name: 'Kirguistán' },
  { iso2: 'KI', dialCode: '686',  name: 'Kiribati' },
  { iso2: 'KW', dialCode: '965',  name: 'Kuwait' },
  { iso2: 'LA', dialCode: '856',  name: 'Laos' },
  { iso2: 'LS', dialCode: '266',  name: 'Lesoto' },
  { iso2: 'LV', dialCode: '371',  name: 'Letonia' },
  { iso2: 'LB', dialCode: '961',  name: 'Líbano' },
  { iso2: 'LR', dialCode: '231',  name: 'Liberia' },
  { iso2: 'LY', dialCode: '218',  name: 'Libia' },
  { iso2: 'LI', dialCode: '423',  name: 'Liechtenstein' },
  { iso2: 'LT', dialCode: '370',  name: 'Lituania' },
  { iso2: 'LU', dialCode: '352',  name: 'Luxemburgo' },
  { iso2: 'MK', dialCode: '389',  name: 'Macedonia del Norte' },
  { iso2: 'MG', dialCode: '261',  name: 'Madagascar' },
  { iso2: 'MY', dialCode: '60',   name: 'Malasia' },
  { iso2: 'MW', dialCode: '265',  name: 'Malaui' },
  { iso2: 'MV', dialCode: '960',  name: 'Maldivas' },
  { iso2: 'ML', dialCode: '223',  name: 'Malí' },
  { iso2: 'MT', dialCode: '356',  name: 'Malta' },
  { iso2: 'MA', dialCode: '212',  name: 'Marruecos' },
  { iso2: 'MU', dialCode: '230',  name: 'Mauricio' },
  { iso2: 'MR', dialCode: '222',  name: 'Mauritania' },
  { iso2: 'MX', dialCode: '52',   name: 'México' },
  { iso2: 'FM', dialCode: '691',  name: 'Micronesia' },
  { iso2: 'MD', dialCode: '373',  name: 'Moldavia' },
  { iso2: 'MC', dialCode: '377',  name: 'Mónaco' },
  { iso2: 'MN', dialCode: '976',  name: 'Mongolia' },
  { iso2: 'ME', dialCode: '382',  name: 'Montenegro' },
  { iso2: 'MZ', dialCode: '258',  name: 'Mozambique' },
  { iso2: 'NA', dialCode: '264',  name: 'Namibia' },
  { iso2: 'NR', dialCode: '674',  name: 'Nauru' },
  { iso2: 'NP', dialCode: '977',  name: 'Nepal' },
  { iso2: 'NI', dialCode: '505',  name: 'Nicaragua' },
  { iso2: 'NE', dialCode: '227',  name: 'Níger' },
  { iso2: 'NG', dialCode: '234',  name: 'Nigeria' },
  { iso2: 'NO', dialCode: '47',   name: 'Noruega' },
  { iso2: 'NZ', dialCode: '64',   name: 'Nueva Zelanda' },
  { iso2: 'OM', dialCode: '968',  name: 'Omán' },
  { iso2: 'NL', dialCode: '31',   name: 'Países Bajos' },
  { iso2: 'PK', dialCode: '92',   name: 'Pakistán' },
  { iso2: 'PW', dialCode: '680',  name: 'Palaos' },
  { iso2: 'PA', dialCode: '507',  name: 'Panamá' },
  { iso2: 'PG', dialCode: '675',  name: 'Papúa Nueva Guinea' },
  { iso2: 'PY', dialCode: '595',  name: 'Paraguay' },
  { iso2: 'PE', dialCode: '51',   name: 'Perú' },
  { iso2: 'PL', dialCode: '48',   name: 'Polonia' },
  { iso2: 'PT', dialCode: '351',  name: 'Portugal' },
  { iso2: 'GB', dialCode: '44',   name: 'Reino Unido' },
  { iso2: 'CF', dialCode: '236',  name: 'República Centroafricana' },
  { iso2: 'CZ', dialCode: '420',  name: 'República Checa' },
  { iso2: 'DO', dialCode: '1809', name: 'República Dominicana' },
  { iso2: 'RW', dialCode: '250',  name: 'Ruanda' },
  { iso2: 'RO', dialCode: '40',   name: 'Rumania' },
  { iso2: 'RU', dialCode: '7',    name: 'Rusia' },
  { iso2: 'WS', dialCode: '685',  name: 'Samoa' },
  { iso2: 'KN', dialCode: '1869', name: 'San Cristóbal y Nieves' },
  { iso2: 'SM', dialCode: '378',  name: 'San Marino' },
  { iso2: 'VC', dialCode: '1784', name: 'San Vicente y las Granadinas' },
  { iso2: 'LC', dialCode: '1758', name: 'Santa Lucía' },
  { iso2: 'ST', dialCode: '239',  name: 'Santo Tomé y Príncipe' },
  { iso2: 'SN', dialCode: '221',  name: 'Senegal' },
  { iso2: 'RS', dialCode: '381',  name: 'Serbia' },
  { iso2: 'SC', dialCode: '248',  name: 'Seychelles' },
  { iso2: 'SL', dialCode: '232',  name: 'Sierra Leona' },
  { iso2: 'SG', dialCode: '65',   name: 'Singapur' },
  { iso2: 'SY', dialCode: '963',  name: 'Siria' },
  { iso2: 'SO', dialCode: '252',  name: 'Somalia' },
  { iso2: 'LK', dialCode: '94',   name: 'Sri Lanka' },
  { iso2: 'SZ', dialCode: '268',  name: 'Suazilandia' },
  { iso2: 'ZA', dialCode: '27',   name: 'Sudáfrica' },
  { iso2: 'SD', dialCode: '249',  name: 'Sudán' },
  { iso2: 'SS', dialCode: '211',  name: 'Sudán del Sur' },
  { iso2: 'SE', dialCode: '46',   name: 'Suecia' },
  { iso2: 'CH', dialCode: '41',   name: 'Suiza' },
  { iso2: 'SR', dialCode: '597',  name: 'Surinam' },
  { iso2: 'TH', dialCode: '66',   name: 'Tailandia' },
  { iso2: 'TZ', dialCode: '255',  name: 'Tanzania' },
  { iso2: 'TJ', dialCode: '992',  name: 'Tayikistán' },
  { iso2: 'TL', dialCode: '670',  name: 'Timor Oriental' },
  { iso2: 'TG', dialCode: '228',  name: 'Togo' },
  { iso2: 'TO', dialCode: '676',  name: 'Tonga' },
  { iso2: 'TT', dialCode: '1868', name: 'Trinidad y Tobago' },
  { iso2: 'TN', dialCode: '216',  name: 'Túnez' },
  { iso2: 'TM', dialCode: '993',  name: 'Turkmenistán' },
  { iso2: 'TR', dialCode: '90',   name: 'Turquía' },
  { iso2: 'TV', dialCode: '688',  name: 'Tuvalu' },
  { iso2: 'UA', dialCode: '380',  name: 'Ucrania' },
  { iso2: 'UG', dialCode: '256',  name: 'Uganda' },
  { iso2: 'UY', dialCode: '598',  name: 'Uruguay' },
  { iso2: 'UZ', dialCode: '998',  name: 'Uzbekistán' },
  { iso2: 'VU', dialCode: '678',  name: 'Vanuatu' },
  { iso2: 'VE', dialCode: '58',   name: 'Venezuela' },
  { iso2: 'VN', dialCode: '84',   name: 'Vietnam' },
  { iso2: 'YE', dialCode: '967',  name: 'Yemen' },
  { iso2: 'ZM', dialCode: '260',  name: 'Zambia' },
  { iso2: 'ZW', dialCode: '263',  name: 'Zimbabue' },
];

/* ─────────────────────────────────────────────────────────────
   parsePhoneDisplay — parsea un número guardado (+573164134212)
   y devuelve { iso2, dialCode, number } para mostrar en UI
   ───────────────────────────────────────────────────────────── */
export function parsePhoneDisplay(raw: string): { iso2: string; dialCode: string; number: string } {
  if (!raw) return { iso2: 'CO', dialCode: '57', number: '' };
  const sorted = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
  const match  = sorted.find(c => raw.startsWith('+' + c.dialCode));
  if (match) {
    const local = raw.slice(match.dialCode.length + 1).trim().replace(/\D/g, '');
    // Colombia: (316) 413-4212
    let formatted = local;
    if (match.iso2 === 'CO' && local.length === 10) {
      formatted = `(${local.slice(0,3)}) ${local.slice(3,6)}-${local.slice(6)}`;
    }
    return { iso2: match.iso2, dialCode: match.dialCode, number: formatted };
  }
  return { iso2: 'CO', dialCode: '57', number: raw };
}

export { FlagImg };

/* ─────────────────────────────────────────────────────────────
   PhoneInput — selector de indicativo + input de número
   Interface idéntica a la versión anterior para compatibilidad
   ───────────────────────────────────────────────────────────── */
interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function PhoneInput({ value, onChange, placeholder = 'Número de teléfono', className = '' }: Props) {
  const [selected, setSelected] = useState<Country>(COUNTRIES[0]);
  const [number, setNumber] = useState('');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [coords, setCoords] = useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight: number; openUp: boolean } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Posiciona la lista de países anclada al botón, con clamp al viewport.
  // Evita que el modal (overflow) recorte el dropdown — abre hacia arriba si no cabe.
  function recalc() {
    const el = dropdownRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const vw = window.innerWidth;
    const GAP = 6;
    const width = Math.min(260, vw - 16);
    const spaceBelow = vh - r.bottom;
    const spaceAbove = r.top;
    const openUp = spaceBelow < 280 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(200, (openUp ? spaceAbove : spaceBelow) - GAP - 10);
    const left = Math.max(8, Math.min(r.left, vw - width - 8));
    setCoords({
      left, width, maxHeight, openUp,
      top:    openUp ? undefined : r.bottom + GAP,
      bottom: openUp ? vh - r.top + GAP : undefined,
    });
  }

  // Recalcular al abrir y reposicionar en scroll/resize (respeta teclado móvil)
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

  // Sincronizar valor externo → estado interno al montar o cuando cambia
  useEffect(() => {
    if (!value) return;
    // Ordenar por longitud de dialCode desc para evitar falsos positivos
    const sorted = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
    const match = sorted.find(c => value.startsWith('+' + c.dialCode));
    if (match) {
      setSelected(match);
      setNumber(value.slice(match.dialCode.length + 1).trim());
    } else {
      setNumber(value);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const t = e.target as Node;
      if (dropdownRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
      setSearch('');
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  const filtered = COUNTRIES.filter(c =>
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
          <FlagImg code={selected.iso2} size={22} />
          <span className="text-[12px] font-medium text-foreground">+{selected.dialCode}</span>
          <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
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
                    placeholder="Buscar país..."
                    className="w-full pl-8 pr-3 py-1.5 text-[13px] rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                </div>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: Math.max(140, coords.maxHeight - 56), WebkitOverflowScrolling: 'touch' }}>
                {filtered.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground text-center py-4">Sin resultados</p>
                ) : filtered.map(c => (
                  <button
                    key={c.iso2}
                    type="button"
                    onClick={() => handleSelectCountry(c)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-secondary/60 ${c.iso2 === selected.iso2 ? 'bg-primary/5' : ''}`}
                  >
                    <FlagImg code={c.iso2} size={20} />
                    <span className="text-[13px] text-foreground flex-1 truncate">{c.name}</span>
                    <span className="text-[12px] text-muted-foreground font-mono">+{c.dialCode}</span>
                  </button>
                ))}
              </div>
            </div>,
            document.body
        )}
      </div>

      {/* Input número */}
      <input
        type="tel"
        value={number}
        onChange={e => handleNumberChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 h-full px-3 text-[12px] md:text-sm bg-white rounded-r-xl focus:outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
