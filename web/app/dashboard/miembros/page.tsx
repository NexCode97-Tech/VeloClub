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
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, Users, Search } from 'lucide-react';

interface Location { id: string; name: string }
interface Member {
  id: string; fullName: string; email?: string; phone?: string;
  birthDate?: string; category?: string; tipo?: string;
  emergencyContact?: string; emergencyPhone?: string; eps?: string;
  role: string;
  locations: { location: Location }[];
}

const ROLES: Record<string, string> = { ADMIN: 'Admin', COACH: 'Entrenador', STUDENT: 'Deportista' };
const ROLE_COLORS: Record<string, string> = {
  ADMIN:   'bg-amber-100 text-amber-700',
  COACH:   'bg-emerald-100 text-emerald-700',
  STUDENT: 'bg-violet-100 text-violet-700',
};
const ROLE_AVATAR: Record<string, string> = {
  ADMIN:   'linear-gradient(135deg,#FFB703,#FB8500)',
  COACH:   'linear-gradient(135deg,#06D6A0,#0CB68D)',
  STUDENT: 'linear-gradient(135deg,#7C3AED,#A855F7)',
};

const emptyForm = {
  fullName: '', email: '', phone: '', birthDate: '',
  category: '', tipo: '', emergencyContact: '', emergencyPhone: '',
  eps: '', role: 'STUDENT', locationIds: [] as string[],
};

export default function MiembrosPage() {
  const { getToken } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'STUDENT' | 'COACH' | 'ADMIN'>('ALL');
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
      category: m.category ?? '', tipo: m.tipo ?? '',
      emergencyContact: m.emergencyContact ?? '',
      emergencyPhone: m.emergencyPhone ?? '',
      eps: m.eps ?? '',
      role: m.role,
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

  const filtered = members.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = m.fullName.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q);
    const matchRole = roleFilter === 'ALL' || m.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div className="min-h-full bg-background">
      {/* Encabezado */}
      <div className="px-5 pt-5 pb-4 bg-card border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-bold text-foreground" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            Miembros
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {members.length} miembro{members.length !== 1 ? 's' : ''} registrado{members.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white transition-colors"
          style={{ background: '#4361EE' }}
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nuevo</span>
        </button>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {/* Búsqueda */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9 bg-white border-border rounded-xl"
            placeholder="Buscar miembro..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Filtros */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {([['ALL','Todos'],['STUDENT','Deportistas'],['COACH','Entrenadores'],['ADMIN','Admins']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setRoleFilter(val)}
              className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors"
              style={roleFilter === val
                ? { background: '#4361EE', color: '#fff', borderColor: '#4361EE' }
                : { background: '#fff', color: '#8E87A8', borderColor: 'rgba(120,80,200,0.10)' }
              }
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-border p-10 text-center">
            <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{search ? 'Sin resultados.' : 'No hay miembros registrados aún.'}</p>
            {!search && (
              <button onClick={openNew} className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold border border-border text-muted-foreground hover:bg-secondary transition-colors">
                Agregar primer miembro
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Tarjetas móvil */}
            <div className="md:hidden space-y-2 pb-4">
              {filtered.map(m => (
                <div key={m.id} className="bg-white border border-border rounded-xl px-3 py-3 flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ background: ROLE_AVATAR[m.role] ?? ROLE_AVATAR.STUDENT }}
                  >
                    {m.fullName.split(' ').slice(0, 2).map(w => w[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="text-[13px] font-bold text-foreground truncate">{m.fullName}</p>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${ROLE_COLORS[m.role]}`}>
                        {ROLES[m.role]}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{m.email ?? '—'}</p>
                    <div className="flex gap-2 mt-0.5">
                      {m.category && <p className="text-[10px] font-semibold" style={{ color: '#4361EE' }}>{m.category}</p>}
                      {m.tipo && <p className="text-[10px] text-muted-foreground">{m.tipo}</p>}
                    </div>
                    {m.locations.length > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">{m.locations.map(l => l.location.name).join(' · ')}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => openEdit(m)} className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(m.id)} className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-red-400 hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Tabla desktop */}
            <div className="hidden md:block bg-white rounded-xl border border-border overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead className="bg-secondary border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Nombre</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Email</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Rol</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Sedes</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Categoría</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Tipo</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map(m => (
                    <tr key={m.id} className="hover:bg-secondary/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                            style={{ background: ROLE_AVATAR[m.role] ?? ROLE_AVATAR.STUDENT }}
                          >
                            {m.fullName.split(' ').slice(0, 2).map(w => w[0]).join('')}
                          </div>
                          <span className="font-semibold text-foreground">{m.fullName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{m.email ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[m.role]}`}>
                          {ROLES[m.role]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {m.locations.length === 0
                            ? <span className="text-muted-foreground">—</span>
                            : m.locations.map(l => (
                              <Badge key={l.location.id} variant="secondary" className="text-xs">{l.location.name}</Badge>
                            ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{m.category ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{m.tipo ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(m)}><Pencil className="w-4 h-4" /></Button>
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(m.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Modal crear / editar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar miembro' : 'Nuevo miembro'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">

            {/* Nombre */}
            <div className="space-y-2">
              <Label>Nombre completo *</Label>
              <Input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} />
            </div>

            {/* Email + Teléfono */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Correo electrónico</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>

            {/* Fecha de nacimiento + Rol */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 min-w-0">
                <Label>Fecha de nacimiento</Label>
                <Input type="date" value={form.birthDate} className="w-full max-w-full" onChange={e => setForm(f => ({ ...f, birthDate: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Rol</Label>
                <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v ?? 'STUDENT' }))}>
                  <SelectTrigger><span className="text-sm">{ROLES[form.role] ?? form.role}</span></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STUDENT">Deportista</SelectItem>
                    <SelectItem value="COACH">Entrenador</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Categoría + Tipo */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Input value={form.category} placeholder="Ej: Juvenil A" onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Input value={form.tipo} placeholder="Ej: Fondo, Velocidad" onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} />
              </div>
            </div>

            {/* EPS */}
            <div className="space-y-2">
              <Label>EPS</Label>
              <Input value={form.eps} placeholder="Nombre de la EPS" onChange={e => setForm(f => ({ ...f, eps: e.target.value }))} />
            </div>

            {/* Contacto de emergencia + Teléfono de emergencia */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Contacto de emergencia</Label>
                <Input value={form.emergencyContact} placeholder="Nombre" onChange={e => setForm(f => ({ ...f, emergencyContact: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Tel. emergencia</Label>
                <Input value={form.emergencyPhone} placeholder="Número" onChange={e => setForm(f => ({ ...f, emergencyPhone: e.target.value }))} />
              </div>
            </div>

            {/* Sedes */}
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
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-white text-muted-foreground border-border hover:border-primary'
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
