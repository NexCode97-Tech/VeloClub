'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { ArrowLeft, Plus, Trash2, Dumbbell, Clock, Ruler, Hash } from 'lucide-react';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select';

interface Member { id: string; fullName: string }
interface TrainingResult {
  id: string; time?: string; distance?: string; laps?: number;
  observations?: string; member: { id: string; fullName: string };
}
interface TrainingSession {
  id: string; title: string; date: string; notes?: string;
  location?: { id: string; name: string } | null;
  results: TrainingResult[];
}

const emptyForm = { memberId: '', time: '', distance: '', laps: '', observations: '' };

export default function TrainingDetailPage() {
  const { getToken } = useAuth();
  const params = useParams();
  const id = String(params.id);

  const [session, setSession]   = useState<TrainingSession | null>(null);
  const [members, setMembers]   = useState<Member[]>([]);
  const [role, setRole]         = useState('');
  const [loading, setLoading]   = useState(true);
  const [open, setOpen]         = useState(false);
  const [form, setForm]         = useState(emptyForm);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function load() {
    const token = await getToken();
    const [meRes, sessionRes, membersRes] = await Promise.all([
      apiFetch<{ status: string; user?: { role: string } }>('/me', { token }),
      apiFetch<{ session: TrainingSession }>(`/training/${id}`, { token }),
      apiFetch<{ members: Member[] }>('/members', { token }),
    ]);
    setRole(meRes.user?.role ?? '');
    setSession(sessionRes.session);
    setMembers(membersRes.members);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const canManage = role === 'ADMIN' || role === 'COACH';
  const usedMemberIds = new Set(session?.results.map(r => r.member.id) ?? []);
  const availableMembers = members.filter(m => !usedMemberIds.has(m.id));

  async function handleSave() {
    if (!form.memberId) return;
    setSaving(true); setError(null);
    try {
      const token = await getToken();
      await apiFetch(`/training/${id}/results`, {
        method: 'POST', token,
        body: JSON.stringify({
          memberId:     form.memberId,
          time:         form.time         || undefined,
          distance:     form.distance     || undefined,
          laps:         form.laps ? parseInt(form.laps) : undefined,
          observations: form.observations || undefined,
        }),
      });
      setOpen(false); setForm(emptyForm);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setSaving(false); }
  }

  async function handleDelete(resultId: string) {
    if (!confirm('¿Eliminar este resultado?')) return;
    setDeleting(resultId);
    try {
      const token = await getToken();
      await apiFetch(`/training/${id}/results/${resultId}`, { method: 'DELETE', token });
      await load();
    } finally { setDeleting(null); }
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
  if (!session) return null;

  const dateStr = new Date(session.date).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div className="px-4 py-3 bg-background border-b border-border flex items-center gap-3">
        <Link href="/dashboard/logros" className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors">
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-[15px] font-bold text-foreground truncate" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            {session.title}
          </h1>
          <p className="text-[11px] text-muted-foreground capitalize">{dateStr}</p>
        </div>
        {canManage && availableMembers.length > 0 && (
          <button
            onClick={() => { setForm(emptyForm); setError(null); setOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white shrink-0"
            style={{ background: '#4361EE' }}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Resultado</span>
          </button>
        )}
      </div>

      <div className="px-4 pt-4 space-y-3 pb-4">
        {/* Info sesión */}
        <div className="bg-white border border-border rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(6,214,160,0.10)' }}>
            <Dumbbell className="w-5 h-5" style={{ color: '#06D6A0' }} />
          </div>
          <div>
            {session.location && <p className="text-[11px] text-muted-foreground">{session.location.name}</p>}
            {session.notes    && <p className="text-[11px] text-muted-foreground">{session.notes}</p>}
            <p className="text-[11px] text-muted-foreground">{session.results.length} resultado{session.results.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Resultados */}
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">
          Resultados por deportista
        </p>

        {session.results.length === 0 ? (
          <div className="bg-white border border-border rounded-xl px-4 py-10 text-center">
            <Dumbbell className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-[12px] text-muted-foreground">Sin resultados registrados</p>
            {canManage && <p className="text-[11px] text-muted-foreground mt-1">Agrega el primer resultado con el botón +</p>}
          </div>
        ) : (
          <div className="space-y-2">
            {session.results.map((r, idx) => (
              <div key={r.id} className="bg-white border border-border rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                  style={{ background: 'linear-gradient(135deg,#4361EE,#7209B7)' }}>
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-foreground">{r.member.fullName}</p>
                  <div className="flex flex-wrap gap-3 mt-0.5">
                    {r.time && (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="w-3 h-3" style={{ color: '#4361EE' }} />{r.time}
                      </span>
                    )}
                    {r.distance && (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Ruler className="w-3 h-3" style={{ color: '#06D6A0' }} />{r.distance}
                      </span>
                    )}
                    {r.laps && (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Hash className="w-3 h-3" style={{ color: '#FFB703' }} />{r.laps} vuelta{r.laps !== 1 ? 's' : ''}
                      </span>
                    )}
                    {r.observations && (
                      <span className="text-[11px] text-muted-foreground truncate max-w-[140px]">{r.observations}</span>
                    )}
                  </div>
                </div>
                {canManage && (
                  <button onClick={() => handleDelete(r.id)} disabled={deleting === r.id}
                    className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-red-400 hover:text-red-600 shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal agregar resultado */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Agregar resultado</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Deportista *</Label>
              <Select value={form.memberId} onValueChange={v => setForm(f => ({ ...f, memberId: v ?? '' }))}>
                <SelectTrigger>
                  <span className="text-sm">{members.find(m => m.id === form.memberId)?.fullName ?? 'Seleccionar deportista'}</span>
                </SelectTrigger>
                <SelectContent>
                  {availableMembers.map(m => <SelectItem key={m.id} value={m.id}>{m.fullName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tiempo</Label>
                <Input value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} placeholder="ej. 2:30.5" />
              </div>
              <div className="space-y-2">
                <Label>Distancia</Label>
                <Input value={form.distance} onChange={e => setForm(f => ({ ...f, distance: e.target.value }))} placeholder="ej. 500m" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Vueltas</Label>
              <Input type="number" value={form.laps} onChange={e => setForm(f => ({ ...f, laps: e.target.value }))} placeholder="ej. 3" />
            </div>
            <div className="space-y-2">
              <Label>Observaciones</Label>
              <Input value={form.observations} onChange={e => setForm(f => ({ ...f, observations: e.target.value }))} placeholder="Opcional" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button onClick={handleSave} disabled={saving || !form.memberId} className="w-full">
              {saving ? 'Guardando...' : 'Guardar resultado'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
