'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { CheckCircle2, Camera, Building2, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { COLOMBIA, DEPARTMENTS } from '@/lib/colombia';

const DAYS = [
  { label: 'Domingo',   value: 0 },
  { label: 'Lunes',     value: 1 },
  { label: 'Martes',    value: 2 },
  { label: 'Miércoles', value: 3 },
  { label: 'Jueves',    value: 4 },
  { label: 'Viernes',   value: 5 },
  { label: 'Sábado',    value: 6 },
];

interface Club {
  id: string; name: string; city?: string; department?: string;
  logoUrl?: string; noAttendanceDays: number[];
}

function SearchableSelect({
  label, value, options, placeholder, onChange,
}: {
  label: string; value: string; options: string[]; placeholder: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const filtered = options.filter(o => o.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function select(v: string) {
    onChange(v);
    setQuery('');
    setOpen(false);
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => { setOpen(o => !o); setQuery(''); }}
          className="w-full flex items-center justify-between px-3 py-2 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <span className={value ? 'text-foreground' : 'text-muted-foreground'}>{value || placeholder}</span>
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        </button>
        {open && (
          <div className="absolute z-50 mt-1 w-full bg-white border border-border rounded-xl shadow-lg overflow-hidden">
            <div className="p-2 border-b border-border">
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar..."
                className="w-full text-base px-2 py-1 outline-none bg-transparent"
                style={{ fontSize: '16px' }}
              />
            </div>
            <div className="max-h-52 overflow-y-auto">
              {value && (
                <button
                  type="button"
                  onClick={() => select('')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-secondary"
                >
                  <X className="w-3 h-3" /> Limpiar
                </button>
              )}
              {filtered.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</p>
              ) : filtered.map(o => (
                <button
                  key={o}
                  type="button"
                  onClick={() => select(o)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors ${o === value ? 'font-semibold text-primary' : 'text-foreground'}`}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AjustesPage() {
  const { getToken } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [club, setClub]             = useState<Club | null>(null);
  const [name, setName]             = useState('');
  const [department, setDepartment] = useState('');
  const [city, setCity]             = useState('');
  const [noAttDays, setNoAttDays]   = useState<number[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview]     = useState<string | null>(null);

  const cityOptions = department ? (COLOMBIA[department] ?? []).sort() : [];

  useEffect(() => {
    (async () => {
      const token = await getToken();
      const res = await apiFetch<{ club: Club }>('/clubs/settings', { token });
      setClub(res.club);
      setName(res.club.name);
      setDepartment(res.club.department ?? '');
      setCity(res.club.city ?? '');
      setNoAttDays(res.club.noAttendanceDays ?? []);
      setLoading(false);
    })();
  }, []);

  function toggleDay(day: number) {
    setNoAttDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true); setSaved(false);
    try {
      const token = await getToken();
      const res = await apiFetch<{ club: Club }>('/clubs/settings', {
        method: 'PATCH', token,
        body: JSON.stringify({
          name: name.trim(),
          department: department || undefined,
          city: city || undefined,
          noAttendanceDays: noAttDays,
        }),
      });
      setClub(res.club);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      setLogoPreview(base64);
      setUploadingLogo(true);
      try {
        const token = await getToken();
        const res = await apiFetch<{ club: { id: string; logoUrl: string } }>('/clubs/logo', {
          method: 'POST', token,
          body: JSON.stringify({ base64 }),
        });
        setClub(prev => prev ? { ...prev, logoUrl: res.club.logoUrl } : prev);
        setLogoPreview(null);
      } catch {
        setLogoPreview(null);
      } finally {
        setUploadingLogo(false);
        if (fileRef.current) fileRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );

  const logoSrc = logoPreview ?? club?.logoUrl ?? null;

  return (
    <div className="min-h-full bg-background">
      <div className="px-5 py-3 bg-background border-b border-border">
        <h1 className="text-[17px] font-bold text-foreground" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
          Ajustes del club
        </h1>
      </div>

      <div className="px-4 pt-4 space-y-4 max-w-lg pb-8">

        {/* Logo */}
        <div className="bg-white border border-border rounded-xl p-4">
          <p className="text-[13px] font-bold text-foreground mb-3">Logo del club</p>
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="relative w-20 h-20 rounded-2xl border border-border overflow-hidden flex items-center justify-center bg-secondary shrink-0">
                {logoSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoSrc} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <Building2 className="w-8 h-8 text-muted-foreground/40" />
                )}
              </div>
              {uploadingLogo && (
                <div className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center">
                  <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                </div>
              )}
            </div>
            <div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadingLogo}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-[12px] font-semibold text-muted-foreground hover:bg-secondary transition-colors"
              >
                <Camera className="w-3.5 h-3.5" />
                {uploadingLogo ? 'Subiendo...' : logoSrc ? 'Cambiar logo' : 'Subir logo'}
              </button>
              <p className="text-[10px] text-muted-foreground mt-1.5">PNG, JPG · máx. 5MB</p>
            </div>
          </div>
        </div>

        {/* Información */}
        <div className="bg-white border border-border rounded-xl p-4 space-y-3">
          <p className="text-[13px] font-bold text-foreground">Información del club</p>
          <div className="space-y-2">
            <Label>Nombre del club</Label>
            <Input value={name} onChange={e => { setName(e.target.value); setSaved(false); }} placeholder="Nombre del club" />
          </div>
          <SearchableSelect
            label="Departamento"
            value={department}
            options={DEPARTMENTS}
            placeholder="Seleccionar departamento"
            onChange={v => { setDepartment(v); setCity(''); setSaved(false); }}
          />
          <SearchableSelect
            label="Ciudad / Municipio"
            value={city}
            options={cityOptions}
            placeholder={department ? 'Seleccionar ciudad' : 'Primero elige un departamento'}
            onChange={v => { setCity(v); setSaved(false); }}
          />
        </div>

        {/* Días sin entrenamiento */}
        <div className="bg-white border border-border rounded-xl p-4 space-y-3">
          <div>
            <p className="text-[13px] font-bold text-foreground">Días sin entrenamiento</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">La asistencia no se registrará estos días</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {DAYS.map(({ label, value }) => {
              const active = noAttDays.includes(value);
              return (
                <button
                  key={value}
                  onClick={() => toggleDay(value)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all"
                  style={active
                    ? { background: 'rgba(239,71,111,0.08)', borderColor: '#EF476F', color: '#EF476F' }
                    : { background: '#fff', borderColor: 'rgba(120,80,200,0.12)', color: '#8E87A8' }
                  }
                >
                  <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                    style={active ? { borderColor: '#EF476F', background: '#EF476F' } : { borderColor: '#C4C2CF' }}>
                    {active && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <span className="text-[12px] font-semibold">{label}</span>
                </button>
              );
            })}
          </div>
          {noAttDays.length === 0 && (
            <p className="text-[11px] text-muted-foreground text-center">Ningún día bloqueado</p>
          )}
        </div>

        <Button onClick={handleSave} disabled={saving || !name.trim()} className="w-full"
          style={saved ? { background: '#06D6A0' } : {}}>
          {saved
            ? <><CheckCircle2 className="w-4 h-4 mr-2" />Guardado</>
            : saving ? 'Guardando...' : 'Guardar ajustes'
          }
        </Button>

      </div>
    </div>
  );
}
