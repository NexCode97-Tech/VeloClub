'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { ChevronLeft, ChevronRight, CalendarDays, Trash2 } from 'lucide-react';

const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];
const DAY_HEADERS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

const EVENT_TYPE_LABELS: Record<string, string> = {
  TRAINING:    'Entrenamiento',
  MEETUP:      'Reunión',
  COMPETITION: 'Competencia',
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  TRAINING:    '#4361EE',
  MEETUP:      '#06D6A0',
  COMPETITION: '#EF476F',
};

interface CalendarEvent {
  id: string;
  title: string;
  type: 'TRAINING' | 'MEETUP' | 'COMPETITION';
  description?: string;
  startDate: string;
  endDate?: string;
  allDay: boolean;
  location?: { id: string; name: string } | null;
}

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
  const [events, setEvents]           = useState<CalendarEvent[]>([]);
  const [role, setRole]               = useState<string>('');
  const [deleting, setDeleting]       = useState<string | null>(null);

  const today = now.getDate();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  async function loadEvents() {
    const token = await getToken();
    const res = await apiFetch<{ events: CalendarEvent[] }>(
      `/events?month=${month + 1}&year=${year}`, { token }
    );
    setEvents(res.events);
  }

  useEffect(() => {
    (async () => {
      const token = await getToken();
      const meRes = await apiFetch<{ status: string; user?: { role: string } }>('/me', { token });
      setRole(meRes.user?.role ?? '');
    })();
  }, []);

  useEffect(() => { loadEvents(); }, [month, year]);

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
    events.filter(e => {
      const d = new Date(e.startDate);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });

  const selectedEvents = eventsOnDay(selectedDay);

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este evento?')) return;
    setDeleting(id);
    try {
      const token = await getToken();
      await apiFetch(`/events/${id}`, { method: 'DELETE', token });
      await loadEvents();
    } finally {
      setDeleting(null);
    }
  }

  const canManage = role === 'ADMIN' || role === 'COACH';

  return (
    <div className="flex flex-col gap-4 px-4 py-5 max-w-lg mx-auto w-full">
      <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
        Calendario
      </h1>

      {/* Tarjeta del mes */}
      <div className="bg-white border border-border rounded-xl p-3">
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevMonth} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors">
            <ChevronLeft size={16} className="text-muted-foreground" />
          </button>
          <p className="text-[15px] font-bold text-foreground" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            {MONTH_NAMES[month]} {year}
          </p>
          <button onClick={nextMonth} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors">
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
        </div>

        <div className="grid grid-cols-7 mb-1">
          {DAY_HEADERS.map((d) => (
            <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">{d}</div>
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
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-semibold transition-colors"
                  style={isActive ? { background: '#4361EE', color: '#fff' } : { color: '#1A1028' }}
                >
                  {day}
                </div>
                <div className="flex gap-[2px] h-1.5 items-center">
                  {dayEvents.slice(0, 3).map(e => (
                    <div
                      key={e.id}
                      className="w-1 h-1 rounded-full"
                      style={{ background: EVENT_TYPE_COLORS[e.type] ?? '#4361EE' }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Eventos del día seleccionado */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
          Eventos — {selectedDay} de {MONTH_NAMES[month]}
        </p>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(67,97,238,0.12)', color: '#4361EE' }}
        >
          {selectedEvents.length}
        </span>
      </div>

      {selectedEvents.length === 0 ? (
        <div className="bg-white border border-border rounded-xl px-4 py-6 text-center">
          <CalendarDays className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-[12px] text-muted-foreground">No hay eventos el día {selectedDay}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {selectedEvents.map(e => (
            <EventCard key={e.id} event={e} canManage={canManage} deleting={deleting} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase px-1 mt-1">
        Todo el mes · {events.length} evento{events.length !== 1 ? 's' : ''}
      </p>

      {events.length === 0 ? (
        <div className="bg-white border border-border rounded-xl px-4 py-8 text-center">
          <CalendarDays className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-[12px] text-muted-foreground">Sin eventos este mes</p>
        </div>
      ) : (
        <div className="space-y-2 pb-4">
          {events.map(e => (
            <EventCard key={e.id} event={e} canManage={canManage} deleting={deleting} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

function EventCard({
  event, canManage, deleting, onDelete,
}: {
  event: CalendarEvent;
  canManage: boolean;
  deleting: string | null;
  onDelete: (id: string) => void;
}) {
  const color = EVENT_TYPE_COLORS[event.type] ?? '#4361EE';
  const d = new Date(event.startDate);
  const dateStr = d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });

  return (
    <div className="bg-white border border-border rounded-xl px-4 py-3 flex items-start gap-3">
      <div className="w-1 self-stretch rounded-full shrink-0" style={{ background: color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: `${color}1A`, color }}
          >
            {EVENT_TYPE_LABELS[event.type]}
          </span>
          <span className="text-[10px] text-muted-foreground">{dateStr}</span>
        </div>
        <p className="text-[13px] font-semibold text-foreground truncate">{event.title}</p>
        {event.description && (
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{event.description}</p>
        )}
        {event.location && (
          <p className="text-[10px] text-muted-foreground mt-0.5">{event.location.name}</p>
        )}
      </div>
      {canManage && (
        <button
          onClick={() => onDelete(event.id)}
          disabled={deleting === event.id}
          className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-red-400 hover:text-red-600 shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
