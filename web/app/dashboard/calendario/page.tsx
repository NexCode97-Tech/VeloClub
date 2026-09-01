'use client';
import { motion } from 'framer-motion';
import { stagger, cardVariant } from '@/lib/page-animations';

import { useAuth } from '@clerk/nextjs';
import { useClubStream } from '@/hooks/useClubStream';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { parseLocalDate } from '@/lib/utils';
import { colorDeGrupo } from '@/lib/colores-grupo';
import { horaLegible } from '@/components/ajustes/horario-clases';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ModuleLoader, { useCargaMinima } from '@/components/ui/module-loader';
import ModuleReveal from '@/components/ui/module-reveal';
import {
  IconCompetencias, IconEntrenamientos, IconEvento, IconUbicacion,
} from '@/components/ui/custom-icons';

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
  latitude?: number | null;
  longitude?: number | null;
  location?: string | null;
  /** "06:00". Solo las clases del horario la traen. */
  hora?: string;
  /** El grupo del que sale, para pintarla con su color. */
  grupoId?: string | null;
}

interface ClaseHorario {
  id: string;
  nombre: string;
  diaSemana: number;
  hora: string;
  grupoId: string | null;
  grupo?: { id: string; nombre: string } | null;
  location: { name: string };
}

/**
 * Las clases del horario NO se guardan como eventos del calendario.
 *
 * Son una regla semanal, no una fecha: copiarlas seria tener la misma clase en
 * dos sitios y que se separen la primera vez que alguien edite una. Aca se
 * calculan del horario, mes a mes, y se dibujan encima de los eventos de
 * verdad. Se ven distintas a proposito —una raya fina, no una pastilla— porque
 * un club con tres grupos entrenando tres dias tiene nueve por semana, y
 * mezclarlas con la competencia del sabado la entierra.
 */
function clasesDelMes(
  clases: { id: string; nombre: string; diaSemana: number; hora: string; grupoId: string | null; location: { name: string } }[],
  year: number,
  month: number,
  sinEntrenamiento: number[],
): CalEvent[] {
  const dias = getDaysInMonth(year, month);
  const salida: CalEvent[] = [];
  for (let d = 1; d <= dias; d++) {
    const fecha = new Date(year, month, d);
    const dow = fecha.getDay();
    if (sinEntrenamiento.includes(dow)) continue;
    for (const c of clases) {
      if (c.diaSemana !== dow) continue;
      salida.push({
        // El id lleva la fecha: la misma clase aparece cuatro veces al mes y
        // React necesita distinguirlas.
        id: `clase-${c.id}-${year}-${month}-${d}`,
        title: c.nombre,
        type: 'TRAINING',
        date: fecha,
        location: c.location?.name ?? null,
        hora: c.hora,
        grupoId: c.grupoId,
      });
    }
  }
  return salida;
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
  const [loading, setLoading]         = useState(true);
  // El horario del club, para dibujar las clases encima de los eventos.
  const [clases, setClases]           = useState<ClaseHorario[]>([]);
  const [sinEntrenar, setSinEntrenar] = useState<number[]>([]);
  // Se pueden apagar: nueve clases por semana entierran la competencia del
  // sabado, que es justo lo que alguien viene a buscar al calendario.
  const [verClases, setVerClases]     = useState(true);
  // Sostiene el indicador un minimo de tiempo para que no parpadee
  const mostrarCarga = useCargaMinima(loading);

  const today = now.getDate();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  async function loadEvents() {
    setLoading(true);
    try {
      const token = await getToken();
      const [compRes, trainRes] = await Promise.all([
        apiFetch<{ competitions: Array<{ id: string; name: string; place?: string | null; latitude?: number | null; longitude?: number | null; date: string }> }>('/competitions', { token }),
        apiFetch<{ sessions: Array<{ id: string; title: string; date: string; location?: { name: string } | null }> }>(`/training?month=${month + 1}&year=${year}`, { token }),
      ]);

      const comps: CalEvent[] = (compRes.competitions ?? [])
        .map(c => ({
          id:        c.id,
          title:     c.name,
          type:      'COMPETITION' as EventType,
          date:      parseLocalDate(c.date),
          place:     c.place,
          latitude:  c.latitude  ?? null,
          longitude: c.longitude ?? null,
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

  // El horario y los dias cerrados no dependen del mes: se piden una vez.
  const cargarHorario = useCallback(async () => {
    try {
      const token = await getToken();
      const [h, cfg] = await Promise.all([
        apiFetch<{ clases: ClaseHorario[]; grupos?: unknown }>('/clases', { token }),
        apiFetch<{ club: { noAttendanceDays?: number[] } }>('/clubs/settings', { token }),
      ]);
      setClases(h.clases ?? []);
      setSinEntrenar(cfg.club?.noAttendanceDays ?? []);
    } catch { /* sin horario el calendario sigue sirviendo igual */ }
  }, [getToken]);

  useEffect(() => { cargarHorario(); }, [cargarHorario]);

  // Tiempo real: SSE push desde el servidor
  useClubStream((ev) => {
    if (ev === 'calendar' || ev === 'training') loadEvents();
    if (ev === 'attendance') cargarHorario();
  });

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

  // Los ids de grupo en el mismo orden que `GET /grupos` los devuelve —por
  // nombre— para que un grupo salga del mismo color aca y en Ajustes.
  const idsGrupo = useMemo(() => {
    const vistos = new Map<string, string>();
    for (const c of clases) if (c.grupo) vistos.set(c.grupo.id, c.grupo.nombre);
    return [...vistos.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id]) => id);
  }, [clases]);

  // Las clases del mes, calculadas del horario. Se recalculan solo al cambiar
  // de mes o el horario: son cuatro o cinco por clase y se recorren en cada
  // celda del calendario.
  const clasesMes = useMemo(
    () => (verClases ? clasesDelMes(clases, year, month, sinEntrenar) : []),
    [clases, year, month, sinEntrenar, verClases]);

  const eventsOnDay = (day: number) =>
    [...events, ...clasesMes].filter(e => e.date.getDate() === day);

  const selectedEvents = eventsOnDay(selectedDay);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="min-h-full bg-background">
      {/* Header — borde inferior alineado con la fila del logo en el sidebar */}
      <div className="px-5 py-3 bg-background flex items-center lg:border-b" style={{ minHeight: 58, borderColor: 'rgba(0,0,0,0.07)' }}>
        <h1 className="text-[22px] font-semibold text-foreground" style={{ fontFamily: 'inherit', lineHeight: 1.1 }}>
          Calendario
        </h1>
      </div>

      {/* Layout: columna única en móvil, dos columnas en desktop */}
      {mostrarCarga ? <ModuleLoader /> : (
      <div className="flex flex-col md:flex-row gap-5 md:items-start px-4 pt-4 lg:pt-6 pb-5">
        <ModuleReveal>

        {/* ── Columna izquierda — Calendario ── */}
        <div className="flex flex-col gap-4 md:w-[420px] shrink-0">
          {/* Tarjeta del mes */}
          <div className="bg-white border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <button onClick={prevMonth} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors">
                <ChevronLeft size={16} className="text-muted-foreground" />
              </button>
              <p className="text-[16px] font-semibold text-foreground" style={{ fontFamily: 'inherit' }}>
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
                          style={{ background: e.hora && e.grupoId
                            ? colorDeGrupo(e.grupoId, idsGrupo)
                            : TYPE_COLOR[e.type] }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* El interruptor de las clases, junto a la leyenda porque las dos
              cosas responden lo mismo: que es cada punto del calendario.
              Solo aparece si el club armo horario. */}
          {clases.length > 0 && (
            <button
              type="button"
              role="switch"
              aria-checked={verClases}
              onClick={() => setVerClases(v => !v)}
              className="self-start inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full text-[11.5px] transition-colors"
              style={{
                background: '#fff',
                border: '1px solid rgba(120,80,200,0.14)',
                color: '#5B5470',
              }}
            >
              <span
                className="relative w-7 h-4 rounded-full shrink-0 transition-colors"
                style={{ background: verClases ? '#381DA0' : 'rgba(120,80,200,0.26)' }}
              >
                <span
                  className="absolute top-[2px] w-3 h-3 rounded-full bg-white transition-all"
                  style={{ left: verClases ? 14 : 2 }}
                />
              </span>
              Mostrar las clases del horario
            </button>
          )}

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
              <p className="text-[13px] font-semibold text-foreground" style={{ fontFamily: 'inherit' }}>
                {selectedDay} de {MONTH_NAMES[month]}
              </p>
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(67,97,238,0.12)', color: '#4361EE' }}
              >
                {selectedEvents.length} evento{selectedEvents.length !== 1 ? 's' : ''}
              </span>
            </div>

            { selectedEvents.length === 0 ? (
              <div className="flex flex-col items-center py-6 gap-2">
                <IconEvento className="w-8 h-8 text-muted-foreground/30" />
                <p className="text-[12px] text-muted-foreground">Sin eventos el día {selectedDay}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedEvents.map(e => (
                  <EventCard
                    key={e.id}
                    event={e}
                    colorClase={e.grupoId ? colorDeGrupo(e.grupoId, idsGrupo) : undefined}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Todos los eventos del mes */}
          <div className="bg-white border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-semibold text-foreground" style={{ fontFamily: 'inherit' }}>
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
                <IconEvento className="w-8 h-8 text-muted-foreground/30" />
                <p className="text-[12px] text-muted-foreground">Sin eventos este mes</p>
              </div>
            ) : (
              <div className="space-y-2">
                {events.map(e => <EventCard key={e.id} event={e} />)}
              </div>
            )}
          </div>
        </div>
        </ModuleReveal>
      </div>
      )}
    </motion.div>
  );
}

function toSentenceCase(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function EventCard({ event, colorClase }: { event: CalEvent; colorClase?: string }) {
  // Una clase del horario no es un evento: se repite todas las semanas. Lleva
  // el color de su grupo y la hora en vez de la fecha, para que se distinga sin
  // tener que leer el nombre.
  const esClase = !!event.hora;
  const color = esClase ? (colorClase ?? TYPE_COLOR[event.type]) : TYPE_COLOR[event.type];
  const Icon  = event.type === 'COMPETITION' ? IconCompetencias : IconEntrenamientos;
  const dateStr = esClase
    ? horaLegible(event.hora as string)
    : event.date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
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
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ background: `${color}1A`, color }}
          >
            {esClase ? 'Clase' : TYPE_LABEL[event.type]}
          </span>
          <span className="text-[10px] text-muted-foreground">{dateStr}</span>
        </div>
        <p className="text-[13px] font-semibold text-foreground truncate">{toSentenceCase(event.title)}</p>
        {sub && (() => {
          const hasCoords = event.latitude && event.longitude;
          const mapsUrl = hasCoords
            ? `https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`
            : null;
          return (
            <div className="flex items-center gap-1 mt-0.5">
              <IconUbicacion className="w-3 h-3 shrink-0 text-muted-foreground" />
              {mapsUrl ? (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-medium truncate text-muted-foreground underline-offset-2 hover:underline"
                >
                  {toSentenceCase(sub)}
                </a>
              ) : (
                <p className="text-[11px] text-muted-foreground truncate">{toSentenceCase(sub)}</p>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
