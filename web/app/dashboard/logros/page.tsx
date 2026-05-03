'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import Link from 'next/link';
import {
  Trophy, Plus, Trash2, MapPin, CalendarDays, ChevronRight,
  Dumbbell, Clock, Ruler, RefreshCw,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select';

// ── Types ──────────────────────────────────────────────────────────────────────
interface EventResult  { id: string; position?: number; member: { id: string; fullName: string } }
interface CompEvent    { id: string; name: string; results: EventResult[] }
interface Competition  { id: string; name: string; place?: string; date: string; events: CompEvent[] }

interface TrainingResult { id: string; time?: string; distance?: string; laps?: number; observations?: string; member: { id: string; fullName: string } }
interface TrainingSession { id: string; title: string; date: string; notes?: string; location?: { id: string; name: string } | null; results: TrainingResult[] }

interface Location { id: string; name: string }

// ── Helpers ────────────────────────────────────────────────────────────────────
const emptyComp     = { name: '', place: '', date: '' };
const emptySession  = { title: '', date: '', locationId: '', notes: '' };

export default function LogrosPage() {
  const { getToken } = useAuth();
  const [tab, setTab]                 = useState<'comp' | 'train'>('comp');
  const [role, setRole]               = useState('');
  const [locations, setLocations]     = useState<Location[]>([]);
  const [loading, setLoading]         = useState(true);

  // Competencias state
  const [competitions, setComps]      = useState<Competition[]>([]);
  const [compOpen, setCompOpen]       = useState(false);
  const [compForm, setCompForm]       = useState(emptyComp);
  const [savingComp, setSavingComp]   = useState(false);
  const [compError, setCompError]     = useState<string | null>(null);
  const [deletingComp, setDeletingComp] = useState<string | null>(null);

  // Entrenamientos state
  const [sessions, setSessions]             = useState<TrainingSession[]>([]);
  const [sessionOpen, setSessionOpen]       = useState(false);
  const [sessionForm, setSessionForm]       = useState(emptySession);
  const [savingSession, setSavingSession]   = useState(false);
  const [sessionError, setSessionError]     = useState<string | null>(null);
  const [deletingSession, setDeletingSession] = useState<string | null>(null);

  async function loadAll() {
    const token = await getToken();
    const [meRes, compRes, trainRes, locsRes] = await Promise.all([
      apiFetch<{ status: string; user?: { role: string } }>('/me', { token }),
      apiFetch<{ competitions: Competition[] }>('/competitions', { token }),
      apiFetch<{ sessions: TrainingSession[] }>('/training', { token }),
      apiFetch<{ locations: Location[] }>('/locations', { token }),
    ]);
    setRole(meRes.user?.role ?? '');
    setComps(compRes.competitions);
    setSessions(trainRes.sessions);
    setLocations(locsRes.locations);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  const canManage = role === 'ADMIN' || role === 'COACH';

  // ── Competencias handlers ───────────────────────────────────────────────────
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

  // ── Entrenamientos handlers ─────────────────────────────────────────────────
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

  // ── Render ──────────────────────────────────────────────────────────────────
  const totalCompResults = competitions.reduce((s, c) => s + c.events.reduce((e, ev) => e + ev.results.length, 0), 0);
  const totalTrainResults = sessions.reduce((s, ses) => s + ses.results.length, 0);

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div className="px-5 py-3 bg-background border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-[17px] font-bold text-foreground" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            Resultados
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {tab === 'comp'
              ? `${competitions.length} competencia${competitions.length !== 1 ? 's' : ''} · ${totalCompResults} resultado${totalCompResults !== 1 ? 's' : ''}`
              : `${sessions.length} entrenamiento${sessions.length !== 1 ? 's' : ''} · ${totalTrainResults} resultado${totalTrainResults !== 1 ? 's' : ''}`
            }
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => {
              if (tab === 'comp') { setCompForm(emptyComp); setCompError(null); setCompOpen(true); }
              else { setSessionForm(emptySession); setSessionError(null); setSessionOpen(true); }
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: '#4361EE' }}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{tab === 'comp' ? 'Competencia' : 'Entrenamiento'}</span>
          </button>
        )}
      </div>

      <div className="px-4 pt-4 flex flex-col gap-3 pb-4">
        {/* Tabs */}
        <div className="flex gap-1 bg-secondary rounded-xl p-1">
          {(['comp', 'train'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-2 rounded-lg text-[12px] font-semibold transition-all flex items-center justify-center gap-1.5"
              style={tab === t
                ? { background: '#fff', color: '#1A1028', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }
                : { color: '#8E87A8' }
              }
            >
              {t === 'comp' ? <><Trophy className="w-3.5 h-3.5" />Competencias</> : <><Dumbbell className="w-3.5 h-3.5" />Entrenamientos</>}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : tab === 'comp' ? (
          /* ── Competencias ── */
          competitions.length === 0 ? (
            <div className="bg-white border border-border rounded-xl px-4 py-12 text-center">
              <Trophy className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-[13px] font-semibold text-muted-foreground">Sin competencias registradas</p>
              {canManage && (
                <button onClick={() => { setCompForm(emptyComp); setCompError(null); setCompOpen(true); }}
                  className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold border border-border text-muted-foreground hover:bg-secondary transition-colors">
                  Agregar primera competencia
                </button>
              )}
            </div>
          ) : (
            competitions.map(c => {
              const resultCount = c.events.reduce((s, e) => s + e.results.length, 0);
              const dateStr = new Date(c.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
              const podium = c.events.flatMap(e => e.results).filter(r => r.position && r.position <= 3).sort((a, b) => (a.position ?? 99) - (b.position ?? 99)).slice(0, 3);
              return (
                <div key={c.id} className="bg-white border border-border rounded-xl overflow-hidden">
                  <Link href={`/dashboard/logros/${c.id}`} className="block px-4 py-3 hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(67,97,238,0.10)' }}>
                        <Trophy className="w-5 h-5" style={{ color: '#4361EE' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-foreground truncate">{c.name}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          {c.place && <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><MapPin className="w-3 h-3" />{c.place}</span>}
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><CalendarDays className="w-3 h-3" />{dateStr}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] text-muted-foreground">{c.events.length} prueba{c.events.length !== 1 ? 's' : ''}</span>
                          <span className="text-[10px] text-muted-foreground">{resultCount} resultado{resultCount !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </div>
                    {podium.length > 0 && (
                      <div className="flex gap-2 mt-2 pt-2 border-t border-border/50">
                        {podium.map(r => {
                          const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
                          return <span key={r.id} className="text-[11px] text-muted-foreground">{medals[r.position ?? 0]} {r.member.fullName.split(' ')[0]}</span>;
                        })}
                      </div>
                    )}
                  </Link>
                  {canManage && (
                    <div className="px-4 pb-3 flex justify-end">
                      <button onClick={() => handleDeleteComp(c.id)} disabled={deletingComp === c.id}
                        className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-red-400 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )
        ) : (
          /* ── Entrenamientos ── */
          sessions.length === 0 ? (
            <div className="bg-white border border-border rounded-xl px-4 py-12 text-center">
              <Dumbbell className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-[13px] font-semibold text-muted-foreground">Sin entrenamientos registrados</p>
              {canManage && (
                <button onClick={() => { setSessionForm(emptySession); setSessionError(null); setSessionOpen(true); }}
                  className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold border border-border text-muted-foreground hover:bg-secondary transition-colors">
                  Registrar primer entrenamiento
                </button>
              )}
            </div>
          ) : (
            sessions.map(s => {
              const dateStr = new Date(s.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
              return (
                <div key={s.id} className="bg-white border border-border rounded-xl overflow-hidden">
                  <Link href={`/dashboard/logros/entrenamiento/${s.id}`} className="block px-4 py-3 hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(6,214,160,0.10)' }}>
                        <Dumbbell className="w-5 h-5" style={{ color: '#06D6A0' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-foreground truncate">{s.title}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          {s.location && <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><MapPin className="w-3 h-3" />{s.location.name}</span>}
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><CalendarDays className="w-3 h-3" />{dateStr}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] text-muted-foreground">{s.results.length} resultado{s.results.length !== 1 ? 's' : ''}</span>
                          {s.notes && <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{s.notes}</span>}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </div>
                    {s.results.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-border/50">
                        {s.results.slice(0, 3).map(r => (
                          <span key={r.id} className="text-[11px] text-muted-foreground flex items-center gap-1">
                            {r.time && <><Clock className="w-2.5 h-2.5" />{r.time}</>}
                            {r.distance && <><Ruler className="w-2.5 h-2.5" />{r.distance}</>}
                            {!r.time && !r.distance && r.member.fullName.split(' ')[0]}
                          </span>
                        ))}
                        {s.results.length > 3 && <span className="text-[11px] text-muted-foreground">+{s.results.length - 3} más</span>}
                      </div>
                    )}
                  </Link>
                  {canManage && (
                    <div className="px-4 pb-3 flex justify-end">
                      <button onClick={() => handleDeleteSession(s.id)} disabled={deletingSession === s.id}
                        className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-red-400 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )
        )}
      </div>

      {/* Modal nueva competencia */}
      <Dialog open={compOpen} onOpenChange={setCompOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nueva competencia</DialogTitle></DialogHeader>
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

      {/* Modal nuevo entrenamiento */}
      <Dialog open={sessionOpen} onOpenChange={setSessionOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nuevo entrenamiento</DialogTitle></DialogHeader>
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
