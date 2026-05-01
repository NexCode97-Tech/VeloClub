'use client';

import { useState } from 'react';

const MOCK_MEMBERS = [
  { id: '1', name: 'Valentina Rios',   category: 'Juvenil A',  defaultStatus: 'PRESENT' as const },
  { id: '2', name: 'Santiago Mora',    category: 'Infantil B', defaultStatus: 'LATE'    as const },
  { id: '3', name: 'Isabella Castro',  category: 'Juvenil A',  defaultStatus: 'PRESENT' as const },
  { id: '4', name: 'Mateo Gonzalez',   category: 'Mayores',    defaultStatus: 'ABSENT'  as const },
  { id: '5', name: 'Sofia Herrera',    category: 'Infantil A', defaultStatus: 'PRESENT' as const },
  { id: '6', name: 'David Ramirez',    category: 'Entrenador', defaultStatus: 'PRESENT' as const },
  { id: '7', name: 'Laura Pena',       category: 'Entrenadora',defaultStatus: 'MEDICAL' as const },
  { id: '8', name: 'Carlos Jimenez',   category: 'Admin',      defaultStatus: 'PRESENT' as const },
];

type Status = 'PRESENT' | 'LATE' | 'ABSENT' | 'MEDICAL';
const CYCLE: Status[] = ['PRESENT', 'LATE', 'ABSENT', 'MEDICAL'];
const STATUS_LABEL: Record<Status, string> = { PRESENT: 'P', LATE: 'T', ABSENT: 'A', MEDICAL: 'M' };
const STATUS_COLOR: Record<Status, string> = { PRESENT: '#06D6A0', LATE: '#FFB703', ABSENT: '#EF476F', MEDICAL: '#8B8FA8' };
const STATUS_NAME: Record<Status, string> = { PRESENT: 'Pres.', LATE: 'Tarde', ABSENT: 'Aus.', MEDICAL: 'Med.' };
const ROLE_BG: Record<string, string> = {
  Entrenador: 'linear-gradient(135deg,#06D6A0,#0CB68D)',
  Entrenadora: 'linear-gradient(135deg,#06D6A0,#0CB68D)',
  Admin: 'linear-gradient(135deg,#FFB703,#FB8500)',
};

function initials(name: string) { return name.split(' ').slice(0, 2).map(w => w[0]).join(''); }
function avatarBg(cat: string) { return ROLE_BG[cat] ?? 'linear-gradient(135deg,#7C3AED,#A855F7)'; }

function todayStr() {
  return new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export default function AsistenciaPage() {
  const [att, setAtt] = useState<Record<string, Status>>(() =>
    Object.fromEntries(MOCK_MEMBERS.map(m => [m.id, m.defaultStatus]))
  );

  function toggle(id: string) {
    setAtt(prev => {
      const cur = prev[id] ?? 'ABSENT';
      return { ...prev, [id]: CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length] };
    });
  }

  const counts = CYCLE.map(s => ({ s, n: Object.values(att).filter(v => v === s).length }));

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div className="px-5 py-3 bg-background border-b border-border">
        <h1 className="text-[17px] font-bold text-foreground" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
          Asistencia
        </h1>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {/* Date chip */}
        <div className="bg-white border border-border rounded-xl px-4 py-2.5 flex items-center justify-between">
          <span className="text-[13px] font-semibold text-foreground capitalize">{todayStr()}</span>
          <span className="text-[11px] font-semibold" style={{ color: '#4361EE' }}>Hoy</span>
        </div>

        {/* Summary pills */}
        <div className="grid grid-cols-4 gap-2">
          {counts.map(({ s, n }) => (
            <div key={s} className="bg-white border border-border rounded-xl py-2 text-center">
              <div className="text-base font-extrabold leading-none mb-0.5" style={{ color: STATUS_COLOR[s], fontFamily: 'var(--font-space-grotesk)' }}>{n}</div>
              <div className="text-[9px] text-muted-foreground">{STATUS_NAME[s]}</div>
            </div>
          ))}
        </div>

        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          Toca el indicador para cambiar
        </p>

        {/* Member list */}
        <div className="space-y-2 pb-4">
          {MOCK_MEMBERS.map(m => {
            const s = att[m.id] ?? 'ABSENT';
            return (
              <div key={m.id} className="bg-white border border-border rounded-xl px-3 py-2.5 flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ background: avatarBg(m.category) }}
                >
                  {initials(m.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-foreground">{m.name}</p>
                  <p className="text-[10px] text-muted-foreground">{m.category}</p>
                </div>
                <button
                  onClick={() => toggle(m.id)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all active:scale-90"
                  style={{ background: `${STATUS_COLOR[s]}22`, color: STATUS_COLOR[s], border: `1.5px solid ${STATUS_COLOR[s]}` }}
                >
                  {STATUS_LABEL[s]}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
