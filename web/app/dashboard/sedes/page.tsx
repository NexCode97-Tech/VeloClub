'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, MapPin } from 'lucide-react';

interface Location { id: string; name: string; address?: string }

export default function SedesPage() {
  const { getToken } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const token = await getToken();
    const res = await apiFetch<{ locations: Location[] }>('/locations', { token });
    setLocations(res.locations);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null); setName(''); setAddress(''); setError(null); setOpen(true);
  }

  function openEdit(loc: Location) {
    setEditing(loc); setName(loc.name); setAddress(loc.address ?? ''); setError(null); setOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true); setError(null);
    try {
      const token = await getToken();
      if (editing) {
        await apiFetch(`/locations/${editing.id}`, { method: 'PUT', token, body: JSON.stringify({ name, address }) });
      } else {
        await apiFetch('/locations', { method: 'POST', token, body: JSON.stringify({ name, address }) });
      }
      setOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta sede?')) return;
    const token = await getToken();
    await apiFetch(`/locations/${id}`, { method: 'DELETE', token });
    await load();
  }

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 bg-card border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-bold text-foreground" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            Sedes
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Lugares de entrenamiento del club</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: '#4361EE' }}
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nueva sede</span>
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar sede' : 'Nueva sede'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Sede Norte" />
            </div>
            <div className="space-y-2">
              <Label>Direccion</Label>
              <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Ej: Calle 10 #45-20" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={handleSave} disabled={saving || !name.trim()} className="w-full">
              {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear sede'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="px-4 pt-4 pb-4">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : locations.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-10 text-center">
            <MapPin className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No hay sedes registradas aun.</p>
            <button onClick={openNew} className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold border border-border text-muted-foreground hover:bg-secondary transition-colors">
              Agregar primera sede
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {locations.map(loc => (
              <div key={loc.id} className="bg-card border border-border rounded-xl px-4 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(6,214,160,0.12)' }}>
                    <MapPin className="w-5 h-5" style={{ color: '#06D6A0' }} />
                  </div>
                  <div>
                    <p className="font-bold text-foreground" style={{ fontFamily: 'var(--font-space-grotesk)' }}>{loc.name}</p>
                    {loc.address && <p className="text-xs text-muted-foreground mt-0.5">{loc.address}</p>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(loc)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(loc.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
