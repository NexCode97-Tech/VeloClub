'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { useNow } from '@/lib/use-now';
import { PhoneInput } from '@/components/ui/phone-input';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { Trash2, ChevronDown, Check, MessageCircle } from 'lucide-react';

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
  phone?: string | null;
  role: 'ADMIN' | 'COACH';
  inviteStatus: string;
}
interface Club {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  trialEndsAt?: string | null;
  deporte?: string | null;
  logoUrl?: string | null;
  _count: { members: number };
  users: { email: string; name: string }[];
  suscripcion?: { tipoPlan: string; planMonto: number } | null;
}

// ── Paleta de roles ───────────────────────────────────────────────────────────
const ROLE_COLOR  = { ADMIN: '#FFB703', COACH: '#06D6A0' } as const;
const ROLE_LABEL  = { ADMIN: 'Admin', COACH: 'Entrenador' } as const;

// ── Input base ────────────────────────────────────────────────────────────────
const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  border: '1.5px solid rgba(120,80,200,0.18)',
  background: '#fff', color: '#1A1028', fontSize: 13, outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit',
};

// ── Deportes ──────────────────────────────────────────────────────────────────
const DEPORTES = ['Patinaje','Ciclismo','Fútbol','Natación','Atletismo','Baloncesto','Voleibol','Tenis','Natación artística','Otro'];

// ── SportSelect — reemplaza native <select> de deporte ───────────────────────
interface MenuCoords { left: number; width: number; top?: number; bottom?: number; maxHeight: number; openUp: boolean; }

function SportSelect({ value, onChange, placeholder = 'Seleccionar deporte' }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const btnRef  = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Calcula la posición del menú anclada al botón, con clamp al viewport.
  // Si no cabe hacia abajo, abre hacia arriba; siempre limita la altura.
  function recalc() {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const vw = window.innerWidth;
    const GAP = 6;
    const spaceBelow = vh - r.bottom;
    const spaceAbove = r.top;
    const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(140, (openUp ? spaceAbove : spaceBelow) - GAP - 10);
    const left = Math.max(8, Math.min(r.left, vw - r.width - 8));
    setCoords({
      left, width: r.width, maxHeight, openUp,
      top:    openUp ? undefined : r.bottom + GAP,
      bottom: openUp ? vh - r.top + GAP : undefined,
    });
  }

  // Recalcular al abrir y reposicionar en scroll/resize mientras está abierto
  useEffect(() => {
    if (!open) return;
    recalc();
    const onScroll = () => recalc();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    window.visualViewport?.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      window.visualViewport?.removeEventListener('resize', onScroll);
    };
  }, [open]);

  // Cerrar al hacer click fuera (botón + menú en portal)
  useEffect(() => {
    function handler(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const optionBtn = (label: string, selected: boolean, onClick: () => void, borderTop: boolean) => (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ background: 'rgba(124,58,237,0.05)' }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.10 }}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', border: 'none', cursor: 'pointer',
        background: selected ? 'rgba(124,58,237,0.07)' : 'transparent',
        borderTop: borderTop ? '1px solid rgba(120,80,200,0.06)' : 'none',
        fontFamily: 'inherit',
      }}
    >
      <span style={{ fontSize: 12, color: selected ? '#7C3AED' : '#1A1028', fontWeight: selected ? 700 : 500 }}>
        {label}
      </span>
      {selected && <Check size={13} strokeWidth={2.5} color="#7C3AED" />}
    </motion.button>
  );

  return (
    <div style={{ position: 'relative' }}>
      {/* Trigger */}
      <motion.button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.10, ease: EASE }}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px', borderRadius: 10, cursor: 'pointer', boxSizing: 'border-box',
          border: open ? '1.5px solid rgba(124,58,237,0.45)' : '1.5px solid rgba(120,80,200,0.18)',
          background: '#fff', fontFamily: 'inherit',
          boxShadow: open ? '0 0 0 3px rgba(124,58,237,0.08)' : 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
      >
        <span style={{ fontSize: 13, color: value ? '#1A1028' : '#8E87A8', fontWeight: value ? 600 : 400 }}>
          {value || placeholder}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.18, ease: EASE }}
          style={{ display: 'flex', color: '#7C3AED' }}
        >
          <ChevronDown size={15} strokeWidth={2.5} />
        </motion.span>
      </motion.button>

      {/* Dropdown en portal — fixed + clamp al viewport para que no lo recorte el modal */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && coords && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, y: coords.openUp ? 6 : -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: coords.openUp ? 4 : -4, scale: 0.97 }}
              transition={{ duration: 0.18, ease: EASE }}
              style={{
                position: 'fixed', left: coords.left, width: coords.width,
                ...(coords.openUp ? { bottom: coords.bottom } : { top: coords.top }),
                maxHeight: coords.maxHeight, overflowY: 'auto',
                background: '#fff', borderRadius: 14, zIndex: 1000,
                border: '1.5px solid rgba(124,58,237,0.15)',
                boxShadow: '0 8px 32px rgba(80,40,180,0.13), 0 2px 8px rgba(0,0,0,0.06)',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {optionBtn('Sin especificar', !value, () => { onChange(''); setOpen(false); }, false)}
              {DEPORTES.map((d, i) =>
                optionBtn(d, value === d, () => { onChange(d); setOpen(false); }, i >= 0)
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

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
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: active ? ROLE_COLOR[r] : '#8E87A8', transition: 'color 0.15s', fontFamily: 'inherit' }}>
              {ROLE_LABEL[r]}
            </p>
          </motion.button>
        );
      })}
    </div>
  );
}

// ── WhatsApp recordatorio ─────────────────────────────────────────────────────
// Abre WhatsApp con el mensaje listo — el superadmin elige el contacto destino
function getWhatsAppUrl(club: Club): string {
  const now  = new Date();
  const admin = club.users[0]?.name ?? 'Administrador';
  let msg = '';

  if (club.trialEndsAt) {
    const ends     = new Date(club.trialEndsAt);
    const expired  = ends < now;
    const daysLeft = expired ? 0 : Math.ceil((ends.getTime() - now.getTime()) / 86_400_000);
    if (expired) {
      msg = `Hola ${admin} 👋, te escribimos de *VeloClub*.\n\nEl período de prueba gratuita del club *${club.name}* ha vencido.\n\nPara seguir disfrutando de VeloClub, activa tu plan escribiéndonos. ¡Estamos listos para ayudarte! 🚀`;
    } else {
      msg = `Hola ${admin} 👋, te escribimos de *VeloClub*.\n\nTe recordamos que el período de prueba gratuita del club *${club.name}* vence en *${daysLeft} día${daysLeft !== 1 ? 's' : ''}*.\n\nActiva tu plan antes de que expire para no perder el acceso. ¡Contáctanos! 🙌`;
    }
  } else if (club.suscripcion) {
    const planLabel: Record<string, string> = { MENSUAL: 'Mensual', TRIMESTRAL: 'Trimestral', ANUAL: 'Anual' };
    const tipo = planLabel[club.suscripcion.tipoPlan] ?? club.suscripcion.tipoPlan;
    msg = `Hola ${admin} 👋, te escribimos de *VeloClub*.\n\nTe recordamos que el Plan *${tipo}* del club *${club.name}* está próximo a vencer.\n\nRenueva tu suscripción para mantener el acceso sin interrupciones. ¡Gracias por confiar en VeloClub! 💜`;
  } else {
    msg = `Hola ${admin} 👋, te escribimos de *VeloClub*.\n\nEl club *${club.name}* aún no tiene un plan activo en VeloClub.\n\n¿Te gustaría activar tu suscripción? Cuéntanos y te ayudamos. 🚀`;
  }

  // Sin número destino → WhatsApp abre el selector de contactos con el mensaje listo
  return `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function ClubsPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  // Hora viva: re-renderiza cada 30s para que los días de prueba se descuenten
  // en tiempo real sin que el superadmin tenga que refrescar la página.
  const now = useNow(30_000);

  const [clubs,   setClubs]   = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ clubName: '', adminEmail: '', adminName: '', adminPhone: '', deporte: '' });
  const [saving,  setSaving]  = useState(false);

  const [editId,   setEditId]   = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ clubName: '', adminName: '', adminEmail: '', adminPhone: '', deporte: '', trialDays: '' });

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
      setNewForm({ clubName: '', adminEmail: '', adminName: '', adminPhone: '', deporte: '' });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setSaving(false); }
  }

  async function handleEdit(id: string) {
    if (!editForm.clubName.trim()) return;
    const token = await getToken();
    const trialDays = editForm.trialDays !== '' ? parseInt(editForm.trialDays) : undefined;
    await apiFetch(`/superadmin/clubs/${id}`, {
      method: 'PATCH', token,
      body: JSON.stringify({
        name:       editForm.clubName,
        deporte:    editForm.deporte || null,
        adminName:  editForm.adminName || undefined,
        adminEmail: editForm.adminEmail || undefined,
        adminPhone: editForm.adminPhone || '',
        ...(trialDays !== undefined ? { trialDays } : {}),
      }),
    });
    setEditId(null);
    await load();
  }

  async function handleSetTrial(id: string, days: number) {
    const token = await getToken();
    await apiFetch(`/superadmin/clubs/${id}`, {
      method: 'PATCH', token,
      body: JSON.stringify({ trialDays: days }),
    });
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
              fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
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
              <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: '#1A1028', fontFamily: 'inherit' }}>
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
              <div style={{ marginBottom: 10 }}>
                <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Teléfono del admin <span style={{ textTransform: 'none', fontWeight: 400 }}>(opcional)</span>
                </p>
                <PhoneInput
                  value={newForm.adminPhone}
                  onChange={v => setNewForm(f => ({ ...f, adminPhone: v }))}
                  placeholder="300 000 0000"
                />
              </div>
              <div style={{ marginBottom: 10 }}>
                <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Deporte principal
                </p>
                <SportSelect
                  value={newForm.deporte}
                  onChange={v => setNewForm(f => ({ ...f, deporte: v }))}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <motion.button
                  onClick={() => { setShowNew(false); setNewForm({ clubName: '', adminEmail: '', adminName: '', adminPhone: '', deporte: '' }); }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.12 }}
                  style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: '1.5px solid rgba(120,80,200,0.15)', background: 'transparent', color: '#8E87A8', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Cancelar
                </motion.button>
                <motion.button
                  onClick={handleCreate}
                  disabled={saving || !newForm.clubName || !newForm.adminEmail || !newForm.adminName}
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.12 }}
                  style={{ flex: 2, padding: '11px 0', borderRadius: 12, border: 'none', background: saving ? '#A855F7' : '#7C3AED', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 3px 14px rgba(124,58,237,0.28)', opacity: (!newForm.clubName || !newForm.adminEmail || !newForm.adminName) ? 0.6 : 1 }}
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
          <motion.div variants={stagger} initial="hidden" animate="show"
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
            {clubs.map(club => (
              <motion.div
                key={club.id}
                variants={cardVariant}
                style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', borderRadius: 20, padding: '14px 14px 12px', gridColumn: editId === club.id ? '1 / -1' : undefined }}
              >
                {/* Formulario de edición completo */}
                {editId === club.id ? (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, ease: EASE }}
                    style={{ marginBottom: 12 }}
                  >
                    <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 700, color: '#7C3AED', fontFamily: 'inherit' }}>
                      Editar club
                    </p>
                    {[
                      { label: 'Nombre del club',  key: 'clubName',   type: 'text',  placeholder: 'Ej: Club Patinaje Norte' },
                      { label: 'Nombre del admin', key: 'adminName',  type: 'text',  placeholder: 'Nombre completo' },
                      { label: 'Email del admin',  key: 'adminEmail', type: 'email', placeholder: 'admin@ejemplo.com' },
                    ].map(({ label, key, type, placeholder }) => (
                      <div key={key} style={{ marginBottom: 8 }}>
                        <p style={{ margin: '0 0 3px', fontSize: 9, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {label}
                        </p>
                        <input
                          type={type}
                          placeholder={placeholder}
                          value={(editForm as Record<string, string>)[key]}
                          onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                          style={inp}
                          autoFocus={key === 'clubName'}
                        />
                      </div>
                    ))}
                    <div style={{ marginBottom: 8 }}>
                      <p style={{ margin: '0 0 3px', fontSize: 9, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Teléfono del admin <span style={{ textTransform: 'none', fontWeight: 400 }}>(opcional)</span>
                      </p>
                      <PhoneInput
                        value={editForm.adminPhone}
                        onChange={v => setEditForm(f => ({ ...f, adminPhone: v }))}
                        placeholder="300 000 0000"
                      />
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <p style={{ margin: '0 0 3px', fontSize: 9, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Deporte principal
                      </p>
                      <SportSelect
                        value={editForm.deporte}
                        onChange={v => setEditForm(f => ({ ...f, deporte: v }))}
                        placeholder="Sin especificar"
                      />
                    </div>
                    {/* Período de prueba */}
                    <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,183,3,0.07)', border: '1px solid rgba(255,183,3,0.20)' }}>
                      <p style={{ margin: '0 0 6px', fontSize: 9, fontWeight: 700, color: '#B88A00', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Período de prueba
                      </p>
                      {/* Estado actual */}
                      {(() => {
                        if (!club.trialEndsAt) return (
                          <p style={{ margin: '0 0 8px', fontSize: 11, color: '#8E87A8' }}>Sin período de prueba asignado</p>
                        );
                        const ends = new Date(club.trialEndsAt);
                        const expired = ends < now;
                        const daysLeft = expired ? 0 : Math.ceil((ends.getTime() - now.getTime()) / 86_400_000);
                        return (
                          <p style={{ margin: '0 0 8px', fontSize: 11, color: expired ? '#EF476F' : '#B88A00', fontWeight: 600 }}>
                            {expired ? `Vencido el ${ends.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}` : `${daysLeft} días restantes (vence ${ends.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })})`}
                          </p>
                        );
                      })()}
                      {/* Acciones rápidas */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {[15, 30, 60].map(d => (
                          <motion.button key={d}
                            onClick={() => setEditForm(f => ({ ...f, trialDays: String(d) }))}
                            whileTap={{ scale: 0.95 }} transition={{ duration: 0.1 }}
                            style={{ padding: '4px 10px', borderRadius: 99, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: editForm.trialDays === String(d) ? 'none' : '1px solid rgba(255,183,3,0.30)', background: editForm.trialDays === String(d) ? '#FFB703' : 'transparent', color: editForm.trialDays === String(d) ? '#fff' : '#B88A00', fontFamily: 'inherit' }}>
                            +{d} días
                          </motion.button>
                        ))}
                        <motion.button
                          onClick={() => setEditForm(f => ({ ...f, trialDays: '0' }))}
                          whileTap={{ scale: 0.95 }} transition={{ duration: 0.1 }}
                          style={{ padding: '4px 10px', borderRadius: 99, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: editForm.trialDays === '0' ? 'none' : '1px solid rgba(239,71,111,0.25)', background: editForm.trialDays === '0' ? '#EF476F' : 'transparent', color: editForm.trialDays === '0' ? '#fff' : '#EF476F', fontFamily: 'inherit' }}>
                          Limpiar trial
                        </motion.button>
                      </div>
                      {editForm.trialDays && editForm.trialDays !== '' && (
                        <p style={{ margin: '6px 0 0', fontSize: 10, color: '#8E87A8' }}>
                          {editForm.trialDays === '0'
                            ? 'Se eliminará el período de prueba al guardar'
                            : `Se asignarán ${editForm.trialDays} días desde hoy al guardar`
                          }
                        </p>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <motion.button onClick={() => setEditId(null)}
                        whileTap={{ scale: 0.97 }} transition={{ duration: 0.12 }}
                        style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: '1.5px solid rgba(120,80,200,0.15)', background: 'transparent', color: '#8E87A8', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Cancelar
                      </motion.button>
                      <motion.button onClick={() => handleEdit(club.id)}
                        disabled={!editForm.clubName.trim()}
                        whileTap={{ scale: 0.97 }} transition={{ duration: 0.12 }}
                        style={{ flex: 2, padding: '10px 0', borderRadius: 12, border: 'none', background: '#7C3AED', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 3px 14px rgba(124,58,237,0.28)', opacity: !editForm.clubName.trim() ? 0.6 : 1 }}>
                        Guardar cambios
                      </motion.button>
                    </div>
                  </motion.div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                    {/* Identidad */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(124,58,237,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#7C3AED', fontFamily: 'inherit', flexShrink: 0, overflow: 'hidden' }}>
                        {club.logoUrl
                          ? <img src={club.logoUrl} alt={club.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : club.name.charAt(0).toUpperCase()
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1A1028', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {club.name}
                          </p>
                          <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: club.active ? 'rgba(6,214,160,0.12)' : 'rgba(239,71,111,0.12)', color: club.active ? '#06D6A0' : '#EF476F' }}>
                            {club.active ? 'Activo' : 'Inactivo'}
                          </span>
                          {/* Badge de plan / trial */}
                          {(() => {
                            if (club.suscripcion) {
                              const planLabel: Record<string, string> = { MENSUAL: 'Mensual', TRIMESTRAL: 'Trimestral', ANUAL: 'Anual' };
                              const planColor: Record<string, { color: string; bg: string }> = {
                                MENSUAL:    { color: '#7C3AED', bg: 'rgba(124,58,237,0.12)' },
                                TRIMESTRAL: { color: '#4361EE', bg: 'rgba(67,97,238,0.12)'  },
                                ANUAL:      { color: '#06D6A0', bg: 'rgba(6,214,160,0.12)'  },
                              };
                              const pc = planColor[club.suscripcion.tipoPlan] ?? planColor.MENSUAL;
                              return (
                                <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: pc.bg, color: pc.color }}>
                                  {planLabel[club.suscripcion.tipoPlan] ?? club.suscripcion.tipoPlan}
                                </span>
                              );
                            }
                            if (club.trialEndsAt) {
                              const ends = new Date(club.trialEndsAt);
                              const expired = ends < now;
                              const daysLeft = expired ? 0 : Math.ceil((ends.getTime() - now.getTime()) / 86_400_000);
                              return (
                                <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: expired ? 'rgba(239,71,111,0.12)' : 'rgba(255,183,3,0.14)', color: expired ? '#EF476F' : '#B88A00' }}>
                                  {expired ? 'Prueba vencida' : `Prueba · ${daysLeft}d`}
                                </span>
                              );
                            }
                            return (
                              <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: 'rgba(142,135,168,0.12)', color: '#8E87A8' }}>
                                Sin plan
                              </span>
                            );
                          })()}
                        </div>
                        <p style={{ margin: 0, fontSize: 11, color: '#8E87A8' }}>
                          {club._count.members} miembro{club._count.members !== 1 ? 's' : ''}{club.deporte ? ` · ${club.deporte}` : ''}{club.users[0] ? ` · ${club.users[0].name}` : ''}
                        </p>
                        {/* Fecha de creación */}
                        <p style={{ margin: '3px 0 0', fontSize: 10, color: '#C4BFD8' }}>
                          Creado {new Date(club.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {club.suscripcion && (() => {
                            const planLabel: Record<string, string> = { MENSUAL: 'Mensual', TRIMESTRAL: 'Trimestral', ANUAL: 'Anual' };
                            return ` · Plan ${planLabel[club.suscripcion!.tipoPlan] ?? club.suscripcion!.tipoPlan}`;
                          })()}
                        </p>
                      </div>
                    </div>
                    {/* Editar */}
                    <motion.button
                      onClick={async () => {
                        // Cargar el admin actual para pre-popular el formulario
                        const token = await getToken();
                        const res = await apiFetch<{ members: Member[] }>(`/superadmin/clubs/${club.id}/miembros`, { token });
                        const admin = res.members.find(m => m.role === 'ADMIN');
                        setEditForm({
                          clubName:   club.name,
                          adminName:  admin?.fullName ?? '',
                          adminEmail: admin?.email ?? '',
                          adminPhone: admin?.phone ?? '',
                          deporte:    club.deporte ?? '',
                          trialDays:  '',
                        });
                        setEditId(club.id);
                      }}
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
                    style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: `1px solid ${membersClubId === club.id ? 'rgba(124,58,237,0.40)' : 'rgba(124,58,237,0.18)'}`, background: membersClubId === club.id ? 'rgba(124,58,237,0.10)' : 'transparent', color: '#7C3AED', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
                  >
                    {membersClubId === club.id ? 'Cerrar' : 'Miembros'}
                  </motion.button>
                  <motion.button
                    onClick={() => handleToggle(club.id)}
                    whileTap={{ scale: 0.96 }} transition={{ duration: 0.12, ease: EASE }}
                    style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: `1px solid ${club.active ? 'rgba(255,183,3,0.28)' : 'rgba(6,214,160,0.28)'}`, background: club.active ? 'rgba(255,183,3,0.07)' : 'rgba(6,214,160,0.07)', color: club.active ? '#FFB703' : '#06D6A0', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
                  >
                    {club.active ? 'Desactivar' : 'Activar'}
                  </motion.button>
                  {/* WhatsApp recordatorio */}
                  <motion.a
                    href={getWhatsAppUrl(club)}
                    target="_blank"
                    rel="noopener noreferrer"
                    whileTap={{ scale: 0.88 }} transition={{ duration: 0.12, ease: EASE }}
                    style={{ width: 36, borderRadius: 10, border: '1px solid rgba(37,211,102,0.30)', background: 'rgba(37,211,102,0.08)', color: '#25D366', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
                  >
                    <MessageCircle size={14} />
                  </motion.a>
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
                          style={{ padding: '4px 10px', borderRadius: 8, background: showAddMember ? 'rgba(239,71,111,0.10)' : '#7C3AED', border: showAddMember ? '1px solid rgba(239,71,111,0.25)' : 'none', color: showAddMember ? '#EF476F' : '#fff', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
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
                                style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: '1.5px solid rgba(120,80,200,0.15)', background: 'transparent', color: '#8E87A8', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                              >
                                Cancelar
                              </motion.button>
                              <motion.button
                                onClick={() => handleAddMember(club.id)}
                                disabled={memberSaving || !memberForm.fullName || !memberForm.email}
                                whileTap={{ scale: 0.97 }} transition={{ duration: 0.12 }}
                                style={{ flex: 2, padding: '9px 0', borderRadius: 10, border: 'none', background: memberSaving ? '#A855F7' : '#7C3AED', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 2px 10px rgba(124,58,237,0.25)' }}
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
                            <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0, background: m.role === 'ADMIN' ? 'linear-gradient(135deg,#FFB703,#FB8500)' : 'linear-gradient(135deg,#06D6A0,#0CB68D)' }}>
                              {m.fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#1A1028', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.fullName}</p>
                              <p style={{ margin: 0, fontSize: 10, color: '#8E87A8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</p>
                            </div>
                            {/* Toggle de rol — sin native select */}
                            <RoleToggle value={m.role} onChange={r => handleChangeRole(club.id, m.id, r)} />
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
