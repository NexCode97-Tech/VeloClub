'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

// April 2026: starts on Wednesday (index 3 in 0=Sun week), 30 days
const APRIL_OFFSET = 3;
const APRIL_DAYS   = 30;

const events = [
  { title: 'Entrenamiento Juvenil A',  day: 30, time: '07:00', sede: 'Sede Norte',      type: 'training'     },
  { title: 'Copa Regional Patinaje',   day: 33, time: '09:00', sede: 'Estadio Sur',     type: 'competition'  },
  { title: 'Entrenamiento Infantil',   day: 31, time: '15:30', sede: 'Sede Sur',        type: 'training'     },
  { title: 'Reunion de Padres',        day: 35, time: '18:00', sede: 'Sede Norte',      type: 'meeting'      },
  { title: 'Campeonato Departamental', day: 40, time: '08:00', sede: 'Coliseo Central', type: 'competition'  },
];

// Days in April that have events (day numbers 1-30)
const aprilEventDays = new Set(
  events.filter((e) => e.day >= 1 && e.day <= 30).map((e) => e.day)
);

const typeConfig: Record<string, { label: string; color: string; bg: string; iconBg: string }> = {
  competition: { label: 'Competencia', color: '#EF476F', bg: 'rgba(239,71,111,0.12)',  iconBg: '#EF476F' },
  training:    { label: 'Entreno',     color: '#4361EE', bg: 'rgba(67,97,238,0.12)',   iconBg: '#4361EE' },
  meeting:     { label: 'Reunion',     color: '#FFB703', bg: 'rgba(255,183,3,0.12)',   iconBg: '#FFB703' },
};

const dayHeaders = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

export default function CalendarioPage() {
  const [selectedDay, setSelectedDay] = useState(30);

  const selectedEvents = events.filter((e) => e.day === selectedDay);

  // Build grid cells: offset blanks + days 1-30
  const cells: (number | null)[] = [
    ...Array(APRIL_OFFSET).fill(null),
    ...Array.from({ length: APRIL_DAYS }, (_, i) => i + 1),
  ];

  return (
    <div className="flex flex-col gap-4 px-4 py-5 max-w-lg mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1
          className="text-2xl font-bold text-foreground"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          Calendario
        </h1>
      </div>

      {/* Month calendar card */}
      <div className="bg-card border border-border rounded-xl p-3">
        {/* Month nav */}
        <div className="flex items-center justify-between mb-3">
          <button className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors">
            <ChevronLeft size={16} className="text-muted-foreground" />
          </button>
          <p
            className="text-[15px] font-bold text-foreground"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            Abril 2026
          </p>
          <button className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors">
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {dayHeaders.map((d) => (
            <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((day, idx) => {
            if (day === null) {
              return <div key={`blank-${idx}`} />;
            }
            const isToday    = day === 30;
            const isSelected = day === selectedDay;
            const hasEvent   = aprilEventDays.has(day);
            const isActive   = isSelected || isToday;

            return (
              <div
                key={day}
                className="flex flex-col items-center gap-0.5 cursor-pointer"
                onClick={() => setSelectedDay(day)}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-semibold transition-colors"
                  style={
                    isActive
                      ? { background: '#4361EE', color: '#fff' }
                      : { color: '#1A1028' }
                  }
                >
                  {day}
                </div>
                {hasEvent && (
                  <div
                    className="w-1 h-1 rounded-full"
                    style={{ background: isActive ? '#fff' : '#4361EE' }}
                  />
                )}
                {!hasEvent && <div className="w-1 h-1" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected day events */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
          Eventos
        </p>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(67,97,238,0.12)', color: '#4361EE' }}
        >
          {selectedEvents.length}
        </span>
      </div>

      {selectedEvents.length === 0 ? (
        <div className="bg-card border border-border rounded-xl px-4 py-6 text-center">
          <p className="text-[12px] text-muted-foreground">No hay eventos el día {selectedDay}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {selectedEvents.map((e, i) => {
            const tc = typeConfig[e.type];
            return (
              <div
                key={i}
                className="flex items-center gap-3 bg-card border border-border rounded-xl px-3 py-2.5"
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: tc.bg }}
                >
                  <CalendarDays size={16} style={{ color: tc.iconBg }} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-foreground truncate">{e.title}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {e.time} · {e.sede}
                  </p>
                </div>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                  style={{ background: tc.bg, color: tc.color }}
                >
                  {tc.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* All events section */}
      <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase px-1 mt-1">
        Todos los eventos
      </p>

      <div className="flex flex-col gap-2">
        {events.map((e, i) => {
          const tc = typeConfig[e.type];
          // Display label for day
          const dayLabel = e.day <= 30
            ? `Abr ${e.day}`
            : `May ${e.day - 30}`;

          return (
            <div
              key={i}
              className="flex items-center gap-3 bg-card border border-border rounded-xl px-3 py-2.5"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: tc.bg }}
              >
                <CalendarDays size={16} style={{ color: tc.iconBg }} strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-foreground truncate">{e.title}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {e.time} · {e.sede}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-[10px] text-muted-foreground">{dayLabel}</span>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: tc.bg, color: tc.color }}
                >
                  {tc.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
