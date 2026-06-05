'use client';

import { useAuth } from '@clerk/nextjs';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { QK } from '@/hooks/useVeloQuery';
import { Users, MapPin, CheckCircle2, Search } from 'lucide-react';
const EASE_OUT: [number,number,number,number] = [0.23, 1, 0.32, 1];
import { MemberAvatar } from '@/components/ui/member-avatar';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { stagger, cardVariant } from '@/lib/page-animations';
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select';

interface Member {
  id: string;
  fullName: string;
  category?: string;
  tipo?: string;
  role: string;
  pictureUrl?: string | null;
  locations: { location: { id: string; name: string } }[];
}
interface Location { id: string; name: string }
interface AttRecord { memberId: string; status: Status }

type Status = 'PRESENT' | 'LATE' | 'ABSENT' | 'MEDICAL_EXCUSE';
const CYCLE: Status[] = ['PRESENT', 'LATE', 'ABSENT', 'MEDICAL_EXCUSE'];
const STATUS_LABEL: Record<Status, string> = { PRESENT: 'P', LATE: 'T', ABSENT: 'A', MEDICAL_EXCUSE: 'M' };
const STATUS_COLOR: Record<Status, string> = { PRESENT: '#06D6A0', LATE: '#FFB703', ABSENT: '#EF476F', MEDICAL_EXCUSE: '#8B8FA8' };
const STATUS_NAME: Record<Status, string>  = { PRESENT: 'Presente', LATE: 'Tarde', ABSENT: 'Ausente', MEDICAL_EXCUSE: 'Excusa Médica' };
const ROLE_BG: Record<string, string> = {
  COACH: 'linear-gradient(135deg,#06D6A0,#0CB68D)',
  ADMIN: 'linear-gradient(135deg,#FFB703,#FB8500)',
};

const DAY_NAMES   = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const DAY_LABELS  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function todayLabel() {
  return new Date().toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}
function avatarBg(role: string) { return ROLE_BG[role] ?? 'linear-gradient(135deg,#7C3AED,#A855F7)'; }

/** ISO strings para cada día de la semana actual (Dom→Sáb) */
function getWeekDates(): string[] {
  const today = new Date();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });
}

// ── WeekStrip ──────────────────────────────────────────────────────────────────
function WeekStrip({
  weekSaved,
  todayStr,
  animatingToday,
}: {
  weekSaved: Set<string>;
  todayStr: string;
  animatingToday: boolean;
}) {
  const weekDates = getWeekDates();
  const todayIdx  = weekDates.indexOf(todayStr);

  return (
    <div className="flex justify-between items-end px-1">
      {weekDates.map((date, i) => {
        const isToday   = date === todayStr;
        const isPast    = i < todayIdx;
        const isFuture  = i > todayIdx;
        const isSaved   = weekSaved.has(date);
        const isAnimating = isToday && animatingToday;

        // Visual state
        // Saved (past or today): filled dark circle with check
        // Today unsaved: ring accent (purple)
        // Past unsaved: ring light gray
        // Future: very light, no check

        let bgColor    = 'transparent';
        let ringColor  = 'rgba(0,0,0,0.10)';
        let checkColor = 'transparent';
        let opacity    = 1;

        if (isSaved) {
          bgColor    = '#1A1028';
          ringColor  = '#1A1028';
          checkColor = '#ffffff';
        } else if (isToday) {
          bgColor    = 'transparent';
          ringColor  = '#7C3AED';
          checkColor = 'transparent';
        } else if (isFuture) {
          bgColor    = 'transparent';
          ringColor  = 'rgba(0,0,0,0.08)';
          opacity    = 0.4;
        }

        return (
          <div key={date} className="flex flex-col items-center gap-1.5" style={{ opacity }}>
            <motion.div
              animate={isAnimating ? {
                scale: [1, 0.82, 1.12, 1],
                backgroundColor: ['transparent', '#1A1028', '#1A1028', '#1A1028'],
              } : {
                scale: 1,
                backgroundColor: bgColor,
              }}
              transition={isAnimating
                ? { duration: 0.55, times: [0, 0.25, 0.65, 1], ease: 'easeInOut' }
                : { duration: 0.3 }
              }
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{
                border: `2px solid ${ringColor}`,
                backgroundColor: bgColor,
              }}
            >
              <AnimatePresence>
                {isSaved && (
                  <motion.svg
                    key="check"
                    width="18" height="18" viewBox="0 0 18 18" fill="none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <motion.path
                      d="M4 9.5L7.5 13L14 6"
                      stroke={checkColor}
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.35, ease: 'easeOut', delay: isAnimating ? 0.28 : 0 }}
                    />
                  </motion.svg>
                )}
                {isToday && !isSaved && (
                  <motion.div
                    key="dot"
                    className="w-2 h-2 rounded-full"
                    style={{ background: '#7C3AED' }}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  />
                )}
              </AnimatePresence>
            </motion.div>
            <span
              className="text-[10px] font-semibold"
              style={{ color: isToday ? '#7C3AED' : '#8E87A8' }}
            >
              {DAY_LABELS[i]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function AsistenciaPage() {
  const { getToken } = useAuth();
  const reducedMotion = useReducedMotion();
  const [selectedLoc, setSelectedLoc] = useState<string>('');
  const [att, setAtt]                 = useState<Record<string, Status>>({});
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [role, setRole]               = useState('');
  const [noAttDays, setNoAttDays]     = useState<number[]>([]);

  // Week streak state
  const [animatingToday, setAnimating]  = useState(false);

  const todayDay = new Date().getDay();
  const isBlocked = noAttDays.includes(todayDay);
  const todayStr = todayISO();
  const queryClient = useQueryClient();

  // ── Week strip con caché ─────────────────────────────────────────────────────
  const weekDates = getWeekDates();
  const { data: weekSavedData } = useQuery({
    queryKey: ['weekSaved', weekDates[0]],
    queryFn: async () => {
      const token = await getToken();
      const results = await Promise.allSettled(
        weekDates.map(d => apiFetch<{ records: AttRecord[] }>(`/attendance?date=${d}`, { token }))
      );
      const saved = new Set<string>();
      results.forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value.records.length > 0) saved.add(weekDates[i]);
      });
      return saved;
    },
    staleTime: 5 * 60 * 1000,
  });
  const weekSaved = weekSavedData ?? new Set<string>();

  // ── Datos con caché ──────────────────────────────────────────────────────────
  const { data: locsData, isLoading: loadingLocs } = useQuery({
    queryKey: QK.locations(),
    queryFn: async () => { const token = await getToken(); return apiFetch<{ locations: Location[] }>('/locations', { token }); },
  });
  const { data: membersData, isLoading: loadingMembers } = useQuery({
    queryKey: QK.members(),
    queryFn: async () => { const token = await getToken(); return apiFetch<{ members: Member[] }>('/members', { token }); },
  });
  const { data: attData, isLoading: loadingAtt } = useQuery({
    queryKey: QK.attendance(todayStr),
    queryFn: async () => { const token = await getToken(); return apiFetch<{ records: AttRecord[] }>(`/attendance?date=${todayStr}`, { token }); },
    staleTime: 0,
  });

  const locations = locsData?.locations ?? [];
  const loading   = loadingLocs || loadingMembers || loadingAtt;

  useEffect(() => {
    if (locations.length > 0 && !selectedLoc) setSelectedLoc(locations[0].id);
  }, [locations, selectedLoc]);

  useEffect(() => {
    getToken().then(async token => {
      const [meRes, clubRes] = await Promise.all([
        apiFetch<{ status: string; user?: { role: string } }>('/me', { token }),
        apiFetch<{ club: { noAttendanceDays: number[] } }>('/clubs/settings', { token }).catch(() => null),
      ]);
      setRole(meRes.user?.role ?? '');
      setNoAttDays(clubRes?.club.noAttendanceDays ?? []);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedLoc || !membersData || !attData) return;
    const forLoc = membersData.members.filter(
      m => m.locations.some(l => l.location.id === selectedLoc)
    );
    const base = Object.fromEntries(forLoc.map(m => [m.id, 'PRESENT' as Status]));
    const existing: Record<string, Status> = {};
    for (const r of attData.records) existing[r.memberId] = r.status as Status;
    setAtt({ ...base, ...existing });
  }, [selectedLoc, membersData, attData]);

  const members = (membersData?.members ?? []).filter(
    m => m.locations.some(l => l.location.id === selectedLoc)
  );

  function toggle(id: string) {
    setAtt(prev => {
      const cur = prev[id] ?? 'ABSENT';
      return { ...prev, [id]: CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length] };
    });
  }

  async function handleSave() {
    if (!selectedLoc) return;
    setSaving(true); setSaved(false);
    try {
      const token = await getToken();
      await apiFetch('/attendance/bulk', {
        method: 'POST', token,
        body: JSON.stringify({
          date:       todayISO(),
          locationId: selectedLoc,
          records:    Object.entries(att).map(([memberId, status]) => ({ memberId, status })),
        }),
      });
      setSaved(true);
      // Marcar hoy como guardado + lanzar animación
      queryClient.setQueryData(['weekSaved', weekDates[0]], (old: Set<string> | undefined) => new Set([...(old ?? []), todayStr]));
      setAnimating(true);
      setTimeout(() => setAnimating(false), 800);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  const counts = CYCLE.map(s => ({ s, n: Object.values(att).filter(v => v === s).length }));
  const canManage = role === 'ADMIN' || role === 'COACH';

  const [search, setSearch]       = useState('');
  const [catFilter, setCatFilter] = useState<string>('TODOS');
  const categories = ['TODOS', ...Array.from(new Set(members.map(m => m.category).filter(Boolean) as string[])).sort()];
  const visibleMembers = members
    .filter(m => catFilter === 'TODOS' || m.category === catFilter)
    .filter(m => !search.trim() || m.fullName.toLowerCase().includes(search.toLowerCase().trim()));

  // "MAYORES" → "Mayores"
  function toLabel(cat: string) {
    if (cat === 'TODOS') return 'Todos';
    return cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
  }

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div className="px-5 py-3 bg-background border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-[17px] font-bold text-foreground" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            Asistencia
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 capitalize">{todayLabel()}</p>
        </div>
        {canManage && !isBlocked && members.length > 0 && (
          <motion.button
            onClick={handleSave}
            disabled={saving}
            whileTap={{ scale: 0.93 }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white cursor-pointer transition-colors"
            animate={{ background: saved ? '#06D6A0' : '#4361EE' }}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar'}</span>
          </motion.button>
        )}
      </div>

      <motion.div variants={stagger} initial="hidden" animate="show" className="px-4 pt-4 space-y-3">
        {loading ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 sm:gap-3">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse" style={{ border: '1px solid rgba(120,80,200,0.08)' }}>
                <div className="flex flex-col items-center pt-4 pb-2 px-2">
                  <div className="w-12 h-12 rounded-full bg-secondary" />
                  <div className="h-2.5 w-16 bg-secondary rounded-full mt-2" />
                  <div className="h-2 w-12 bg-secondary rounded-full mt-1.5" />
                </div>
                <div className="h-8 bg-secondary/60 mt-2" />
              </div>
            ))}
          </div>
        ) : isBlocked ? (
          <div className="bg-white border border-border rounded-xl px-4 py-12 text-center">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(239,71,111,0.08)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#EF476F" strokeWidth="2"/><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke="#EF476F" strokeWidth="2" strokeLinecap="round"/></svg>
            </div>
            <p className="text-[15px] font-bold text-foreground">No hay entrenamiento hoy</p>
            <p className="text-[12px] text-muted-foreground mt-1 capitalize">
              Los {DAY_NAMES[todayDay]}s no se registra asistencia
            </p>
          </div>
        ) : (
          <>
            {/* ── Week streak strip ── */}
            <motion.div
              variants={cardVariant}
              className="bg-white border border-border rounded-2xl px-4 py-4"
              style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}
            >
              <WeekStrip
                weekSaved={weekSaved}
                todayStr={todayStr}
                animatingToday={animatingToday}
              />
            </motion.div>

            {/* Selector de sede */}
            {locations.length > 1 && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                <Select value={selectedLoc} onValueChange={v => setSelectedLoc(v ?? selectedLoc)}>
                  <SelectTrigger className="bg-white flex-1">
                    <span className="text-sm font-semibold">
                      {locations.find(l => l.id === selectedLoc)?.name ?? 'Seleccionar sede'}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {locations.length === 1 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-white border border-border rounded-xl">
                <MapPin className="w-4 h-4 shrink-0" style={{ color: '#4361EE' }} />
                <span className="text-[13px] font-semibold text-foreground">{locations[0].name}</span>
              </div>
            )}

            {members.length === 0 ? (
              <div className="bg-white border border-border rounded-xl px-4 py-10 text-center">
                <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-[13px] font-semibold text-muted-foreground">Sin deportistas en esta sede</p>
                <p className="text-[11px] text-muted-foreground mt-1">Asigna miembros a esta sede desde Miembros</p>
              </div>
            ) : (
              <>
                {/* Resumen */}
                <motion.div variants={cardVariant} className="grid grid-cols-4 gap-2 md:gap-3">
                  {counts.map(({ s, n }) => (
                    <div
                      key={s}
                      className="bg-white border border-border rounded-xl text-center flex flex-col items-center justify-center py-3 md:py-5 md:rounded-2xl"
                      style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}
                    >
                      <div
                        className="text-xl md:text-[36px] font-extrabold leading-none mb-1"
                        style={{ color: STATUS_COLOR[s], fontFamily: 'var(--font-space-grotesk)' }}
                      >
                        {n}
                      </div>
                      <div className="text-[10px] md:text-[13px] font-semibold text-muted-foreground md:mt-0.5">
                        {s === 'PRESENT' ? 'Presentes'
                          : s === 'LATE' ? 'Tarde'
                          : s === 'ABSENT' ? 'Ausentes'
                          : 'Excusa Médica'}
                      </div>
                    </div>
                  ))}
                </motion.div>

                {/* Barra de búsqueda */}
                <motion.div variants={cardVariant} className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#8E87A8' }} />
                  <input
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-[13px] outline-none transition-all"
                    style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.12)', color: '#1A1028' }}
                    placeholder="Buscar por nombre..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </motion.div>

                {/* Filtro por categoría */}
                {categories.length > 1 && (
                  <motion.div variants={cardVariant}>
                    {/* Dropdown — solo en móvil */}
                    <div className="sm:hidden">
                      <Select value={catFilter} onValueChange={(v) => { if (v) setCatFilter(v); }}>
                        <SelectTrigger className="w-full h-9 text-[12px] font-bold rounded-xl" style={{ borderColor: 'rgba(124,58,237,0.25)', color: '#7C3AED' }}>
                          <span>
                            {toLabel(catFilter)}
                            {catFilter !== 'TODOS' && (
                              <span className="ml-1.5 text-[10px] opacity-60">
                                {members.filter(m => m.category === catFilter).length}
                              </span>
                            )}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map(cat => (
                            <SelectItem key={cat} value={cat} className="text-[12px] font-semibold">
                              {toLabel(cat)}
                              {cat !== 'TODOS' && (
                                <span className="ml-1.5 text-[10px] text-muted-foreground">
                                  {members.filter(m => m.category === cat).length}
                                </span>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Pills — solo en sm+ */}
                    <div className="hidden sm:flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                      {categories.map(cat => (
                        <motion.button
                          key={cat}
                          onClick={() => setCatFilter(cat)}
                          whileTap={reducedMotion ? {} : { scale: 0.95 }}
                          transition={{ duration: 0.1 }}
                          className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all cursor-pointer"
                          style={catFilter === cat
                            ? { background: '#7C3AED', color: '#fff', boxShadow: '0 2px 8px rgba(124,58,237,0.30)' }
                            : { background: '#fff', color: '#8E87A8', border: '1px solid rgba(120,80,200,0.15)' }
                          }
                        >
                          {toLabel(cat)}
                          {cat !== 'TODOS' && (
                            <span className="ml-1.5 text-[9px] opacity-70">
                              {members.filter(m => m.category === cat).length}
                            </span>
                          )}
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {canManage && (
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Toca el indicador para cambiar
                  </p>
                )}

                {/* Grid de tarjetas compactas */}
                <div className="grid grid-cols-3 gap-2 pb-24 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 sm:gap-3">
                  {visibleMembers.map(m => {
                    const s = att[m.id] ?? 'ABSENT';
                    const color = STATUS_COLOR[s];
                    const statusName = STATUS_NAME[s];
                    return (
                      <motion.div
                        variants={cardVariant}
                        key={m.id}
                        whileHover={reducedMotion ? {} : { y: -3, boxShadow: `0 12px 32px ${color}28`, transition: { duration: 0.22, ease: EASE_OUT } }}
                        whileTap={reducedMotion ? {} : { scale: 0.97, transition: { duration: 0.1 } }}
                        className="bg-white rounded-2xl overflow-hidden flex flex-col cursor-pointer"
                        style={{
                          border: `1.5px solid ${color}30`,
                          boxShadow: `0 2px 10px ${color}18`,
                        }}
                      >
                        <div className="flex flex-col items-center pt-4 pb-2 px-2">
                          <MemberAvatar
                            name={m.fullName}
                            photoUrl={m.pictureUrl}
                            gradient={avatarBg(m.role)}
                          />
                          <p className="text-[11px] font-bold text-center mt-2 leading-tight line-clamp-2 w-full px-1"
                            style={{ color: '#1A1028' }}>
                            {m.fullName}
                          </p>
                          {(m.category || m.tipo) && (
                            <p className="text-[9px] font-semibold text-center mt-0.5 truncate w-full px-1"
                              style={{ color: '#8E87A8' }}>
                              {m.category ?? m.tipo}
                            </p>
                          )}
                        </div>

                        {canManage ? (
                          <button
                            onClick={() => toggle(m.id)}
                            className="mt-auto w-full py-2 text-[11px] font-extrabold tracking-wide transition-all active:scale-95 flex items-center justify-center gap-1"
                            style={{
                              background: `${color}18`,
                              color,
                              borderTop: `1.5px solid ${color}30`,
                            }}
                          >
                            <span className="text-[11px]">{statusName}</span>
                          </button>
                        ) : (
                          <div
                            className="mt-auto w-full py-2 text-[11px] font-extrabold tracking-wide flex items-center justify-center gap-1"
                            style={{
                              background: `${color}18`,
                              color,
                              borderTop: `1.5px solid ${color}30`,
                            }}
                          >
                            <span className="text-[11px]">{statusName}</span>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
