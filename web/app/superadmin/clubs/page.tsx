'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { useNow } from '@/lib/use-now';
import { PhoneInput } from '@/components/ui/phone-input';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { ChevronRight, ChevronDown, Check, LayoutGrid, Table2, Search } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
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

// ── Estilos de encabezados de tabla ──────────────────────────────────────────
const thText: React.CSSProperties = {
  textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 600,
  color: '#8E87A8', whiteSpace: 'nowrap',
};
const thFilter: React.CSSProperties = {
  textAlign: 'left', padding: '7px 8px', whiteSpace: 'nowrap',
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

// Categoría de plan para el filtro (misma prioridad que planBadge, sin formato visual)
type PlanCategory = 'PRUEBA' | 'MENSUAL' | 'TRIMESTRAL' | 'ANUAL' | 'SIN_PLAN';
function planCategory(club: Club): PlanCategory {
  if (club.trialEndsAt) return 'PRUEBA';
  if (club.suscripcion) return (club.suscripcion.tipoPlan as PlanCategory) ?? 'SIN_PLAN';
  return 'SIN_PLAN';
}
const PLAN_FILTER_LABEL: Record<PlanCategory, string> = {
  PRUEBA: 'Prueba', MENSUAL: 'Mensual', TRIMESTRAL: 'Trimestral', ANUAL: 'Anual', SIN_PLAN: 'Sin plan',
};

// Dropdown estilizado (Select de la app: portal + animación + hover de marca),
// con trigger compacto tipo pill consistente con el resto del panel.
function FilterSelect({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder: string;
}) {
  const selected = options.find(o => o.value === value);
  return (
    <Select value={value} onValueChange={v => onChange(v ?? 'ALL')}>
      {/* El trigger siempre muestra el nombre del filtro (como Estado); la
          selección aparece como badge morado al lado. */}
      <SelectTrigger
        className="rounded-[10px] bg-white gap-1"
        style={{ height: 30, minHeight: 30, border: `1px solid ${selected ? 'rgba(124,58,237,0.35)' : 'rgba(120,80,200,0.16)'}`, padding: '0 8px 0 10px', fontSize: 11, fontWeight: 600, boxSizing: 'border-box' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1A1028' }}>
          {placeholder}
          {selected && (
            <span style={{ fontSize: 9, fontWeight: 700, color: '#7C3AED', background: 'rgba(124,58,237,0.10)', borderRadius: 99, padding: '1px 6px', whiteSpace: 'nowrap' }}>
              {selected.label}
            </span>
          )}
        </span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL">Todos</SelectItem>
        {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

// Filtro de Estado tipo Vercel (puntos de color apilados + contador + panel
// multi-selección). El panel va en portal con posición fija porque la tarjeta
// contenedora tiene overflow hidden (ver memoria dropdown-overflow-recortado).
const ESTADO_OPTS = [
  { value: 'ACTIVE',   label: 'Activos',   dot: '#06D6A0' },
  { value: 'INACTIVE', label: 'Inactivos', dot: '#EF476F' },
];

function EstadoFilterDropdown({ selected, onChange, counts }: {
  selected: string[];               // [] = todos
  onChange: (v: string[]) => void;
  counts: Record<string, number>;   // { ACTIVE, INACTIVE, ALL }
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const activeDots = selected.length === 0 ? ESTADO_OPTS : ESTADO_OPTS.filter(o => selected.includes(o.value));

  function toggleOpen() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      // Clamp al viewport para que no se salga por la derecha
      const left = Math.min(r.left, window.innerWidth - 190);
      setPos({ top: r.bottom + 6, left: Math.max(8, left) });
    }
    setOpen(v => !v);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  function toggleValue(v: string) {
    onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]);
  }

  return (
    <>
      <button ref={btnRef} onClick={toggleOpen}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, height: 30, padding: '0 8px 0 10px', boxSizing: 'border-box',
          borderRadius: 10, border: `1px solid ${selected.length > 0 ? 'rgba(124,58,237,0.35)' : 'rgba(120,80,200,0.16)'}`,
          background: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
          color: '#1A1028', whiteSpace: 'nowrap',
        }}>
        {/* Puntos de color apilados */}
        <span style={{ display: 'flex', alignItems: 'center' }}>
          {activeDots.map((o, i) => (
            <span key={o.value} style={{
              width: 9, height: 9, borderRadius: '50%', background: o.dot,
              border: '1.5px solid #fff', marginLeft: i > 0 ? -3 : 0,
            }} />
          ))}
        </span>
        Estado
        <span style={{
          fontSize: 9, fontWeight: 700, color: '#7C3AED', background: 'rgba(124,58,237,0.10)',
          borderRadius: 99, padding: '1px 6px',
        }}>
          {selected.length === 0 ? ESTADO_OPTS.length : selected.length}/{ESTADO_OPTS.length}
        </span>
        <ChevronDown size={12} color="#8E87A8" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s' }} />
      </button>

      {open && pos && typeof document !== 'undefined' && createPortal(
        <div ref={panelRef}
          style={{
            position: 'fixed', top: pos.top, left: pos.left, zIndex: 70, width: 180,
            background: '#fff', border: '1px solid rgba(120,80,200,0.16)', borderRadius: 12,
            boxShadow: '0 10px 32px rgba(26,16,40,0.14)', padding: 4, fontFamily: 'inherit',
          }}>
          {ESTADO_OPTS.map(o => {
            const checked = selected.includes(o.value);
            return (
              <button key={o.value} onClick={() => toggleValue(o.value)}
                className="hover:bg-[rgba(124,58,237,0.06)]"
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 8px',
                  borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer',
                  fontSize: 11, fontWeight: 600, fontFamily: 'inherit', color: '#1A1028', textAlign: 'left',
                }}>
                <span style={{
                  width: 14, height: 14, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: checked ? '#7C3AED' : 'transparent',
                  border: checked ? '1px solid #7C3AED' : '1px solid rgba(120,80,200,0.30)', flexShrink: 0,
                }}>
                  {checked && <Check size={10} color="#fff" strokeWidth={3} />}
                </span>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: o.dot, flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{o.label}</span>
                <span style={{ fontSize: 10, color: '#8E87A8', fontWeight: 500 }}>{counts[o.value] ?? 0}</span>
              </button>
            );
          })}
          <div style={{ height: 1, background: 'rgba(120,80,200,0.10)', margin: '4px 4px' }} />
          <button onClick={() => { onChange([]); setOpen(false); }}
            className="hover:bg-[rgba(124,58,237,0.06)]"
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 8px',
              borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
              color: selected.length === 0 ? '#7C3AED' : '#8E87A8', textAlign: 'left',
            }}>
            <span style={{ flex: 1 }}>Mostrar todos</span>
            <span style={{ fontSize: 10, color: '#8E87A8', fontWeight: 500 }}>{counts.ALL ?? 0}</span>
          </button>
        </div>,
        document.body
      )}
    </>
  );
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

  // Filtros de columnas + búsqueda por nombre
  const [filterEstado, setFilterEstado] = useState<string[]>([]); // [] = todos
  const [filterPlan,   setFilterPlan]   = useState('ALL');
  const [filterVerif,  setFilterVerif]  = useState('ALL');
  const [filterDeporte, setFilterDeporte] = useState('ALL');
  const [search, setSearch] = useState('');

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

  // Opciones de deporte disponibles, derivadas de los clubes cargados
  const deporteOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of clubs) if (c.deporte) set.add(c.deporte);
    return Array.from(set).sort().map(d => ({ value: d, label: d }));
  }, [clubs]);

  const filteredClubs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clubs.filter(c => {
      if (q && !c.name.toLowerCase().includes(q)) return false;
      if (filterEstado.length > 0 && !filterEstado.includes(c.active ? 'ACTIVE' : 'INACTIVE')) return false;
      if (filterPlan !== 'ALL' && planCategory(c) !== filterPlan) return false;
      if (filterVerif !== 'ALL' && (c.verificationStatus ?? 'VERIFIED') !== filterVerif) return false;
      if (filterDeporte !== 'ALL' && c.deporte !== filterDeporte) return false;
      return true;
    });
  }, [clubs, search, filterEstado, filterPlan, filterVerif, filterDeporte]);

  // Conteos para el panel del filtro de Estado
  const estadoCounts = useMemo(() => ({
    ACTIVE: clubs.filter(c => c.active).length,
    INACTIVE: clubs.filter(c => !c.active).length,
    ALL: clubs.length,
  }), [clubs]);

  const filtersActive = filterEstado.length > 0 || filterPlan !== 'ALL' || filterVerif !== 'ALL' || filterDeporte !== 'ALL' || search.trim() !== '';

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

  const clearFilters = () => { setFilterEstado([]); setFilterPlan('ALL'); setFilterVerif('ALL'); setFilterDeporte('ALL'); setSearch(''); };

  // Filtros unificados con los encabezados: cada dropdown ES el encabezado de su
  // columna en la vista de tabla. Se reutilizan como barra en la vista de tarjetas.
  const estadoFilter = <EstadoFilterDropdown selected={filterEstado} onChange={setFilterEstado} counts={estadoCounts} />;
  const planFilter = (
    <FilterSelect value={filterPlan} onChange={setFilterPlan} placeholder="Plan"
      options={(['PRUEBA', 'MENSUAL', 'TRIMESTRAL', 'ANUAL', 'SIN_PLAN'] as PlanCategory[]).map(p => ({ value: p, label: PLAN_FILTER_LABEL[p] }))} />
  );
  const verifFilter = (
    <FilterSelect value={filterVerif} onChange={setFilterVerif} placeholder="Verificación"
      options={[{ value: 'VERIFIED', label: 'Verificado' }, { value: 'PENDING', label: 'Por verificar' }, { value: 'REJECTED', label: 'Rechazado' }]} />
  );
  const deporteFilter = deporteOptions.length > 0
    ? <FilterSelect value={filterDeporte} onChange={setFilterDeporte} placeholder="Deporte" options={deporteOptions} />
    : null;

  // Barra superior: solo búsqueda (+ Limpiar). En tarjetas se agregan los dropdowns
  // porque ahí no hay encabezados de tabla.
  const filterBar = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 14px', borderBottom: '1px solid rgba(120,80,200,0.10)', background: '#fff' }}>
      <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 160, maxWidth: 260 }}>
        <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#8E87A8', pointerEvents: 'none' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar club..."
          style={{
            width: '100%', padding: '7px 10px 7px 28px', borderRadius: 10,
            border: '1px solid rgba(120,80,200,0.16)', background: '#fff', color: '#1A1028',
            fontSize: 11, fontWeight: 600, fontFamily: 'inherit', outline: 'none',
          }}
        />
      </div>
      {view === 'cards' && (
        <>
          {estadoFilter}
          {planFilter}
          {verifFilter}
          {deporteFilter}
        </>
      )}
      {filtersActive && (
        <button onClick={clearFilters}
          style={{ fontSize: 11, fontWeight: 600, color: '#7C3AED', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 4px' }}>
          Limpiar
        </button>
      )}
    </div>
  );

  return (
    <div style={{ background: '#F7F7FB', minHeight: '100%' }}>
      <div style={{ padding: '12px 16px 80px' }}>

        {/* Header: contador + toggle vista + botón nuevo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
          <p style={{ margin: 0, fontSize: 12, color: '#8E87A8', fontWeight: 500 }}>
            {filtersActive
              ? <>{filteredClubs.length} de {clubs.length} {clubs.length === 1 ? 'club' : 'clubes'}</>
              : <>{clubs.length} {clubs.length === 1 ? 'club' : 'clubes'} registrado{clubs.length !== 1 ? 's' : ''}</>
            }
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
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#8E87A8' }}>Sin clubes registrados</p>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#C4BFD8' }}>Crea el primero con el botón de arriba</p>
          </motion.div>
        ) : (
          <motion.div variants={cardVariant} initial="hidden" animate="show"
            style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', borderRadius: 16, overflow: 'hidden' }}>
            {filterBar}
            {filteredClubs.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#8E87A8' }}>Sin resultados con estos filtros</p>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: '#C4BFD8' }}>Prueba ajustando o limpiando los filtros</p>
            </div>
            ) : view === 'table' ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'inherit', minWidth: 720 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(120,80,200,0.10)' }}>
                    {/* Encabezados-filtro: el dropdown ES el encabezado de la columna */}
                    <th style={thText}>Club</th>
                    <th style={thFilter}>{estadoFilter}</th>
                    <th style={thFilter}>{planFilter}</th>
                    <th style={thFilter}>{verifFilter}</th>
                    <th style={thText}>Miembros</th>
                    <th style={thFilter}>{deporteFilter ?? <span style={{ fontSize: 11, fontWeight: 600, color: '#8E87A8' }}>Deporte</span>}</th>
                    <th style={thText}>Creado</th>
                    <th style={{ width: 32 }} />
                  </tr>
                </thead>
                <tbody>
                  {filteredClubs.map(club => {
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
            ) : (
            <motion.div variants={stagger} initial="hidden" animate="show"
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4"
              style={{ padding: 14, background: '#F7F7FB' }}>
            {filteredClubs.map(club => {
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
          </motion.div>
        )}

      </div>
    </div>
  );
}
