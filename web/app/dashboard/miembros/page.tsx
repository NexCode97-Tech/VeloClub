'use client';

import { useAuth, useUser } from '@clerk/nextjs';
import { useClubStream } from '@/hooks/useClubStream';
import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { apiFetch } from '@/lib/api-client';
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
  FileSpreadsheet, Upload, X, ChevronRight,
} from 'lucide-react';
import { downloadMembersPDF } from '@/lib/pdf';
import { downloadMembersTemplate, parseMembersExcel } from '@/lib/excel';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Location { id: string; name: string }
interface Member {
  id: string; fullName: string; email?: string; phone?: string;
  birthDate?: string; category?: string; tipo?: string;
  emergencyContact?: string; emergencyPhone?: string; eps?: string;
  paymentDueDay?: number | null; monthlyFee?: number | null;
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
const emptyForm = {
  fullName: '', email: '', phone: '', birthDate: '',
  category: '', tipo: '',
  guardianName: '', guardianPhone: '',
  eps: '', role: 'STUDENT', locationIds: [] as string[],
  paymentDueDay: '' as string,
  monthlyFee: '' as string,
};

// ── Animations ─────────────────────────────────────────────────────────────────
const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];
const EASE_IOS: [number, number, number, number] = [0.32, 0.72, 0, 1];

export default function MiembrosPage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const reducedMotion = useReducedMotion();

  const [members, setMembers]   = useState<Member[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL'|'STUDENT'|'COACH'|'ADMIN'>('ALL');
  const [clubName, setClubName] = useState('VeloClub');

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

  // Steps definition
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

  // ── Data ────────────────────────────────────────────────────────────────────
  async function load() {
    const token = await getToken();
    const [membersRes, locsRes, settingsRes] = await Promise.all([
      apiFetch<{ members: Member[] }>('/members', { token }),
      apiFetch<{ locations: Location[] }>('/locations', { token }),
      apiFetch<{ club: { name: string } }>('/clubs/settings', { token }).catch(() => null),
    ]);
    setMembers(membersRes.members);
    setLocations(locsRes.locations);
    if (settingsRes) setClubName(settingsRes.club.name);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);
  useClubStream(ev => { if (ev === 'members') load(); });

  // ── Panel actions ───────────────────────────────────────────────────────────
  function openNew() {
    setEditing(null); setForm(emptyForm); setStep(0); setError(null); setOpen(true);
  }

  function openEdit(m: Member) {
    setEditing(m);
    setForm({
      fullName: m.fullName, email: m.email ?? '', phone: m.phone ?? '',
      birthDate: m.birthDate ? m.birthDate.split('T')[0] : '',
      category: m.category ?? '', tipo: m.tipo ?? '',
      guardianName: m.emergencyContact ?? '',
      guardianPhone: m.emergencyPhone ?? '',
      eps: m.eps ?? '', role: m.role,
      locationIds: m.locations.map(l => l.location.id),
      paymentDueDay: m.paymentDueDay != null ? String(m.paymentDueDay) : '',
      monthlyFee: m.monthlyFee != null ? String(m.monthlyFee) : '',
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
        category: form.category || undefined,
        tipo: form.tipo || undefined,
        emergencyContact: form.guardianName || undefined,
        emergencyPhone: form.guardianPhone || undefined,
        eps: form.eps || undefined,
        role: form.role,
        locationIds: form.locationIds,
        paymentDueDay: form.paymentDueDay ? parseInt(form.paymentDueDay) : null,
        monthlyFee: form.monthlyFee ? parseFloat(form.monthlyFee) : null,
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
      await load();
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
    await load();
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
        await apiFetch('/members', { method: 'POST', token, body: JSON.stringify({ ...rest, locationIds }) });
      } catch (e) { failed.push(`${row.fullName}: ${e instanceof Error ? e.message : 'Error'}`); }
    }
    setImporting(false);
    if (failed.length > 0) setImportErrors(failed); else setImportOpen(false);
    await load();
  }

  // ── Filtered list ────────────────────────────────────────────────────────────
  const filtered = members.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = m.fullName.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q);
    const matchRole   = roleFilter === 'ALL' || m.role === roleFilter;
    return matchSearch && matchRole;
  });

  // ── Initials ─────────────────────────────────────────────────────────────────
  function initials(name: string) {
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  // ── Step content renderer ────────────────────────────────────────────────────
  const currentStep = steps[step]?.id;

  const fmt = new Intl.NumberFormat('es-CO');

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-full bg-background">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-4 bg-card border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-bold text-foreground" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            Miembros
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {members.length} miembro{members.length !== 1 ? 's' : ''} registrado{members.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadMembersPDF(members, clubName)}
            disabled={members.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-border text-muted-foreground hover:bg-secondary active:scale-95 transition-all disabled:opacity-40"
          >
            <Download className="w-4 h-4" /><span className="hidden sm:inline">PDF</span>
          </button>
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-border text-muted-foreground hover:bg-secondary active:scale-95 transition-all"
          >
            <Upload className="w-4 h-4" /><span className="hidden sm:inline">Importar</span>
          </button>
          <button
            onClick={() => downloadMembersTemplate(locations)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-border text-muted-foreground hover:bg-secondary active:scale-95 transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" /><span className="hidden sm:inline">Plantilla</span>
          </button>
          <motion.button
            onClick={openNew}
            whileTap={reducedMotion ? {} : { scale: 0.97 }}
            transition={{ duration: 0.12, ease: EASE_OUT }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: '#7C3AED' }}
          >
            <Plus className="w-4 h-4" /><span className="hidden sm:inline">Nuevo</span>
          </motion.button>
        </div>
      </div>

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9 bg-white border-border rounded-xl" placeholder="Buscar miembro..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {([['ALL','Todos'],['STUDENT','Deportistas'],['COACH','Entrenadores'],['ADMIN','Admins']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setRoleFilter(val)}
              className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors"
              style={roleFilter === val
                ? { background: '#7C3AED', color: '#fff', borderColor: '#7C3AED' }
                : { background: '#fff', color: '#8E87A8', borderColor: 'rgba(120,80,200,0.10)' }
              }
            >{label}</button>
          ))}
        </div>

        {/* ── List ──────────────────────────────────────────────────────── */}
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
          <>
            {/* Mobile cards */}
            <div className="md:hidden space-y-2 pb-28">
              {filtered.map(m => {
                const rc = ROLE_COLORS[m.role] ?? ROLE_COLORS.STUDENT;
                return (
                  <motion.div
                    key={m.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, ease: EASE_OUT }}
                    className="bg-white border border-border rounded-xl px-3 py-3 flex items-center gap-3"
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ background: ROLE_GRADIENT[m.role] ?? ROLE_GRADIENT.STUDENT }}
                    >
                      {initials(m.fullName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <p className="text-[13px] font-bold text-foreground truncate">{m.fullName}</p>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ color: rc.text, background: rc.bg }}>
                          {ROLES[m.role]}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{m.email ?? '—'}</p>
                      {m.role === 'STUDENT' && (
                        <div className="flex gap-2 mt-0.5 flex-wrap">
                          {m.category && <span className="text-[10px] font-semibold" style={{ color: '#7C3AED' }}>{m.category}</span>}
                          {m.tipo && <span className="text-[10px] text-muted-foreground">{m.tipo}</span>}
                          {m.paymentDueDay && <span className="text-[10px] text-muted-foreground">Día {m.paymentDueDay}</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
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

            {/* Desktop table */}
            <div className="hidden md:block bg-white rounded-xl border border-border overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead className="bg-secondary border-b border-border">
                  <tr>
                    {['Nombre','Email','Rol','Sedes','Categoría','Tipo',''].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map(m => {
                    const rc = ROLE_COLORS[m.role] ?? ROLE_COLORS.STUDENT;
                    return (
                      <tr key={m.id} className="hover:bg-secondary/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: ROLE_GRADIENT[m.role] ?? ROLE_GRADIENT.STUDENT }}>
                              {initials(m.fullName)}
                            </div>
                            <span className="font-semibold text-foreground">{m.fullName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{m.email ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: rc.text, background: rc.bg }}>{ROLES[m.role]}</span>
                        </td>
                        <td className="px-4 py-3">
                          {m.role === 'ADMIN' || m.locations.length === 0
                            ? <span className="text-muted-foreground">—</span>
                            : m.locations.map(l => <Badge key={l.location.id} variant="secondary" className="text-xs mr-1">{l.location.name}</Badge>)
                          }
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{m.category ?? '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{m.tipo ?? '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="ghost" onClick={() => openEdit(m)}><Pencil className="w-4 h-4" /></Button>
                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(m.id)}><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          NUEVO PANEL — bottom sheet multi-paso
      ═══════════════════════════════════════════════════════════════════ */}

      {/* Backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(15,10,30,0.52)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => !saving && setOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sheet */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="sheet"
            className="fixed bottom-0 left-0 right-0 z-50 bg-white flex flex-col"
            style={{
              borderRadius: '28px 28px 0 0',
              maxHeight: '94dvh',
              boxShadow: '0 -8px 40px rgba(124,58,237,0.14)',
            }}
            initial={reducedMotion ? { opacity: 0 } : { y: '100%' }}
            animate={reducedMotion ? { opacity: 1 } : { y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { y: '100%' }}
            transition={{ duration: 0.46, ease: EASE_IOS }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-9 h-1 rounded-full" style={{ background: 'rgba(124,58,237,0.15)' }} />
            </div>

            {/* Header */}
            <div className="px-6 pt-2 pb-3 flex items-start justify-between shrink-0">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#7C3AED' }}>
                  {editing ? 'Editar miembro' : 'Nuevo miembro'}
                </p>
                <h2 className="text-[22px] font-extrabold text-foreground leading-tight mt-0.5" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
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
                              className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                              style={{ background: ROLE_GRADIENT[form.role] ?? ROLE_GRADIENT.STUDENT }}
                            >
                              {initials(form.fullName)}
                            </div>
                            <div>
                              <p className="font-bold text-foreground text-[14px]">{form.fullName}</p>
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
                              className="py-3 rounded-2xl text-[13px] font-bold border-2 transition-all"
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
                        <Input placeholder="ej. 3001234567" value={form.phone} className="h-12 rounded-xl"
                          onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest block mb-2">Nacimiento</label>
                          <Input type="date" value={form.birthDate} className="h-12 rounded-xl text-sm"
                            onChange={e => setForm(f => ({ ...f, birthDate: e.target.value }))} />
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
                        <Input placeholder="ej. 3001234567" value={form.guardianPhone} className="h-12 rounded-xl"
                          onChange={e => setForm(f => ({ ...f, guardianPhone: e.target.value }))} />
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
                            {['Escuela','Novatos','Intermedio','Avanzados','Federados'].map(t => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest block mb-2">Tarifa mensual</label>
                          <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] font-bold" style={{ color: '#7C3AED' }}>$</span>
                            <Input
                              placeholder="0"
                              className="pl-7 h-12 rounded-xl"
                              value={form.monthlyFee ? Number(form.monthlyFee).toLocaleString('es-CO') : ''}
                              onChange={e => {
                                const raw = e.target.value.replace(/\./g, '').replace(/\D/g, '');
                                setForm(f => ({ ...f, monthlyFee: raw }));
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest block mb-2">Día de pago</label>
                          <Input
                            type="number" min={1} max={31}
                            placeholder="ej. 5"
                            className="h-12 rounded-xl"
                            value={form.paymentDueDay}
                            onChange={e => {
                              const v = e.target.value;
                              const n = parseInt(v);
                              if (v === '' || (n >= 1 && n <= 31)) setForm(f => ({ ...f, paymentDueDay: v }));
                            }}
                          />
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        El cobro mensual se generará automáticamente el día 1 de cada mes
                      </p>
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
            <div className="px-6 py-4 flex gap-3 shrink-0 border-t border-border">
              {step > 0 && (
                <motion.button
                  whileTap={reducedMotion ? {} : { scale: 0.97 }}
                  transition={{ duration: 0.12, ease: EASE_OUT }}
                  onClick={prevStep}
                  className="flex-1 py-3.5 rounded-2xl font-bold text-[14px] border-2 transition-colors"
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
                className="flex-[2] py-3.5 rounded-2xl font-bold text-[14px] text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
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
        )}
      </AnimatePresence>

      {/* ── Modal importar Excel ────────────────────────────────────────────── */}
      <Dialog open={importOpen} onOpenChange={v => { if (!importing) { setImportOpen(v); setImportErrors([]); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Importar desde Excel</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-[12px] text-muted-foreground">
              Sube el archivo Excel con la plantilla completada. Los deportistas con el mismo correo no se duplicarán.
            </p>
            <div
              className="border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center gap-3 cursor-pointer hover:border-primary transition-colors"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file'; input.accept = '.xlsx,.xls';
                input.onchange = e => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) handleImport(file);
                };
                input.click();
              }}
            >
              <FileSpreadsheet className="w-8 h-8 text-muted-foreground/40" />
              {importing
                ? <p className="text-[12px] font-semibold text-primary">Importando...</p>
                : <p className="text-[12px] font-semibold text-muted-foreground">Toca para seleccionar .xlsx</p>
              }
            </div>
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
