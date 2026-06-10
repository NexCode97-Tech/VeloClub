'use client';

import { useAuth, UserProfile } from '@clerk/nextjs';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { CheckCircle2, Camera, Building2, ChevronDown, X, Crop, ChevronRight, HelpCircle, User, Settings2, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { stagger, cardVariant } from '@/lib/page-animations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { COLOMBIA, DEPARTMENTS } from '@/lib/colombia';
import ReactCrop, { type Crop as CropType, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

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

function SectionHeader({ label, icon: Icon }: { label: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #4361EE 100%)' }}
      >
        <Icon className="w-3.5 h-3.5 text-white" />
      </div>
      <h2 className="text-[15px] font-bold text-foreground">{label}</h2>
    </div>
  );
}

type Tab = 'perfil' | 'club';

export default function AjustesPage() {
  const { getToken, signOut } = useAuth();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [tab, setTab]               = useState<Tab>('perfil');
  const [role, setRole]             = useState<string | null>(null);
  const [club, setClub]             = useState<Club | null>(null);
  const [name, setName]             = useState('');
  const [department, setDepartment] = useState('');
  const [city, setCity]             = useState('');
  const [noAttDays, setNoAttDays]   = useState<number[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [uploadingLogo, setUploadingLogo]   = useState(false);
  const [deletingLogo, setDeletingLogo]     = useState(false);
  const [logoPreview, setLogoPreview]       = useState<string | null>(null);
  const [cropSrc, setCropSrc]             = useState<string | null>(null);
  const [crop, setCrop]                   = useState<CropType>();
  const imgRef                            = useRef<HTMLImageElement>(null);

  const cityOptions = department ? (COLOMBIA[department] ?? []).sort() : [];

  useEffect(() => {
    (async () => {
      const token = await getToken();
      const me = await apiFetch<{ user?: { role: string } }>('/me', { token });
      setRole(me.user?.role ?? null);
      if (me.user?.role === 'ADMIN') {
        const res = await apiFetch<{ club: Club }>('/clubs/settings', { token });
        setClub(res.club);
        setName(res.club.name);
        setDepartment(res.club.department ?? '');
        setCity(res.club.city ?? '');
        setNoAttDays(res.club.noAttendanceDays ?? []);
      }
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

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileRef.current) fileRef.current.value = '';
    if (file.size > 2 * 1024 * 1024) {
      alert('La imagen no puede superar 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setCropSrc(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    const initial = centerCrop(makeAspectCrop({ unit: '%', width: 90 }, 1, w, h), w, h);
    setCrop(initial);
  }, []);

  async function handleCropConfirm() {
    if (!imgRef.current || !crop) return;
    const img  = imgRef.current;
    const SIZE = 400;
    const scaleX = img.naturalWidth  / img.width;
    const scaleY = img.naturalHeight / img.height;
    const canvas = document.createElement('canvas');
    canvas.width  = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(
      img,
      (crop.x ?? 0) * scaleX,
      (crop.y ?? 0) * scaleY,
      (crop.width  ?? img.naturalWidth)  * scaleX,
      (crop.height ?? img.naturalHeight) * scaleY,
      0, 0, SIZE, SIZE,
    );
    const base64 = canvas.toDataURL('image/jpeg', 0.85);
    setCropSrc(null);
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
    } catch (err) {
      alert('Error al subir el logo: ' + (err instanceof Error ? err.message : 'intenta de nuevo'));
      setLogoPreview(null);
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleDeleteLogo() {
    if (!confirm('¿Eliminar el logo del club?')) return;
    setDeletingLogo(true);
    try {
      const token = await getToken();
      await apiFetch('/clubs/logo', { method: 'DELETE', token });
      setClub(prev => prev ? { ...prev, logoUrl: undefined } : prev);
    } finally {
      setDeletingLogo(false);
    }
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );

  const logoSrc = logoPreview ?? club?.logoUrl ?? null;
  const isAdmin = role === 'ADMIN';

  /* ── Bloque: UserProfile de Clerk ─────────────────────────────────── */
  const userProfileBlock = (
    <div className="w-full min-w-0 overflow-hidden">
      <UserProfile
        appearance={{
          elements: {
            rootBox: { width: '100%', maxWidth: '100%' },
            card: {
              width: '100%',
              maxWidth: '100%',
              minHeight: 'unset',
              boxShadow: 'none',
              border: '1px solid rgba(0,0,0,0.07)',
              borderRadius: '1rem',
            },
            navbar: { display: 'none' },
            pageScrollBox: { padding: '16px', paddingBottom: '4px', minHeight: 'unset' },
            cardBox: { width: '100%', maxWidth: '100%', minHeight: 'unset' },
            scrollBox: { minHeight: 'unset' },
            profileSection__connectedAccounts: { display: 'none' },
            profileSectionContent__connectedAccounts: { display: 'none' },
          },
        }}
      />
    </div>
  );

  /* ── Bloque: Ayuda + Cerrar sesión ────────────────────────────────── */
  const helpAndSignOut = (
    <div className="flex flex-col gap-3">
      <button
        onClick={() => router.push('/dashboard/ajustes/ayuda')}
        className="w-full flex items-center gap-3 bg-white rounded-2xl px-4 py-4 text-left transition-colors hover:bg-secondary/40 active:bg-secondary/60"
        style={{ border: '1px solid rgba(120,80,200,0.10)' }}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(67,97,238,0.10)' }}>
          <HelpCircle className="w-4 h-4" style={{ color: '#4361EE' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-foreground">Centro de ayuda</p>
          <p className="text-[11px] text-muted-foreground">Guía rápida de cada módulo</p>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
      </button>

      <button
        onClick={() => signOut({ redirectUrl: '/sign-in' })}
        className="w-full flex items-center gap-3 bg-white rounded-2xl px-4 py-4 text-left transition-colors hover:bg-red-50 active:bg-red-100 cursor-pointer"
        style={{ border: '1px solid rgba(239,71,111,0.15)' }}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(239,71,111,0.10)' }}>
          <LogOut className="w-4 h-4" style={{ color: '#EF476F' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold" style={{ color: '#EF476F' }}>Cerrar sesión</p>
          <p className="text-[11px] text-muted-foreground">Salir de tu cuenta</p>
        </div>
      </button>
    </div>
  );

  /* ── Bloque: Tarjetas del club ────────────────────────────────────── */
  const clubCards = (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">

      {/* Logo */}
      <motion.div variants={cardVariant} className="bg-white border border-border rounded-xl p-4">
        <p style={{ fontSize: 11, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Logo del club</p>
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="relative w-20 h-20 rounded-2xl border border-border overflow-hidden flex items-center justify-center bg-secondary shrink-0">
              {logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoSrc} alt="Logo" className="w-full h-full" style={{ objectFit: 'cover' }} />
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
            <div className="flex gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadingLogo || deletingLogo}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-[12px] font-semibold text-muted-foreground hover:bg-secondary transition-colors"
              >
                <Camera className="w-3.5 h-3.5" />
                {uploadingLogo ? 'Subiendo...' : logoSrc ? 'Cambiar' : 'Subir logo'}
              </button>
              {logoSrc && (
                <button
                  onClick={handleDeleteLogo}
                  disabled={uploadingLogo || deletingLogo}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-red-200 text-[12px] font-semibold text-red-400 hover:bg-red-50 transition-colors"
                >
                  {deletingLogo ? '...' : <X className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">PNG, JPG · 400×400px · máx. 2MB</p>
            <p className="text-[10px] mt-0.5" style={{ color: '#7C3AED' }}>Se recomienda PNG sin fondo para un mejor diseño visual</p>
          </div>
        </div>
      </motion.div>

      {/* Información */}
      <motion.div variants={cardVariant} className="bg-white border border-border rounded-xl p-4 space-y-3">
        <p style={{ fontSize: 11, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Información del club</p>
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
      </motion.div>

      {/* Días sin entrenamiento */}
      <motion.div variants={cardVariant} className="bg-white border border-border rounded-xl p-4 space-y-3">
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Días sin entrenamiento</p>
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
      </motion.div>

      <Button onClick={handleSave} disabled={saving || !name.trim()} className="w-full"
        style={saved ? { background: '#06D6A0' } : {}}>
        {saved
          ? <><CheckCircle2 className="w-4 h-4 mr-2" />Guardado</>
          : saving ? 'Guardando...' : 'Guardar ajustes'
        }
      </Button>
    </motion.div>
  );

  return (
    <div className="min-h-full bg-background">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="px-5 py-3 bg-background">
        <h1 className="text-[22px] font-semibold text-foreground" style={{ fontFamily: 'inherit', lineHeight: 1.1 }}>
          Ajustes
        </h1>
      </div>

      {/* ── Modal recorte de logo ─────────────────────────────────────── */}
      {cropSrc && (
        <div className="fixed inset-0 z-50 bg-black/70 flex flex-col items-end justify-end sm:items-center sm:justify-center">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm flex flex-col" style={{ maxHeight: '90dvh' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <Crop className="w-4 h-4 text-primary" />
                <p className="text-[13px] font-bold text-foreground">Recortar logo</p>
              </div>
              <button onClick={() => setCropSrc(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex justify-center items-center bg-secondary/40 min-h-0">
              <ReactCrop
                crop={crop}
                onChange={c => setCrop(c)}
                aspect={1}
                circularCrop={false}
                minWidth={50}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={cropSrc}
                  alt="Recortar"
                  onLoad={onImageLoad}
                  style={{ maxHeight: '55dvh', width: 'auto' }}
                />
              </ReactCrop>
            </div>
            <div className="flex gap-2 px-4 py-4 shrink-0 border-t border-border">
              <button
                onClick={() => setCropSrc(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-[13px] font-semibold text-muted-foreground"
              >
                Cancelar
              </button>
              <button
                onClick={handleCropConfirm}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-[13px] font-semibold"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MOBILE (< lg) — tabs para admin, directo para otros
      ══════════════════════════════════════════════════════════════ */}
      <div className="lg:hidden">
        {isAdmin && (
          <div className="px-4 pb-4">
            <div
              className="relative flex rounded-2xl p-1 gap-1"
              style={{ background: '#FFFFFF', boxShadow: '0 1px 4px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(0,0,0,0.06)' }}
            >
              {([
                { key: 'perfil' as Tab, label: 'Mi perfil',  icon: User },
                { key: 'club'   as Tab, label: 'Mi club',    icon: Settings2 },
              ]).map(({ key, label, icon: Icon }) => {
                const active = tab === key;
                return (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className="relative flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl z-10"
                  >
                    {active && (
                      <motion.div
                        layoutId="ajustes-tab-pill"
                        className="absolute inset-0 rounded-xl"
                        style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #4361EE 100%)', boxShadow: '0 4px 20px rgba(124,58,237,0.40)' }}
                        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                      />
                    )}
                    <Icon className="relative w-3.5 h-3.5 z-10" style={{ color: active ? '#fff' : '#8E87A8' }} />
                    <p className="relative text-[12px] font-bold leading-none z-10" style={{ color: active ? '#fff' : '#8E87A8' }}>
                      {label}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {(!isAdmin || tab === 'perfil') && (
            <motion.div
              key="perfil"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="px-4 pb-28 space-y-3"
            >
              {userProfileBlock}
              {helpAndSignOut}
            </motion.div>
          )}

          {isAdmin && tab === 'club' && (
            <motion.div
              key="club"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="px-4 pb-28"
            >
              {clubCards}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          DESKTOP (>= lg) — columna única centrada, perfil arriba / club abajo
      ══════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:block px-6 pb-8 max-w-2xl space-y-8">
        {/* Bloque: Mi perfil */}
        <div className="space-y-4 min-w-0">
          <SectionHeader label="Mi perfil" icon={User} />
          {userProfileBlock}
          {helpAndSignOut}
        </div>

        {/* Bloque: Mi club (solo admin) */}
        {isAdmin && (
          <div className="space-y-4">
            <SectionHeader label="Mi club" icon={Settings2} />
            {clubCards}
          </div>
        )}
      </div>
    </div>
  );
}
