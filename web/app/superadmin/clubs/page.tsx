'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { useNow } from '@/lib/use-now';
import { PhoneInput } from '@/components/ui/phone-input';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { ChevronRight, LayoutGrid, Table2 } from 'lucide-react';
import ClubDetail, { type Club, type Suscripcion } from './club-detail';
import SportSelect from './sport-select';

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

// ── Input base ────────────────────────────────────────────────────────────────
const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  border: '1.5px solid rgba(120,80,200,0.18)',
  background: '#fff', color: '#1A1028', fontSize: 13, outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit',
};

// ── Badge de plan/prueba ────────────────────────────────────────────────────
// Prioridad: trialEndsAt es la fuente de verdad de "sigue en prueba, sin plan
// pagado real" — un club puede tener un tipoPlan SELECCIONADO (vía "Elegir este
// plan") sin haber pagado nunca. Solo cuando el pago se confirma se limpia
// trialEndsAt (ver activarClubTrasPago), así que null ahí sí significa plan pagado.
function planBadge(club: Club, now: Date) {
  if (club.trialEndsAt) {
    const ends = new Date(club.trialEndsAt);
    const expired = ends < now;
    const daysLeft = expired ? 0 : Math.ceil((ends.getTime() - now.getTime()) / 86_400_000);
    return expired
      ? { label: 'Prueba vencida', color: '#EF476F', bg: 'rgba(239,71,111,0.12)' }
      : { label: `Prueba · ${daysLeft}d`, color: '#B88A00', bg: 'rgba(255,183,3,0.14)' };
  }
  if (club.suscripcion) {
    const planLabel: Record<string, string> = { MENSUAL: 'Mensual', TRIMESTRAL: 'Trimestral', ANUAL: 'Anual' };
    const planColor: Record<string, { color: string; bg: string }> = {
      MENSUAL:    { color: '#7C3AED', bg: 'rgba(124,58,237,0.12)' },
      TRIMESTRAL: { color: '#4361EE', bg: 'rgba(67,97,238,0.12)'  },
      ANUAL:      { color: '#06D6A0', bg: 'rgba(6,214,160,0.12)'  },
    };
    const pc = planColor[club.suscripcion.tipoPlan] ?? planColor.MENSUAL;
    return { label: planLabel[club.suscripcion.tipoPlan] ?? club.suscripcion.tipoPlan, ...pc };
  }
  return { label: 'Sin plan', color: '#8E87A8', bg: 'rgba(142,135,168,0.12)' };
}

function verificationBadge(club: Club) {
  if (club.verificationStatus === 'PENDING') {
    return { label: club.nameFlagged ? 'Revisar nombre' : 'Por verificar', color: '#B88A00', bg: 'rgba(255,183,3,0.16)' };
  }
  if (club.verificationStatus === 'REJECTED') {
    return { label: 'Rechazado', color: '#EF476F', bg: 'rgba(239,71,111,0.12)' };
  }
  return { label: 'Verificado', color: '#06D6A0', bg: 'rgba(6,214,160,0.12)' };
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function ClubsPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  // Hora viva: re-renderiza cada 30s para que los días de prueba se descuenten
  const now = useNow(30_000);

  const [clubs,   setClubs]   = useState<Club[]>([]);
  const [susMap,  setSusMap]  = useState<Record<string, Suscripcion | null>>({});
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [view, setView] = useState<'table' | 'cards'>('table');

  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ clubName: '', adminEmail: '', adminName: '', adminPhone: '', deporte: '' });
  const [saving,  setSaving]  = useState(false);

  async function load(silent = false) {
    try {
      const token = await getToken();
      const [clubsRes, susRes] = await Promise.all([
        apiFetch<{ clubs: Club[] }>('/superadmin/clubs', { token }),
        apiFetch<{ clubs: { id: string; suscripcion: Suscripcion | null }[] }>('/superadmin/suscripciones', { token }),
      ]);
      setClubs(clubsRes.clubs);
      const map: Record<string, Suscripcion | null> = {};
      for (const c of susRes.clubs) map[c.id] = c.suscripcion;
      setSusMap(map);
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : 'Error al cargar clubs');
    } finally { setLoading(false); }
  }

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { router.push('/sign-in'); return; }
    load();
    // Refresco silencioso en tiempo real — sin spinner ni parpadeo, para que
    // clubes auto-registrados o verificados por otro superadmin aparezcan solos.
    const interval = setInterval(() => load(true), 15_000);
    return () => clearInterval(interval);
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

  // ── Vista de detalle ──────────────────────────────────────────────────────
  const detailClub = detailId ? clubs.find(c => c.id === detailId) : null;
  if (detailClub) {
    return (
      <div style={{ background: '#F7F7FB', minHeight: '100%' }}>
        <div style={{ padding: '12px 16px 80px', maxWidth: 1100, margin: '0 auto' }}>
          <ClubDetail
            club={detailClub}
            suscripcion={susMap[detailClub.id] ?? null}
            onBack={() => setDetailId(null)}
            onReload={load}
            onDeleted={() => { setDetailId(null); load(); }}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#F7F7FB', minHeight: '100%' }}>
      <div style={{ padding: '12px 16px 80px' }}>

        {/* Header: contador + toggle vista + botón nuevo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
          <p style={{ margin: 0, fontSize: 12, color: '#8E87A8', fontWeight: 500 }}>
            {clubs.length} club{clubs.length !== 1 ? 's' : ''} registrado{clubs.length !== 1 ? 's' : ''}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', background: '#fff', border: '1px solid rgba(120,80,200,0.14)', borderRadius: 10, padding: 2 }}>
              <button onClick={() => setView('table')} title="Vista de tabla"
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', background: view === 'table' ? 'rgba(124,58,237,0.10)' : 'transparent', color: view === 'table' ? '#7C3AED' : '#8E87A8' }}>
                <Table2 size={13} /> Tabla
              </button>
              <button onClick={() => setView('cards')} title="Vista de tarjetas"
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', background: view === 'cards' ? 'rgba(124,58,237,0.10)' : 'transparent', color: view === 'cards' ? '#7C3AED' : '#8E87A8' }}>
                <LayoutGrid size={13} /> Tarjetas
              </button>
            </div>
          <motion.button
            onClick={() => setShowNew(v => !v)}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.12, ease: EASE }}
            style={{
              background: showNew ? 'rgba(239,71,111,0.10)' : '#7C3AED',
              border: showNew ? '1.5px solid rgba(239,71,111,0.25)' : 'none',
              borderRadius: 12, padding: '7px 16px', cursor: 'pointer',
              color: showNew ? '#EF476F' : '#fff',
              fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
              transition: 'background 0.18s, color 0.18s',
            }}
          >
            {showNew ? '✕ Cancelar' : '+ Nuevo club'}
          </motion.button>
          </div>
        </div>

        {error && <p style={{ fontSize: 12, color: '#EF476F', marginBottom: 8 }}>{error}</p>}

        {/* Formulario nuevo club */}
        <AnimatePresence>
          {showNew && (
            <motion.div key="new-form" variants={expandY} initial="hidden" animate="show" exit="exit"
              style={{ background: '#fff', border: '1.5px solid rgba(124,58,237,0.25)', borderRadius: 20, padding: '16px 14px', marginBottom: 12 }}>
              <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 600, color: '#1A1028', fontFamily: 'inherit' }}>Nuevo club</p>
              {[
                { label: 'Nombre del club',  key: 'clubName',   type: 'text',  placeholder: 'Ej: Club Patinaje Norte' },
                { label: 'Nombre del admin', key: 'adminName',  type: 'text',  placeholder: 'Nombre completo' },
                { label: 'Email del admin',  key: 'adminEmail', type: 'email', placeholder: 'admin@ejemplo.com' },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key} style={{ marginBottom: 10 }}>
                  <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
                  <input type={type} placeholder={placeholder} value={(newForm as Record<string, string>)[key]}
                    onChange={e => setNewForm(f => ({ ...f, [key]: e.target.value }))} style={inp} />
                </div>
              ))}
              <div style={{ marginBottom: 10 }}>
                <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Teléfono del admin <span style={{ textTransform: 'none', fontWeight: 400 }}>(opcional)</span>
                </p>
                <PhoneInput value={newForm.adminPhone} onChange={v => setNewForm(f => ({ ...f, adminPhone: v }))} placeholder="300 000 0000" />
              </div>
              <div style={{ marginBottom: 10 }}>
                <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Deporte principal</p>
                <SportSelect value={newForm.deporte} onChange={v => setNewForm(f => ({ ...f, deporte: v }))} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <motion.button onClick={() => { setShowNew(false); setNewForm({ clubName: '', adminEmail: '', adminName: '', adminPhone: '', deporte: '' }); }}
                  whileTap={{ scale: 0.97 }} transition={{ duration: 0.12 }}
                  style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: '1.5px solid rgba(120,80,200,0.15)', background: 'transparent', color: '#8E87A8', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Cancelar
                </motion.button>
                <motion.button onClick={handleCreate} disabled={saving || !newForm.clubName || !newForm.adminEmail || !newForm.adminName}
                  whileTap={{ scale: 0.97 }} transition={{ duration: 0.12 }}
                  style={{ flex: 2, padding: '11px 0', borderRadius: 12, border: 'none', background: saving ? '#A855F7' : '#7C3AED', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 3px 14px rgba(124,58,237,0.28)', opacity: (!newForm.clubName || !newForm.adminEmail || !newForm.adminName) ? 0.6 : 1 }}>
                  {saving ? 'Creando...' : 'Crear club'}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Lista */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160 }}>
            <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#7C3AED', borderTopColor: 'transparent' }} />
          </div>
        ) : clubs.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: EASE }}
            style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', borderRadius: 20, padding: '40px 16px', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(124,58,237,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#8E87A8' }}>Sin clubs registrados</p>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#C4BFD8' }}>Crea el primero con el botón de arriba</p>
          </motion.div>
        ) : view === 'table' ? (
          <motion.div variants={cardVariant} initial="hidden" animate="show"
            style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'inherit', minWidth: 720 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(120,80,200,0.10)' }}>
                    {['Club', 'Estado', 'Plan', 'Verificación', 'Miembros', 'Deporte', 'Creado'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                    <th style={{ width: 32 }} />
                  </tr>
                </thead>
                <tbody>
                  {clubs.map(club => {
                    const badge = planBadge(club, now);
                    const verif = verificationBadge(club);
                    return (
                      <tr key={club.id} onClick={() => setDetailId(club.id)}
                        style={{ borderBottom: '1px solid rgba(120,80,200,0.06)', cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(124,58,237,0.03)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(124,58,237,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#7C3AED', flexShrink: 0, overflow: 'hidden' }}>
                              {club.logoUrl
                                ? <img src={club.logoUrl} alt={club.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : club.name.charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1028', whiteSpace: 'nowrap' }}>{club.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 99, whiteSpace: 'nowrap', background: club.active ? 'rgba(6,214,160,0.12)' : 'rgba(239,71,111,0.12)', color: club.active ? '#06D6A0' : '#EF476F' }}>
                            {club.active ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 99, whiteSpace: 'nowrap', background: badge.bg, color: badge.color }}>{badge.label}</span>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 99, whiteSpace: 'nowrap', background: verif.bg, color: verif.color }}>{verif.label}</span>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: '#1A1028' }}>{club._count.members}</td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: '#8E87A8', whiteSpace: 'nowrap' }}>{club.deporte || '—'}</td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: '#8E87A8', whiteSpace: 'nowrap' }}>
                          {new Date(club.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <ChevronRight size={15} color="#C4BFD8" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
            {clubs.map(club => {
              const badge = planBadge(club, now);
              const verif = verificationBadge(club);

              return (
                <motion.button
                  key={club.id}
                  variants={cardVariant}
                  onClick={() => setDetailId(club.id)}
                  whileHover={{ y: -2, boxShadow: '0 10px 28px rgba(124,58,237,0.10)' }}
                  whileTap={{ scale: 0.99 }}
                  transition={{ duration: 0.2, ease: EASE }}
                  style={{ textAlign: 'left', background: '#fff', border: '1px solid rgba(120,80,200,0.10)', borderRadius: 20, padding: '14px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}
                >
                  {/* Logo */}
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(124,58,237,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#7C3AED', fontFamily: 'inherit', flexShrink: 0, overflow: 'hidden' }}>
                    {club.logoUrl
                      ? <img src={club.logoUrl} alt={club.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : club.name.charAt(0).toUpperCase()}
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: '0 0 5px', fontSize: 14, fontWeight: 600, color: '#1A1028', lineHeight: 1.25, wordBreak: 'break-word' }}>{club.name}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: club.active ? 'rgba(6,214,160,0.12)' : 'rgba(239,71,111,0.12)', color: club.active ? '#06D6A0' : '#EF476F' }}>
                        {club.active ? 'Activo' : 'Inactivo'}
                      </span>
                      <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: badge.bg, color: badge.color }}>{badge.label}</span>
                      {club.verificationStatus !== 'VERIFIED' && (
                        <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: verif.bg, color: verif.color }}>{verif.label}</span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: 11, color: '#8E87A8' }}>
                      {club._count.members} miembro{club._count.members !== 1 ? 's' : ''}{club.deporte ? ` · ${club.deporte}` : ''}
                    </p>
                  </div>
                  {/* Chevron */}
                  <ChevronRight size={18} color="#C4BFD8" style={{ flexShrink: 0 }} />
                </motion.button>
              );
            })}
          </motion.div>
        )}

      </div>
    </div>
  );
}
