'use client';

import { useState, useRef, useEffect } from 'react';
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay,
  isWithinInterval, isAfter,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const WEEKDAYS = ['Lu','Ma','Mi','Ju','Vi','Sá','Do'];

export interface DateRange { start: Date; end: Date }

interface MonthPickerProps {
  value: string | null;                          // "YYYY-MM" | null = mes actual
  currentMonth: string;                          // "YYYY-MM"
  availableMonths?: string[];                    // vacío = todos habilitados
  dateRange: DateRange | null;
  onChange: (month: string | null, range: DateRange | null) => void;
  alignRight?: boolean;
}

export function MonthPicker({
  value, currentMonth, availableMonths = [], dateRange, onChange, alignRight = false,
}: MonthPickerProps) {
  const [open, setOpen]       = useState(false);
  const [step, setStep]       = useState<'month' | 'days'>('month');
  const [viewYear, setViewYear] = useState(() => {
    const m = value ?? currentMonth;
    return m ? parseInt(m.split('-')[0]) : new Date().getFullYear();
  });
  const [calBase,    setCalBase]    = useState<Date | null>(null);
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd,   setRangeEnd]   = useState<Date | null>(null);
  const [hoverDay,   setHoverDay]   = useState<Date | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Cerrar al clic fuera
  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setStep('month');
      }
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Sincronizar año con value
  useEffect(() => {
    const m = value ?? currentMonth;
    if (m) setViewYear(parseInt(m.split('-')[0]));
  }, [value, currentMonth]);

  // Sincronizar rango externo
  useEffect(() => {
    if (dateRange) { setRangeStart(dateRange.start); setRangeEnd(dateRange.end); }
    else           { setRangeStart(null); setRangeEnd(null); }
  }, [dateRange]);

  const selected = value ?? currentMonth;

  function isAvailable(monthKey: string) {
    return availableMonths.length === 0 || monthKey === currentMonth || availableMonths.includes(monthKey);
  }

  function handleSelectMonth(monthKey: string) {
    const isCurrentMonth = monthKey === currentMonth;
    onChange(isCurrentMonth ? null : monthKey, null);
    setRangeStart(null); setRangeEnd(null);
    const [y, m] = monthKey.split('-').map(Number);
    setCalBase(new Date(y, m - 1, 1));
    setStep('days');
  }

  function handleDayClick(day: Date) {
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(day); setRangeEnd(null); setHoverDay(null);
    } else {
      const [s, e] = isAfter(day, rangeStart) ? [rangeStart, day] : [day, rangeStart];
      setRangeStart(s); setRangeEnd(e);
      onChange(value, { start: s, end: e });
    }
  }

  function handleClearRange() {
    setRangeStart(null); setRangeEnd(null);
    onChange(value, null);
  }

  function buildDays(base: Date) {
    const start = startOfWeek(startOfMonth(base), { weekStartsOn: 1 });
    const end   = endOfWeek(endOfMonth(base),     { weekStartsOn: 1 });
    const days: Date[] = [];
    let d = start;
    while (!isAfter(d, end)) { days.push(d); d = addDays(d, 1); }
    return days;
  }

  const calDays = calBase ? buildDays(calBase) : [];

  function isDayInRange(day: Date) {
    const e = rangeEnd ?? (hoverDay && rangeStart && !rangeEnd ? hoverDay : null);
    if (!rangeStart || !e) return false;
    const [s, en] = isAfter(e, rangeStart) ? [rangeStart, e] : [e, rangeStart];
    return isWithinInterval(day, { start: s, end: en });
  }

  // Label del trigger
  const labelDate = selected ? new Date(selected + '-15') : new Date();
  const monthLabel = format(labelDate, 'MMM yyyy', { locale: es });
  let triggerLabel = monthLabel;
  if (dateRange?.start && dateRange?.end) {
    const s = format(dateRange.start, 'd MMM', { locale: es });
    const e = format(dateRange.end,   'd MMM', { locale: es });
    triggerLabel = `${monthLabel} · ${s}–${e}`;
  }

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(p => !p)}
        className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-[12px] font-semibold transition-all cursor-pointer"
        style={{
          background: open ? 'rgba(124,58,237,0.12)' : '#fff',
          border: `1.5px solid ${open ? '#7C3AED' : 'rgba(124,58,237,0.18)'}`,
          color: '#7C3AED',
        }}
      >
        <CalendarDays className="w-3.5 h-3.5 shrink-0" />
        <span className="capitalize leading-none">{triggerLabel}</span>
        <ChevronDown
          className="w-3 h-3 shrink-0 transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>

      {/* Popover */}
      {open && (
        <div
          className={`absolute top-11 z-50 rounded-2xl p-4 w-72 ${alignRight ? 'right-0' : 'left-0'}`}
          style={{
            background: '#fff',
            border: '1px solid rgba(124,58,237,0.14)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
          }}
        >

          {/* ── Step: Mes ── */}
          {step === 'month' && (
            <>
              {/* Nav año */}
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setViewYear(y => y - 1)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[13px] font-semibold text-foreground">{viewYear}</span>
                <button
                  onClick={() => setViewYear(y => y + 1)}
                  disabled={viewYear >= new Date().getFullYear()}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Grid de meses */}
              <div className="grid grid-cols-4 gap-1.5">
                {MONTHS.map((name, i) => {
                  const monthKey = `${viewYear}-${String(i + 1).padStart(2, '0')}`;
                  const isSel    = selected === monthKey;
                  const isCur    = monthKey === currentMonth;
                  const avail    = isAvailable(monthKey);
                  return (
                    <button
                      key={monthKey}
                      onClick={() => avail && handleSelectMonth(monthKey)}
                      disabled={!avail}
                      className="h-9 rounded-xl text-[11px] font-semibold transition-all duration-150 cursor-pointer"
                      style={
                        isSel
                          ? { background: '#7C3AED', color: '#fff', boxShadow: '0 2px 8px rgba(124,58,237,0.35)' }
                          : isCur && !isSel
                          ? { background: 'rgba(124,58,237,0.10)', color: '#7C3AED', border: '1px solid rgba(124,58,237,0.30)' }
                          : avail
                          ? { background: '#F7F7FB', color: '#1A1028' }
                          : { background: 'transparent', color: '#C4C2CF', cursor: 'not-allowed' }
                      }
                    >
                      {name}
                    </button>
                  );
                })}
              </div>

              {value !== null && (
                <button
                  onClick={() => { onChange(null, null); setOpen(false); }}
                  className="mt-3 w-full text-[11px] text-muted-foreground hover:text-purple-600 transition-colors py-1 cursor-pointer"
                >
                  → Ir al mes actual
                </button>
              )}
            </>
          )}

          {/* ── Step: Días ── */}
          {step === 'days' && calBase && (
            <>
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setStep('month')}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[13px] font-semibold text-foreground capitalize">
                  {format(calBase, 'MMMM yyyy', { locale: es })}
                </span>
                <div className="flex gap-0.5">
                  <button onClick={() => setCalBase(b => subMonths(b!, 1))} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary transition-colors cursor-pointer">
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setCalBase(b => addMonths(b!, 1))} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary transition-colors cursor-pointer">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Días de semana */}
              <div className="grid grid-cols-7 text-center mb-1">
                {WEEKDAYS.map(d => (
                  <div key={d} className="text-[10px] font-semibold text-muted-foreground uppercase">{d}</div>
                ))}
              </div>

              {/* Grid de días */}
              <div className="grid grid-cols-7 gap-y-0.5">
                {calDays.map((day, idx) => {
                  const inMonth = isSameMonth(day, calBase);
                  const isStart = rangeStart ? isSameDay(day, rangeStart) : false;
                  const isEnd   = rangeEnd   ? isSameDay(day, rangeEnd)   : false;
                  const inRange = isDayInRange(day);
                  return (
                    <div
                      key={idx}
                      onClick={() => inMonth && handleDayClick(day)}
                      onMouseEnter={() => { if (rangeStart && !rangeEnd) setHoverDay(day); }}
                      onMouseLeave={() => setHoverDay(null)}
                      className="h-8 flex items-center justify-center text-[11px] transition-all select-none"
                      style={{
                        opacity: !inMonth ? 0 : 1,
                        pointerEvents: !inMonth ? 'none' : 'auto',
                        cursor: inMonth ? 'pointer' : 'default',
                        background: isStart || isEnd
                          ? '#7C3AED'
                          : inRange
                          ? 'rgba(124,58,237,0.12)'
                          : 'transparent',
                        color: isStart || isEnd ? '#fff' : inRange ? '#7C3AED' : '#1A1028',
                        fontWeight: isStart || isEnd ? 700 : 400,
                        borderRadius: isStart ? '8px 0 0 8px' : isEnd ? '0 8px 8px 0' : inRange ? 0 : 8,
                      }}
                    >
                      {format(day, 'd')}
                    </div>
                  );
                })}
              </div>

              {/* Footer del rango */}
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-[11px]" style={{ color: '#8E87A8' }}>
                  {rangeStart && rangeEnd
                    ? `${format(rangeStart, 'd MMM', { locale: es })} – ${format(rangeEnd, 'd MMM', { locale: es })}`
                    : rangeStart
                    ? 'Selecciona el día final'
                    : 'Selecciona un día inicial'}
                </p>
                <div className="flex gap-2 shrink-0">
                  {(rangeStart || rangeEnd) && (
                    <button
                      onClick={handleClearRange}
                      className="text-[11px] text-muted-foreground hover:text-red-500 transition-colors cursor-pointer"
                    >
                      Limpiar
                    </button>
                  )}
                  {rangeStart && rangeEnd && (
                    <button
                      onClick={() => setOpen(false)}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-lg text-white cursor-pointer"
                      style={{ background: '#7C3AED' }}
                    >
                      Aplicar
                    </button>
                  )}
                </div>
              </div>

              <button
                onClick={() => { handleClearRange(); setOpen(false); }}
                className="mt-2 w-full text-[11px] text-muted-foreground hover:text-purple-600 transition-colors py-1 cursor-pointer"
              >
                Ver todo el mes
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
