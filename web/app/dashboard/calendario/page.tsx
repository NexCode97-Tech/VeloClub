'use client';
import { motion } from 'framer-motion';
import { stagger, cardVariant } from '@/lib/page-animations';

import { useAuth } from '@clerk/nextjs';
import { useClubStream } from '@/hooks/useClubStream';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { parseLocalDate } from '@/lib/utils';
import { ChevronLeft, ChevronRight, CalendarDays, Trophy, Dumbbell, MapPin } from 'lucide-react';

const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];
const DAY_HEADERS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

type EventType = 'COMPETITION' | 'TRAINING';

interface CalEvent {
  id: string;
  title: string;
  type: EventType;
  date: Date;
  place?: string | null;
  location?: string | null;
}

const TYPE_COLOR: Record<EventType, string> = {
  COMPETITION: '#EF476F',
  TRAINING:    '#4361EE',
};

const TYPE_LABEL: Record<EventType, string> = {
  COMPETITION: 'Competencia',
  TRAINING:    'Entrenamiento',
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function CalendarioPage() {
  const { getToken } = useAuth();
  const now = new Date();
  const [year, setYear]               = useState(now.getFullYear());
  const [month, setMonth]             = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState(now.getDate());
  const [events, setEvents]           = useState<CalEvent[]>([]);
  const [loading, setLoading]         = useState(false);

  const today = now.getDate();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  async function loadEvents() {
    setLoading(true);
    try {
      const token = await getToken();
      const [compRes, trainRes] = await Promise.all([
        apiFetch<{ competitions: Array<{ id: string; name: string; place?: string | null; date: string }> }>('/competitions', { token }),
        apiFetch<{ sessions: Array<{ id: string; title: string; date: string; location?: { name: string } | null }> }>(`/training?month=${month + 1}&year=${year}`, { token }),
      ]);

      const comps: CalEvent[] = (compRes.competitions ?? [])
        .map(c => ({
          id:    c.id,
          title: c.name,
          type:  'COMPETITION' as EventType,
          date:  parseLocalDate(c.date),
          place: c.place,
        }))
        .filter(c => c.date.getFullYear() === year && c.date.getMonth() === month);

      const trains: CalEvent[] = (trainRes.sessions ?? []).map(s => ({
        id:       s.id,
        title:    s.title,
        type:     'TRAINING' as EventType,
        date:     parseLocalDate(s.date),
        location: s.location?.name ?? null,
      }));

      setEvents([...comps, ...trains].sort((a, b) => a.date.getTime() - b.date.getTime()));
    } catch { /* silencioso */ }
    finally { setLoading(false); }
  }

  useEffect(() => { loadEvents(); }, [month, year]);

  // Tiempo real: SSE push desde el servidor
  useClubStream((ev) => { if (ev === 'calendar' || ev === 'training') loadEvents(); });

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay    = getFirstDayOfMonth(year, month);
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelectedDay(1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelectedDay(1);
  }

  const eventsOnDay = (day: number) =>
    events.filter(e => e.date.getDate() === day);

  const selectedEvents = eventsOnDay(selectedDay);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="min-h-full bg-background px-4 py-5">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-[22px] font-extrabold text-foreground uppercase" style={{ fontFamily: 'Cascadia Code, monospace', lineHeight: 1.1 }}>
          Calendario
        </h1>
        <p className="text-[12px] text-muted-foreground mt-0.5">{MONTH_NAMES[month]} {year}</p>
      </div>

      {/* Layout: columna única en móvil, dos columnas en desktop */}
      <div className="flex flex-col md:flex-row gap-5 md:items-start">

        {/* ── Columna izquierda — Calendario ── */}
        <div className="flex flex-col gap-4 md:w-[420px] shrink-0">
          {/* Tarjeta del mes */}
          <div className="bg-white border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <button onClick={prevMonth} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors">
                <ChevronLeft size={16} className="text-muted-foreground" />
              </button>
              <p className="text-[16px] font-bold text-foreground" style={{ fontFamily: ''Cascadia Code', monospace' }}>
                {MONTH_NAMES[month]} {year}
              </p>
              <button onClick={nextMonth} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors">
                <ChevronRight size={16} className="text-muted-foreground" />
              </button>
            </div>

            <div className="grid grid-cols-7 mb-2">
              {DAY_HEADERS.map((d) => (
                <div key={d} className="text-center text-[11px] font-semibold text-muted-foreground py-1">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-y-1">
              {cells.map((day, idx) => {
                if (day === null) return <div key={`blank-${idx}`} />;
                const isToday    = isCurrentMonth && day === today;
                const isSelected = day === selectedDay;
                const isActive   = isSelected || isToday;
                const dayEvents  = eventsOnDay(day);
                return (
                  <div
                    key={day}
                    className="flex flex-col items-center gap-0.5 cursor-pointer"
                    onClick={() => setSelectedDay(day)}
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-[13px] font-semibold transition-colors"
                      style={isActive ? { background: '#4361EE', color: '#fff' } : { color: '#1A1028' }}
                    >
                      {day}
                    </div>
                    <div className="flex gap-[2px] h-1.5 items-center">
                      {dayEvents.slice(0, 3).map(e => (
                        <div
                          key={e.id}
                          className="w-1 h-1 rounded-full"
                          style={{ background: TYPE_COLOR[e.type] }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Leyenda */}
          <div className="flex gap-4 px-1">
            {(['COMPETITION', 'TRAINING'] as EventType[]).map(t => (
              <div key={t} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: TYPE_COLOR[t] }} />
                <span className="text-[11px] font-semibold text-muted-foreground">{TYPE_LABEL[t]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Columna derecha — Eventos ── */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">

          {/* Eventos del día */}
          <div className="bg-white border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-bold text-foreground" style={{ fontFamily: ''Cascadia Code', monospace' }}>
                {selectedDay} de {MONTH_NAMES[month]}
              </p>
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(67,97,238,0.12)', color: '#4361EE' }}
              >
                {selectedEvents.length} evento{selectedEvents.length !== 1 ? 's' : ''}
              </span>
            </div>

            {loading ? (
              <div className="flex justify-center py-6">
                <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: '#4361EE', borderTopColor: 'transparent' }} />
              </div>
            ) : selectedEvents.length === 0 ? (
              <div className="flex flex-col items-center py-6 gap-2">
                <CalendarDays className="w-8 h-8 text-muted-foreground/30" />
                <p className="text-[12px] text-muted-foreground">Sin eventos el día {selectedDay}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedEvents.map(e => <EventCard key={e.id} event={e} />)}
              </div>
            )}
          </div>

          {/* Todos los eventos del mes */}
          <div className="bg-white border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-bold text-foreground" style={{ fontFamily: ''Cascadia Code', monospace' }}>
                Todo el mes
              </p>
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(67,97,238,0.12)', color: '#4361EE' }}
              >
                {events.length} evento{events.length !== 1 ? 's' : ''}
              </span>
            </div>

            {events.length === 0 && !loading ? (
              <div className="flex flex-col items-center py-6 gap-2">
                <CalendarDays className="w-8 h-8 text-muted-foreground/30" />
                <p className="text-[12px] text-muted-foreground">Sin eventos este mes</p>
              </div>
            ) : (
              <div className="space-y-2">
                {events.map(e => <EventCard key={e.id} event={e} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function EventCard({ event }: { event: CalEvent }) {
  const color = TYPE_COLOR[event.type];
  const Icon  = event.type === 'COMPETITION' ? Trophy : Dumbbell;
  const dateStr = event.date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  const sub = event.place ?? event.location;

  return (
    <div className="border border-border rounded-xl px-4 py-3 flex items-start gap-3">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: `${color}18`, color }}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: `${color}1A`, color }}
          >
            {TYPE_LABEL[event.type]}
          </span>
          <span className="text-[10px] text-muted-foreground">{dateStr}</span>
        </div>
        <p className="text-[13px] font-semibold text-foreground truncate">{event.title}</p>
        {sub && (
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
            <p className="text-[11px] text-muted-foreground truncate">{sub}</p>
          </div>
        )}
      </div>
    </div>
  );
}
