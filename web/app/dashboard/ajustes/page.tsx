'use client';

import { useAuth, useUser, useClerk } from '@clerk/nextjs';
import { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import {
  CheckCircle2, Camera, Building2, ChevronDown, X, Crop,
  ChevronRight, HelpCircle, User, LogOut, Lock, UserCog, Trash2, AlertTriangle,
} from 'lucide-react';
import { IconClub, IconPerfil, IconSuscripcion } from '@/components/ui/custom-icons';
import SuscripcionCard from '@/components/ajustes/suscripcion-card';
import { PhoneInput } from '@/components/ui/phone-input';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { COLOMBIA, DEPARTMENTS } from '@/lib/colombia';
import ReactCrop, { type Crop as CropType, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

const DAYS = [
  { label: 'Lunes',     short: 'L', value: 1 },
  { label: 'Martes',    short: 'M', value: 2 },
  { label: 'Miércoles', short: 'X', value: 3 },
  { label: 'Jueves',    short: 'J', value: 4 },
  { label: 'Viernes',   short: 'V', value: 5 },
  { label: 'Sábado',    short: 'S', value: 6 },
  { label: 'Domingo',   short: 'D', value: 0 },
];

interface Club {
  id: string; name: string; city?: string; department?: string;
  logoUrl?: string; noAttendanceDays: number[];
}
interface MemberMe {
  id: string; fullName: string; role: string; pictureUrl?: string;
  phone?: string; email?: string; category?: string; tipo?: string;
  createdAt?: string;
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

  function select(v: string) { onChange(v); setQuery(''); setOpen(false); }

  return (
    <div className="space-y-1.5">
      <Label className="text-[12px]">{label}</Label>
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
                autoFocus value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Buscar..." className="w-full text-base px-2 py-1 outline-none bg-transparent"
                style={{ fontSize: '16px' }}
              />
            </div>
            <div className="max-h-52 overflow-y-auto">
              {value && (
                <button type="button" onClick={() => select('')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-secondary">
                  <X className="w-3 h-3" /> Limpiar
                </button>
              )}
              {filtered.length === 0
                ? <p className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</p>
                : filtered.map(o => (
                  <button key={o} type="button" onClick={() => select(o)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors ${o === value ? 'font-semibold text-primary' : 'text-foreground'}`}>
                    {o}
                  </button>
                ))
              }
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ label, icon: Icon }: { label: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #4361EE 100%)' }}>
        <Icon className="w-3.5 h-3.5 text-white" />
      </div>
      <h2 className="text-[15px] font-semibold text-foreground">{label}</h2>
    </div>
  );
}

function formatJoinDate(dateStr?: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const mes = d.toLocaleDateString('es-CO', { month: 'long' });
  const año = d.getFullYear();
  return `Socio desde ${mes.charAt(0).toUpperCase() + mes.slice(1)} ${año}`;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  COACH: 'Entrenador',
  STUDENT: 'Deportista',
  SUPERADMIN: 'Superadmin',
};

// Mismos colores por rol que el footer del sidebar (SIDEBAR_ROLE_COLOR en layout.tsx)
const PROFILE_ROLE_COLOR: Record<string, string> = {
  SUPERADMIN: '#EF476F',
  ADMIN: '#FFB703',
  COACH: '#06D6A0',
  STUDENT: '#7C3AED',
};

type Tab = 'perfil' | 'club' | 'suscripcion';

export default function AjustesPage() {
  return (
    <Suspense fallback={null}>
      <AjustesPageContent />
    </Suspense>
  );
}

function AjustesPageContent() {
  const { getToken, signOut } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);

  const tabParam = searchParams.get('tab');
  const validTab: Tab = tabParam === 'club' || tabParam === 'suscripcion' ? tabParam : 'perfil';
  const [tab, setTab]               = useState<Tab>(validTab);
  const [role, setRole]             = useState<string | null>(null);
  const [memberMe, setMemberMe]     = useState<MemberMe | null>(null);
  const [club, setClub]             = useState<Club | null>(null);
  const [name, setName]             = useState('');
  const [department, setDepartment] = useState('');
  const [city, setCity]             = useState('');
  const [noAttDays, setNoAttDays]   = useState<number[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);

  // Perfil
  const [phone, setPhone]               = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedProfile, setSavedProfile]   = useState(false);

  // Logo
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [deletingLogo, setDeletingLogo]   = useState(false);
  const [logoPreview, setLogoPreview]     = useState<string | null>(null);
  const [cropSrc, setCropSrc]             = useState<string | null>(null);
  const [crop, setCrop]                   = useState<CropType>();
  const imgRef                            = useRef<HTMLImageElement>(null);

  // Eliminar cuenta
  const [deleteOpen, setDeleteOpen]       = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting]           = useState(false);
  const [deleteError, setDeleteError]     = useState<string | null>(null);

  // Cerrar sesión
  const [signingOut, setSigningOut]       = useState(false);
  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try { await signOut(); } catch { /* ignorar */ }
    // Redirección dura: garantiza que la sesión cerrada se refleje sin refrescar
    window.location.href = '/sign-in';
  }

  const cityOptions = department ? (COLOMBIA[department] ?? []).sort() : [];

  // Sincroniza el tab si cambia el query param (clic en el sub-menú del sidebar
  // estando ya en esta página, sin remount del componente).
  useEffect(() => { setTab(validTab); }, [validTab]);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      const me = await apiFetch<{ user?: { role: string } }>('/me', { token });
      setRole(me.user?.role ?? null);

      const memberRes = await apiFetch<{ member: MemberMe | null }>('/members/me', { token });
      if (memberRes.member) {
        setMemberMe(memberRes.member);
        setPhone(memberRes.member.phone ?? '');
      }

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
        body: JSON.stringify({ name: name.trim(), department: department || undefined, city: city || undefined, noAttendanceDays: noAttDays }),
      });
      setClub(res.club);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveProfile() {
    setSavingProfile(true);
    try {
      const token = await getToken();
      // Endpoint self-resolving: el backend encuentra el miembro desde el token,
      // así funciona aunque el cliente no tenga cargado memberMe.id.
      const res = await apiFetch<{ member: MemberMe }>(`/members/me/contact`, {
        method: 'PATCH', token,
        body: JSON.stringify({ phone: phone || null }),
      });
      setMemberMe(res.member);
      setSavedProfile(true);
      setTimeout(() => setSavedProfile(false), 3000);
    } catch (err) {
      alert('Error al guardar: ' + (err instanceof Error ? err.message : 'intenta de nuevo'));
    } finally {
      setSavingProfile(false);
    }
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileRef.current) fileRef.current.value = '';
    if (file.size > 2 * 1024 * 1024) { alert('La imagen no puede superar 2MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setCropSrc(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    setCrop(centerCrop(makeAspectCrop({ unit: '%', width: 90 }, 1, w, h), w, h));
  }, []);

  async function handleCropConfirm() {
    if (!imgRef.current || !crop) return;
    const img = imgRef.current;
    const SIZE = 400;
    const scaleX = img.naturalWidth / img.width;
    const scaleY = img.naturalHeight / img.height;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE; canvas.height = SIZE;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, (crop.x ?? 0) * scaleX, (crop.y ?? 0) * scaleY,
      (crop.width ?? img.naturalWidth) * scaleX, (crop.height ?? img.naturalHeight) * scaleY, 0, 0, SIZE, SIZE);
    const base64 = canvas.toDataURL('image/jpeg', 0.85);
    setCropSrc(null); setLogoPreview(base64); setUploadingLogo(true);
    try {
      const token = await getToken();
      const res = await apiFetch<{ club: { id: string; logoUrl: string } }>('/clubs/logo', {
        method: 'POST', token, body: JSON.stringify({ base64 }),
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

  async function handleDeleteAccount() {
    setDeleting(true); setDeleteError(null);
    try {
      const token = await getToken();
      await apiFetch('/me', { method: 'DELETE', token });
      try { await signOut(); } catch { /* ignorar */ }
      window.location.href = '/sign-in';
    } catch (err) {
      const { ApiError } = await import('@/lib/api-client');
      if (err instanceof ApiError && err.status === 409) {
        setDeleteError('Eres el único administrador de este club. Agrega otro administrador desde Miembros, o elimina el club, antes de eliminar tu cuenta.');
      } else {
        setDeleteError('No pudimos eliminar tu cuenta. Intenta de nuevo.');
      }
      setDeleting(false);
    }
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );

  const logoSrc = logoPreview ?? club?.logoUrl ?? null;
  const isAdmin = role === 'ADMIN';
  const avatarSrc = memberMe?.pictureUrl || user?.imageUrl || null;
  const displayName = memberMe?.fullName || user?.fullName || '';
  const displayEmail = memberMe?.email || user?.emailAddresses?.[0]?.emailAddress || '';

  /* ── Tarjeta Mi Perfil ───────────────────────────────────────────────── */
  const perfilCard = (
    <div className="bg-white border border-border rounded-2xl overflow-hidden">
      {/* Encabezado con avatar */}
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-secondary border border-border shrink-0 flex items-center justify-center">
            {avatarSrc
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={avatarSrc} alt={displayName} className="w-full h-full object-cover" />
              : <User className="w-7 h-7 text-muted-foreground/40" />
            }
          </div>
          <div className="min-w-0">
            <p className="text-[16px] font-semibold text-foreground truncate">{displayName}</p>
            <span
              className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide mt-1"
              style={{ background: `${PROFILE_ROLE_COLOR[role ?? ''] ?? '#7C3AED'}1A`, color: PROFILE_ROLE_COLOR[role ?? ''] ?? '#7C3AED' }}
            >
              {ROLE_LABELS[role ?? ''] ?? role}
            </span>
            {memberMe?.createdAt && (
              <p className="text-[11px] text-muted-foreground mt-1">{formatJoinDate(memberMe.createdAt)}</p>
            )}
          </div>
        </div>
      </div>

      {/* Campos del formulario */}
      <div className="px-5 py-4 space-y-3 border-b border-border">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[12px]">Nombre de usuario</Label>
            <Input
              value={displayName} readOnly
              className="text-muted-foreground bg-muted/30 cursor-not-allowed text-sm h-12"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px]">Teléfono</Label>
            <PhoneInput
              value={phone}
              onChange={v => { setPhone(v); setSavedProfile(false); }}
              placeholder="Número de contacto"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[12px]">Correo electrónico</Label>
          <div className="relative">
            <Input
              value={displayEmail} readOnly
              className="text-muted-foreground bg-muted/30 cursor-not-allowed pr-10 text-sm h-12"
            />
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
          </div>
        </div>
        <Button
          onClick={handleSaveProfile}
          disabled={savingProfile}
          className="w-full transition-all"
          style={savedProfile ? { background: '#06D6A0' } : {}}
        >
          {savedProfile
            ? <><CheckCircle2 className="w-4 h-4 mr-2" />Guardado</>
            : savingProfile ? 'Guardando...' : 'Guardar cambios'
          }
        </Button>
      </div>

      {/* Gestionar cuenta */}
      <button
        type="button"
        onClick={() => clerk.openUserProfile()}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-secondary/40 active:bg-secondary/60 transition-colors border-b border-border"
      >
        <UserCog className="w-4 h-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-foreground">Gestionar cuenta</p>
          <p className="text-[11px] text-muted-foreground">Nombre, contraseña y datos de acceso</p>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </button>

      {/* Centro de ayuda */}
      <button
        type="button"
        onClick={() => router.push('/dashboard/ajustes/ayuda')}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-secondary/40 active:bg-secondary/60 transition-colors border-b border-border"
      >
        <HelpCircle className="w-4 h-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-foreground">Centro de ayuda</p>
          <p className="text-[11px] text-muted-foreground">Tutoriales y soporte técnico</p>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </button>

      {/* Cerrar sesión */}
      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-red-50 active:bg-red-100 transition-colors disabled:opacity-60"
      >
        <LogOut className="w-4 h-4 shrink-0" style={{ color: '#EF476F' }} />
        <span className="flex-1 text-[13px] font-semibold" style={{ color: '#EF476F' }}>
          {signingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
        </span>
      </button>
    </div>
  );

  /* ── Tarjeta Zona de peligro — eliminar cuenta ─────────────────────────── */
  const dangerCard = (
    <div className="rounded-2xl p-5" style={{ background: 'rgba(239,71,111,0.04)', border: '1px solid rgba(239,71,111,0.18)' }}>
      <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#EF476F' }}>Zona de peligro</p>
      <p className="text-[12px] text-muted-foreground mb-4">
        Al eliminar tu cuenta perderás el acceso de inmediato. Tus datos personales se eliminan; los registros de pagos y asistencia se conservan de forma anónima por obligaciones contables del club.
      </p>
      <button
        type="button"
        onClick={() => { setDeleteOpen(true); setDeleteConfirm(''); setDeleteError(null); }}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold transition-colors"
        style={{ background: 'rgba(239,71,111,0.10)', color: '#EF476F', border: '1px solid rgba(239,71,111,0.25)' }}
      >
        <Trash2 className="w-4 h-4" />
        Eliminar mi cuenta
      </button>
    </div>
  );

  /* ── Tarjeta Mi Club ──────────────────────────────────────────────────── */
  const clubCard = (
    <div className="bg-white border border-border rounded-2xl p-5 space-y-5">
      {/* Logo */}
      <div className="flex items-center gap-4">
        <div className="relative w-20 h-20 rounded-full border border-border overflow-hidden flex items-center justify-center bg-secondary shrink-0">
          {logoSrc
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={logoSrc} alt="Logo" className="w-full h-full object-cover" />
            : <Building2 className="w-8 h-8 text-muted-foreground/40" />
          }
          {uploadingLogo && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
            </div>
          )}
        </div>
        <div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
          <div className="flex items-center gap-3">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploadingLogo || deletingLogo}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-[12px] font-semibold text-foreground hover:bg-secondary transition-colors"
            >
              <Camera className="w-3.5 h-3.5" />
              {uploadingLogo ? 'Subiendo...' : logoSrc ? 'Cambiar' : 'Subir logo'}
            </button>
            {logoSrc && (
              <button
                onClick={handleDeleteLogo}
                disabled={uploadingLogo || deletingLogo}
                className="text-[12px] font-semibold transition-colors hover:opacity-70"
                style={{ color: '#EF476F' }}
              >
                {deletingLogo ? '...' : 'Eliminar'}
              </button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">PNG, JPG · 400×400px · máx. 2MB</p>
        </div>
      </div>

      {/* Información del club */}
      <div className="space-y-3">
        <p style={{ fontSize: 11, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Información del club
        </p>
        <div className="space-y-1.5">
          <Label className="text-[12px]">Nombre del club</Label>
          <Input value={name} onChange={e => { setName(e.target.value); setSaved(false); }} placeholder="Nombre del club" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SearchableSelect
            label="Departamento"
            value={department}
            options={DEPARTMENTS}
            placeholder="Departamento"
            onChange={v => { setDepartment(v); setCity(''); setSaved(false); }}
          />
          <SearchableSelect
            label="Ciudad / Municipio"
            value={city}
            options={cityOptions}
            placeholder={department ? 'Ciudad' : '— primero depto —'}
            onChange={v => { setCity(v); setSaved(false); }}
          />
        </div>
      </div>

      {/* Días sin entrenamiento */}
      <div className="space-y-3">
        <p style={{ fontSize: 11, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Días sin entrenamiento
        </p>
        <p className="text-[11px] text-muted-foreground -mt-2">La asistencia no se registrará estos días</p>
        <div className="flex gap-2 flex-wrap">
          {DAYS.map(({ short, value }) => {
            const active = noAttDays.includes(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggleDay(value)}
                className="w-10 h-10 rounded-full text-[12px] font-semibold border-2 transition-all flex items-center justify-center"
                style={active
                  ? { background: 'rgba(239,71,111,0.08)', borderColor: '#EF476F', color: '#EF476F' }
                  : { background: '#fff', borderColor: 'rgba(120,80,200,0.15)', color: '#8E87A8' }
                }
              >
                {short}
              </button>
            );
          })}
        </div>
      </div>

      <Button
        onClick={handleSave}
        disabled={saving || !name.trim()}
        className="w-full transition-all"
        style={saved ? { background: '#06D6A0' } : {}}
      >
        {saved
          ? <><CheckCircle2 className="w-4 h-4 mr-2" />Cambios guardados</>
          : saving ? 'Guardando...' : 'Guardar ajustes'
        }
      </Button>
    </div>
  );

  return (
    <div className="min-h-full bg-background">
      {/* Header — mismo alto (58px) y borde inferior que la fila del logo en el
          sidebar, para que ambas líneas queden alineadas a la misma altura */}
      <div className="px-5 py-3 bg-background flex items-center lg:border-b" style={{ minHeight: 58, borderColor: 'rgba(0,0,0,0.07)' }}>
        <h1 className="text-[22px] font-semibold text-foreground" style={{ lineHeight: 1.1 }}>
          Ajustes
        </h1>
      </div>

      {/* Modal recorte de logo — en portal a document.body para quedar por encima
          del menú flotante inferior (que si no tapa los botones en móvil) */}
      {cropSrc && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/70 flex flex-col items-end justify-end sm:items-center sm:justify-center" style={{ zIndex: 100 }}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm flex flex-col" style={{ maxHeight: '90dvh' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <Crop className="w-4 h-4 text-primary" />
                <p className="text-[13px] font-semibold text-foreground">Recortar logo</p>
              </div>
              <button onClick={() => setCropSrc(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex justify-center items-center bg-secondary/40 min-h-0">
              <ReactCrop crop={crop} onChange={c => setCrop(c)} aspect={1} circularCrop={false} minWidth={50}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img ref={imgRef} src={cropSrc} alt="Recortar" onLoad={onImageLoad} style={{ maxHeight: '55dvh', width: 'auto' }} />
              </ReactCrop>
            </div>
            <div
              className="flex gap-2 px-4 pt-4 shrink-0 border-t border-border"
              style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
            >
              <button onClick={() => setCropSrc(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-[13px] font-semibold text-muted-foreground">
                Cancelar
              </button>
              <button onClick={handleCropConfirm}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-[13px] font-semibold">
                Confirmar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal de confirmación — eliminar cuenta */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {deleteOpen && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 flex items-center justify-center p-4"
              style={{ zIndex: 200, background: 'rgba(15,5,30,0.55)', backdropFilter: 'blur(6px)' }}
              onClick={() => !deleting && setDeleteOpen(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
                onClick={e => e.stopPropagation()}
                className="w-full bg-white rounded-2xl p-6"
                style={{ maxWidth: 420, boxShadow: '0 24px 70px rgba(80,40,180,0.25)' }}
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3" style={{ background: 'rgba(239,71,111,0.10)' }}>
                  <AlertTriangle className="w-5 h-5" style={{ color: '#EF476F' }} />
                </div>
                <h2 className="text-[16px] font-semibold text-foreground mb-1">Eliminar tu cuenta</h2>
                <p className="text-[12.5px] text-muted-foreground leading-relaxed mb-4">
                  Esta acción es irreversible. Perderás el acceso de inmediato, tus datos personales se eliminarán y no podrás volver a iniciar sesión con este correo. Para confirmar, escribe <strong className="text-foreground">ELIMINAR</strong> abajo.
                </p>
                <Input
                  value={deleteConfirm}
                  onChange={e => setDeleteConfirm(e.target.value)}
                  placeholder="ELIMINAR"
                  className="mb-3 text-sm h-11"
                  autoFocus
                />
                {deleteError && <p className="text-[12px] mb-3" style={{ color: '#EF476F' }}>{deleteError}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDeleteOpen(false)}
                    disabled={deleting}
                    className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white"
                    style={{ background: '#EF476F' }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirm !== 'ELIMINAR' || deleting}
                    className="flex-1 py-2.5 rounded-xl border border-border text-[13px] font-semibold text-muted-foreground transition-opacity"
                    style={{ opacity: deleteConfirm !== 'ELIMINAR' || deleting ? 0.5 : 1 }}
                  >
                    {deleting ? 'Eliminando...' : 'Eliminar cuenta'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ══ MOBILE (< lg) ══════════════════════════════════════════════════ */}
      <div className="lg:hidden">
        {isAdmin && (
          <div className="px-4 pb-4">
            <div
              className="relative flex rounded-2xl p-1 gap-1"
              style={{ background: '#FFFFFF', boxShadow: '0 1px 4px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(0,0,0,0.06)' }}
            >
              {([
                { key: 'perfil'      as Tab, label: 'Mi perfil',      icon: IconPerfil },
                { key: 'club'        as Tab, label: 'Mi club',        icon: IconClub },
                { key: 'suscripcion' as Tab, label: 'Mi suscripción', icon: IconSuscripcion },
              ]).map(({ key, label, icon: Icon }) => {
                const active = tab === key;
                return (
                  <button key={key} onClick={() => setTab(key)} aria-label={label}
                    className="relative flex-1 flex items-center justify-center py-2.5 rounded-xl z-10">
                    {active && (
                      <motion.div layoutId="ajustes-tab-pill" className="absolute inset-0 rounded-xl"
                        style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #4361EE 100%)', boxShadow: '0 4px 20px rgba(124,58,237,0.40)' }}
                        transition={{ type: 'spring', stiffness: 500, damping: 35 }} />
                    )}
                    <Icon className="relative w-4 h-4 z-10" style={{ color: active ? '#fff' : '#8E87A8' }} />
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <AnimatePresence mode="wait">
          {(!isAdmin || tab === 'perfil') && (
            <motion.div key="perfil"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="px-4 pb-28 space-y-4">
              {perfilCard}
              {dangerCard}
            </motion.div>
          )}
          {isAdmin && tab === 'club' && (
            <motion.div key="club"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="px-4 pb-28">
              {clubCard}
            </motion.div>
          )}
          {isAdmin && tab === 'suscripcion' && (
            <motion.div key="suscripcion"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="px-4 pb-28">
              <SuscripcionCard />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ══ DESKTOP (>= lg) — columna centrada, una sección a la vez ═══════ */}
      <div className="hidden lg:block px-6 pt-6 pb-8">
        <div className="max-w-5xl mx-auto">
          {(!isAdmin || tab === 'perfil') && (
            <div className="space-y-4">
              <SectionHeader label="Mi perfil" icon={IconPerfil} />
              {perfilCard}
              {dangerCard}
            </div>
          )}
          {isAdmin && tab === 'club' && (
            <div>
              <SectionHeader label="Mi club" icon={IconClub} />
              {clubCard}
            </div>
          )}
          {isAdmin && tab === 'suscripcion' && (
            <div>
              <SectionHeader label="Mi suscripción" icon={IconSuscripcion} />
              <SuscripcionCard />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
