'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];
const DAY_HEADERS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function CalendarioPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState(now.getDate());

  const today = now.getDate();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

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

  return (
    <div className="flex flex-col gap-4 px-4 py-5 max-w-lg mx-auto w-full">
      {/* Título */}
      <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
        Calendario
      </h1>

      {/* Tarjeta del mes */}
      <div className="bg-white border border-border rounded-xl p-3">
        {/* Navegación mes */}
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

        {/* Cabecera días */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_HEADERS.map((d) => (
            <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">{d}</div>
          ))}
        </div>

        {/* Cuadrícula */}
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((day, idx) => {
            if (day === null) return <div key={`blank-${idx}`} />;
            const isToday    = isCurrentMonth && day === today;
            const isSelected = day === selectedDay;
            const isActive   = isSelected || isToday;
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
                <div className="w-1 h-1" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Eventos del día seleccionado */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Eventos</p>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(67,97,238,0.12)', color: '#4361EE' }}
        >
          0
        </span>
      </div>

      <div className="bg-white border border-border rounded-xl px-4 py-6 text-center">
        <CalendarDays className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
        <p className="text-[12px] text-muted-foreground">No hay eventos el día {selectedDay}</p>
      </div>

      {/* Todos los eventos */}
      <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase px-1 mt-1">
        Todos los eventos
      </p>
      <div className="bg-white border border-border rounded-xl px-4 py-8 text-center">
        <CalendarDays className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
        <p className="text-[12px] text-muted-foreground">Sin eventos programados</p>
        <p className="text-[11px] text-muted-foreground mt-1">Los eventos aparecerán aquí una vez se agreguen</p>
      </div>
    </div>
  );
}
