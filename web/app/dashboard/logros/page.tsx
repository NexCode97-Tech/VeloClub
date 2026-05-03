'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import Link from 'next/link';
import { Trophy, Plus, Trash2, MapPin, CalendarDays, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface EventResult {
  id: string;
  position?: number;
  member: { id: string; fullName: string };
}
interface CompetitionEvent {
  id: string;
  name: string;
  results: EventResult[];
}
interface Competition {
  id: string;
  name: string;
  place?: string;
  date: string;
  events: CompetitionEvent[];
}

const emptyForm = { name: '', place: '', date: '' };

export default function LogrosPage() {
  const { getToken } = useAuth();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [role, setRole]                 = useState('');
  const [loading, setLoading]           = useState(true);
  const [open, setOpen]                 = useState(false);
  const [form, setForm]                 = useState(emptyForm);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [deleting, setDeleting]         = useState<string | null>(null);

  async function load() {
    const token = await getToken();
    const [compRes, meRes] = await Promise.all([
      apiFetch<{ competitions: Competition[] }>('/competitions', { token }),
      apiFetch<{ status: string; user?: { role: string } }>('/me', { token }),
    ]);
    setCompetitions(compRes.competitions);
    setRole(meRes.user?.role ?? '');
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSave() {
    if (!form.name.trim() || !form.date) return;
    setSaving(true); setError(null);
    try {
      const token = await getToken();
      await apiFetch('/competitions', {
        method: 'POST', token,
        body: JSON.stringify({ ...form, place: form.place || undefined }),
      });
      setOpen(false);
      setForm(emptyForm);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta competencia y todos sus resultados?')) return;
    setDeleting(id);
    try {
      const token = await getToken();
      await apiFetch(`/competitions/${id}`, { method: 'DELETE', token });
      await load();
    } finally {
      setDeleting(null);
    }
  }

  const canManage = role === 'ADMIN' || role === 'COACH';

  const totalResults = competitions.reduce(
    (sum, c) => sum + c.events.reduce((s, e) => s + e.results.length, 0), 0
  );

  return (
    <div className="min-h-full bg-background">
      {/* Encabezado */}
      <div className="px-5 py-3 bg-background border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-[17px] font-bold text-foreground" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            Logros
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {competitions.length} competencia{competitions.length !== 1 ? 's' : ''} · {totalResults} resultado{totalResults !== 1 ? 's' : ''}
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => { setForm(emptyForm); setError(null); setOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: '#4361EE' }}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Competencia</span>
          </button>
        )}
      </div>

      <div className="px-4 pt-4 flex flex-col gap-3 pb-4">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : competitions.length === 0 ? (
          <div className="bg-white border border-border rounded-xl px-4 py-12 text-center">
            <Trophy className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-[13px] font-semibold text-muted-foreground">Sin competencias registradas</p>
            {canManage && (
              <button
                onClick={() => { setForm(emptyForm); setError(null); setOpen(true); }}
                className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold border border-border text-muted-foreground hover:bg-secondary transition-colors"
              >
                Agregar primera competencia
              </button>
            )}
          </div>
        ) : (
          competitions.map(c => {
            const resultCount = c.events.reduce((s, e) => s + e.results.length, 0);
            const dateStr = new Date(c.date).toLocaleDateString('es-CO', {
              day: 'numeric', month: 'short', year: 'numeric',
            });
            const podium = c.events
              .flatMap(e => e.results)
              .filter(r => r.position && r.position <= 3)
              .sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
              .slice(0, 3);

            return (
              <div key={c.id} className="bg-white border border-border rounded-xl overflow-hidden">
                <Link href={`/dashboard/logros/${c.id}`} className="block px-4 py-3 hover:bg-secondary/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(67,97,238,0.10)' }}
                    >
                      <Trophy className="w-5 h-5" style={{ color: '#4361EE' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-foreground truncate">{c.name}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        {c.place && (
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <MapPin className="w-3 h-3" />{c.place}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <CalendarDays className="w-3 h-3" />{dateStr}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-muted-foreground">{c.events.length} prueba{c.events.length !== 1 ? 's' : ''}</span>
                        <span className="text-[10px] text-muted-foreground">{resultCount} resultado{resultCount !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </div>

                  {/* Mini podio */}
                  {podium.length > 0 && (
                    <div className="flex gap-2 mt-2 pt-2 border-t border-border/50">
                      {podium.map(r => {
                        const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
                        return (
                          <span key={r.id} className="text-[11px] text-muted-foreground">
                            {medals[r.position ?? 0]} {r.member.fullName.split(' ')[0]}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </Link>

                {canManage && (
                  <div className="px-4 pb-3 flex justify-end">
                    <button
                      onClick={() => handleDelete(c.id)}
                      disabled={deleting === c.id}
                      className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal nueva competencia */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nueva competencia</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ej. Copa Ciclismo Antioquia 2025" />
            </div>
            <div className="space-y-2">
              <Label>Lugar</Label>
              <Input value={form.place} onChange={e => setForm(f => ({ ...f, place: e.target.value }))} placeholder="Ciudad o municipio" />
            </div>
            <div className="space-y-2">
              <Label>Fecha *</Label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button onClick={handleSave} disabled={saving || !form.name.trim() || !form.date} className="w-full">
              {saving ? 'Guardando...' : 'Crear competencia'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
