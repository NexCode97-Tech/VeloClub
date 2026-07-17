'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@clerk/nextjs';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { parseLocalDate, toSentenceCase } from '@/lib/utils';
import { useCompetitions, useTraining, useLocations } from '@/hooks/useVeloQuery';
import Link from 'next/link';
import {
  Trophy, Plus, Trash2, MapPin, CalendarDays, ChevronRight,
  Dumbbell, Users, Target, Medal,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { LocationPicker } from '@/components/ui/location-picker';

// ── Types ──────────────────────────────────────────────────────────────────────
interface EventResult  { id: string; position?: number; member: { id: string; fullName: string; pictureUrl?: string | null } }
interface CompEvent    { id: string; name: string; results: EventResult[] }
interface Competition  { id: string; name: string; place?: string; latitude?: number | null; longitude?: number | null; date: string; events: CompEvent[] }

interface TrainingResult { id: string; time?: string; distance?: string; laps?: number; observations?: string; member: { id: string; fullName: string } }
interface TrainingSession { id: string; title: string; date: string; notes?: string; location?: { id: string; name: string } | null; results: TrainingResult[] }

interface Location { id: string; name: string; latitude?: number | null; longitude?: number | null; address?: string | null }

// ── Helpers ────────────────────────────────────────────────────────────────────
const emptyComp    = { name: '', place: '', latitude: null as number | null, longitude: null as number | null, date: '' };
const emptySession = { title: '', date: '', locationId: '', notes: '' };

// Corrección ortográfica de ciudades/lugares (clave en MAYÚSCULAS)
const PLACE_FIX: Record<string, string> = {
  'BOGOTA': 'Bogotá', 'BOGOTÁ': 'Bogotá',
  'MEDELLIN': 'Medellín', 'MEDELLÍN': 'Medellín',
  'CALI': 'Cali',
  'BARRANQUILLA': 'Barranquilla',
  'BUCARAMANGA': 'Bucaramanga',
  'CARTAGENA': 'Cartagena',
  'MANIZALES': 'Manizales',
  'PEREIRA': 'Pereira',
  'CUCUTA': 'Cúcuta', 'CÚCUTA': 'Cúcuta',
  'IBAGUE': 'Ibagué', 'IBAGUÉ': 'Ibagué',
  'SANTA MARTA': 'Santa Marta',
  'VILLAVICENCIO': 'Villavicencio',
  'PASTO': 'Pasto',
  'MONTERIA': 'Montería', 'MONTERÍA': 'Montería',
  'NEIVA': 'Neiva',
  'ARMENIA': 'Armenia',
  'POPAYAN': 'Popayán', 'POPAYÁN': 'Popayán',
  'TUNJA': 'Tunja',
  'SINCELEJO': 'Sincelejo',
  'VALLEDUPAR': 'Valledupar',
  'RIOHACHA': 'Riohacha',
  'QUIBDO': 'Quibdó', 'QUIBDÓ': 'Quibdó',
  'FLORENCIA': 'Florencia',
  'YOPAL': 'Yopal',
  'MOCOA': 'Mocoa',
  'MITU': 'Mitú', 'MITÚ': 'Mitú',
  'INIRIDA': 'Inírida', 'INÍRIDA': 'Inírida',
  'PUERTO CARRENO': 'Puerto Carreño', 'PUERTO CARREÑO': 'Puerto Carreño',
  'SAN JOSE DEL GUAVIARE': 'San José del Guaviare',
};

function toPlace(str: string): string {
  const upper = str.toUpperCase().trim();
  if (PLACE_FIX[upper]) return PLACE_FIX[upper];
  // Fallback: primera letra de cada palabra en mayúscula
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

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
      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-semibold"
      style={{ background: c.bg, border: `1.5px solid ${c.ring}`, color: c.text }}
    >
      {position}
    </span>
  );
}

// Stat pill
function StatPill({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex-1 flex flex-col items-center gap-1 py-3 rounded-2xl" style={{ background: `${color}12` }}>
      <span className="text-[26px] font-semibold leading-none" style={{ color, fontFamily: 'inherit' }}>{value}</span>
      <span className="text-[11px] font-semibold text-muted-foreground leading-none">{label}</span>
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
  show:   { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 380, damping: 28 } },
};

export default function LogrosPage() {
  return (
    <Suspense fallback={null}>
      <LogrosPageInner />
    </Suspense>
  );
}

function LogrosPageInner() {
  const { getToken } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  // Tab controlado por la URL (?tab=comp|train) para sincronizar con el sub-menú
  // del sidebar, igual que el módulo de Ajustes.
  const tab: 'comp' | 'train' = searchParams.get('tab') === 'train' ? 'train' : 'comp';
  const setTab = (t: 'comp' | 'train') => router.replace(`/dashboard/logros?tab=${t}`, { scroll: false });
  const [role, setRole]             = useState('');
  const [myMemberId, setMyMemberId] = useState<string | null>(null);

  const [roleLoaded, setRoleLoaded] = useState(false);

  const [compOpen, setCompOpen]     = useState(false);
  const [compForm, setCompForm]     = useState(emptyComp);
  const [savingComp, setSavingComp] = useState(false);
  const [compError, setCompError]   = useState<string | null>(null);
  const [deletingComp, setDeletingComp] = useState<string | null>(null);

  const [sessionOpen, setSessionOpen]   = useState(false);
  const [sessionForm, setSessionForm]   = useState(emptySession);
  const [savingSession, setSavingSession] = useState(false);
  const [sessionError, setSessionError]   = useState<string | null>(null);
  const [deletingSession, setDeletingSession] = useState<string | null>(null);

  const { data: compData,  isLoading: loadingComps, refetch: refetchComps }  = useCompetitions();
  const { data: trainData, isLoading: loadingTrain, refetch: refetchTrain }  = useTraining();
  const { data: locsData,  isLoading: loadingLocs }                          = useLocations();

  const competitions = (compData?.competitions  ?? []) as Competition[];
  const sessions     = (trainData?.sessions     ?? []) as TrainingSession[];
  const locations    = (locsData?.locations     ?? []) as Location[];

  const loading = loadingComps || loadingTrain || loadingLocs || !roleLoaded;

  useEffect(() => {
    getToken().then(async token => {
      const meRes = await apiFetch<{ status: string; user?: { role: string } }>('/me', { token });
      const userRole = meRes.user?.role ?? '';
      setRole(userRole);
      if (userRole === 'STUDENT') {
        const memberRes = await apiFetch<{ member: { id: string } }>('/members/me', { token }).catch(() => null);
        setMyMemberId(memberRes?.member.id ?? null);
      }
      setRoleLoaded(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        body: JSON.stringify({
          ...compForm,
          place:     compForm.place     || undefined,
          latitude:  compForm.latitude  ?? undefined,
          longitude: compForm.longitude ?? undefined,
        }),
      });
      setCompOpen(false); setCompForm(emptyComp);
      await refetchComps();
    } catch (e) { setCompError(e instanceof Error ? e.message : 'Error'); }
    finally { setSavingComp(false); }
  }

  async function handleDeleteComp(id: string) {
    if (!confirm('¿Eliminar esta competencia y todos sus resultados?')) return;
    setDeletingComp(id);
    try {
      const token = await getToken();
      await apiFetch(`/competitions/${id}`, { method: 'DELETE', token });
      await refetchComps();
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
      await refetchTrain();
    } catch (e) { setSessionError(e instanceof Error ? e.message : 'Error'); }
    finally { setSavingSession(false); }
  }

  async function handleDeleteSession(id: string) {
    if (!confirm('¿Eliminar esta sesión y todos sus resultados?')) return;
    setDeletingSession(id);
    try {
      const token = await getToken();
      await apiFetch(`/training/${id}`, { method: 'DELETE', token });
      await refetchTrain();
    } finally { setDeletingSession(null); }
  }

  const totalCompResults  = visibleComps.reduce((s, c) => s + c.events.reduce((e, ev) => e + ev.results.length, 0), 0);
  const totalTrainResults = visibleSessions.reduce((s, ses) => s + ses.results.length, 0);

  return (
    <div className="min-h-full bg-background">

      {/* ── Header — separador full-width alineado con la fila del logo en el sidebar ── */}
      <div className="px-5 py-3 bg-background flex items-center lg:border-b" style={{ minHeight: 58, borderColor: 'rgba(0,0,0,0.07)' }}>
        <h1 className="text-[22px] font-semibold text-foreground" style={{ fontFamily: 'inherit', lineHeight: 1.1 }}>
          Rendimiento
        </h1>
      </div>

      <div className="px-5 pt-4 lg:pt-6">
        {/* Tabs — solo móvil; en escritorio viven en el sidebar. Van justo debajo
            del título, igual que en Finanzas. */}
        <div className="md:hidden relative flex bg-secondary rounded-2xl p-1 mb-4">
          {/* Sliding indicator */}
          <motion.div
            className="absolute top-1 bottom-1 rounded-xl bg-white shadow-sm"
            animate={{ left: tab === 'comp' ? '4px' : '50%', width: 'calc(50% - 4px)' }}
            transition={{ type: 'spring', stiffness: 500, damping: 36 }}
          />
          {(['comp', 'train'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="relative z-10 flex-1 py-2.5 rounded-xl text-[12px] font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              style={{ color: tab === t ? '#1A1028' : '#8E87A8' }}
            >
              {t === 'comp'
                ? <><Trophy className="w-3.5 h-3.5" />Competencias</>
                : <><Dumbbell className="w-3.5 h-3.5" />Entrenamientos</>
              }
            </button>
          ))}
        </div>

        {/* Encabezado de sección (escritorio) + botón — misma lógica que Ajustes:
            muestra el ícono y el título de la pestaña activa, como "Mi perfil". */}
        <div className="flex items-center mb-4">
          {/* Sección activa: ícono en cuadrito con degradado + título */}
          <div className="hidden lg:flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #4361EE 100%)' }}>
              {tab === 'comp'
                ? <Trophy className="w-3.5 h-3.5 text-white" />
                : <Dumbbell className="w-3.5 h-3.5 text-white" />}
            </div>
            <h2 className="text-[15px] font-semibold text-foreground">
              {tab === 'comp' ? 'Competencias' : 'Entrenamientos'}
            </h2>
          </div>
          {/* Botón de acción, empujado a la derecha */}
          {role !== 'STUDENT' && (
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={() => {
                if (tab === 'comp') { setCompForm(emptyComp); setCompError(null); setCompOpen(true); }
                else { setSessionForm(emptySession); setSessionError(null); setSessionOpen(true); }
              }}
              className="ml-auto flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold text-white shadow-sm shrink-0 cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #7C3AED 0%, #4361EE 100%)',
                opacity: canManage ? 1 : 0,
                pointerEvents: canManage ? 'auto' : 'none',
                transition: 'opacity 0.15s ease',
              }}
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{tab === 'comp' ? 'Competencia' : 'Entrenamiento'}</span>
            </motion.button>
          )}
        </div>

        {/* Stats strip — siempre ocupa espacio para evitar layout shift */}
        <div className="flex gap-2 mb-4 w-full" style={{ opacity: loading ? 0 : 1, transition: 'opacity 0.2s ease' }}>
          {tab === 'comp' ? (
            <>
              <StatPill value={loading ? 0 : visibleComps.length} label="Competencias" color="#4361EE" />
              <StatPill value={loading ? 0 : visibleComps.reduce((s, c) => s + c.events.length, 0)} label="Pruebas" color="#7C3AED" />
              <StatPill value={loading ? 0 : totalCompResults} label="Resultados" color="#06D6A0" />
            </>
          ) : (
            <>
              <StatPill value={loading ? 0 : visibleSessions.length} label="Sesiones" color="#06D6A0" />
              <StatPill value={loading ? 0 : totalTrainResults} label="Resultados" color="#4361EE" />
            </>
          )}
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
                <motion.div variants={listVariants} initial="hidden" animate="show" className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
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
                <motion.div variants={listVariants} initial="hidden" animate="show" className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
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
              <Label>Fecha *</Label>
              <DatePicker value={compForm.date} onChange={v => setCompForm(f => ({ ...f, date: v }))} />
            </div>
            <div className="space-y-2">
              <Label>Ubicación</Label>
              {locations.length > 0 && (
                <Select
                  value={locations.find(l => l.latitude === compForm.latitude && l.longitude === compForm.longitude && compForm.latitude !== null)?.id ?? ''}
                  onValueChange={v => {
                    if (!v) {
                      setCompForm(f => ({ ...f, place: '', latitude: null, longitude: null }));
                      return;
                    }
                    const loc = locations.find(l => l.id === v);
                    if (loc) setCompForm(f => ({
                      ...f,
                      place:     loc.name,
                      latitude:  loc.latitude  ?? null,
                      longitude: loc.longitude ?? null,
                    }));
                  }}
                >
                  <SelectTrigger>
                    <span className="text-sm">
                      {locations.find(l => l.latitude === compForm.latitude && l.longitude === compForm.longitude && compForm.latitude !== null)?.name ?? 'Seleccionar sede registrada (opcional)'}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— Ninguna / lugar externo —</SelectItem>
                    {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <LocationPicker
                value={compForm.place}
                hasCoords={!!(compForm.latitude && compForm.longitude)}
                initialLat={compForm.latitude}
                initialLng={compForm.longitude}
                onSelect={(place, lat, lng) => setCompForm(f => ({ ...f, place, latitude: lat, longitude: lng }))}
                onClear={() => setCompForm(f => ({ ...f, place: '', latitude: null, longitude: null }))}
              />
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
              <DatePicker value={sessionForm.date} onChange={v => setSessionForm(f => ({ ...f, date: v }))} />
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
  const allResults     = c.events.flatMap(e => e.results);
  const visibleResults = isStudent && myMemberId ? allResults.filter(r => r.member.id === myMemberId) : allResults;
  const resultCount    = visibleResults.length;
  const dateStr        = parseLocalDate(c.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  const podium         = visibleResults
    .filter(r => r.position && r.position <= 3)
    .sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
    .slice(0, 3);
  const hasGold = podium.some(r => r.position === 1);

  const MEDAL_STYLES: Record<number, { bg: string; ring: string; text: string; ribbon: string }> = {
    1: { bg: 'rgba(244,191,0,0.12)',   ring: '#F4BF00', text: '#A67C00', ribbon: '#F4BF00' },
    2: { bg: 'rgba(160,160,160,0.12)', ring: '#A0A0A0', text: '#606060', ribbon: '#B0B0B8' },
    3: { bg: 'rgba(212,132,90,0.12)', ring: '#D4845A', text: '#8B4513', ribbon: '#D4845A' },
  };

  return (
    <motion.div
      variants={itemVariant}
      style={{ borderRadius: 20 }}
      whileHover={{ y: -2, boxShadow: '0 10px 36px rgba(67,97,238,0.14)' }}
      transition={{ type: 'spring' as const, stiffness: 400, damping: 28 }}
      className="bg-white border border-border overflow-hidden w-full"
    >
      {/* Accent bar */}
      <div className="h-1.5 w-full" style={{ background: hasGold ? 'linear-gradient(90deg,#F4BF00 0%,#4361EE 60%,#7C3AED 100%)' : 'linear-gradient(90deg,#4361EE,#7C3AED)' }} />

      {/* Header row: icono + info + delete */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        {/* Icono */}
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg,rgba(67,97,238,0.13),rgba(124,58,237,0.13))' }}
        >
          <Trophy className="w-6 h-6" style={{ color: '#4361EE' }} />
        </div>

        {/* Info central */}
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-foreground leading-tight truncate" style={{ fontFamily: 'inherit' }}>
            {c.name.charAt(0).toUpperCase() + c.name.slice(1).toLowerCase()}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
            {c.place && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <MapPin className="w-3 h-3 shrink-0" />{toPlace(c.place)}
              </span>
            )}
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <CalendarDays className="w-3 h-3 shrink-0" />{dateStr}
            </span>
          </div>
          {/* Chips */}
          <div className="flex items-center gap-2 mt-2">
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: 'rgba(67,97,238,0.08)', color: '#4361EE' }}>
              <Target className="w-3 h-3" />{c.events.length} prueba{c.events.length !== 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: 'rgba(6,214,160,0.09)', color: '#05A07B' }}>
              <Users className="w-3 h-3" />{resultCount} resultado{resultCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Acciones: ver + eliminar */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <Link href={`/dashboard/logros/${c.id}`} className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer" style={{ background: 'rgba(67,97,238,0.08)', color: '#4361EE' }}>
            <ChevronRight className="w-4 h-4" />
          </Link>
          {canManage && (
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => onDelete(c.id)}
              disabled={deleting}
              className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
              style={{ background: 'rgba(239,71,111,0.08)', color: '#EF476F' }}
            >
              {deleting
                ? <div className="w-3.5 h-3.5 rounded-full border border-red-400 border-t-transparent animate-spin" />
                : <Trash2 className="w-3.5 h-3.5" />
              }
            </motion.button>
          )}
        </div>
      </div>

      {/* Pódio */}
      {podium.length > 0 && (
        <div className="mx-4 mb-4 rounded-2xl overflow-hidden" style={{ background: 'rgba(247,245,255,0.8)', border: '1px solid rgba(124,58,237,0.08)' }}>
          <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'rgba(124,58,237,0.08)' }}>
            <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#7C3AED' }}>Pódio</span>
            <Trophy className="w-3 h-3" style={{ color: '#7C3AED', opacity: 0.5 }} />
          </div>
          <div className="flex divide-x" style={{ '--tw-divide-opacity': 1, borderColor: 'rgba(124,58,237,0.06)' } as React.CSSProperties}>
            {podium.map(r => {
              const pos = r.position ?? 0;
              const m = MEDAL_STYLES[pos];
              if (!m) return null;
              return (
                <div key={r.id} className="flex-1 flex flex-col items-center gap-1 py-3 px-2">
                  <div className="relative">
                    <Medal className="w-9 h-9" style={{ color: m.ring }} strokeWidth={1.4} />
                    <span
                      className="absolute bottom-[6px] left-1/2 -translate-x-1/2 text-[9px] font-semibold leading-none"
                      style={{ color: m.text }}
                    >
                      {pos}
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-foreground text-center leading-tight truncate w-full">
                    {r.member.fullName.split(' ')[0]}
                  </span>
                </div>
              );
            })}
          </div>
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
      style={{ borderRadius: 20 }}
      whileHover={{ y: -2, boxShadow: '0 10px 36px rgba(6,214,160,0.13)' }}
      transition={{ type: 'spring' as const, stiffness: 400, damping: 28 }}
      className="bg-white border border-border overflow-hidden w-full"
    >
      {/* Accent bar */}
      <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg,#06D6A0,#4361EE)' }} />

      {/* Header row */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-4">
        {/* Icono */}
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg,rgba(6,214,160,0.13),rgba(67,97,238,0.10))' }}
        >
          <Dumbbell className="w-6 h-6" style={{ color: '#06D6A0' }} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-foreground leading-tight truncate" style={{ fontFamily: 'inherit' }}>{toSentenceCase(s.title)}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
            {s.location && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <MapPin className="w-3 h-3 shrink-0" />{toPlace(s.location.name)}
              </span>
            )}
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <CalendarDays className="w-3 h-3 shrink-0" />{dateStr}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: 'rgba(6,214,160,0.09)', color: '#05A07B' }}>
              <Users className="w-3 h-3" />{rc} resultado{rc !== 1 ? 's' : ''}
            </span>
            {s.notes && (
              <span className="text-[10px] text-muted-foreground truncate max-w-[130px]">{s.notes}</span>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <Link href={`/dashboard/logros/entrenamiento/${s.id}`} className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer" style={{ background: 'rgba(6,214,160,0.10)', color: '#06D6A0' }}>
            <ChevronRight className="w-4 h-4" />
          </Link>
          {canManage && (
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => onDelete(s.id)}
              disabled={deleting}
              className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
              style={{ background: 'rgba(239,71,111,0.08)', color: '#EF476F' }}
            >
              {deleting
                ? <div className="w-3.5 h-3.5 rounded-full border border-red-400 border-t-transparent animate-spin" />
                : <Trash2 className="w-3.5 h-3.5" />
              }
            </motion.button>
          )}
        </div>
      </div>
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
      <p className="text-[15px] font-semibold text-foreground mb-1">{title}</p>
      <p className="text-[12px] text-muted-foreground max-w-[240px] leading-relaxed">{desc}</p>
      {cta && onCta && (
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onCta}
          className="mt-5 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white shadow-sm cursor-pointer"
          style={{ background: color }}
        >
          {cta}
        </motion.button>
      )}
    </motion.div>
  );
}
