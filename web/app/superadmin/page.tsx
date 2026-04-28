'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Power, Trash2, Users } from 'lucide-react';

interface Club {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  _count: { members: number };
  users: { email: string; name: string }[];
}

export default function SuperadminPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ clubName: '', adminEmail: '', adminName: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const token = await getToken();
      const res = await apiFetch<{ clubs: Club[] }>('/superadmin/clubs', { token });
      setClubs(res.clubs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar clubs');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { router.push('/sign-in'); return; }
    load();
  }, [isLoaded, isSignedIn]);

  async function handleCreate() {
    if (!form.clubName || !form.adminEmail || !form.adminName) return;
    setSaving(true); setError(null);
    try {
      const token = await getToken();
      await apiFetch('/superadmin/clubs', { method: 'POST', token, body: JSON.stringify(form) });
      setOpen(false);
      setForm({ clubName: '', adminEmail: '', adminName: '' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(id: string) {
    const token = await getToken();
    await apiFetch(`/superadmin/clubs/${id}/toggle`, { method: 'PATCH', token });
    await load();
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este club? Esta acción no se puede deshacer.')) return;
    const token = await getToken();
    await apiFetch(`/superadmin/clubs/${id}`, { method: 'DELETE', token });
    await load();
  }

  if (loading) return <div className="p-8 text-slate-500">Cargando...</div>;
  if (error && clubs.length === 0) return (
    <div className="p-8">
      <p className="text-red-600 font-semibold mb-2">Error al acceder al panel superadmin:</p>
      <p className="text-slate-700 bg-red-50 rounded p-3 font-mono text-sm">{error}</p>
      <p className="text-slate-500 text-sm mt-4">Asegúrate de que Render haya terminado de redesplegar y recarga la página.</p>
      <button onClick={() => { setLoading(true); setError(null); load(); }} className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm">Reintentar</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Panel Superadmin</h1>
            <p className="text-slate-500 text-sm mt-1">{clubs.length} club{clubs.length !== 1 ? 's' : ''} registrado{clubs.length !== 1 ? 's' : ''}</p>
          </div>
          <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" />Nuevo club</Button>
        </div>

        <div className="space-y-3">
          {clubs.map(club => (
            <div key={club.id} className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <p className="font-semibold text-slate-900">{club.name}</p>
                  <Badge variant={club.active ? 'default' : 'secondary'}>
                    {club.active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-500">
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{club._count.members} miembros</span>
                  {club.users[0] && <span>Admin: {club.users[0].name} ({club.users[0].email})</span>}
                  <span>Creado: {new Date(club.createdAt).toLocaleDateString('es')}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleToggle(club.id)}
                  className={club.active ? 'text-orange-600 border-orange-300' : 'text-green-600 border-green-300'}
                >
                  <Power className="w-4 h-4 mr-1" />
                  {club.active ? 'Desactivar' : 'Activar'}
                </Button>
                <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(club.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}

          {clubs.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <p className="text-slate-400">No hay clubs registrados aún.</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo club</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Nombre del club *</Label>
              <Input value={form.clubName} onChange={e => setForm(f => ({ ...f, clubName: e.target.value }))} placeholder="Ej: Club Patines Norte" />
            </div>
            <div className="space-y-2">
              <Label>Nombre del admin *</Label>
              <Input value={form.adminName} onChange={e => setForm(f => ({ ...f, adminName: e.target.value }))} placeholder="Nombre completo" />
            </div>
            <div className="space-y-2">
              <Label>Email del admin *</Label>
              <Input type="email" value={form.adminEmail} onChange={e => setForm(f => ({ ...f, adminEmail: e.target.value }))} placeholder="admin@ejemplo.com" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button onClick={handleCreate} disabled={saving || !form.clubName || !form.adminEmail || !form.adminName} className="w-full">
              {saving ? 'Creando...' : 'Crear club'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
