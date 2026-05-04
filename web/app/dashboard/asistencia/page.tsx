'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { Users, MapPin, CheckCircle2 } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select';

interface Member {
  id: string;
  fullName: string;
  category?: string;
  tipo?: string;
  role: string;
  locations: { location: { id: string; name: string } }[];
}
interface Location { id: string; name: string }
interface AttRecord { memberId: string; status: Status }

type Status = 'PRESENT' | 'LATE' | 'ABSENT' | 'MEDICAL_EXCUSE';
const CYCLE: Status[] = ['PRESENT', 'LATE', 'ABSENT', 'MEDICAL_EXCUSE'];
const STATUS_LABEL: Record<Status, string> = { PRESENT: 'P', LATE: 'T', ABSENT: 'A', MEDICAL_EXCUSE: 'M' };
const STATUS_COLOR: Record<Status, string> = { PRESENT: '#06D6A0', LATE: '#FFB703', ABSENT: '#EF476F', MEDICAL_EXCUSE: '#8B8FA8' };
const STATUS_NAME: Record<Status, string>  = { PRESENT: 'Pres.', LATE: 'Tarde', ABSENT: 'Aus.', MEDICAL_EXCUSE: 'Med.' };
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
function initials(name: string) { return name.split(' ').slice(0,2).map(w=>w[0]).join(''); }
function avatarBg(role: string) { return ROLE_BG[role] ?? 'linear-gradient(135deg,#7C3AED,#A855F7)'; }

export default function AsistenciaPage() {
  const { getToken } = useAuth();
  const [locations, setLocations]     = useState<Location[]>([]);
  const [selectedLoc, setSelectedLoc] = useState<string>('');
  const [members, setMembers]         = useState<Member[]>([]);
  const [att, setAtt]                 = useState<Record<string, Status>>({});
  const [noAttDays, setNoAttDays]     = useState<number[]>([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [role, setRole]               = useState('');

  const todayDay = new Date().getDay();
  const isBlocked = noAttDays.includes(todayDay);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const [meRes, locsRes] = await Promise.all([
          apiFetch<{ status: string; user?: { role: string } }>('/me', { token }),
          apiFetch<{ locations: Location[] }>('/locations', { token }),
        ]);
        setRole(meRes.user?.role ?? '');
        setLocations(locsRes.locations);
        if (locsRes.locations.length > 0) setSelectedLoc(locsRes.locations[0].id);

        try {
          const clubRes = await apiFetch<{ club: { noAttendanceDays: number[] } }>('/clubs/settings', { token });
          setNoAttDays(clubRes.club.noAttendanceDays ?? []);
        } catch {
          // Si el endpoint falla, no bloqueamos la carga
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedLoc) return;
    (async () => {
      const token = await getToken();
      const [membersRes, attRes] = await Promise.all([
        apiFetch<{ members: Member[] }>('/members', { token }),
        apiFetch<{ records: AttRecord[] }>(`/attendance?date=${todayISO()}&locationId=${selectedLoc}`, { token }),
      ]);
      const forLoc = membersRes.members.filter(
        m => m.locations.some(l => l.location.id === selectedLoc)
      );
      setMembers(forLoc);
      const base = Object.fromEntries(forLoc.map(m => [m.id, 'PRESENT' as Status]));
      const existing: Record<string, Status> = {};
      for (const r of attRes.records) existing[r.memberId] = r.status as Status;
      setAtt({ ...base, ...existing });
    })();
  }, [selectedLoc]);

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

      <div className="px-4 pt-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
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
                <div className="grid grid-cols-4 gap-2">
                  {counts.map(({ s, n }) => (
                    <div key={s} className="bg-white border border-border rounded-xl py-2 text-center">
                      <div className="text-base font-extrabold leading-none mb-0.5" style={{ color: STATUS_COLOR[s], fontFamily: 'var(--font-space-grotesk)' }}>{n}</div>
                      <div className="text-[9px] text-muted-foreground">{STATUS_NAME[s]}</div>
                    </div>
                  ))}
                </div>

                {canManage && (
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Toca el indicador para cambiar
                  </p>
                )}

                <div className="space-y-2 pb-4">
                  {members.map(m => {
                    const s = att[m.id] ?? 'ABSENT';
                    return (
                      <div key={m.id} className="bg-white border border-border rounded-xl px-3 py-2.5 flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                          style={{ background: avatarBg(m.role) }}
                        >
                          {initials(m.fullName)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-foreground">{m.fullName}</p>
                          <div className="flex gap-2 mt-0.5">
                            {m.category && <p className="text-[10px] font-semibold" style={{ color: '#4361EE' }}>{m.category}</p>}
                            {m.tipo && <p className="text-[10px] text-muted-foreground">{m.tipo}</p>}
                          </div>
                        </div>
                        {canManage ? (
                          <button
                            onClick={() => toggle(m.id)}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all active:scale-90"
                            style={{ background: `${STATUS_COLOR[s]}22`, color: STATUS_COLOR[s], border: `1.5px solid ${STATUS_COLOR[s]}` }}
                          >
                            {STATUS_LABEL[s]}
                          </button>
                        ) : (
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{ background: `${STATUS_COLOR[s]}22`, color: STATUS_COLOR[s], border: `1.5px solid ${STATUS_COLOR[s]}` }}
                          >
                            {STATUS_LABEL[s]}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
