'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
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
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Sedes</h2>
          <p className="text-slate-500 text-sm mt-1">Gestiona los lugares de entrenamiento del club</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Nueva sede</Button>
          </DialogTrigger>
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
                <Label>Dirección</Label>
                <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Ej: Calle 10 #45-20" />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button onClick={handleSave} disabled={saving || !name.trim()} className="w-full">
                {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear sede'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-slate-500">Cargando...</p>
      ) : locations.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <MapPin className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No hay sedes registradas aún.</p>
          <Button variant="outline" className="mt-4" onClick={openNew}>Agregar primera sede</Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {locations.map(loc => (
            <div key={loc.id} className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">{loc.name}</p>
                  {loc.address && <p className="text-sm text-slate-500">{loc.address}</p>}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => openEdit(loc)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(loc.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
