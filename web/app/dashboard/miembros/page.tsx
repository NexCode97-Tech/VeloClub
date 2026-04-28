'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, Users, Search } from 'lucide-react';

interface Location { id: string; name: string }
interface Member {
  id: string; fullName: string; email?: string; phone?: string;
  birthDate?: string; category?: string; role: string;
  locations: { location: Location }[];
}

const ROLES: Record<string, string> = { ADMIN: 'Admin', COACH: 'Entrenador', STUDENT: 'Alumno' };
const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-700', COACH: 'bg-blue-100 text-blue-700', STUDENT: 'bg-green-100 text-green-700',
};

const emptyForm = { fullName: '', email: '', phone: '', birthDate: '', category: '', role: 'STUDENT', locationIds: [] as string[] };

export default function MiembrosPage() {
  const { getToken } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const token = await getToken();
    const [membersRes, locsRes] = await Promise.all([
      apiFetch<{ members: Member[] }>('/members', { token }),
      apiFetch<{ locations: Location[] }>('/locations', { token }),
    ]);
    setMembers(membersRes.members);
    setLocations(locsRes.locations);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null); setForm(emptyForm); setError(null); setOpen(true);
  }

  function openEdit(m: Member) {
    setEditing(m);
    setForm({
      fullName: m.fullName, email: m.email ?? '', phone: m.phone ?? '',
      birthDate: m.birthDate ? m.birthDate.split('T')[0] : '',
      category: m.category ?? '', role: m.role,
      locationIds: m.locations.map(l => l.location.id),
    });
    setError(null); setOpen(true);
  }

  async function handleSave() {
    if (!form.fullName.trim()) return;
    setSaving(true); setError(null);
    try {
      const token = await getToken();
      const body = JSON.stringify(form);
      if (editing) {
        await apiFetch(`/members/${editing.id}`, { method: 'PUT', token, body });
      } else {
        await apiFetch('/members', { method: 'POST', token, body });
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

  const filtered = members.filter(m =>
    m.fullName.toLowerCase().includes(search.toLowerCase()) ||
    m.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Miembros</h2>
          <p className="text-slate-500 text-sm mt-1">{members.length} miembro{members.length !== 1 ? 's' : ''} registrado{members.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Nuevo miembro</Button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input className="pl-9" placeholder="Buscar por nombre o email..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <p className="text-slate-500">Cargando...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">{search ? 'Sin resultados.' : 'No hay miembros registrados aún.'}</p>
          {!search && <Button variant="outline" className="mt-4" onClick={openNew}>Agregar primer miembro</Button>}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Nombre</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Email</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Rol</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Sedes</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Categoría</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(m => (
                <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{m.fullName}</td>
                  <td className="px-4 py-3 text-slate-500">{m.email ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${ROLE_COLORS[m.role]}`}>
                      {ROLES[m.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {m.locations.length === 0
                        ? <span className="text-slate-400">—</span>
                        : m.locations.map(l => (
                          <Badge key={l.location.id} variant="secondary" className="text-xs">{l.location.name}</Badge>
                        ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{m.category ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(m)}><Pencil className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(m.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar miembro' : 'Nuevo miembro'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Nombre completo *</Label>
              <Input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Fecha de nacimiento</Label>
                <Input type="date" value={form.birthDate} onChange={e => setForm(f => ({ ...f, birthDate: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Input value={form.category} placeholder="Ej: Juvenil A" onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="STUDENT">Alumno</SelectItem>
                  <SelectItem value="COACH">Entrenador</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {locations.length > 0 && (
              <div className="space-y-2">
                <Label>Sedes</Label>
                <div className="flex flex-wrap gap-2">
                  {locations.map(loc => (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => toggleLocation(loc.id)}
                      className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                        form.locationIds.includes(loc.id)
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {loc.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button onClick={handleSave} disabled={saving || !form.fullName.trim()} className="w-full">
              {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear miembro'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
