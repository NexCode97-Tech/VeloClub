'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';

interface Member {
  id: string;
  fullName: string;
  email: string;
  role: 'ADMIN' | 'COACH';
  inviteStatus: string;
}

interface Club {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  _count: { members: number };
  users: { email: string; name: string }[];
}

const ROLE_COLOR  = { ADMIN: '#FFB703', COACH: '#06D6A0' };
const ROLE_BG     = { ADMIN: 'rgba(255,183,3,0.12)', COACH: 'rgba(6,214,160,0.12)' };
const ROLE_LABEL  = { ADMIN: 'Administrador', COACH: 'Entrenador' };

const inputStyle = {
  width: '100%', padding: '8px 10px', borderRadius: 8,
  border: '1px solid rgba(120,80,200,0.10)',
  background: '#F7F7FB', color: '#1A1028', fontSize: 13, outline: 'none',
  boxSizing: 'border-box' as const, fontFamily: 'Plus Jakarta Sans, sans-serif',
};

export default function ClubsPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  const [clubs,   setClubs]   = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // New club form
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ clubName: '', adminEmail: '', adminName: '' });
  const [saving,  setSaving]  = useState(false);

  // Edit club
  const [editId,   setEditId]   = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Members panel per club
  const [membersClubId, setMembersClubId]   = useState<string | null>(null);
  const [members,       setMembers]         = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [showAddMember, setShowAddMember]   = useState(false);
  const [memberForm, setMemberForm]         = useState({ fullName: '', email: '', role: 'COACH' as 'ADMIN' | 'COACH' });
  const [memberSaving, setMemberSaving]     = useState(false);
  const [memberError,  setMemberError]      = useState<string | null>(null);

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
    if (!newForm.clubName || !newForm.adminEmail || !newForm.adminName) return;
    setSaving(true); setError(null);
    try {
      const token = await getToken();
      await apiFetch('/superadmin/clubs', { method: 'POST', token, body: JSON.stringify(newForm) });
      setShowNew(false);
      setNewForm({ clubName: '', adminEmail: '', adminName: '' });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setSaving(false); }
  }

  async function handleEdit(id: string) {
    if (!editName.trim()) return;
    const token = await getToken();
    await apiFetch(`/superadmin/clubs/${id}`, { method: 'PATCH', token, body: JSON.stringify({ name: editName }) });
    setEditId(null);
    await load();
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
    if (membersClubId === id) setMembersClubId(null);
    await load();
  }

  async function loadMembers(clubId: string) {
    setMembersLoading(true);
    try {
      const token = await getToken();
      const res = await apiFetch<{ members: Member[] }>(`/superadmin/clubs/${clubId}/miembros`, { token });
      setMembers(res.members);
    } finally { setMembersLoading(false); }
  }

  async function openMembers(clubId: string) {
    if (membersClubId === clubId) { setMembersClubId(null); return; }
    setMembersClubId(clubId);
    setShowAddMember(false);
    setMemberError(null);
    await loadMembers(clubId);
  }

  async function handleAddMember(clubId: string) {
    if (!memberForm.fullName || !memberForm.email) return;
    setMemberSaving(true); setMemberError(null);
    try {
      const token = await getToken();
      await apiFetch(`/superadmin/clubs/${clubId}/miembros`, { method: 'POST', token, body: JSON.stringify(memberForm) });
      setShowAddMember(false);
      setMemberForm({ fullName: '', email: '', role: 'COACH' });
      await loadMembers(clubId);
      await load();
    } catch (e) { setMemberError(e instanceof Error ? e.message : 'Error'); }
    finally { setMemberSaving(false); }
  }

  async function handleChangeRole(clubId: string, memberId: string, newRole: 'ADMIN' | 'COACH') {
    const token = await getToken();
    await apiFetch(`/superadmin/clubs/${clubId}/miembros/${memberId}`, { method: 'PATCH', token, body: JSON.stringify({ role: newRole }) });
    await loadMembers(clubId);
  }

  async function handleRemoveMember(clubId: string, memberId: string) {
    if (!confirm('¿Quitar este miembro? Perderá acceso a la app.')) return;
    const token = await getToken();
    await apiFetch(`/superadmin/clubs/${clubId}/miembros/${memberId}`, { method: 'DELETE', token });
    await loadMembers(clubId);
    await load();
  }

  return (
    <div style={{ background: '#F7F7FB', minHeight: '100%' }}>
      <div style={{ padding: '12px 16px 80px' }}>

        {/* Count + New */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-[12px] m-0" style={{ color: '#8E87A8' }}>
            {clubs.length} club{clubs.length !== 1 ? 's' : ''} registrado{clubs.length !== 1 ? 's' : ''}
          </p>
          <button onClick={() => setShowNew(v => !v)}
            className="text-[12px] font-bold text-white px-3.5 py-1.5 rounded-xl"
            style={{ background: '#7C3AED', border: 'none', cursor: 'pointer' }}>
            + Nuevo
          </button>
        </div>

        {error && <p className="text-[12px] mb-2" style={{ color: '#EF476F' }}>{error}</p>}

        {/* New club form */}
        {showNew && (
          <div className="rounded-2xl p-3.5 mb-3" style={{ background: '#fff', border: '1.5px solid #7C3AED' }}>
            <p className="text-[13px] font-bold mb-3 m-0" style={{ fontFamily: 'Space Grotesk, sans-serif', color: '#1A1028' }}>Nuevo club</p>
            {[
              { label: 'Nombre del club',  key: 'clubName',   type: 'text'  },
              { label: 'Nombre del admin', key: 'adminName',  type: 'text'  },
              { label: 'Email del admin',  key: 'adminEmail', type: 'email' },
            ].map(({ label, key, type }) => (
              <div key={key} className="mb-2">
                <p className="text-[11px] font-semibold mb-1 m-0" style={{ color: '#8E87A8' }}>{label}</p>
                <input type={type} value={(newForm as Record<string, string>)[key]}
                  onChange={e => setNewForm(f => ({ ...f, [key]: e.target.value }))} style={inputStyle} />
              </div>
            ))}
            <div className="flex gap-2 mt-2.5">
              <button onClick={() => setShowNew(false)}
                className="flex-1 text-[12px] font-semibold py-2 rounded-xl"
                style={{ border: '1px solid rgba(120,80,200,0.10)', background: 'transparent', color: '#8E87A8', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={handleCreate} disabled={saving || !newForm.clubName || !newForm.adminEmail || !newForm.adminName}
                className="flex-[2] text-[12px] font-bold py-2 rounded-xl text-white"
                style={{ background: saving ? '#A855F7' : '#7C3AED', border: 'none', cursor: 'pointer' }}>
                {saving ? 'Creando...' : 'Crear club'}
              </button>
            </div>
          </div>
        )}

        {/* Club list */}
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#7C3AED', borderTopColor: 'transparent' }} />
          </div>
        ) : clubs.length === 0 ? (
          <div className="rounded-2xl p-12 text-center" style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', color: '#8E87A8', fontSize: 13 }}>
            No hay clubs registrados aún.
          </div>
        ) : clubs.map(club => (
          <div key={club.id} className="rounded-2xl mb-3" style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', padding: 14 }}>

            {/* Edit name inline */}
            {editId === club.id ? (
              <div className="flex gap-2 mb-3">
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  style={{ ...inputStyle, flex: 1 }} autoFocus />
                <button onClick={() => handleEdit(club.id)}
                  className="px-3 rounded-xl text-[12px] font-bold text-white"
                  style={{ background: '#7C3AED', border: 'none', cursor: 'pointer' }}>
                  Guardar
                </button>
                <button onClick={() => setEditId(null)}
                  className="px-3 rounded-xl text-[12px] font-semibold"
                  style={{ border: '1px solid rgba(120,80,200,0.10)', background: 'transparent', color: '#8E87A8', cursor: 'pointer' }}>
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="text-[14px] font-bold m-0 truncate" style={{ color: '#1A1028' }}>{club.name}</p>
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                      style={{ background: club.active ? 'rgba(6,214,160,0.12)' : 'rgba(239,71,111,0.12)', color: club.active ? '#06D6A0' : '#EF476F' }}>
                      {club.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <p className="text-[11px] m-0" style={{ color: '#8E87A8' }}>
                    {club._count.members} miembros{club.users[0] ? ` · Admin: ${club.users[0].name}` : ''}
                  </p>
                </div>
                {/* Edit icon */}
                <button onClick={() => { setEditId(club.id); setEditName(club.name); }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg ml-2 shrink-0"
                  style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)', color: '#7C3AED', cursor: 'pointer' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 mb-2">
              <button onClick={() => openMembers(club.id)}
                className="flex-1 text-[11px] font-semibold py-1.5 rounded-xl"
                style={{ border: '1px solid rgba(124,58,237,0.25)', background: membersClubId === club.id ? 'rgba(124,58,237,0.12)' : 'rgba(124,58,237,0.06)', color: '#7C3AED', cursor: 'pointer' }}>
                👥 Miembros
              </button>
              <button onClick={() => handleToggle(club.id)}
                className="flex-1 text-[11px] font-semibold py-1.5 rounded-xl"
                style={{ border: `1px solid ${club.active ? 'rgba(255,183,3,0.3)' : 'rgba(6,214,160,0.3)'}`, background: club.active ? 'rgba(255,183,3,0.08)' : 'rgba(6,214,160,0.08)', color: club.active ? '#FFB703' : '#06D6A0', cursor: 'pointer' }}>
                {club.active ? '⏸ Desactivar' : '▶ Activar'}
              </button>
              <button onClick={() => handleDelete(club.id)}
                className="w-9 flex items-center justify-center rounded-xl"
                style={{ border: '1px solid rgba(239,71,111,0.3)', background: 'rgba(239,71,111,0.08)', color: '#EF476F', cursor: 'pointer' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
              </button>
            </div>

            {/* Members panel */}
            {membersClubId === club.id && (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(120,80,200,0.10)', marginTop: 4 }}>
                <div className="flex items-center justify-between px-3 py-2" style={{ background: '#F0EEF8', borderBottom: '1px solid rgba(120,80,200,0.10)' }}>
                  <p className="text-[11px] font-bold m-0" style={{ color: '#7C3AED' }}>Admins y Entrenadores</p>
                  <button onClick={() => { setShowAddMember(v => !v); setMemberError(null); }}
                    className="text-[10px] font-bold px-2.5 py-1 rounded-lg text-white"
                    style={{ background: '#7C3AED', border: 'none', cursor: 'pointer' }}>
                    + Agregar
                  </button>
                </div>

                {/* Add member form */}
                {showAddMember && (
                  <div className="p-3" style={{ borderBottom: '1px solid rgba(120,80,200,0.08)', background: '#fafafa' }}>
                    <div className="mb-1.5">
                      <p className="text-[10px] font-semibold m-0 mb-0.5" style={{ color: '#8E87A8' }}>Nombre completo</p>
                      <input type="text" value={memberForm.fullName} placeholder="Nombre completo"
                        onChange={e => setMemberForm(f => ({ ...f, fullName: e.target.value }))} style={{ ...inputStyle, fontSize: 12 }} />
                    </div>
                    <div className="mb-1.5">
                      <p className="text-[10px] font-semibold m-0 mb-0.5" style={{ color: '#8E87A8' }}>Email</p>
                      <input type="email" value={memberForm.email} placeholder="email@ejemplo.com"
                        onChange={e => setMemberForm(f => ({ ...f, email: e.target.value }))} style={{ ...inputStyle, fontSize: 12 }} />
                    </div>
                    <div className="mb-2">
                      <p className="text-[10px] font-semibold m-0 mb-0.5" style={{ color: '#8E87A8' }}>Rol</p>
                      <div className="flex gap-2">
                        {(['ADMIN', 'COACH'] as const).map(r => (
                          <button key={r} onClick={() => setMemberForm(f => ({ ...f, role: r }))}
                            className="flex-1 text-[11px] font-semibold py-1.5 rounded-xl"
                            style={{ border: `1px solid ${memberForm.role === r ? ROLE_COLOR[r] : 'rgba(120,80,200,0.10)'}`, background: memberForm.role === r ? ROLE_BG[r] : 'transparent', color: memberForm.role === r ? ROLE_COLOR[r] : '#8E87A8', cursor: 'pointer' }}>
                            {ROLE_LABEL[r]}
                          </button>
                        ))}
                      </div>
                    </div>
                    {memberError && <p className="text-[11px] mb-1.5" style={{ color: '#EF476F' }}>{memberError}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => { setShowAddMember(false); setMemberError(null); }}
                        className="flex-1 text-[11px] font-semibold py-1.5 rounded-xl"
                        style={{ border: '1px solid rgba(120,80,200,0.10)', background: 'transparent', color: '#8E87A8', cursor: 'pointer' }}>
                        Cancelar
                      </button>
                      <button onClick={() => handleAddMember(club.id)} disabled={memberSaving || !memberForm.fullName || !memberForm.email}
                        className="flex-[2] text-[11px] font-bold py-1.5 rounded-xl text-white"
                        style={{ background: memberSaving ? '#A855F7' : '#7C3AED', border: 'none', cursor: 'pointer' }}>
                        {memberSaving ? 'Guardando...' : 'Agregar y dar acceso'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Members list */}
                {membersLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#7C3AED', borderTopColor: 'transparent' }} />
                  </div>
                ) : members.length === 0 ? (
                  <p className="text-[12px] text-center py-4 m-0" style={{ color: '#8E87A8' }}>Sin admins o entrenadores aún</p>
                ) : members.map((m, i) => (
                  <div key={m.id} className="flex items-center gap-2.5 px-3 py-2.5"
                    style={{ borderTop: i > 0 ? '1px solid rgba(120,80,200,0.07)' : 'none' }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                      style={{ background: m.role === 'ADMIN' ? 'linear-gradient(135deg,#FFB703,#FB8500)' : 'linear-gradient(135deg,#06D6A0,#0CB68D)' }}>
                      {m.fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold m-0 truncate" style={{ color: '#1A1028' }}>{m.fullName}</p>
                      <p className="text-[10px] m-0 truncate" style={{ color: '#8E87A8' }}>{m.email}</p>
                    </div>
                    {/* Role toggle */}
                    <select value={m.role} onChange={e => handleChangeRole(club.id, m.id, e.target.value as 'ADMIN' | 'COACH')}
                      className="text-[10px] font-semibold rounded-lg px-1.5 py-1"
                      style={{ border: `1px solid ${ROLE_COLOR[m.role]}40`, background: ROLE_BG[m.role], color: ROLE_COLOR[m.role], cursor: 'pointer', outline: 'none' }}>
                      <option value="ADMIN">Admin</option>
                      <option value="COACH">Entrenador</option>
                    </select>
                    <button onClick={() => handleRemoveMember(club.id, m.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0"
                      style={{ background: 'rgba(239,71,111,0.08)', border: '1px solid rgba(239,71,111,0.2)', color: '#EF476F', cursor: 'pointer' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
