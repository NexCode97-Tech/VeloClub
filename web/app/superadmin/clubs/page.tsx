'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { KeyRound, Trash2 } from 'lucide-react';

// ── Easing ────────────────────────────────────────────────────────────────────
const EASE    = [0.23, 1, 0.32, 1]  as [number,number,number,number];
const EASE_IN = [0.55, 0, 1, 0.45] as [number,number,number,number];

// ── Variantes ─────────────────────────────────────────────────────────────────
const stagger: Variants = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};
const cardVariant: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.98 },
  show:   { opacity: 1, y: 0,  scale: 1, transition: { duration: 0.22, ease: EASE } },
};
const expandY: Variants = {
  hidden: { opacity: 0, height: 0, overflow: 'hidden' },
  show:   { opacity: 1, height: 'auto', overflow: 'hidden', transition: { duration: 0.28, ease: EASE } },
  exit:   { opacity: 0, height: 0, overflow: 'hidden', transition: { duration: 0.18, ease: EASE_IN } },
};

// ── Interfaces ────────────────────────────────────────────────────────────────
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

// ── Paleta de roles ───────────────────────────────────────────────────────────
const ROLE_COLOR  = { ADMIN: '#FFB703', COACH: '#06D6A0' } as const;
const ROLE_BG     = { ADMIN: 'rgba(255,183,3,0.12)', COACH: 'rgba(6,214,160,0.12)' } as const;
const ROLE_LABEL  = { ADMIN: 'Admin', COACH: 'Entrenador' } as const;

// ── Input base ────────────────────────────────────────────────────────────────
const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  border: '1.5px solid rgba(120,80,200,0.18)',
  background: '#fff', color: '#1A1028', fontSize: 13, outline: 'none',
  boxSizing: 'border-box', fontFamily: 'Plus Jakarta Sans, sans-serif',
};

// ── RoleToggle — reemplaza native <select> ────────────────────────────────────
function RoleToggle({ value, onChange }: { value: 'ADMIN' | 'COACH'; onChange: (v: 'ADMIN' | 'COACH') => void }) {
  return (
    <div style={{ display: 'flex', background: 'rgba(120,80,200,0.07)', borderRadius: 10, padding: 2, gap: 2 }}>
      {(['ADMIN', 'COACH'] as const).map(r => {
        const active = value === r;
        return (
          <motion.button
            key={r}
            onClick={() => onChange(r)}
            whileTap={{ scale: 0.96 }}
            transition={{ duration: 0.12, ease: EASE }}
            style={{
              flex: 1, padding: '5px 8px', border: 'none', borderRadius: 8, cursor: 'pointer',
              background: active ? '#fff' : 'transparent',
              boxShadow: active ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
              transition: 'background 0.15s, box-shadow 0.15s',
            }}
          >
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: active ? ROLE_COLOR[r] : '#8E87A8', transition: 'color 0.15s', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              {ROLE_LABEL[r]}
            </p>
          </motion.button>
        );
      })}
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function ClubsPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  const [clubs,   setClubs]   = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ clubName: '', adminEmail: '', adminName: '' });
  const [saving,  setSaving]  = useState(false);

  const [editId,   setEditId]   = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const [membersClubId,   setMembersClubId]   = useState<string | null>(null);
  const [members,         setMembers]         = useState<Member[]>([]);
  const [membersLoading,  setMembersLoading]  = useState(false);
  const [showAddMember,   setShowAddMember]   = useState(false);
  const [memberForm,      setMemberForm]      = useState({ fullName: '', email: '', role: 'COACH' as 'ADMIN' | 'COACH' });
  const [memberSaving,    setMemberSaving]    = useState(false);
  const [memberError,     setMemberError]     = useState<string | null>(null);

  async function load() {
    try {
      const token = await getToken();
      const res = await apiFetch<{ clubs: Club[] }>('/superadmin/clubs', { token });
      setClubs(res.clubs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar clubs');
    } finally { setLoading(false); }
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

  async function handleResendAccess(clubId: string, memberId: string) {
    const token = await getToken();
    await apiFetch(`/superadmin/clubs/${clubId}/miembros/${memberId}/allowlist`, { method: 'POST', token });
    alert('Acceso re-enviado. El correo ya puede registrarse en la app.');
  }

  return (
    <div style={{ background: '#F7F7FB', minHeight: '100%' }}>
      <div style={{ padding: '12px 16px 80px' }}>

        {/* Header: contador + botón nuevo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <p style={{ margin: 0, fontSize: 12, color: '#8E87A8', fontWeight: 500 }}>
            {clubs.length} club{clubs.length !== 1 ? 's' : ''} registrado{clubs.length !== 1 ? 's' : ''}
          </p>
          <motion.button
            onClick={() => setShowNew(v => !v)}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.12, ease: EASE }}
            style={{
              background: showNew ? 'rgba(239,71,111,0.10)' : '#7C3AED',
              border: showNew ? '1.5px solid rgba(239,71,111,0.25)' : 'none',
              borderRadius: 12, padding: '7px 16px', cursor: 'pointer',
              color: showNew ? '#EF476F' : '#fff',
              fontSize: 12, fontWeight: 700, fontFamily: 'Plus Jakarta Sans, sans-serif',
              transition: 'background 0.18s, color 0.18s',
            }}
          >
            {showNew ? '✕ Cancelar' : '+ Nuevo club'}
          </motion.button>
        </div>

        {error && <p style={{ fontSize: 12, color: '#EF476F', marginBottom: 8 }}>{error}</p>}

        {/* Formulario nuevo club — AnimatePresence */}
        <AnimatePresence>
          {showNew && (
            <motion.div
              key="new-form"
              variants={expandY}
              initial="hidden"
              animate="show"
              exit="exit"
              style={{ background: '#fff', border: '1.5px solid rgba(124,58,237,0.25)', borderRadius: 20, padding: '16px 14px', marginBottom: 12 }}
            >
              <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: '#1A1028', fontFamily: 'Space Grotesk, sans-serif' }}>
                Nuevo club
              </p>
              {[
                { label: 'Nombre del club',  key: 'clubName',   type: 'text',  placeholder: 'Ej: Club Patinaje Norte' },
                { label: 'Nombre del admin', key: 'adminName',  type: 'text',  placeholder: 'Nombre completo' },
                { label: 'Email del admin',  key: 'adminEmail', type: 'email', placeholder: 'admin@ejemplo.com' },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key} style={{ marginBottom: 10 }}>
                  <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {label}
                  </p>
                  <input
                    type={type}
                    placeholder={placeholder}
                    value={(newForm as Record<string, string>)[key]}
                    onChange={e => setNewForm(f => ({ ...f, [key]: e.target.value }))}
                    style={inp}
                  />
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <motion.button
                  onClick={() => { setShowNew(false); setNewForm({ clubName: '', adminEmail: '', adminName: '' }); }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.12 }}
                  style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: '1.5px solid rgba(120,80,200,0.15)', background: 'transparent', color: '#8E87A8', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                >
                  Cancelar
                </motion.button>
                <motion.button
                  onClick={handleCreate}
                  disabled={saving || !newForm.clubName || !newForm.adminEmail || !newForm.adminName}
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.12 }}
                  style={{ flex: 2, padding: '11px 0', borderRadius: 12, border: 'none', background: saving ? '#A855F7' : '#7C3AED', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', boxShadow: '0 3px 14px rgba(124,58,237,0.28)', opacity: (!newForm.clubName || !newForm.adminEmail || !newForm.adminName) ? 0.6 : 1 }}
                >
                  {saving ? 'Creando...' : 'Crear club'}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Lista */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160 }}>
            <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: '#7C3AED', borderTopColor: 'transparent' }} />
          </div>
        ) : clubs.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', borderRadius: 20, padding: '40px 16px', textAlign: 'center' }}
          >
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(124,58,237,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#8E87A8' }}>Sin clubs registrados</p>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#C4BFD8' }}>Crea el primero con el botón de arriba</p>
          </motion.div>
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="show">
            {clubs.map(club => (
              <motion.div
                key={club.id}
                variants={cardVariant}
                style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', borderRadius: 20, padding: '14px 14px 12px', marginBottom: 10 }}
              >
                {/* Editar nombre inline */}
                {editId === club.id ? (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, ease: EASE }}
                    style={{ display: 'flex', gap: 8, marginBottom: 12 }}
                  >
                    <input value={editName} onChange={e => setEditName(e.target.value)}
                      style={{ ...inp, flex: 1 }} autoFocus />
                    <motion.button onClick={() => handleEdit(club.id)}
                      whileTap={{ scale: 0.94 }} transition={{ duration: 0.12 }}
                      style={{ padding: '0 14px', height: 42, borderRadius: 10, background: '#7C3AED', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                      Guardar
                    </motion.button>
                    <motion.button onClick={() => setEditId(null)}
                      whileTap={{ scale: 0.94 }} transition={{ duration: 0.12 }}
                      style={{ width: 42, height: 42, borderRadius: 10, border: '1.5px solid rgba(120,80,200,0.15)', background: 'transparent', color: '#8E87A8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </motion.button>
                  </motion.div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                    {/* Identidad */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(124,58,237,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: '#7C3AED', fontFamily: 'Space Grotesk, sans-serif', flexShrink: 0 }}>
                        {club.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1A1028', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {club.name}
                          </p>
                          <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: club.active ? 'rgba(6,214,160,0.12)' : 'rgba(239,71,111,0.12)', color: club.active ? '#06D6A0' : '#EF476F' }}>
                            {club.active ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: 11, color: '#8E87A8' }}>
                          {club._count.members} miembros{club.users[0] ? ` · Admin: ${club.users[0].name}` : ''}
                        </p>
                      </div>
                    </div>
                    {/* Editar */}
                    <motion.button
                      onClick={() => { setEditId(club.id); setEditName(club.name); }}
                      whileTap={{ scale: 0.88 }} transition={{ duration: 0.12, ease: EASE }}
                      style={{ width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.12)', color: '#7C3AED', cursor: 'pointer', flexShrink: 0, marginLeft: 8 }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </motion.button>
                  </div>
                )}

                {/* Acciones */}
                <div style={{ display: 'flex', gap: 6, marginBottom: membersClubId === club.id ? 10 : 0 }}>
                  <motion.button
                    onClick={() => openMembers(club.id)}
                    whileTap={{ scale: 0.96 }} transition={{ duration: 0.12, ease: EASE }}
                    style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: `1px solid ${membersClubId === club.id ? 'rgba(124,58,237,0.40)' : 'rgba(124,58,237,0.18)'}`, background: membersClubId === club.id ? 'rgba(124,58,237,0.10)' : 'transparent', color: '#7C3AED', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', transition: 'all 0.15s' }}
                  >
                    {membersClubId === club.id ? 'Cerrar' : 'Miembros'}
                  </motion.button>
                  <motion.button
                    onClick={() => handleToggle(club.id)}
                    whileTap={{ scale: 0.96 }} transition={{ duration: 0.12, ease: EASE }}
                    style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: `1px solid ${club.active ? 'rgba(255,183,3,0.28)' : 'rgba(6,214,160,0.28)'}`, background: club.active ? 'rgba(255,183,3,0.07)' : 'rgba(6,214,160,0.07)', color: club.active ? '#FFB703' : '#06D6A0', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', transition: 'all 0.15s' }}
                  >
                    {club.active ? 'Desactivar' : 'Activar'}
                  </motion.button>
                  <motion.button
                    onClick={() => handleDelete(club.id)}
                    whileTap={{ scale: 0.88 }} transition={{ duration: 0.12, ease: EASE }}
                    style={{ width: 36, borderRadius: 10, border: '1px solid rgba(239,71,111,0.22)', background: 'rgba(239,71,111,0.07)', color: '#EF476F', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Trash2 size={14} />
                  </motion.button>
                </div>

                {/* Panel de miembros */}
                <AnimatePresence>
                  {membersClubId === club.id && (
                    <motion.div
                      key="members-panel"
                      variants={expandY}
                      initial="hidden"
                      animate="show"
                      exit="exit"
                      style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(120,80,200,0.10)' }}
                    >
                      {/* Header del panel */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(124,58,237,0.05)', borderBottom: '1px solid rgba(120,80,200,0.08)' }}>
                        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#7C3AED' }}>Admins y Entrenadores</p>
                        <motion.button
                          onClick={() => { setShowAddMember(v => !v); setMemberError(null); }}
                          whileTap={{ scale: 0.94 }} transition={{ duration: 0.12 }}
                          style={{ padding: '4px 10px', borderRadius: 8, background: showAddMember ? 'rgba(239,71,111,0.10)' : '#7C3AED', border: showAddMember ? '1px solid rgba(239,71,111,0.25)' : 'none', color: showAddMember ? '#EF476F' : '#fff', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', transition: 'all 0.15s' }}
                        >
                          {showAddMember ? '✕ Cerrar' : '+ Agregar'}
                        </motion.button>
                      </div>

                      {/* Formulario agregar miembro */}
                      <AnimatePresence>
                        {showAddMember && (
                          <motion.div
                            key="add-member-form"
                            variants={expandY}
                            initial="hidden"
                            animate="show"
                            exit="exit"
                            style={{ padding: '12px', background: '#FAFAFA', borderBottom: '1px solid rgba(120,80,200,0.07)' }}
                          >
                            <div style={{ marginBottom: 8 }}>
                              <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nombre completo</p>
                              <input type="text" value={memberForm.fullName} placeholder="Nombre completo"
                                onChange={e => setMemberForm(f => ({ ...f, fullName: e.target.value }))}
                                style={{ ...inp, fontSize: 12 }} />
                            </div>
                            <div style={{ marginBottom: 8 }}>
                              <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email</p>
                              <input type="email" value={memberForm.email} placeholder="email@ejemplo.com"
                                onChange={e => setMemberForm(f => ({ ...f, email: e.target.value }))}
                                style={{ ...inp, fontSize: 12 }} />
                            </div>
                            <div style={{ marginBottom: 10 }}>
                              <p style={{ margin: '0 0 6px', fontSize: 9, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rol</p>
                              <RoleToggle value={memberForm.role} onChange={r => setMemberForm(f => ({ ...f, role: r }))} />
                            </div>
                            {memberError && <p style={{ fontSize: 11, color: '#EF476F', marginBottom: 8, margin: '0 0 8px' }}>{memberError}</p>}
                            <div style={{ display: 'flex', gap: 8 }}>
                              <motion.button
                                onClick={() => { setShowAddMember(false); setMemberError(null); }}
                                whileTap={{ scale: 0.97 }} transition={{ duration: 0.12 }}
                                style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: '1.5px solid rgba(120,80,200,0.15)', background: 'transparent', color: '#8E87A8', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                              >
                                Cancelar
                              </motion.button>
                              <motion.button
                                onClick={() => handleAddMember(club.id)}
                                disabled={memberSaving || !memberForm.fullName || !memberForm.email}
                                whileTap={{ scale: 0.97 }} transition={{ duration: 0.12 }}
                                style={{ flex: 2, padding: '9px 0', borderRadius: 10, border: 'none', background: memberSaving ? '#A855F7' : '#7C3AED', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', boxShadow: '0 2px 10px rgba(124,58,237,0.25)' }}
                              >
                                {memberSaving ? 'Guardando...' : 'Agregar y dar acceso'}
                              </motion.button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Lista de miembros */}
                      {membersLoading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 0' }}>
                          <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                            style={{ borderColor: '#7C3AED', borderTopColor: 'transparent' }} />
                        </div>
                      ) : members.length === 0 ? (
                        <p style={{ textAlign: 'center', padding: '16px 0', margin: 0, fontSize: 12, color: '#8E87A8' }}>
                          Sin admins o entrenadores aún
                        </p>
                      ) : (
                        members.map((m, i) => (
                          <div key={m.id}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderTop: i > 0 ? '1px solid rgba(120,80,200,0.07)' : 'none' }}
                          >
                            {/* Avatar */}
                            <div style={{ width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0, background: m.role === 'ADMIN' ? 'linear-gradient(135deg,#FFB703,#FB8500)' : 'linear-gradient(135deg,#06D6A0,#0CB68D)' }}>
                              {m.fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#1A1028', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.fullName}</p>
                              <p style={{ margin: 0, fontSize: 10, color: '#8E87A8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</p>
                            </div>
                            {/* Toggle de rol — sin native select */}
                            <RoleToggle value={m.role} onChange={r => handleChangeRole(club.id, m.id, r)} />
                            {/* Reenviar acceso */}
                            <motion.button
                              onClick={() => handleResendAccess(club.id, m.id)}
                              whileTap={{ scale: 0.88 }} transition={{ duration: 0.12 }}
                              title="Re-enviar acceso"
                              style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(67,97,238,0.08)', border: '1px solid rgba(67,97,238,0.18)', color: '#4361EE', cursor: 'pointer', flexShrink: 0 }}
                            >
                              <KeyRound size={12} />
                            </motion.button>
                            {/* Quitar miembro */}
                            <motion.button
                              onClick={() => handleRemoveMember(club.id, m.id)}
                              whileTap={{ scale: 0.88 }} transition={{ duration: 0.12 }}
                              style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239,71,111,0.07)', border: '1px solid rgba(239,71,111,0.18)', color: '#EF476F', cursor: 'pointer', flexShrink: 0 }}
                            >
                              <Trash2 size={12} />
                            </motion.button>
                          </div>
                        ))
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

              </motion.div>
            ))}
          </motion.div>
        )}

      </div>
    </div>
  );
}
