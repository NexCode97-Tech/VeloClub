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
  const [open, setOpen]     = useState(false);
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({});
  const [base, setBase]     = useState<Date>(() => parsed ?? new Date());
  const ref        = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

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

  // Calcular posición fixed para escapar del overflow del modal
  function handleOpen() {
    if (triggerRef.current) {
      const rect       = triggerRef.current.getBoundingClientRect();
      const dropdownH  = 270;
      const spaceBelow = window.innerHeight - rect.bottom;
      const goUp       = spaceBelow < dropdownH;

      setDropStyle(goUp
        ? { position: 'fixed', bottom: window.innerHeight - rect.top + 6, left: rect.left, width: Math.max(rect.width, 232) }
        : { position: 'fixed', top: rect.bottom + 6,                      left: rect.left, width: Math.max(rect.width, 232) }
      );
    }
    setOpen(o => !o);
  }

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
    ? format(parsed, "d MMM yyyy", { locale: es })
    : placeholder;

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* ── Trigger ── */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className="w-full flex items-center gap-2 h-12 px-3 rounded-xl border border-input hover:border-ring transition-colors text-left group"
        style={{ background: '#fff' }}
      >
        <CalendarDays className="w-4 h-4 shrink-0 text-muted-foreground" />
        <span className={`flex-1 text-sm ${parsed ? 'text-foreground' : 'text-muted-foreground'}`}>
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

      {/* ── Dropdown (fixed para escapar modal overflow) ── */}
      {open && (
          <div
            className="z-[9999] rounded-xl p-3"
            style={{
              ...dropStyle,
              background: '#fff',
              border:     '1px solid rgba(124,58,237,0.14)',
              boxShadow:  '0 12px 32px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)',
            }}
          >
            {/* Nav mes */}
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => setBase(b => subMonths(b, 1))}
                className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-secondary transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-[12px] font-bold text-foreground capitalize">
                {format(base, 'MMMM yyyy', { locale: es })}
              </span>
              <button
                type="button"
                onClick={() => setBase(b => addMonths(b, 1))}
                className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-secondary transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Días de semana */}
            <div className="grid grid-cols-7 mb-0.5">
              {WEEKDAYS.map(d => (
                <div key={d} className="text-center text-[9px] font-bold text-muted-foreground uppercase py-0.5">
                  {d}
                </div>
              ))}
            </div>

            {/* Grid de días */}
            <div className="grid grid-cols-7">
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
                    className="h-7 w-full flex items-center justify-center rounded-md text-[11px] font-medium transition-all"
                    style={
                      isSel
                        ? { background: '#7C3AED', color: '#fff', fontWeight: 700,
                            boxShadow: '0 1px 4px rgba(124,58,237,0.35)' }
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
              className="mt-2 w-full text-[10px] text-muted-foreground hover:text-purple-600 transition-colors py-0.5"
            >
              → Ir a hoy
            </button>
          </div>
      )}
    </div>
  );
}
