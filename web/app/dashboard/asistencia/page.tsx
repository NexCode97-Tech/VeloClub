'use client';

import { useAuth } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { QK } from '@/hooks/useVeloQuery';
import { Users, MapPin, CheckCircle2 } from 'lucide-react';
const EASE_OUT: [number,number,number,number] = [0.23, 1, 0.32, 1];
import { MemberAvatar } from '@/components/ui/member-avatar';
import { motion, useReducedMotion } from 'framer-motion';
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

const DAY_NAMES = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function todayLabel() {
  return new Date().toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}
function avatarBg(role: string) { return ROLE_BG[role] ?? 'linear-gradient(135deg,#7C3AED,#A855F7)'; }

export default function AsistenciaPage() {
  const { getToken } = useAuth();
  const reducedMotion = useReducedMotion();
  const [selectedLoc, setSelectedLoc] = useState<string>('');
  const [att, setAtt]                 = useState<Record<string, Status>>({});
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [role, setRole]               = useState('');
  const [noAttDays, setNoAttDays]     = useState<number[]>([]);

  const todayDay = new Date().getDay();
  const isBlocked = noAttDays.includes(todayDay);
  const todayStr = todayISO();

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
    staleTime: 0, // asistencia siempre fresca (cambia con frecuencia)
  });

  const locations = locsData?.locations ?? [];
  const loading   = loadingLocs || loadingMembers || loadingAtt;

  // Seleccionar primera sede cuando cargan las sedes
  useEffect(() => {
    if (locations.length > 0 && !selectedLoc) setSelectedLoc(locations[0].id);
  }, [locations, selectedLoc]);

  // Rol y noAttDays (sin bloquear)
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

  // Recalcular lista de miembros y asistencia al cambiar sede o cuando llegan datos
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

  // Miembros filtrados por sede seleccionada
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
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  const counts = CYCLE.map(s => ({ s, n: Object.values(att).filter(v => v === s).length }));
  const canManage = role === 'ADMIN' || role === 'COACH';

  return (
    <div className="min-h-full bg-background">
      <div className="px-5 py-3 bg-background border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-[17px] font-bold text-foreground" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            Asistencia
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 capitalize">{todayLabel()}</p>
        </div>
        {canManage && !isBlocked && members.length > 0 && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: saved ? '#06D6A0' : '#4361EE' }}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar'}</span>
          </button>
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
            <span className="text-4xl mb-3 block">🚫</span>
            <p className="text-[15px] font-bold text-foreground">No hay entrenamiento hoy</p>
            <p className="text-[12px] text-muted-foreground mt-1 capitalize">
              Los {DAY_NAMES[todayDay]}s no se registra asistencia
            </p>
          </div>
        ) : (
          <>
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

                {canManage && (
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Toca el indicador para cambiar
                  </p>
                )}

                {/* Grid de tarjetas compactas */}
                <div className="grid grid-cols-3 gap-2 pb-24 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 sm:gap-3">
                  {members.map(m => {
                    const s = att[m.id] ?? 'ABSENT';
                    const color = STATUS_COLOR[s];
                    const label = STATUS_LABEL[s];
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
                        {/* Avatar + nombre */}
                        <div className="flex flex-col items-center pt-4 pb-2 px-2">
                          <MemberAvatar
                            name={m.fullName}
                            photoUrl={m.pictureUrl}
                            gradient={avatarBg(m.role)}
                            size={48}
                          />
                          <p className="text-[11px] font-bold text-center mt-2 leading-tight line-clamp-2 w-full px-1"
                            style={{ color: '#1A1028' }}>
                            {m.fullName}
                          </p>
                        </div>

                        {/* Botón de estado — ocupa todo el ancho */}
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
