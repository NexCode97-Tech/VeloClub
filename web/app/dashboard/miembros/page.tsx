'use client';

import { useAuth, useUser } from '@clerk/nextjs';
import { useClubStream } from '@/hooks/useClubStream';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { stagger as pageStagger, cardVariant as pageCard } from '@/lib/page-animations';
import { apiFetch } from '@/lib/api-client';
import { parseLocalDate } from '@/lib/utils';
import { QK } from '@/hooks/useVeloQuery';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Plus, Pencil, Trash2, Users, Search, Download,
  FileSpreadsheet, Upload, X, ChevronRight, Eye,
  Phone, Mail, Calendar, MapPin, Shield, Heart, CreditCard,
  ArrowUpDown, Tag, ChevronDown,
} from 'lucide-react';
import { MemberAvatar } from '@/components/ui/member-avatar';
import { PhoneInput, parsePhoneDisplay, FlagImg } from '@/components/ui/phone-input';
import { DatePicker } from '@/components/ui/date-picker';
import { downloadMembersPDF } from '@/lib/pdf';
import { downloadMembersTemplate, parseMembersExcel } from '@/lib/excel';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Location { id: string; name: string }
interface Member {
  id: string; fullName: string; email?: string; phone?: string;
  birthDate?: string; category?: string; tipo?: string;
  emergencyContact?: string; emergencyPhone?: string; eps?: string;
  paymentDueDay?: number | null; monthlyFee?: number | null;
  pictureUrl?: string | null; docType?: string | null; docNumber?: string | null;
  createdAt?: string;
  role: string;
  locations: { location: Location }[];
}

// ── Design tokens ──────────────────────────────────────────────────────────────
const ROLES: Record<string, string> = { ADMIN: 'Admin', COACH: 'Entrenador', STUDENT: 'Deportista' };
const ROLE_COLORS: Record<string, { text: string; bg: string }> = {
  ADMIN:   { text: '#B45309', bg: 'rgba(245,158,11,0.12)' },
  COACH:   { text: '#047857', bg: 'rgba(6,214,160,0.12)' },
  STUDENT: { text: '#6D28D9', bg: 'rgba(124,58,237,0.12)' },
};
const ROLE_GRADIENT: Record<string, string> = {
  ADMIN:   'linear-gradient(135deg,#FFB703,#FB8500)',
  COACH:   'linear-gradient(135deg,#06D6A0,#0CB68D)',
  STUDENT: 'linear-gradient(135deg,#7C3AED,#A855F7)',
};

// ── Empty form ─────────────────────────────────────────────────────────────────
const DOC_TYPES = ['CC', 'TI', 'RC', 'CE', 'PA', 'NIT', 'Otro'] as const;

const emptyForm = {
  fullName: '', email: '', phone: '', birthDate: '',
  docType: '', docNumber: '',
  category: '', tipo: '',
  guardianName: '', guardianPhone: '',
  eps: '', role: 'STUDENT', locationIds: [] as string[],
};

// ── Animations ─────────────────────────────────────────────────────────────────
const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];
const EASE_IOS: [number, number, number, number] = [0.32, 0.72, 0, 1];

export default function MiembrosPage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const reducedMotion = useReducedMotion();
  const qc = useQueryClient();

  const [search, setSearch]         = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL'|'STUDENT'|'COACH'|'ADMIN'>('ALL');
  const [sortOrder, setSortOrder]     = useState<'az'|'za'|'recent'|'oldest'>('recent');
  const [catFilter, setCatFilter]     = useState<string>('ALL');
  const [locFilter, setLocFilter]     = useState<string>('ALL');
  const [clubName, setClubName] = useState('VeloClub');

  // View detail state
  const [viewMember, setViewMember] = useState<Member | null>(null);

  // Panel state
  const [open, setOpen]         = useState(false);
  const [editing, setEditing]   = useState<Member | null>(null);
  const [form, setForm]         = useState(emptyForm);
  const [step, setStep]         = useState(0);
  const [stepDir, setStepDir]   = useState(1);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // Import state
  const [importOpen, setImportOpen]     = useState(false);
  const [importing, setImporting]       = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  // ── Data con caché TanStack Query ───────────────────────────────────────────
  const { data: membersData, isLoading: loadingMembers } = useQuery({
    queryKey: QK.members(),
    queryFn: async () => {
      const token = await getToken();
      return apiFetch<{ members: Member[] }>('/members', { token });
    },
  });
  const { data: locsData, isLoading: loadingLocs } = useQuery({
    queryKey: QK.locations(),
    queryFn: async () => {
      const token = await getToken();
      return apiFetch<{ locations: Location[] }>('/locations', { token });
    },
  });

  const members   = membersData?.members   ?? [];
  const locations = locsData?.locations    ?? [];

  // Steps definition (después de declarar locations)
  const steps = useMemo(() => {
    const s = [
      { id: 'identity', label: 'Identidad' },
      { id: 'contact',  label: 'Contacto' },
    ];
    if (form.role === 'STUDENT') {
      s.push({ id: 'guardian', label: 'Acudiente' });
      s.push({ id: 'sport',    label: 'Deportiva' });
    }
    if (locations.length > 0 && form.role !== 'ADMIN') {
      s.push({ id: 'locations', label: 'Sedes' });
    }
    return s;
  }, [form.role, locations.length]);
  const loading   = loadingMembers || loadingLocs;

  // Cargar nombre del club (sin bloquear)
  useEffect(() => {
    getToken().then(token =>
      apiFetch<{ club: { name: string } }>('/clubs/settings', { token }).then(r => setClubName(r.club.name)).catch(() => {})
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SSE invalida la caché → TanStack Query refetch en bg, sin spinner
  useClubStream(ev => {
    if (ev === 'members') qc.invalidateQueries({ queryKey: QK.members() });
  });

  // ── Panel actions ───────────────────────────────────────────────────────────
  function openNew() {
    setEditing(null); setForm(emptyForm); setStep(0); setError(null); setOpen(true);
  }

  function openEdit(m: Member) {
    setEditing(m);
    setForm({
      fullName: m.fullName, email: m.email ?? '', phone: m.phone ?? '',
      birthDate: m.birthDate ? m.birthDate.split('T')[0] : '',
      docType: m.docType ?? '',
      docNumber: m.docNumber ?? '',
      category: m.category ?? '', tipo: m.tipo ?? '',
      guardianName: m.emergencyContact ?? '',
      guardianPhone: m.emergencyPhone ?? '',
      eps: m.eps ?? '', role: m.role,
      locationIds: m.locations.map(l => l.location.id),
    });
    setStep(0); setError(null); setOpen(true);
  }

  function nextStep() { setStepDir(1); setStep(s => Math.min(s + 1, steps.length - 1)); }
  function prevStep() { setStepDir(-1); setStep(s => Math.max(s - 1, 0)); }

  async function handleSave() {
    if (!form.fullName.trim()) return;
    setSaving(true); setError(null);
    try {
      const token = await getToken();
      const body = JSON.stringify({
        fullName: form.fullName,
        email: form.email || undefined,
        phone: form.phone || undefined,
        birthDate: form.birthDate || undefined,
        docType: form.docType || undefined,
        docNumber: form.docNumber || undefined,
        category: form.category || undefined,
        tipo: form.tipo || undefined,
        emergencyContact: form.guardianName || undefined,
        emergencyPhone: form.guardianPhone || undefined,
        eps: form.eps || undefined,
        role: form.role,
        locationIds: form.locationIds,
      });
      if (editing) {
        const roleChanged = editing.role !== form.role;
        const isSelf = editing.email && user?.primaryEmailAddress?.emailAddress
          ? editing.email === user.primaryEmailAddress.emailAddress : false;
        await apiFetch(`/members/${editing.id}`, { method: 'PUT', token, body });
        if (roleChanged && isSelf) { window.location.href = '/dashboard'; return; }
      } else {
        await apiFetch('/members', { method: 'POST', token, body });
      }
      setOpen(false);
      qc.invalidateQueries({ queryKey: QK.members() });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este miembro?')) return;
    const token = await getToken();
    await apiFetch(`/members/${id}`, { method: 'DELETE', token });
    qc.invalidateQueries({ queryKey: QK.members() });
  }

  function toggleLocation(id: string) {
    setForm(f => ({
      ...f,
      locationIds: f.locationIds.includes(id)
        ? f.locationIds.filter(l => l !== id)
        : [...f.locationIds, id],
    }));
  }

  async function handleImport(file: File) {
    setImporting(true); setImportErrors([]);
    const { rows, errors } = await parseMembersExcel(file);
    if (errors.length > 0) { setImportErrors(errors); setImporting(false); return; }
    const token = await getToken();
    const failed: string[] = [];
    for (const row of rows) {
      try {
        const { locationName, ...rest } = row;
        let locationIds: string[] | undefined;
        if (locationName) {
          const found = locations.find(l => l.name.toLowerCase().trim() === locationName.toLowerCase().trim());
          if (!found) { failed.push(`${row.fullName}: la sede "${locationName}" no existe`); continue; }
          locationIds = [found.id];
        }
        // Buscar si el miembro ya existe por docNumber o email para evitar duplicados
        const existing = members.find(m =>
          (rest.docNumber && m.docNumber && m.docNumber.trim() === rest.docNumber.trim()) ||
          (rest.email && m.email && m.email.toLowerCase().trim() === rest.email.toLowerCase().trim())
        );
        if (existing) {
          await apiFetch(`/members/${existing.id}`, { method: 'PUT', token, body: JSON.stringify({ ...rest, locationIds }) });
        } else {
          await apiFetch('/members', { method: 'POST', token, body: JSON.stringify({ ...rest, locationIds }) });
        }
      } catch (e) { failed.push(`${row.fullName}: ${e instanceof Error ? e.message : 'Error'}`); }
    }
    setImporting(false);
    if (failed.length > 0) setImportErrors(failed); else setImportOpen(false);
    qc.invalidateQueries({ queryKey: QK.members() });
  }

  // ── Filtered + sorted list ───────────────────────────────────────────────────
  const allCategories = useMemo(() =>
    Array.from(new Set(members.map(m => m.category).filter(Boolean) as string[])).sort()
  , [members]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = members.filter(m => {
      const matchSearch = !q || m.fullName.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q);
      const matchRole   = roleFilter === 'ALL' || m.role === roleFilter;
      const matchCat    = catFilter  === 'ALL' || m.category === catFilter;
      const matchLoc = locFilter === 'ALL'
        || (locFilter === 'SIN_SEDE' ? m.locations.length === 0 : m.locations.some(l => l.location.id === locFilter));
      return matchSearch && matchRole && matchCat && matchLoc;
    });
    list = [...list].sort((a, b) => {
      if (sortOrder === 'az')     return a.fullName.localeCompare(b.fullName);
      if (sortOrder === 'za')     return b.fullName.localeCompare(a.fullName);
      if (sortOrder === 'recent') return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
      if (sortOrder === 'oldest') return new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
      return 0;
    });
    return list;
  }, [members, search, roleFilter, catFilter, locFilter, sortOrder]);

  // ── Initials ─────────────────────────────────────────────────────────────────
  function initials(name: string) {
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  // ── Step content renderer ────────────────────────────────────────────────────
  const currentStep = steps[step]?.id;

  // ── Stats desktop (también actúan como filtros) ──────────────────────────────
  const statsDesktop: { label: string; value: number; color: string; bg: string; filter: 'ALL'|'STUDENT'|'COACH'|'ADMIN' }[] = [
    { label: 'Total',       value: members.length,                                    color: '#7C3AED', bg: 'rgba(124,58,237,0.08)', filter: 'ALL'     },
    { label: 'Deportistas', value: members.filter(m => m.role === 'STUDENT').length,  color: '#4361EE', bg: 'rgba(67,97,238,0.08)',  filter: 'STUDENT' },
    { label: 'Entrenadores',value: members.filter(m => m.role === 'COACH').length,    color: '#06D6A0', bg: 'rgba(6,214,160,0.10)',  filter: 'COACH'   },
    { label: 'Admins',      value: members.filter(m => m.role === 'ADMIN').length,    color: '#FFB703', bg: 'rgba(255,183,3,0.10)',  filter: 'ADMIN'   },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-full" style={{ background: '#F7F7FB' }}>

      {/* ══════════════════════════════════════════════════════════════════
          HEADER MOBILE
      ══════════════════════════════════════════════════════════════════ */}
      <div className="md:hidden px-5 py-3 flex items-center justify-between" style={{ background: '#F7F7FB' }}>
        <div>
          <h1 className="text-[22px] font-semibold text-foreground" style={{ fontFamily: 'inherit', lineHeight: 1.1 }}>Miembros</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{members.length} miembro{members.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => downloadMembersPDF(members, clubName)} disabled={members.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-border text-muted-foreground hover:bg-secondary active:scale-95 transition-all disabled:opacity-40">
            <Download className="w-4 h-4" /><span className="hidden sm:inline">PDF</span>
          </button>
          <button onClick={() => setImportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-border text-muted-foreground hover:bg-secondary active:scale-95 transition-all">
            <Upload className="w-4 h-4" /><span className="hidden sm:inline">Importar</span>
          </button>
          <button onClick={() => downloadMembersTemplate(locations)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-border text-muted-foreground hover:bg-secondary active:scale-95 transition-all">
            <FileSpreadsheet className="w-4 h-4" /><span className="hidden sm:inline">Plantilla</span>
          </button>
          <motion.button onClick={openNew} whileTap={reducedMotion ? {} : { scale: 0.97 }}
            transition={{ duration: 0.12, ease: EASE_OUT }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #4361EE 100%)' }}>
            <Plus className="w-4 h-4" /><span className="hidden sm:inline">Nuevo</span>
          </motion.button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          DESKTOP LAYOUT
      ══════════════════════════════════════════════════════════════════ */}
      <div className="hidden md:flex flex-col h-full">

        {/* ── Desktop Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: EASE_OUT }}
          className="px-5 py-3 pb-0"
        >
          <div className="flex items-center mb-6 lg:pb-3 lg:border-b" style={{ minHeight: 58, borderColor: 'rgba(0,0,0,0.07)' }}>
            <h1 className="text-[22px] font-semibold" style={{ color: '#1A1028', fontFamily: 'inherit', lineHeight: 1.1 }}>
              Miembros
            </h1>
          </div>

          {/* ── Stats strip ── */}
          <motion.div
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
            initial="hidden" animate="show"
            className="grid grid-cols-4 gap-3 mb-6 lg:mt-3"
          >
            {statsDesktop.map(s => {
              const active = roleFilter === s.filter;
              return (
                <motion.button
                  key={s.label}
                  variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE_OUT } } }}
                  whileTap={reducedMotion ? {} : { scale: 0.97 }}
                  onClick={() => setRoleFilter(s.filter)}
                  className="rounded-xl md:rounded-2xl py-3 md:py-5 flex flex-col items-center justify-center w-full cursor-pointer transition-all text-center"
                  style={{
                    background: active ? s.bg : '#fff',
                    border: active ? `1.5px solid ${s.color}40` : '1px solid rgba(120,80,200,0.08)',
                    boxShadow: active ? `0 4px 16px ${s.color}20` : '0 1px 6px rgba(0,0,0,0.04)',
                  }}
                >
                  <p className="text-xl md:text-[36px] font-semibold leading-none mb-1" style={{ color: active ? s.color : '#1A1028', fontFamily: 'inherit' }}>{s.value}</p>
                  <p className="text-[10px] md:text-[13px] font-semibold md:mt-0.5" style={{ color: active ? s.color : '#8E87A8' }}>{s.label}</p>
                </motion.button>
              );
            })}
          </motion.div>

          {/* ── Search + Filtros ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: EASE_OUT, delay: 0.12 }}
            className="flex items-center gap-2 mb-4 flex-wrap"
          >
            {/* Barra de búsqueda */}
            <div className="relative flex-1 min-w-[180px] max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#8E87A8' }} />
              <input
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-[13px] outline-none transition-all"
                style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.12)', color: '#1A1028' }}
                placeholder="Buscar por nombre o email..."
                value={search} onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Ordenar */}
            <Select value={sortOrder} onValueChange={v => { if (v) setSortOrder(v as typeof sortOrder); }}>
              <SelectTrigger className="px-3 rounded-xl text-[12px] font-semibold gap-1.5 cursor-pointer"
                style={{ height: 42, background: '#fff', border: '1px solid rgba(120,80,200,0.12)', color: '#1A1028', width: 'auto', minWidth: 130 }}>
                <ArrowUpDown className="w-3.5 h-3.5 shrink-0" style={{ color: '#8E87A8' }} />
                <span>{{ az: 'A–Z', za: 'Z–A', recent: 'Reciente', oldest: 'Más antiguo' }[sortOrder]}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Reciente</SelectItem>
                <SelectItem value="oldest">Más antiguo</SelectItem>
                <SelectItem value="az">A–Z</SelectItem>
                <SelectItem value="za">Z–A</SelectItem>
              </SelectContent>
            </Select>

            {/* Categoría — solo si existen */}
            {allCategories.length > 0 && (
              <Select value={catFilter} onValueChange={v => { if (v) setCatFilter(v); }}>
                <SelectTrigger className="px-3 rounded-xl text-[12px] font-semibold gap-1.5 cursor-pointer"
                  style={{ height: 42, background: catFilter !== 'ALL' ? 'rgba(124,58,237,0.08)' : '#fff', border: catFilter !== 'ALL' ? '1px solid rgba(124,58,237,0.30)' : '1px solid rgba(120,80,200,0.12)', color: catFilter !== 'ALL' ? '#7C3AED' : '#1A1028', width: 'auto', minWidth: 130 }}>
                  <Tag className="w-3.5 h-3.5 shrink-0" style={{ color: catFilter !== 'ALL' ? '#7C3AED' : '#8E87A8' }} />
                  <span>{catFilter === 'ALL' ? 'Categoría' : catFilter.charAt(0).toUpperCase() + catFilter.slice(1).toLowerCase()}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas las categorías</SelectItem>
                  {allCategories.map(c => (
                    <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1).toLowerCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Sede — todas las sedes + sin sede */}
            <Select value={locFilter} onValueChange={v => { if (v) setLocFilter(v); }}>
              <SelectTrigger className="px-3 rounded-xl text-[12px] font-semibold gap-1.5 cursor-pointer"
                style={{
                  height: 42,
                  background: locFilter !== 'ALL' ? 'rgba(67,97,238,0.08)' : '#fff',
                  border: locFilter !== 'ALL' ? '1px solid rgba(67,97,238,0.30)' : '1px solid rgba(120,80,200,0.12)',
                  color: locFilter !== 'ALL' ? '#4361EE' : '#1A1028',
                  width: 'fit-content',
                }}>
                <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: locFilter !== 'ALL' ? '#4361EE' : '#8E87A8' }} />
                <span>
                  {locFilter === 'ALL'
                    ? 'Sede'
                    : locFilter === 'SIN_SEDE'
                      ? 'Sin sede'
                      : (locations.find(l => l.id === locFilter)?.name ?? 'Sede')}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas las sedes</SelectItem>
                {locations.map(l => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
                <SelectItem value="SIN_SEDE">Sin sede</SelectItem>
              </SelectContent>
            </Select>

            <p className="text-[12px] font-semibold whitespace-nowrap" style={{ color: '#8E87A8' }}>
              {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
            </p>

            <div className="flex items-center gap-2 ml-auto">
              <button onClick={() => setImportOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-[13px] font-semibold transition-all hover:bg-white cursor-pointer"
                style={{ color: '#8E87A8', border: '1px solid rgba(120,80,200,0.12)' }}>
                <Upload className="w-4 h-4" /> Importar
              </button>
              <button onClick={() => downloadMembersPDF(members, clubName)} disabled={members.length === 0}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-[13px] font-semibold transition-all hover:bg-white cursor-pointer disabled:opacity-40"
                style={{ color: '#8E87A8', border: '1px solid rgba(120,80,200,0.12)' }}>
                <Download className="w-4 h-4" /> PDF
              </button>
              <motion.button onClick={openNew}
                whileHover={reducedMotion ? {} : { scale: 1.02 }}
                whileTap={reducedMotion ? {} : { scale: 0.97 }}
                transition={{ duration: 0.14, ease: EASE_OUT }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #4361EE 100%)', boxShadow: '0 4px 16px rgba(124,58,237,0.30)' }}>
                <Plus className="w-4 h-4" /> Nuevo miembro
              </motion.button>
            </div>
          </motion.div>
        </motion.div>

        {/* ── Grid de tarjetas ── */}
        <div className="px-8 pb-8">
          {loading ? (
            /* Skeleton */
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse" style={{ border: '1px solid rgba(120,80,200,0.08)' }}>
                  <div className="h-[72px]" style={{ background: 'rgba(120,80,200,0.07)' }} />
                  <div className="px-5 pt-4 pb-5 space-y-3">
                    <div className="h-3.5 w-32 rounded-full" style={{ background: 'rgba(120,80,200,0.07)' }} />
                    <div className="h-2.5 w-48 rounded-full" style={{ background: 'rgba(120,80,200,0.05)' }} />
                    <div className="h-2.5 w-36 rounded-full" style={{ background: 'rgba(120,80,200,0.05)' }} />
                    <div className="h-8 rounded-xl mt-4" style={{ background: 'rgba(120,80,200,0.07)' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.22, ease: EASE_OUT }}
              className="flex flex-col items-center justify-center py-32 bg-white rounded-2xl"
              style={{ border: '1px solid rgba(120,80,200,0.08)' }}
            >
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(124,58,237,0.08)' }}>
                <Users className="w-8 h-8" style={{ color: '#7C3AED' }} />
              </div>
              <p className="text-[17px] font-semibold mb-1.5" style={{ color: '#1A1028', fontFamily: 'inherit' }}>
                {search ? 'Sin resultados' : 'Sin miembros aún'}
              </p>
              <p className="text-[13px] mb-6" style={{ color: '#8E87A8' }}>
                {search ? `Sin coincidencias para "${search}"` : 'Agrega el primer miembro del club'}
              </p>
              {!search && (
                <motion.button onClick={openNew}
                  whileTap={reducedMotion ? {} : { scale: 0.97 }} transition={{ duration: 0.12 }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white cursor-pointer"
                  style={{ background: 'linear-gradient(135deg,#7C3AED,#4361EE)' }}>
                  <Plus className="w-4 h-4" /> Agregar miembro
                </motion.button>
              )}
            </motion.div>
          ) : (
            <motion.div
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } } }}
              initial="hidden" animate="show"
              className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            >
              {filtered.map((m) => {
                const rc = ROLE_COLORS[m.role] ?? ROLE_COLORS.STUDENT;
                return (
                  <motion.div
                    key={m.id}
                    variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: EASE_OUT } } }}
                    whileHover={reducedMotion ? {} : { y: -3, boxShadow: '0 12px 40px rgba(124,58,237,0.14)', transition: { duration: 0.22, ease: EASE_OUT } }}
                    className="bg-white rounded-2xl overflow-hidden flex flex-col cursor-default"
                    style={{
                      border: '1px solid rgba(120,80,200,0.09)',
                      boxShadow: '0 2px 12px rgba(124,58,237,0.05)',
                    }}
                  >
                    {/* ── Cabecera con gradiente ── */}
                    <div className="relative px-5 pt-5 pb-4" style={{ background: ROLE_GRADIENT[m.role] ?? ROLE_GRADIENT.STUDENT }}>
                      {/* Patrón decorativo sutil */}
                      <div className="absolute inset-0 opacity-10" style={{
                        backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.6) 0%, transparent 60%)',
                      }} />
                      <div className="relative flex items-center gap-3">
                        {/* Avatar */}
                        <MemberAvatar
                          name={m.fullName}
                          photoUrl={m.pictureUrl}
                          gradient={ROLE_GRADIENT[m.role] ?? ROLE_GRADIENT.STUDENT}
                        />
                        <div className="min-w-0 flex-1">
                          <h3
                            className="text-white font-semibold text-[15px] leading-snug truncate"
                            style={{ fontFamily: 'inherit', textShadow: '0 1px 4px rgba(0,0,0,0.12)' }}
                          >
                            {m.fullName}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(255,255,255,0.22)', color: '#fff' }}
                            >
                              {ROLES[m.role]}
                            </span>
                            {m.tipo && (
                              <span
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.85)' }}
                              >
                                {m.tipo}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ── Cuerpo ── */}
                    <div className="px-5 pt-4 pb-3 flex-1 space-y-2.5">
                      {/* 1. Documento */}
                      {(m.docType || m.docNumber) && (
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(124,58,237,0.08)' }}>
                            <CreditCard className="w-3 h-3" style={{ color: '#7C3AED' }} />
                          </div>
                          <p className="text-[12px] font-medium" style={{ color: '#5A5278' }}>
                            {[m.docType, m.docNumber].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                      )}
                      {/* 2. Teléfono */}
                      {m.phone && (() => {
                        const { iso2, dialCode, number } = parsePhoneDisplay(m.phone);
                        return (
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(124,58,237,0.08)' }}>
                              <Phone className="w-3 h-3" style={{ color: '#7C3AED' }} />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="flex items-center gap-0.5">
                                <FlagImg code={iso2} size={16} />
                                <span className="text-[12px] font-medium" style={{ color: '#5A5278' }}>+{dialCode}</span>
                              </span>
                              <p className="text-[12px] font-medium" style={{ color: '#5A5278' }}>{number}</p>
                            </div>
                          </div>
                        );
                      })()}
                      {/* 3. Correo */}
                      {m.email && (
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(124,58,237,0.08)' }}>
                            <Mail className="w-3 h-3" style={{ color: '#7C3AED' }} />
                          </div>
                          <p className="text-[12px] font-medium truncate lowercase" style={{ color: '#5A5278' }}>{m.email}</p>
                        </div>
                      )}
                      {/* 4. Nacimiento */}
                      {m.birthDate && (
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(124,58,237,0.08)' }}>
                            <Calendar className="w-3 h-3" style={{ color: '#7C3AED' }} />
                          </div>
                          <p className="text-[12px] font-medium" style={{ color: '#5A5278' }}>
                            {parseLocalDate(m.birthDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      )}
                      {/* 5. EPS */}
                      {m.eps && (
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(6,214,160,0.08)' }}>
                            <Heart className="w-3 h-3" style={{ color: '#06D6A0' }} />
                          </div>
                          <p className="text-[12px] font-medium" style={{ color: '#5A5278' }}>{m.eps}</p>
                        </div>
                      )}

                      {/* Sedes */}
                      {m.locations.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {m.locations.map(l => (
                            <span
                              key={l.location.id}
                              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(124,58,237,0.08)', color: '#7C3AED' }}
                            >
                              <MapPin className="w-2.5 h-2.5" />
                              {l.location.name}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Acudiente — solo si existe */}
                      {m.emergencyContact && (
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(67,97,238,0.08)' }}>
                            <Shield className="w-3 h-3" style={{ color: '#4361EE' }} />
                          </div>
                          <p className="text-[12px] font-medium" style={{ color: '#5A5278' }}>{m.emergencyContact}</p>
                        </div>
                      )}
                    </div>

                    {/* ── Acciones ── */}
                    <div className="px-4 pb-4 pt-1 flex gap-2">
                      <motion.button
                        onClick={() => openEdit(m)}
                        whileHover={reducedMotion ? {} : { scale: 1.02 }}
                        whileTap={reducedMotion ? {} : { scale: 0.97 }}
                        transition={{ duration: 0.12, ease: EASE_OUT }}
                        className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold text-white flex items-center justify-center gap-1.5 cursor-pointer"
                        style={{ background: 'linear-gradient(135deg,#7C3AED,#4361EE)', boxShadow: '0 3px 12px rgba(124,58,237,0.22)' }}
                      >
                        <Pencil className="w-3.5 h-3.5" /> Editar
                      </motion.button>
                      <motion.button
                        onClick={() => setViewMember(m)}
                        whileHover={reducedMotion ? {} : { scale: 1.02 }}
                        whileTap={reducedMotion ? {} : { scale: 0.97 }}
                        transition={{ duration: 0.12, ease: EASE_OUT }}
                        className="w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer shrink-0"
                        style={{ background: 'rgba(124,58,237,0.08)' }}
                        aria-label="Ver deportista"
                      >
                        <Eye className="w-4 h-4" style={{ color: '#7C3AED' }} />
                      </motion.button>
                      <motion.button
                        onClick={() => handleDelete(m.id)}
                        whileHover={reducedMotion ? {} : { scale: 1.05 }}
                        whileTap={reducedMotion ? {} : { scale: 0.95 }}
                        transition={{ duration: 0.12, ease: EASE_OUT }}
                        className="w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer shrink-0"
                        style={{ background: 'rgba(239,71,111,0.08)' }}
                        aria-label="Eliminar miembro"
                      >
                        <Trash2 className="w-4 h-4" style={{ color: '#EF476F' }} />
                      </motion.button>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          MOBILE LAYOUT
      ══════════════════════════════════════════════════════════════════ */}
      <motion.div variants={pageStagger} initial="hidden" animate="show" className="md:hidden px-4 pt-4 space-y-3">
        {/* Stats móvil como filtros */}
        <motion.div variants={pageCard} className="grid grid-cols-4 gap-2">
          {statsDesktop.map(s => {
            const active = roleFilter === s.filter;
            return (
              <button
                key={s.label}
                onClick={() => setRoleFilter(s.filter)}
                className="rounded-xl py-3 flex flex-col items-center justify-center transition-all text-center"
                style={{
                  background: active ? s.bg : '#fff',
                  border: active ? `1.5px solid ${s.color}40` : '1px solid rgba(120,80,200,0.08)',
                  boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
                }}
              >
                <p className="text-xl font-semibold leading-none mb-1" style={{ color: active ? s.color : '#1A1028', fontFamily: 'inherit' }}>{s.value}</p>
                <p className="text-[10px] font-semibold text-center leading-tight" style={{ color: active ? s.color : '#8E87A8' }}>{s.label}</p>
              </button>
            );
          })}
        </motion.div>

        <motion.div variants={pageCard} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9 bg-white border-border rounded-xl" placeholder="Buscar miembro..." value={search} onChange={e => setSearch(e.target.value)} />
        </motion.div>

        {loading ? (
          <div className="space-y-2 pt-2">
            {[1,2,3].map(i => (
              <div key={i} className="bg-white border border-border rounded-xl px-3 py-3 flex items-center gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-secondary shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-36 bg-secondary rounded-full" />
                  <div className="h-2.5 w-24 bg-secondary rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-border p-10 text-center mt-2">
            <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{search ? 'Sin resultados.' : 'No hay miembros registrados aún.'}</p>
            {!search && (
              <button onClick={openNew} className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold border border-border text-muted-foreground hover:bg-secondary transition-colors">
                Agregar primer miembro
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2 pb-28">
            {filtered.map(m => {
              const rc = ROLE_COLORS[m.role] ?? ROLE_COLORS.STUDENT;
              return (
                <motion.div key={m.id} layout
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: EASE_OUT }}
                  className="bg-white border border-border rounded-xl px-3 py-3 flex items-center gap-3">
                  <MemberAvatar
                    name={m.fullName}
                    photoUrl={m.pictureUrl}
                    gradient={ROLE_GRADIENT[m.role] ?? ROLE_GRADIENT.STUDENT}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="text-[13px] font-semibold text-foreground truncate">{m.fullName}</p>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style={{ color: rc.text, background: rc.bg }}>{ROLES[m.role]}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate lowercase">{m.email ?? '—'}</p>
                    {m.role === 'STUDENT' && (
                      <div className="flex gap-2 mt-0.5 flex-wrap">
                        {m.category && <span className="text-[10px] font-semibold" style={{ color: '#7C3AED' }}>{m.category}</span>}
                        {m.tipo && <span className="text-[10px] text-muted-foreground">{m.tipo}</span>}
                        {m.paymentDueDay && <span className="text-[10px] text-muted-foreground">Día {m.paymentDueDay}</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => setViewMember(m)} className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => openEdit(m)} className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(m.id)} className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-red-400 hover:text-red-600 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════
          NUEVO PANEL — bottom sheet multi-paso
      ═══════════════════════════════════════════════════════════════════ */}

      {typeof document !== 'undefined' && createPortal(
      <>
      {/* Backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            className="fixed inset-0"
            style={{ background: 'rgba(15,10,30,0.52)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', zIndex: 100 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => !saving && setOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Modal centrado */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="sheet"
            className="fixed inset-0 flex items-center justify-center px-4"
            style={{ pointerEvents: 'none', zIndex: 101 }}
          >
            <motion.div
              className="bg-white flex flex-col w-full"
              style={{
                maxWidth: 480,
                borderRadius: 28,
                maxHeight: '92dvh',
                boxShadow: '0 24px 64px rgba(124,58,237,0.18), 0 4px 16px rgba(0,0,0,0.08)',
                pointerEvents: 'auto',
              }}
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: -12 }}
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: -12 }}
              transition={{ duration: 0.26, ease: EASE_OUT }}
            >

            {/* Header */}
            <div className="px-6 pt-5 pb-3 flex items-start justify-between shrink-0">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#7C3AED' }}>
                  {editing ? 'Editar miembro' : 'Nuevo miembro'}
                </p>
                <h2 className="text-[22px] font-semibold text-foreground leading-tight mt-0.5" style={{ fontFamily: 'inherit' }}>
                  {steps[step]?.label}
                </h2>
              </div>
              <motion.button
                whileTap={reducedMotion ? {} : { scale: 0.93 }}
                transition={{ duration: 0.1 }}
                onClick={() => !saving && setOpen(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center mt-1 shrink-0"
                style={{ background: 'rgba(142,135,168,0.12)' }}
              >
                <X className="w-4 h-4" style={{ color: '#8E87A8' }} />
              </motion.button>
            </div>

            {/* Step indicator */}
            <div className="px-6 pb-4 flex gap-1.5 shrink-0">
              {steps.map((s, i) => (
                <motion.div
                  key={s.id}
                  className="h-1 rounded-full"
                  animate={{
                    background: i < step ? '#7C3AED' : i === step ? '#7C3AED' : 'rgba(124,58,237,0.15)',
                    flex: i === step ? 2 : 1,
                    opacity: i > step ? 0.4 : 1,
                  }}
                  transition={{ duration: 0.28, ease: EASE_OUT }}
                />
              ))}
            </div>

            {/* Step content — scrollable */}
            <div className="flex-1 overflow-y-auto">
              <AnimatePresence mode="wait" custom={stepDir}>
                <motion.div
                  key={`${step}-${currentStep}`}
                  custom={stepDir}
                  variants={{
                    enter:  (d: number) => ({ x: reducedMotion ? 0 : d * 48, opacity: 0 }),
                    center: { x: 0, opacity: 1 },
                    exit:   (d: number) => ({ x: reducedMotion ? 0 : d * -48, opacity: 0 }),
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.22, ease: EASE_OUT }}
                  className="px-6 pb-6"
                >

                  {/* ── STEP: IDENTIDAD ───────────────────────────────── */}
                  {currentStep === 'identity' && (
                    <div className="space-y-5">
                      {/* Avatar preview */}
                      <AnimatePresence>
                        {form.fullName && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -8 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2, ease: EASE_OUT }}
                            className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                            style={{ background: 'rgba(124,58,237,0.06)' }}
                          >
                            <div
                              className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0"
                              style={{ background: ROLE_GRADIENT[form.role] ?? ROLE_GRADIENT.STUDENT }}
                            >
                              {initials(form.fullName)}
                            </div>
                            <div>
                              <p className="font-semibold text-foreground text-[14px]">{form.fullName}</p>
                              <p className="text-[11px]" style={{ color: '#7C3AED' }}>{ROLES[form.role]}</p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest block mb-2">
                          Nombre completo *
                        </label>
                        <Input
                          placeholder="ej. Juan Pérez López"
                          value={form.fullName}
                          autoFocus
                          className="h-12 text-[15px] rounded-xl border-border"
                          onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest block mb-2">
                          Rol
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {([['STUDENT','Deportista'],['COACH','Entrenador'],['ADMIN','Admin']] as const).map(([val, label]) => (
                            <motion.button
                              key={val}
                              whileTap={reducedMotion ? {} : { scale: 0.96 }}
                              transition={{ duration: 0.1 }}
                              onClick={() => { setForm(f => ({ ...f, role: val })); }}
                              className="py-3 rounded-2xl text-[13px] font-semibold border-2 transition-all"
                              style={form.role === val
                                ? { background: '#7C3AED', color: '#fff', borderColor: '#7C3AED' }
                                : { background: '#fff', color: '#8E87A8', borderColor: 'rgba(124,58,237,0.15)' }
                              }
                            >
                              {label}
                            </motion.button>
                          ))}
                        </div>
                      </div>

                      {/* Documento */}
                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest block mb-2">
                          Documento
                        </label>
                        <div className="flex gap-2">
                          {/* Tipo de documento */}
                          <div className="flex gap-1 flex-wrap shrink-0">
                            {DOC_TYPES.map(t => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setForm(f => ({ ...f, docType: f.docType === t ? '' : t }))}
                                className="h-9 px-2.5 rounded-lg text-[11px] font-semibold border-2 transition-all"
                                style={form.docType === t
                                  ? { background: '#7C3AED', color: '#fff', borderColor: '#7C3AED' }
                                  : { background: '#fff', color: '#8E87A8', borderColor: 'rgba(124,58,237,0.15)' }
                                }
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="mt-2">
                          <Input
                            placeholder={form.docType ? `Número de ${form.docType}` : 'Selecciona primero el tipo'}
                            value={form.docNumber}
                            disabled={!form.docType}
                            className="h-11 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                            onChange={e => setForm(f => ({ ...f, docNumber: e.target.value }))}
                          />
                        </div>
                      </div>

                    </div>
                  )}

                  {/* ── STEP: CONTACTO ────────────────────────────────── */}
                  {currentStep === 'contact' && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest block mb-2">Correo electrónico</label>
                        <Input type="email" placeholder="correo@ejemplo.com" value={form.email} className="h-12 rounded-xl"
                          onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest block mb-2">Teléfono</label>
                        <PhoneInput
                          value={form.phone}
                          onChange={v => setForm(f => ({ ...f, phone: v }))}
                          placeholder="Número de teléfono"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest block mb-2">Nacimiento</label>
                          <DatePicker value={form.birthDate} onChange={v => setForm(f => ({ ...f, birthDate: v }))} placeholder="Fecha de nacimiento" />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest block mb-2">EPS</label>
                          <Input placeholder="Nombre de la EPS" value={form.eps} className="h-12 rounded-xl"
                            onChange={e => setForm(f => ({ ...f, eps: e.target.value }))} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── STEP: ACUDIENTE ───────────────────────────────── */}
                  {currentStep === 'guardian' && (
                    <div className="space-y-5">
                      <div className="px-4 py-3 rounded-2xl" style={{ background: 'rgba(67,97,238,0.06)' }}>
                        <p className="text-[12px] font-semibold" style={{ color: '#4361EE' }}>
                          El recordatorio de pago se enviará a este número por WhatsApp
                        </p>
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest block mb-2">Nombre del acudiente</label>
                        <Input placeholder="ej. María López" value={form.guardianName} className="h-12 rounded-xl"
                          onChange={e => setForm(f => ({ ...f, guardianName: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest block mb-2">Teléfono del acudiente</label>
                        <PhoneInput
                          value={form.guardianPhone}
                          onChange={v => setForm(f => ({ ...f, guardianPhone: v }))}
                          placeholder="Número del acudiente"
                        />
                      </div>
                    </div>
                  )}

                  {/* ── STEP: INFO DEPORTIVA ──────────────────────────── */}
                  {currentStep === 'sport' && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest block mb-2">Categoría</label>
                        <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v ?? '' }))}>
                          <SelectTrigger className="h-12 rounded-xl">
                            <span className="text-sm">{form.category || 'Seleccionar categoría'}</span>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Menores 3-10 años">Menores 3-10 años</SelectItem>
                            <SelectItem value="Transición 11-13 años">Transición 11-13 años</SelectItem>
                            <SelectItem value="Mayores 14+ años">Mayores 14+ años</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest block mb-2">Nivel</label>
                        <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v ?? '' }))}>
                          <SelectTrigger className="h-12 rounded-xl">
                            <span className="text-sm">{form.tipo || 'Seleccionar nivel'}</span>
                          </SelectTrigger>
                          <SelectContent>
                            {['Escuela','Novatos','Intermedio','Avanzados','Federados','Adultos'].map(t => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {/* ── STEP: SEDES ───────────────────────────────────── */}
                  {currentStep === 'locations' && (
                    <div className="space-y-4">
                      {locations.length === 0 ? (
                        <p className="text-[13px] text-muted-foreground">No hay sedes registradas aún.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {locations.map(loc => {
                            const selected = form.locationIds.includes(loc.id);
                            return (
                              <motion.button
                                key={loc.id}
                                whileTap={reducedMotion ? {} : { scale: 0.96 }}
                                transition={{ duration: 0.1 }}
                                onClick={() => toggleLocation(loc.id)}
                                className="px-4 py-2.5 rounded-2xl text-[13px] font-semibold border-2 transition-all"
                                style={selected
                                  ? { background: '#7C3AED', color: '#fff', borderColor: '#7C3AED' }
                                  : { background: '#fff', color: '#8E87A8', borderColor: 'rgba(124,58,237,0.18)' }
                                }
                              >
                                {loc.name}
                              </motion.button>
                            );
                          })}
                        </div>
                      )}

                      {/* Error display on last step */}
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="px-4 py-3 rounded-xl"
                          style={{ background: 'rgba(239,71,111,0.10)' }}
                        >
                          <p className="text-[12px] font-semibold" style={{ color: '#EF476F' }}>{error}</p>
                        </motion.div>
                      )}
                    </div>
                  )}

                  {/* Error display if only 2 steps (ADMIN) */}
                  {currentStep === 'contact' && steps.length === 2 && error && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 px-4 py-3 rounded-xl"
                      style={{ background: 'rgba(239,71,111,0.10)' }}
                    >
                      <p className="text-[12px] font-semibold" style={{ color: '#EF476F' }}>{error}</p>
                    </motion.div>
                  )}

                </motion.div>
              </AnimatePresence>
            </div>

            {/* ── Navigation ─────────────────────────────────────────── */}
            <div
              className="px-6 pt-4 flex gap-3 shrink-0 border-t border-border"
              style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
            >
              {step > 0 && (
                <motion.button
                  whileTap={reducedMotion ? {} : { scale: 0.97 }}
                  transition={{ duration: 0.12, ease: EASE_OUT }}
                  onClick={prevStep}
                  className="flex-1 py-3.5 rounded-2xl font-semibold text-[14px] border-2 transition-colors"
                  style={{ borderColor: 'rgba(124,58,237,0.18)', color: '#7C3AED' }}
                >
                  Atrás
                </motion.button>
              )}
              <motion.button
                whileTap={reducedMotion ? {} : { scale: 0.97 }}
                transition={{ duration: 0.12, ease: EASE_OUT }}
                onClick={step < steps.length - 1 ? nextStep : handleSave}
                disabled={saving || (step === 0 && !form.fullName.trim())}
                className="flex-[2] py-3.5 rounded-2xl font-semibold text-[14px] text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #7C3AED, #4361EE)' }}
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    Guardando...
                  </span>
                ) : step < steps.length - 1 ? (
                  <>
                    Continuar
                    <ChevronRight className="w-4 h-4" />
                  </>
                ) : editing ? 'Guardar cambios' : 'Crear miembro'}
              </motion.button>
            </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </>,
      document.body
      )}

      {/* ── Modal Ver Deportista ────────────────────────────────────────── */}
      <div>
      <AnimatePresence>
        {viewMember && (
          <>
            <motion.div
              key="view-backdrop"
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(15,10,30,0.52)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setViewMember(null)}
            />
            <motion.div
              key="view-modal"
              className="fixed inset-0 z-50 flex items-center justify-center px-4"
              style={{ pointerEvents: 'none' }}
            >
              <motion.div
                className="bg-white flex flex-col w-full overflow-hidden"
                style={{
                  maxWidth: 440,
                  borderRadius: 28,
                  maxHeight: '88dvh',
                  boxShadow: '0 24px 64px rgba(124,58,237,0.18), 0 4px 16px rgba(0,0,0,0.08)',
                  pointerEvents: 'auto',
                }}
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: -12 }}
                animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: -12 }}
                transition={{ duration: 0.26, ease: EASE_OUT }}
              >
                {/* Hero del deportista */}
                <div className="relative px-6 pt-6 pb-5" style={{ background: ROLE_GRADIENT[viewMember.role] ?? ROLE_GRADIENT.STUDENT }}>
                  <button
                    onClick={() => setViewMember(null)}
                    className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,0.2)' }}
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-semibold text-white shrink-0"
                      style={{ background: 'rgba(255,255,255,0.2)' }}>
                      {initials(viewMember.fullName)}
                    </div>
                    <div>
                      <p className="text-white/70 text-[11px] font-semibold uppercase tracking-widest mb-0.5">
                        {ROLES[viewMember.role]}
                      </p>
                      <h2 className="text-white font-semibold text-[18px] leading-tight" style={{ fontFamily: 'inherit' }}>
                        {viewMember.fullName}
                      </h2>
                      {viewMember.category && (
                        <p className="text-white/80 text-[12px] mt-0.5">{viewMember.category}{viewMember.tipo ? ` · ${viewMember.tipo}` : ''}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Info scrollable */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

                  {/* 1. Documento */}
                  {(viewMember.docType || viewMember.docNumber) && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Documento</p>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(124,58,237,0.08)' }}>
                          <CreditCard className="w-3.5 h-3.5" style={{ color: '#7C3AED' }} />
                        </div>
                        <div>
                          {viewMember.docType && (
                            <p className="text-[10px] text-muted-foreground">{viewMember.docType}</p>
                          )}
                          {viewMember.docNumber && (
                            <p className="text-[13px] font-semibold text-foreground">{viewMember.docNumber}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 2. Contacto */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Contacto</p>
                    <div className="space-y-2.5">
                      {viewMember.phone && (() => {
                        const { iso2, dialCode, number } = parsePhoneDisplay(viewMember.phone);
                        return (
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(124,58,237,0.08)' }}>
                              <Phone className="w-3.5 h-3.5" style={{ color: '#7C3AED' }} />
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground">Teléfono</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="flex items-center gap-0.5">
                                  <FlagImg code={iso2} size={16} />
                                  <span className="text-[13px] font-semibold text-foreground">+{dialCode}</span>
                                </span>
                                <p className="text-[13px] font-semibold text-foreground">{number}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                      {viewMember.email && (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(124,58,237,0.08)' }}>
                            <Mail className="w-3.5 h-3.5" style={{ color: '#7C3AED' }} />
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Correo</p>
                            <p className="text-[13px] font-semibold text-foreground">{viewMember.email}</p>
                          </div>
                        </div>
                      )}
                      {viewMember.birthDate && (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(124,58,237,0.08)' }}>
                            <Calendar className="w-3.5 h-3.5" style={{ color: '#7C3AED' }} />
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Nacimiento</p>
                            <p className="text-[13px] font-semibold text-foreground">
                              {parseLocalDate(viewMember.birthDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3. Acudiente */}
                  {(viewMember.emergencyContact || viewMember.emergencyPhone) && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Acudiente</p>
                      <div className="space-y-2.5">
                        {viewMember.emergencyContact && (
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(67,97,238,0.08)' }}>
                              <Shield className="w-3.5 h-3.5" style={{ color: '#4361EE' }} />
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground">Nombre</p>
                              <p className="text-[13px] font-semibold text-foreground">{viewMember.emergencyContact}</p>
                            </div>
                          </div>
                        )}
                        {viewMember.emergencyPhone && (() => {
                          const { iso2, dialCode, number } = parsePhoneDisplay(viewMember.emergencyPhone);
                          return (
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(67,97,238,0.08)' }}>
                                <Phone className="w-3.5 h-3.5" style={{ color: '#4361EE' }} />
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground">Teléfono</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="flex items-center gap-0.5">
                                    <FlagImg code={iso2} size={16} />
                                    <span className="text-[13px] font-semibold text-foreground">+{dialCode}</span>
                                  </span>
                                  <p className="text-[13px] font-semibold text-foreground">{number}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* 4. Salud */}
                  {viewMember.eps && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Salud</p>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(6,214,160,0.08)' }}>
                          <Heart className="w-3.5 h-3.5" style={{ color: '#06D6A0' }} />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">EPS</p>
                          <p className="text-[13px] font-semibold text-foreground">{viewMember.eps}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Sedes */}
                  {viewMember.locations.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Sedes</p>
                      <div className="flex flex-wrap gap-2">
                        {viewMember.locations.map(l => (
                          <div key={l.location.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: 'rgba(124,58,237,0.08)' }}>
                            <MapPin className="w-3 h-3 shrink-0" style={{ color: '#7C3AED' }} />
                            <span className="text-[12px] font-semibold" style={{ color: '#7C3AED' }}>{l.location.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Acción editar */}
                <div className="px-6 py-4 border-t border-border shrink-0">
                  <motion.button
                    whileTap={reducedMotion ? {} : { scale: 0.97 }}
                    transition={{ duration: 0.12, ease: EASE_OUT }}
                    onClick={() => { setViewMember(null); openEdit(viewMember); }}
                    className="w-full py-3.5 rounded-2xl font-semibold text-[14px] text-white flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #7C3AED, #4361EE)' }}
                  >
                    <Pencil className="w-4 h-4" />
                    Editar información
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      </div>

      {/* ── Modal importar Excel ────────────────────────────────────────────── */}
      <Dialog open={importOpen} onOpenChange={v => { if (!importing) { setImportOpen(v); setImportErrors([]); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Importar desde Excel</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-[12px] text-muted-foreground">
              Sube el archivo Excel con la plantilla completada. Los deportistas con el mismo correo no se duplicarán.
            </p>
            {/* Input real oculto — evita que el file picker del OS cierre el dialog */}
            <label
              className="border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center gap-3 cursor-pointer hover:border-primary transition-colors"
              htmlFor="import-file-input"
            >
              <FileSpreadsheet className="w-8 h-8 text-muted-foreground/40" />
              {importing
                ? <p className="text-[12px] font-semibold text-primary">Importando...</p>
                : <p className="text-[12px] font-semibold text-muted-foreground">Toca para seleccionar .xlsx</p>
              }
            </label>
            <input
              id="import-file-input"
              type="file"
              accept=".xlsx,.xls"
              className="sr-only"
              disabled={importing}
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) {
                  handleImport(file);
                  // Limpiar el input para permitir seleccionar el mismo archivo de nuevo
                  e.target.value = '';
                }
              }}
            />
            {importErrors.length > 0 && (
              <div className="bg-red-50 rounded-xl p-3 space-y-1 max-h-40 overflow-y-auto">
                {importErrors.map((e, i) => <p key={i} className="text-[11px] text-red-600">{e}</p>)}
              </div>
            )}
            <button
              onClick={() => downloadMembersTemplate(locations)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-border text-[12px] font-semibold text-muted-foreground hover:bg-secondary"
            >
              <FileSpreadsheet className="w-4 h-4" />Descargar plantilla
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
