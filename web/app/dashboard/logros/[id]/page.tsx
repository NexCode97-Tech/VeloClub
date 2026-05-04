'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { ChevronLeft, Plus, Trash2, Trophy, Users, MapPin, CalendarDays } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface Member { id: string; fullName: string }
interface EventResult {
  id: string; position?: number; category?: string; observations?: string;
  member: { id: string; fullName: string };
}
interface CompetitionEvent {
  id: string; name: string; results: EventResult[];
}
interface Competition {
  id: string; name: string; place?: string; date: string;
  events: CompetitionEvent[];
}

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function CompetitionDetailPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = String(params.id);

  const [competition, setCompetition] = useState<Competition | null>(null);
  const [members, setMembers]         = useState<Member[]>([]);
  const [role, setRole]               = useState('');
  const [loading, setLoading]         = useState(true);

  // Modal prueba
  const [eventOpen, setEventOpen]   = useState(false);
  const [eventName, setEventName]   = useState('');
  const [savingEvent, setSavingEvent] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);

  // Modal resultado
  const [resultOpen, setResultOpen]     = useState(false);
  const [targetEventId, setTargetEventId] = useState('');
  const [resultForm, setResultForm]     = useState({ memberId: '', position: '', category: '', observations: '' });
  const [savingResult, setSavingResult] = useState(false);
  const [resultError, setResultError]   = useState<string | null>(null);

  const [deleting, setDeleting] = useState<string | null>(null);

  async function load() {
    const token = await getToken();
    const [compRes, membersRes, meRes] = await Promise.all([
      apiFetch<{ competition: Competition }>(`/competitions/${id}`, { token }),
      apiFetch<{ members: Member[] }>('/members', { token }),
      apiFetch<{ status: string; user?: { role: string } }>('/me', { token }),
    ]);
    setCompetition(compRes.competition);
    setMembers(membersRes.members);
    setRole(meRes.user?.role ?? '');
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function handleAddEvent() {
    if (!eventName.trim()) return;
    setSavingEvent(true); setEventError(null);
    try {
      const token = await getToken();
      await apiFetch(`/competitions/${id}/events`, {
        method: 'POST', token,
        body: JSON.stringify({ name: eventName }),
      });
      setEventOpen(false);
      setEventName('');
      await load();
    } catch (e) {
      setEventError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSavingEvent(false);
    }
  }

  async function handleDeleteEvent(eventId: string) {
    if (!confirm('¿Eliminar esta prueba y todos sus resultados?')) return;
    setDeleting(eventId);
    try {
      const token = await getToken();
      await apiFetch(`/competitions/${id}/events/${eventId}`, { method: 'DELETE', token });
      await load();
    } finally {
      setDeleting(null);
    }
  }

  function openAddResult(eventId: string) {
    setTargetEventId(eventId);
    setResultForm({ memberId: '', position: '', category: '', observations: '' });
    setResultError(null);
    setResultOpen(true);
  }

  async function handleAddResult() {
    if (!resultForm.memberId) return;
    setSavingResult(true); setResultError(null);
    try {
      const token = await getToken();
      await apiFetch(`/competitions/${id}/events/${targetEventId}/results`, {
        method: 'POST', token,
        body: JSON.stringify({
          memberId:     resultForm.memberId,
          position:     resultForm.position ? parseInt(resultForm.position) : undefined,
          category:     resultForm.category   || undefined,
          observations: resultForm.observations || undefined,
        }),
      });
      setResultOpen(false);
      await load();
    } catch (e) {
      setResultError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSavingResult(false);
    }
  }

  async function handleDeleteResult(eventId: string, resultId: string) {
    if (!confirm('¿Eliminar este resultado?')) return;
    setDeleting(resultId);
    try {
      const token = await getToken();
      await apiFetch(`/competitions/${id}/events/${eventId}/results/${resultId}`, { method: 'DELETE', token });
      await load();
    } finally {
      setDeleting(null);
    }
  }

  const canManage = role === 'ADMIN' || role === 'COACH';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!competition) {
    return (
      <div className="px-5 py-10 text-center text-muted-foreground">Competencia no encontrada</div>
    );
  }

  const dateStr = new Date(competition.date).toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="min-h-full bg-background">
      {/* Encabezado */}
      <div className="px-4 py-3 bg-background border-b border-border">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-[12px] text-muted-foreground mb-2 hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Resultados
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[17px] font-bold text-foreground leading-tight" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
              {competition.name}
            </h1>
            <div className="flex flex-wrap gap-3 mt-1">
              {competition.place && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <MapPin className="w-3 h-3" />{competition.place}
                </span>
              )}
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <CalendarDays className="w-3 h-3" />{dateStr}
              </span>
            </div>
          </div>
          {canManage && (
            <button
              onClick={() => { setEventName(''); setEventError(null); setEventOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white shrink-0"
              style={{ background: '#4361EE' }}
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Prueba</span>
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pt-4 flex flex-col gap-4 pb-6">
        {competition.events.length === 0 ? (
          <div className="bg-white border border-border rounded-xl px-4 py-12 text-center">
            <Trophy className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-[13px] font-semibold text-muted-foreground">Sin pruebas registradas</p>
            {canManage && (
              <button
                onClick={() => { setEventName(''); setEventError(null); setEventOpen(true); }}
                className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold border border-border text-muted-foreground hover:bg-secondary transition-colors"
              >
                Agregar primera prueba
              </button>
            )}
          </div>
        ) : (
          competition.events.map(ev => (
            <div key={ev.id} className="bg-white border border-border rounded-xl overflow-hidden">
              {/* Cabecera prueba */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                <div>
                  <p className="text-[13px] font-bold text-foreground">{ev.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {ev.results.length} resultado{ev.results.length !== 1 ? 's' : ''}
                  </p>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openAddResult(ev.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold"
                      style={{ background: 'rgba(67,97,238,0.10)', color: '#4361EE' }}
                    >
                      <Plus className="w-3 h-3" />
                      Resultado
                    </button>
                    <button
                      onClick={() => handleDeleteEvent(ev.id)}
                      disabled={deleting === ev.id}
                      className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Resultados */}
              {ev.results.length === 0 ? (
                <div className="px-4 py-5 text-center">
                  <Users className="w-6 h-6 mx-auto mb-1.5 text-muted-foreground/30" />
                  <p className="text-[11px] text-muted-foreground">Sin resultados aún</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {ev.results.map(r => (
                    <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="w-8 text-center text-[15px]">
                        {r.position && r.position <= 3
                          ? MEDALS[r.position]
                          : r.position
                            ? <span className="text-[12px] font-bold text-muted-foreground">{r.position}°</span>
                            : <span className="text-[12px] text-muted-foreground">—</span>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-foreground truncate">{r.member.fullName}</p>
                        <div className="flex gap-2 mt-0.5">
                          {r.category && <p className="text-[10px] font-semibold" style={{ color: '#4361EE' }}>{r.category}</p>}
                          {r.observations && <p className="text-[10px] text-muted-foreground truncate">{r.observations}</p>}
                        </div>
                      </div>
                      {canManage && (
                        <button
                          onClick={() => handleDeleteResult(ev.id, r.id)}
                          disabled={deleting === r.id}
                          className="w-6 h-6 rounded-lg bg-red-50 flex items-center justify-center text-red-400 hover:text-red-600 shrink-0"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal nueva prueba */}
      <Dialog open={eventOpen} onOpenChange={setEventOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nueva prueba</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Nombre de la prueba *</Label>
              <Input
                value={eventName}
                onChange={e => setEventName(e.target.value)}
                placeholder="ej. Esprint Masculino Sub-12"
              />
            </div>
            {eventError && <p className="text-sm text-red-600">{eventError}</p>}
            <Button onClick={handleAddEvent} disabled={savingEvent || !eventName.trim()} className="w-full">
              {savingEvent ? 'Guardando...' : 'Agregar prueba'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal nuevo resultado */}
      <Dialog open={resultOpen} onOpenChange={setResultOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Agregar resultado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Deportista *</Label>
              <Select value={resultForm.memberId} onValueChange={v => setResultForm(f => ({ ...f, memberId: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar deportista" /></SelectTrigger>
                <SelectContent>
                  {members.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Posición</Label>
                <Input
                  type="number"
                  value={resultForm.position}
                  onChange={e => setResultForm(f => ({ ...f, position: e.target.value }))}
                  placeholder="ej. 1"
                  min={1}
                />
              </div>
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Input
                  value={resultForm.category}
                  onChange={e => setResultForm(f => ({ ...f, category: e.target.value }))}
                  placeholder="ej. Sub-12"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observaciones</Label>
              <Input
                value={resultForm.observations}
                onChange={e => setResultForm(f => ({ ...f, observations: e.target.value }))}
                placeholder="Opcional"
              />
            </div>

            {resultError && <p className="text-sm text-red-600">{resultError}</p>}
            <Button onClick={handleAddResult} disabled={savingResult || !resultForm.memberId} className="w-full">
              {savingResult ? 'Guardando...' : 'Agregar resultado'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
