'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@clerk/nextjs';
import { useEffect, useState, useRef } from 'react';
import { apiFetch } from '@/lib/api-client';
import { parseLocalDate } from '@/lib/utils';
import Link from 'next/link';
import {
  Trophy, Plus, Trash2, MapPin, CalendarDays, ChevronRight,
  Dumbbell, Users, Target,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';

// ── Types ──────────────────────────────────────────────────────────────────────
interface EventResult  { id: string; position?: number; member: { id: string; fullName: string } }
interface CompEvent    { id: string; name: string; results: EventResult[] }
interface Competition  { id: string; name: string; place?: string; date: string; events: CompEvent[] }

interface TrainingResult { id: string; time?: string; distance?: string; laps?: number; observations?: string; member: { id: string; fullName: string } }
interface TrainingSession { id: string; title: string; date: string; notes?: string; location?: { id: string; name: string } | null; results: TrainingResult[] }

interface Location { id: string; name: string }

// ── Helpers ────────────────────────────────────────────────────────────────────
const emptyComp    = { name: '', place: '', date: '' };
const emptySession = { title: '', date: '', locationId: '', notes: '' };

// Medal SVG components (no emojis)
function MedalIcon({ position }: { position: number }) {
  const colors: Record<number, { bg: string; ring: string; text: string }> = {
    1: { bg: '#FFF7CC', ring: '#F4BF00', text: '#A67C00' },
    2: { bg: '#F0F0F0', ring: '#A0A0A0', text: '#606060' },
    3: { bg: '#FFF0E6', ring: '#D4845A', text: '#8B4513' },
  };
  const c = colors[position];
  if (!c) return null;
  return (
    <span
      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-black"
      style={{ background: c.bg, border: `1.5px solid ${c.ring}`, color: c.text }}
    >
      {position}
    </span>
  );
}

// Stat pill
function StatPill({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl" style={{ background: `${color}12` }}>
      <span className="text-[18px] font-black leading-none" style={{ color }}>{value}</span>
      <span className="text-[10px] font-medium text-muted-foreground leading-none">{label}</span>
    </div>
  );
}

// Skeleton card
function SkeletonCard() {
  return (
    <div className="bg-white border border-border rounded-2xl p-4 animate-pulse">
      <div className="flex gap-3">
        <div className="w-12 h-12 rounded-xl bg-secondary shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-secondary rounded-full w-2/3" />
          <div className="h-2 bg-secondary rounded-full w-1/2" />
          <div className="h-2 bg-secondary rounded-full w-1/3" />
        </div>
      </div>
    </div>
  );
}

const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const itemVariant = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 380, damping: 28 } },
};

export default function LogrosPage() {
  const { getToken } = useAuth();
  const [tab, setTab]               = useState<'comp' | 'train'>('comp');
  const [role, setRole]             = useState('');
  const [locations, setLocations]   = useState<Location[]>([]);
  const [loading, setLoading]       = useState(true);
  const [myMemberId, setMyMemberId] = useState<string | null>(null);

  const [competitions, setComps]    = useState<Competition[]>([]);
  const [compOpen, setCompOpen]     = useState(false);
  const [compForm, setCompForm]     = useState(emptyComp);
  const [savingComp, setSavingComp] = useState(false);
  const [compError, setCompError]   = useState<string | null>(null);
  const [deletingComp, setDeletingComp] = useState<string | null>(null);

  const [sessions, setSessions]         = useState<TrainingSession[]>([]);
  const [sessionOpen, setSessionOpen]   = useState(false);
  const [sessionForm, setSessionForm]   = useState(emptySession);
  const [savingSession, setSavingSession] = useState(false);
  const [sessionError, setSessionError]   = useState<string | null>(null);
  const [deletingSession, setDeletingSession] = useState<string | null>(null);

  async function loadAll() {
    const token = await getToken();
    const [meRes, compRes, trainRes, locsRes] = await Promise.all([
      apiFetch<{ status: string; user?: { role: string } }>('/me', { token }),
      apiFetch<{ competitions: Competition[] }>('/competitions', { token }),
      apiFetch<{ sessions: TrainingSession[] }>('/training', { token }),
      apiFetch<{ locations: Location[] }>('/locations', { token }),
    ]);
    const userRole = meRes.user?.role ?? '';
    setRole(userRole);
    if (userRole === 'STUDENT') {
      const memberRes = await apiFetch<{ member: { id: string } }>('/members/me', { token }).catch(() => null);
      setMyMemberId(memberRes?.member.id ?? null);
    }
    setComps(compRes.competitions);
    setSessions(trainRes.sessions);
    setLocations(locsRes.locations);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  const canManage = role === 'ADMIN' || role === 'COACH';
  const isStudent = role === 'STUDENT';

  const visibleComps = isStudent && myMemberId
    ? competitions.filter(c => c.events.some(e => e.results.some(r => r.member.id === myMemberId)))
    : competitions;
  const visibleSessions = isStudent && myMemberId
    ? sessions.filter(s => s.results.some(r => r.member.id === myMemberId))
    : sessions;

  async function handleSaveComp() {
    if (!compForm.name.trim() || !compForm.date) return;
    setSavingComp(true); setCompError(null);
    try {
      const token = await getToken();
      await apiFetch('/competitions', {
        method: 'POST', token,
        body: JSON.stringify({ ...compForm, place: compForm.place || undefined }),
      });
      setCompOpen(false); setCompForm(emptyComp);
      await loadAll();
    } catch (e) { setCompError(e instanceof Error ? e.message : 'Error'); }
    finally { setSavingComp(false); }
  }

  async function handleDeleteComp(id: string) {
    if (!confirm('¿Eliminar esta competencia y todos sus resultados?')) return;
    setDeletingComp(id);
    try {
      const token = await getToken();
      await apiFetch(`/competitions/${id}`, { method: 'DELETE', token });
      await loadAll();
    } finally { setDeletingComp(null); }
  }

  async function handleSaveSession() {
    if (!sessionForm.title.trim() || !sessionForm.date) return;
    setSavingSession(true); setSessionError(null);
    try {
      const token = await getToken();
      await apiFetch('/training', {
        method: 'POST', token,
        body: JSON.stringify({
          title:      sessionForm.title,
          date:       sessionForm.date,
          locationId: sessionForm.locationId || undefined,
          notes:      sessionForm.notes      || undefined,
        }),
      });
      setSessionOpen(false); setSessionForm(emptySession);
      await loadAll();
    } catch (e) { setSessionError(e instanceof Error ? e.message : 'Error'); }
    finally { setSavingSession(false); }
  }

  async function handleDeleteSession(id: string) {
    if (!confirm('¿Eliminar esta sesión y todos sus resultados?')) return;
    setDeletingSession(id);
    try {
      const token = await getToken();
      await apiFetch(`/training/${id}`, { method: 'DELETE', token });
      await loadAll();
    } finally { setDeletingSession(null); }
  }

  const totalCompResults  = visibleComps.reduce((s, c) => s + c.events.reduce((e, ev) => e + ev.results.length, 0), 0);
  const totalTrainResults = visibleSessions.reduce((s, ses) => s + ses.results.length, 0);

  // ── Tab indicator ref ──────────────────────────────────────────────────────
  const tabCompRef  = useRef<HTMLButtonElement>(null);
  const tabTrainRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="min-h-full bg-background">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-4">
          <div>
            <h1 className="text-[20px] font-black text-foreground tracking-tight" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
              Resultados
            </h1>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Competencias y entrenamientos del club
            </p>
          </div>
          {canManage && (
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={() => {
                if (tab === 'comp') { setCompForm(emptyComp); setCompError(null); setCompOpen(true); }
                else { setSessionForm(emptySession); setSessionError(null); setSessionOpen(true); }
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-bold text-white shadow-sm shrink-0 cursor-pointer"
              style={{ background: tab === 'comp' ? '#4361EE' : '#06D6A0' }}
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{tab === 'comp' ? 'Competencia' : 'Entrenamiento'}</span>
            </motion.button>
          )}
        </div>

        {/* Stats strip */}
        {!loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex gap-2 mb-4"
          >
            {tab === 'comp' ? (
              <>
                <StatPill value={visibleComps.length} label="Competencias" color="#4361EE" />
                <StatPill value={visibleComps.reduce((s, c) => s + c.events.length, 0)} label="Pruebas" color="#7C3AED" />
                <StatPill value={totalCompResults} label="Resultados" color="#06D6A0" />
              </>
            ) : (
              <>
                <StatPill value={visibleSessions.length} label="Sesiones" color="#06D6A0" />
                <StatPill value={totalTrainResults} label="Resultados" color="#4361EE" />
              </>
            )}
          </motion.div>
        )}

        {/* Tabs */}
        <div className="relative flex bg-secondary rounded-2xl p-1">
          {/* Sliding indicator */}
          <motion.div
            className="absolute top-1 bottom-1 rounded-xl bg-white shadow-sm"
            animate={{ left: tab === 'comp' ? '4px' : '50%', width: 'calc(50% - 4px)' }}
            transition={{ type: 'spring', stiffness: 500, damping: 36 }}
          />
          {(['comp', 'train'] as const).map(t => (
            <button
              key={t}
              ref={t === 'comp' ? tabCompRef : tabTrainRef}
              onClick={() => setTab(t)}
              className="relative z-10 flex-1 py-2.5 rounded-xl text-[12px] font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              style={{ color: tab === t ? '#1A1028' : '#8E87A8' }}
            >
              {t === 'comp'
                ? <><Trophy className="w-3.5 h-3.5" />Competencias</>
                : <><Dumbbell className="w-3.5 h-3.5" />Entrenamientos</>
              }
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="px-4 pb-6">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-3">
              {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
            </motion.div>
          ) : tab === 'comp' ? (
            <motion.div key="comp" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.2 }}>
              {visibleComps.length === 0 ? (
                <EmptyState
                  icon={<Trophy className="w-10 h-10" style={{ color: '#4361EE' }} />}
                  color="#4361EE"
                  title="Sin competencias"
                  desc="Registra la primera competencia del club para llevar un historial de resultados."
                  cta={canManage ? 'Agregar competencia' : undefined}
                  onCta={() => { setCompForm(emptyComp); setCompError(null); setCompOpen(true); }}
                />
              ) : (
                <motion.div variants={listVariants} initial="hidden" animate="show" className="flex flex-col gap-3">
                  {visibleComps.map(c => <CompCard key={c.id} comp={c} isStudent={isStudent} myMemberId={myMemberId} canManage={canManage} deleting={deletingComp === c.id} onDelete={handleDeleteComp} />)}
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.div key="train" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
              {visibleSessions.length === 0 ? (
                <EmptyState
                  icon={<Dumbbell className="w-10 h-10" style={{ color: '#06D6A0' }} />}
                  color="#06D6A0"
                  title="Sin entrenamientos"
                  desc="Registra sesiones de entrenamiento para hacer seguimiento del rendimiento."
                  cta={canManage ? 'Registrar entrenamiento' : undefined}
                  onCta={() => { setSessionForm(emptySession); setSessionError(null); setSessionOpen(true); }}
                />
              ) : (
                <motion.div variants={listVariants} initial="hidden" animate="show" className="flex flex-col gap-3">
                  {visibleSessions.map(s => <TrainCard key={s.id} session={s} isStudent={isStudent} myMemberId={myMemberId} canManage={canManage} deleting={deletingSession === s.id} onDelete={handleDeleteSession} />)}
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Modal nueva competencia ─────────────────────────────────────────── */}
      <Dialog open={compOpen} onOpenChange={setCompOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(67,97,238,0.10)' }}>
                <Trophy className="w-4 h-4" style={{ color: '#4361EE' }} />
              </span>
              Nueva competencia
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input value={compForm.name} onChange={e => setCompForm(f => ({ ...f, name: e.target.value }))} placeholder="ej. Copa Patinaje Antioquia 2025" />
            </div>
            <div className="space-y-2">
              <Label>Lugar</Label>
              <Input value={compForm.place} onChange={e => setCompForm(f => ({ ...f, place: e.target.value }))} placeholder="Ciudad o municipio" />
            </div>
            <div className="space-y-2">
              <Label>Fecha *</Label>
              <Input type="date" value={compForm.date} onChange={e => setCompForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            {compError && <p className="text-sm text-red-600">{compError}</p>}
            <Button onClick={handleSaveComp} disabled={savingComp || !compForm.name.trim() || !compForm.date} className="w-full">
              {savingComp ? 'Guardando...' : 'Crear competencia'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal nuevo entrenamiento ───────────────────────────────────────── */}
      <Dialog open={sessionOpen} onOpenChange={setSessionOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(6,214,160,0.10)' }}>
                <Dumbbell className="w-4 h-4" style={{ color: '#06D6A0' }} />
              </span>
              Nuevo entrenamiento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={sessionForm.title} onChange={e => setSessionForm(f => ({ ...f, title: e.target.value }))} placeholder="ej. Velocidad 500m" />
            </div>
            <div className="space-y-2">
              <Label>Fecha *</Label>
              <Input type="date" value={sessionForm.date} onChange={e => setSessionForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            {locations.length > 0 && (
              <div className="space-y-2">
                <Label>Sede</Label>
                <Select value={sessionForm.locationId} onValueChange={v => setSessionForm(f => ({ ...f, locationId: v ?? '' }))}>
                  <SelectTrigger>
                    <span className="text-sm">{locations.find(l => l.id === sessionForm.locationId)?.name ?? 'Seleccionar sede'}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Notas</Label>
              <Input value={sessionForm.notes} onChange={e => setSessionForm(f => ({ ...f, notes: e.target.value }))} placeholder="Opcional" />
            </div>
            {sessionError && <p className="text-sm text-red-600">{sessionError}</p>}
            <Button onClick={handleSaveSession} disabled={savingSession || !sessionForm.title.trim() || !sessionForm.date} className="w-full">
              {savingSession ? 'Guardando...' : 'Crear entrenamiento'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── CompCard ───────────────────────────────────────────────────────────────────
function CompCard({ comp: c, isStudent, myMemberId, canManage, deleting, onDelete }: {
  comp: Competition; isStudent: boolean; myMemberId: string | null;
  canManage: boolean; deleting: boolean; onDelete: (id: string) => void;
}) {
  const allResults    = c.events.flatMap(e => e.results);
  const visibleResults = isStudent && myMemberId ? allResults.filter(r => r.member.id === myMemberId) : allResults;
  const resultCount   = visibleResults.length;
  const dateStr       = parseLocalDate(c.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  const podium        = visibleResults
    .filter(r => r.position && r.position <= 3)
    .sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
    .slice(0, 3);
  const hasGold       = podium.some(r => r.position === 1);

  return (
    <motion.div
      variants={itemVariant}
      style={{ borderRadius: 16 }}
      whileHover={{ y: -2, boxShadow: '0 8px 32px rgba(67,97,238,0.13)' }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className="bg-white border border-border overflow-hidden"
    >
      {/* Color accent bar */}
      <div className="h-1 w-full" style={{ background: hasGold ? 'linear-gradient(90deg,#F4BF00,#4361EE)' : 'linear-gradient(90deg,#4361EE,#7C3AED)' }} />

      <Link href={`/dashboard/logros/${c.id}`} className="block px-4 py-3.5 cursor-pointer">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: 'linear-gradient(135deg,rgba(67,97,238,0.12),rgba(124,58,237,0.12))' }}
          >
            <Trophy className="w-5 h-5" style={{ color: '#4361EE' }} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-foreground truncate leading-tight">{c.name}</p>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
              {c.place && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <MapPin className="w-3 h-3 shrink-0" />{c.place}
                </span>
              )}
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <CalendarDays className="w-3 h-3 shrink-0" />{dateStr}
              </span>
            </div>

            {/* Chips */}
            <div className="flex items-center gap-2 mt-2">
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: 'rgba(67,97,238,0.08)', color: '#4361EE' }}>
                <Target className="w-3 h-3" />{c.events.length} prueba{c.events.length !== 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: 'rgba(6,214,160,0.08)', color: '#05A07B' }}>
                <Users className="w-3 h-3" />{resultCount} resultado{resultCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0 mt-1.5" />
        </div>

        {/* Podio */}
        {podium.length > 0 && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/60">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Pódio</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {podium.map(r => (
                <span key={r.id} className="flex items-center gap-1">
                  <MedalIcon position={r.position ?? 0} />
                  <span className="text-[11px] font-semibold text-foreground">{r.member.fullName.split(' ')[0]}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </Link>

      {canManage && (
        <div className="px-4 pb-3 flex justify-end">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => onDelete(c.id)}
            disabled={deleting}
            className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
            style={{ background: 'rgba(239,71,111,0.08)', color: '#EF476F' }}
          >
            {deleting
              ? <div className="w-3.5 h-3.5 rounded-full border border-red-400 border-t-transparent animate-spin" />
              : <Trash2 className="w-3.5 h-3.5" />
            }
          </motion.button>
        </div>
      )}
    </motion.div>
  );
}

// ── TrainCard ──────────────────────────────────────────────────────────────────
function TrainCard({ session: s, isStudent, myMemberId, canManage, deleting, onDelete }: {
  session: TrainingSession; isStudent: boolean; myMemberId: string | null;
  canManage: boolean; deleting: boolean; onDelete: (id: string) => void;
}) {
  const rc      = isStudent && myMemberId ? s.results.filter(r => r.member.id === myMemberId).length : s.results.length;
  const dateStr = parseLocalDate(s.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <motion.div
      variants={itemVariant}
      style={{ borderRadius: 16 }}
      whileHover={{ y: -2, boxShadow: '0 8px 32px rgba(6,214,160,0.13)' }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className="bg-white border border-border overflow-hidden"
    >
      {/* Color accent bar */}
      <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg,#06D6A0,#4361EE)' }} />

      <Link href={`/dashboard/logros/entrenamiento/${s.id}`} className="block px-4 py-3.5 cursor-pointer">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: 'linear-gradient(135deg,rgba(6,214,160,0.12),rgba(67,97,238,0.10))' }}
          >
            <Dumbbell className="w-5 h-5" style={{ color: '#06D6A0' }} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-foreground truncate leading-tight">{s.title}</p>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
              {s.location && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <MapPin className="w-3 h-3 shrink-0" />{s.location.name}
                </span>
              )}
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <CalendarDays className="w-3 h-3 shrink-0" />{dateStr}
              </span>
            </div>

            {/* Chips */}
            <div className="flex items-center gap-2 mt-2">
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: 'rgba(6,214,160,0.09)', color: '#05A07B' }}>
                <Users className="w-3 h-3" />{rc} resultado{rc !== 1 ? 's' : ''}
              </span>
              {s.notes && (
                <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">{s.notes}</span>
              )}
            </div>
          </div>

          <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0 mt-1.5" />
        </div>
      </Link>

      {canManage && (
        <div className="px-4 pb-3 flex justify-end">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => onDelete(s.id)}
            disabled={deleting}
            className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
            style={{ background: 'rgba(239,71,111,0.08)', color: '#EF476F' }}
          >
            {deleting
              ? <div className="w-3.5 h-3.5 rounded-full border border-red-400 border-t-transparent animate-spin" />
              : <Trash2 className="w-3.5 h-3.5" />
            }
          </motion.button>
        </div>
      )}
    </motion.div>
  );
}

// ── EmptyState ─────────────────────────────────────────────────────────────────
function EmptyState({ icon, color, title, desc, cta, onCta }: {
  icon: React.ReactNode; color: string; title: string; desc: string;
  cta?: string; onCta?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-14 px-6 text-center bg-white border border-border rounded-2xl"
    >
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: `${color}12` }}>
        {icon}
      </div>
      <p className="text-[15px] font-bold text-foreground mb-1">{title}</p>
      <p className="text-[12px] text-muted-foreground max-w-[240px] leading-relaxed">{desc}</p>
      {cta && onCta && (
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onCta}
          className="mt-5 px-5 py-2.5 rounded-xl text-[13px] font-bold text-white shadow-sm cursor-pointer"
          style={{ background: color }}
        >
          {cta}
        </motion.button>
      )}
    </motion.div>
  );
}
