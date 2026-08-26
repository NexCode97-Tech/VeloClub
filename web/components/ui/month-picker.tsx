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
  /**
   * Qué se elige después del mes.
   *
   * `dias` (por defecto) abre el calendario del mes para marcar un rango de
   * días adentro: es lo que necesita Analíticas.
   *
   * `meses` se queda en la grilla y deja marcar de un mes a otro. Lo pide una
   * pantalla cuyo dato mínimo es el mes —Finanzas—, donde elegir días no
   * cambiaría nada y en cambio un rango de varios meses sí.
   */
  modo?: 'dias' | 'meses';
}

export function MonthPicker({
  value, currentMonth, availableMonths = [], dateRange, onChange, alignRight = false,
  modo = 'dias',
}: MonthPickerProps) {
  const [open, setOpen]       = useState(false);
  const [step, setStep]       = useState<'month' | 'days'>('month');
  // En modo meses: el mes que quedó marcado esperando el segundo clic.
  const [mesInicio, setMesInicio] = useState<string | null>(null);
  const [mesEncima, setMesEncima] = useState<string | null>(null);
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
        // Un rango a medias no se queda esperando: al cerrar sin el segundo
        // clic, lo que aplica es el mes que ya se eligio.
        setOpen(false); setStep('month'); setMesInicio(null); setMesEncima(null);
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

  /**
   * Modo meses: el primer clic marca el mes y lo aplica solo; el segundo, en
   * otro mes, arma el rango entre los dos. Volver a tocar el mismo mes lo
   * confirma como mes único.
   *
   * El rango se emite de primer día a último día, y el servidor de todos modos
   * lo redondea a meses completos: acá el día es solo la forma de nombrar el
   * mes.
   */
  function elegirMesEnRango(monthKey: string) {
    if (!mesInicio || mesInicio === monthKey) {
      if (mesInicio === monthKey) { setMesInicio(null); setOpen(false); return; }
      setMesInicio(monthKey);
      setMesEncima(null);
      onChange(monthKey, null);
      return;
    }

    const [a, b] = mesInicio < monthKey ? [mesInicio, monthKey] : [monthKey, mesInicio];
    const [ay, am] = a.split('-').map(Number);
    const [by, bm] = b.split('-').map(Number);
    onChange(a, {
      start: new Date(ay, am - 1, 1),
      end:   new Date(by, bm, 0),   // dia 0 del mes siguiente = ultimo del mes
    });
    setMesInicio(null);
    setMesEncima(null);
    setOpen(false);
  }

  /**
   * El año entero, de un toque.
   *
   * Del año en curso no se ofrecen los meses que todavía no pasaron: dejarían
   * media gráfica en blanco fingiendo que hubo meses sin movimiento.
   */
  function elegirAnio() {
    const ahora = new Date();
    const esEsteAnio = viewYear === ahora.getFullYear();
    const ultimo = esEsteAnio ? ahora.getMonth() : 11;
    onChange(`${viewYear}-01`, {
      start: new Date(viewYear, 0, 1),
      end: new Date(viewYear, ultimo + 1, 0),
    });
    setMesInicio(null);
    setMesEncima(null);
    setOpen(false);
  }

  function handleSelectMonth(monthKey: string) {
    if (modo === 'meses') return elegirMesEnRango(monthKey);

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

  /** ¿Este mes cae dentro del rango que se está armando o del ya elegido? */
  function mesEnRango(monthKey: string): boolean {
    if (modo !== 'meses') return false;
    if (mesInicio) {
      const otro = mesEncima;
      if (!otro) return monthKey === mesInicio;
      const [a, b] = mesInicio < otro ? [mesInicio, otro] : [otro, mesInicio];
      return monthKey >= a && monthKey <= b;
    }
    if (!dateRange) return false;
    const a = format(dateRange.start, 'yyyy-MM');
    const b = format(dateRange.end,   'yyyy-MM');
    return monthKey >= a && monthKey <= b;
  }

  // Label del trigger
  const labelDate = selected ? new Date(selected + '-15') : new Date();
  const monthLabel = format(labelDate, 'MMM yyyy', { locale: es });
  let triggerLabel = monthLabel;
  if (dateRange?.start && dateRange?.end) {
    if (modo === 'meses') {
      const anioIni = format(dateRange.start, 'yyyy');
      const mismoAnio = anioIni === format(dateRange.end, 'yyyy');
      const ahora = new Date();
      // Un año entero se llama por su año y ya: «Ene – Ago 2026» dice lo mismo
      // con el triple de tinta, y obliga a leerlo para entender que es «todo
      // 2026». Cuenta como año entero el que arranca en enero y llega hasta
      // diciembre, o hasta el mes de hoy si es el año en curso.
      const desdeEnero = dateRange.start.getMonth() === 0;
      const hastaElFinal = dateRange.end.getMonth() === 11
        || (Number(anioIni) === ahora.getFullYear() && dateRange.end.getMonth() === ahora.getMonth());

      if (mismoAnio && desdeEnero && hastaElFinal) {
        triggerLabel = anioIni;
      } else {
        // Un rango de meses se nombra por sus meses, no por los dias en que cae.
        const s = format(dateRange.start, 'MMM', { locale: es });
        const e = format(dateRange.end, 'MMM yyyy', { locale: es });
        triggerLabel = mismoAnio
          ? `${s} – ${e}`
          : `${format(dateRange.start, 'MMM yyyy', { locale: es })} – ${e}`;
      }
    } else {
      const s = format(dateRange.start, 'd MMM', { locale: es });
      const e = format(dateRange.end,   'd MMM', { locale: es });
      triggerLabel = `${monthLabel} · ${s}–${e}`;
    }
  }

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(p => !p)}
        className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-[12px] font-semibold transition-all cursor-pointer"
        style={{
          background: open ? 'rgba(56,29,160,0.12)' : '#fff',
          border: `1.5px solid ${open ? '#381DA0' : 'rgba(56,29,160,0.18)'}`,
          color: '#381DA0',
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
            border: '1px solid rgba(56,29,160,0.14)',
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
                {modo === 'meses' ? (
                  <button
                    onClick={elegirAnio}
                    title={`Ver todo ${viewYear}`}
                    className="text-[13px] font-semibold text-foreground px-2.5 py-1 rounded-lg cursor-pointer transition-colors hover:bg-primary/10 hover:text-primary"
                  >
                    {viewYear}
                  </button>
                ) : (
                  <span className="text-[13px] font-semibold text-foreground">{viewYear}</span>
                )}
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
                  const enRango  = mesEnRango(monthKey);
                  const isSel    = modo === 'meses'
                    ? (mesInicio ? monthKey === mesInicio : !dateRange && selected === monthKey)
                    : selected === monthKey;
                  const isCur    = monthKey === currentMonth;
                  const avail    = isAvailable(monthKey);
                  return (
                    <button
                      key={monthKey}
                      onClick={() => avail && handleSelectMonth(monthKey)}
                      onMouseEnter={() => modo === 'meses' && mesInicio && setMesEncima(monthKey)}
                      disabled={!avail}
                      className="h-9 rounded-xl text-[11px] font-semibold transition-all duration-150 cursor-pointer"
                      style={
                        isSel
                          ? { background: '#381DA0', color: '#fff', boxShadow: '0 2px 8px rgba(56,29,160,0.35)' }
                          : enRango
                          ? { background: 'rgba(56,29,160,0.14)', color: '#381DA0' }
                          : isCur && !isSel
                          ? { background: 'rgba(56,29,160,0.10)', color: '#381DA0', border: '1px solid rgba(56,29,160,0.30)' }
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

              {modo === 'meses' ? (
                <p className="mt-3 mb-0 text-[11px] text-muted-foreground text-center leading-snug">
                  {mesInicio
                    ? 'Elegí el mes final, o tocá el mismo para ver solo ese'
                    : 'Un mes, dos para el rango entre ellos, o el año para verlo entero'}
                </p>
              ) : value !== null && (
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
                          ? '#381DA0'
                          : inRange
                          ? 'rgba(56,29,160,0.12)'
                          : 'transparent',
                        color: isStart || isEnd ? '#fff' : inRange ? '#381DA0' : '#1A1028',
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
                      style={{ background: '#381DA0' }}
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
