'use client';

import { useState, useRef, useEffect } from 'react';
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, isAfter,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
   DatePicker — selector de fecha individual
   value:    "YYYY-MM-DD" | ""
   onChange: (date: "YYYY-MM-DD" | "") => void
   ───────────────────────────────────────────────────────────── */

const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

function buildDays(base: Date): Date[] {
  const start = startOfWeek(startOfMonth(base), { weekStartsOn: 1 });
  const end   = endOfWeek(endOfMonth(base),     { weekStartsOn: 1 });
  const days: Date[] = [];
  let d = start;
  while (!isAfter(d, end)) { days.push(d); d = addDays(d, 1); }
  return days;
}

interface DatePickerProps {
  value: string;                  // "YYYY-MM-DD" o ""
  onChange: (date: string) => void;
  placeholder?: string;
  className?: string;
  minDate?: Date;
  maxDate?: Date;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Seleccionar fecha',
  className = '',
  minDate,
  maxDate,
}: DatePickerProps) {
  const parsed   = value ? new Date(value + 'T00:00:00') : null;
  const [open, setOpen]   = useState(false);
  const [base, setBase]   = useState<Date>(() => parsed ?? new Date());
  const ref = useRef<HTMLDivElement>(null);

  // Sincronizar base cuando cambia el valor externo
  useEffect(() => {
    if (value) setBase(new Date(value + 'T00:00:00'));
  }, [value]);

  // Cerrar al clic fuera
  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  function handleDay(day: Date) {
    if (minDate && day < minDate) return;
    if (maxDate && day > maxDate) return;
    onChange(format(day, 'yyyy-MM-dd'));
    setOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange('');
  }

  const days    = buildDays(base);
  const today   = new Date();
  const label   = parsed
    ? format(parsed, "d 'de' MMMM 'de' yyyy", { locale: es })
    : placeholder;

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* ── Trigger ── */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 h-12 px-3 rounded-xl border border-input bg-background hover:border-ring transition-colors text-left group"
      >
        <CalendarDays className="w-4 h-4 shrink-0 text-muted-foreground" />
        <span className={`flex-1 text-sm ${parsed ? 'text-foreground' : 'text-muted-foreground'} capitalize`}>
          {label}
        </span>
        {parsed && (
          <button
            type="button"
            onClick={handleClear}
            className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-secondary transition-colors shrink-0"
          >
            <X className="w-3 h-3 text-muted-foreground" />
          </button>
        )}
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <>
          {/* Overlay para cerrar en móvil */}
          <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />

          <div
            className="absolute left-0 top-[calc(100%+6px)] z-[9999] rounded-2xl p-4 w-[280px]"
            style={{
              background: '#fff',
              border:     '1px solid rgba(124,58,237,0.14)',
              boxShadow:  '0 16px 48px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
            }}
          >
            {/* Nav mes */}
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={() => setBase(b => subMonths(b, 1))}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[13px] font-bold text-foreground capitalize">
                {format(base, 'MMMM yyyy', { locale: es })}
              </span>
              <button
                type="button"
                onClick={() => setBase(b => addMonths(b, 1))}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Días de semana */}
            <div className="grid grid-cols-7 mb-1">
              {WEEKDAYS.map(d => (
                <div key={d} className="text-center text-[10px] font-bold text-muted-foreground uppercase py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Grid de días */}
            <div className="grid grid-cols-7 gap-y-0.5">
              {days.map((day, idx) => {
                const inMonth  = isSameMonth(day, base);
                const isToday  = isSameDay(day, today);
                const isSel    = parsed ? isSameDay(day, parsed) : false;
                const disabled = !inMonth
                  || (minDate ? day < minDate : false)
                  || (maxDate ? day > maxDate : false);

                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={disabled}
                    onClick={() => !disabled && handleDay(day)}
                    className="h-8 w-full flex items-center justify-center rounded-lg text-[12px] font-medium transition-all"
                    style={
                      isSel
                        ? { background: '#7C3AED', color: '#fff', fontWeight: 700,
                            boxShadow: '0 2px 8px rgba(124,58,237,0.35)' }
                        : isToday && !isSel
                        ? { background: 'rgba(124,58,237,0.10)', color: '#7C3AED',
                            fontWeight: 700, border: '1px solid rgba(124,58,237,0.30)' }
                        : disabled
                        ? { color: '#D1D0D8', cursor: 'default' }
                        : { color: '#1A1028' }
                    }
                  >
                    {inMonth ? format(day, 'd') : ''}
                  </button>
                );
              })}
            </div>

            {/* Ir a hoy */}
            <button
              type="button"
              onClick={() => { setBase(new Date()); handleDay(new Date()); }}
              className="mt-3 w-full text-[11px] text-muted-foreground hover:text-purple-600 transition-colors py-1"
            >
              → Ir a hoy
            </button>
          </div>
        </>
      )}
    </div>
  );
}
