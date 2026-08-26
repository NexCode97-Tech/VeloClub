'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

const MONTHS = [
  'Ene','Feb','Mar','Abr','May','Jun',
  'Jul','Ago','Sep','Oct','Nov','Dic',
];

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
  /**
   * Con qué vista abre. `years` es para las fechas de nacimiento: nadie nació
   * este mes, y llegar a 1994 mes por mes desde hoy son trescientos clics.
   * Solo aplica mientras el campo esté vacío; con fecha puesta abre en su día.
   */
  abrirEn?: 'days' | 'years';
  /** Alto de campo de formulario denso, para las filas donde no cabe el de 48px. */
  compacto?: boolean;
  /** Pinta el borde de error, como el resto de los campos del proyecto. */
  error?: boolean;
  /**
   * Si se puede dejar vacío. En un campo obligatorio la X no va: al tocarla, la
   * pantalla vuelve a poner un valor por defecto y parece que no hizo nada.
   */
  limpiable?: boolean;
  /**
   * El ámbar de «esto lo trajimos vacío y falta llenarlo», el mismo que usa
   * `entrada()` en los formularios de miembros e inscripción.
   */
  falta?: boolean;
}

type View = 'days' | 'months' | 'years';

export function DatePicker({
  value,
  onChange,
  placeholder = 'Seleccionar fecha',
  className = '',
  minDate,
  maxDate,
  abrirEn = 'days',
  compacto = false,
  error = false,
  falta = false,
  limpiable = true,
}: DatePickerProps) {
  const parsed   = value ? new Date(value + 'T00:00:00') : null;
  const [open, setOpen]         = useState(false);
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({});
  const [base, setBase]         = useState<Date>(() => parsed ?? new Date());
  const [view, setView]         = useState<View>('days');
  // Para el selector de años: década visible
  const [decadeStart, setDecadeStart] = useState<number>(() => {
    const y = (parsed ?? new Date()).getFullYear();
    return Math.floor(y / 12) * 12;
  });

  const ref        = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const portalRef  = useRef<HTMLDivElement>(null);

  // Sincronizar base cuando cambia el valor externo
  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00');
      setBase(d);
      setDecadeStart(Math.floor(d.getFullYear() / 12) * 12);
    }
  }, [value]);

  // Cerrar al clic fuera (incluye el portal)
  useEffect(() => {
    function h(e: MouseEvent) {
      const t = e.target as Node;
      const insideTrigger = ref.current?.contains(t);
      const insidePortal  = portalRef.current?.contains(t);
      if (!insideTrigger && !insidePortal) {
        setOpen(false);
        setView('days');
      }
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Calcular posición fixed para escapar del overflow del modal
  function handleOpen() {
    if (triggerRef.current) {
      const rect       = triggerRef.current.getBoundingClientRect();
      const DROP_H     = 330;
      const vhVisible  = window.visualViewport?.height ?? window.innerHeight;
      const vw         = window.innerWidth;
      const GAP        = 8;
      const spaceBelow = vhVisible - rect.bottom - 16;
      const goUp       = spaceBelow < DROP_H;
      const width      = Math.max(rect.width, 240);
      const left       = Math.min(rect.left, vw - width - GAP);

      setDropStyle(goUp
        ? { position: 'fixed', bottom: vhVisible - rect.top + 6, left, width }
        : { position: 'fixed', top:    rect.bottom + 6,          left, width }
      );
    }
    // Con fecha puesta siempre abre en su dia; `abrirEn` es para el campo
    // vacio, donde arrancar en el mes actual no ayuda a nadie.
    setView(!value && abrirEn === 'years' ? 'years' : 'days');
    setOpen(o => !o);
  }

  function handleDay(day: Date) {
    if (minDate && day < minDate) return;
    if (maxDate && day > maxDate) return;
    onChange(format(day, 'yyyy-MM-dd'));
    setOpen(false);
    setView('days');
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange('');
  }

  function selectMonth(monthIdx: number) {
    setBase(b => new Date(b.getFullYear(), monthIdx, 1));
    setView('days');
  }

  function selectYear(year: number) {
    setBase(b => new Date(year, b.getMonth(), 1));
    setDecadeStart(Math.floor(year / 12) * 12);
    setView('months');
  }

  const days  = buildDays(base);
  const today = new Date();
  const label = parsed
    ? format(parsed, "d MMM yyyy", { locale: es })
    : placeholder;

  // Años para la vista de selección (12 años por página)
  const years = Array.from({ length: 12 }, (_, i) => decadeStart + i);

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* ── Trigger ── */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className={`w-full flex items-center gap-2 px-3 rounded-xl border transition-colors text-left group ${
          compacto ? 'h-[38px]' : 'h-12'
        } ${error
          ? 'border-[#EF476F]'
          : falta
            ? 'border-[#D9A227]'
            : 'border-input hover:border-ring'}`}
        style={{ background: falta && !error ? '#FDF7E8' : '#fff' }}
      >
        <CalendarDays className="w-4 h-4 shrink-0 text-muted-foreground" />
        <span className={`flex-1 ${compacto ? 'text-[13px]' : 'text-sm'} ${parsed ? 'text-foreground' : 'text-muted-foreground'}`}>
          {label}
        </span>
        {parsed && limpiable && (
          <button
            type="button"
            onClick={handleClear}
            className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-secondary transition-colors shrink-0"
          >
            <X className="w-3 h-3 text-muted-foreground" />
          </button>
        )}
      </button>

      {/* ── Dropdown — Portal para escapar transforms del Dialog ── */}
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={portalRef}
          className="z-[9999] rounded-xl p-3"
          style={{
            ...dropStyle,
            background: '#fff',
            border:     '1px solid rgba(56,29,160,0.14)',
            boxShadow:  '0 12px 32px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)',
          }}
        >
          {/* ── VISTA DÍAS ── */}
          {view === 'days' && (
            <>
              {/* Nav mes/año */}
              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  onClick={() => setBase(b => subMonths(b, 1))}
                  className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-secondary transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                {/* Click en el header → ir a selector de mes */}
                <button
                  type="button"
                  onClick={() => setView('months')}
                  className="text-[12px] font-semibold text-foreground capitalize hover:text-purple-600 transition-colors px-2 py-0.5 rounded-md hover:bg-secondary"
                >
                  {format(base, 'MMMM yyyy', { locale: es })}
                </button>
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
                  <div key={d} className="text-center text-[9px] font-semibold text-muted-foreground uppercase py-0.5">
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
                          ? { background: '#381DA0', color: '#fff', fontWeight: 600,
                              boxShadow: '0 1px 4px rgba(56,29,160,0.35)' }
                          : isToday && !isSel
                          ? { background: 'rgba(56,29,160,0.10)', color: '#381DA0',
                              fontWeight: 600, border: '1px solid rgba(56,29,160,0.30)' }
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
            </>
          )}

          {/* ── VISTA MESES ── */}
          {view === 'months' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={() => setBase(b => new Date(b.getFullYear() - 1, b.getMonth(), 1))}
                  className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-secondary transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                {/* Click en el año → ir a selector de año */}
                <button
                  type="button"
                  onClick={() => { setDecadeStart(Math.floor(base.getFullYear() / 12) * 12); setView('years'); }}
                  className="text-[12px] font-semibold text-foreground hover:text-purple-600 transition-colors px-2 py-0.5 rounded-md hover:bg-secondary"
                >
                  {base.getFullYear()}
                </button>
                <button
                  type="button"
                  onClick={() => setBase(b => new Date(b.getFullYear() + 1, b.getMonth(), 1))}
                  className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-secondary transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {MONTHS.map((name, idx) => {
                  const isCurrent = base.getMonth() === idx && parsed && parsed.getFullYear() === base.getFullYear();
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => selectMonth(idx)}
                      className="py-2 rounded-lg text-[11px] font-semibold transition-all"
                      style={isCurrent
                        ? { background: '#381DA0', color: '#fff' }
                        : { color: '#1A1028' }
                      }
                      onMouseEnter={e => { if (!isCurrent) (e.currentTarget as HTMLElement).style.background = 'rgba(56,29,160,0.08)'; }}
                      onMouseLeave={e => { if (!isCurrent) (e.currentTarget as HTMLElement).style.background = ''; }}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* ── VISTA AÑOS ── */}
          {view === 'years' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={() => setDecadeStart(d => d - 12)}
                  className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-secondary transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[12px] font-semibold text-foreground">
                  {decadeStart} – {decadeStart + 11}
                </span>
                <button
                  type="button"
                  onClick={() => setDecadeStart(d => d + 12)}
                  className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-secondary transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {years.map(yr => {
                  const isCurrent = parsed && parsed.getFullYear() === yr;
                  return (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => selectYear(yr)}
                      className="py-2 rounded-lg text-[11px] font-semibold transition-all"
                      style={isCurrent
                        ? { background: '#381DA0', color: '#fff' }
                        : { color: '#1A1028' }
                      }
                      onMouseEnter={e => { if (!isCurrent) (e.currentTarget as HTMLElement).style.background = 'rgba(56,29,160,0.08)'; }}
                      onMouseLeave={e => { if (!isCurrent) (e.currentTarget as HTMLElement).style.background = ''; }}
                    >
                      {yr}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
