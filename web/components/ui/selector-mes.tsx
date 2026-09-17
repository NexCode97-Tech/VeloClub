'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { IconCalendar } from '@/components/ui/custom-icons';

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/**
 * Un mes y su año, en un solo control.
 *
 * Reemplaza la pareja de listas «Septiembre» y «2026». Eran dos controles para
 * una sola decisión, y en el celular se comían la fila entera, así que la sede
 * tenía que bajar a otro renglón.
 *
 * En el celular es solo el ícono: el mes elegido ya se lee en la tarjeta, justo
 * debajo («Cobrado septiembre 2026»). Con más espacio muestra además el mes.
 * Eso se decide por el ancho del contenedor (`@container` en la página), no
 * por el del aparato: una tablet con el menú abierto tiene poco espacio.
 *
 * No es el `MonthPicker` de Analíticas a propósito: ese trae atajos por días y
 * rangos de varios meses, y aquí la unidad es un solo mes. Tampoco apaga los
 * meses que vienen, porque Finanzas genera los cobros del mes siguiente.
 */
export function SelectorMes({
  mes, anio, onChange, anioMin = 2024, anioMax = new Date().getFullYear() + 1, alinear = 'izquierda',
}: {
  /** 1 a 12 */
  mes: number;
  anio: number;
  onChange: (mes: number, anio: number) => void;
  anioMin?: number;
  anioMax?: number;
  /** Hacia dónde se abre la grilla. A la derecha cuando el control va al final
   *  de la fila: abierta hacia la derecha se saldría de la pantalla. */
  alinear?: 'izquierda' | 'derecha';
}) {
  const [abierto, setAbierto] = useState(false);
  const [anioVista, setAnioVista] = useState(anio);
  const caja = useRef<HTMLDivElement>(null);

  const hoy = new Date();
  const mesHoy = hoy.getMonth() + 1;
  const anioHoy = hoy.getFullYear();

  useEffect(() => {
    if (!abierto) return;
    function afuera(e: MouseEvent | TouchEvent) {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') setAbierto(false);
    }
    document.addEventListener('mousedown', afuera);
    document.addEventListener('touchstart', afuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', afuera);
      document.removeEventListener('touchstart', afuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  function alternar() {
    // Abre en el año del mes elegido, no en el último que se miró.
    if (!abierto) setAnioVista(anio);
    setAbierto(v => !v);
  }

  function elegir(m: number, a: number) {
    onChange(m, a);
    setAbierto(false);
  }

  const esHoy = mes === mesHoy && anio === anioHoy;
  const etiqueta = `${MESES_CORTOS[mes - 1]} ${anio}`;

  return (
    <div ref={caja} className="relative shrink-0">
      <button
        type="button"
        onClick={alternar}
        aria-expanded={abierto}
        aria-haspopup="dialog"
        aria-label={`Mes: ${etiqueta}`}
        title={etiqueta}
        className="flex items-center justify-center gap-1.5 h-9 w-9 @min-[460px]:w-auto @min-[460px]:px-3 rounded-xl bg-white text-[12.5px] font-semibold cursor-pointer transition-colors"
        style={{
          color: '#381DA0',
          background: abierto ? 'rgba(56,29,160,0.12)' : '#fff',
          border: `1.5px solid ${abierto ? '#381DA0' : 'rgba(56,29,160,0.18)'}`,
        }}
      >
        <IconCalendar className="w-4 h-4 shrink-0" />
        <span className="hidden @min-[460px]:inline whitespace-nowrap">{etiqueta}</span>
        <ChevronDown
          className="hidden @min-[460px]:block w-3.5 h-3.5 shrink-0 transition-transform duration-200"
          style={{ transform: abierto ? 'rotate(180deg)' : 'none' }}
        />
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-label="Elegir mes"
          className={`absolute top-11 z-50 w-[272px] rounded-2xl p-3.5 ${alinear === 'derecha' ? 'right-0' : 'left-0'}`}
          style={{
            background: '#fff',
            border: '1px solid rgba(56,29,160,0.14)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
          }}
        >
          <div className="flex items-center justify-between mb-2.5">
            <button
              type="button"
              onClick={() => setAnioVista(a => a - 1)}
              disabled={anioVista <= anioMin}
              aria-label="Año anterior"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[13px] font-semibold text-foreground">{anioVista}</span>
            <button
              type="button"
              onClick={() => setAnioVista(a => a + 1)}
              disabled={anioVista >= anioMax}
              aria-label="Año siguiente"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {MESES_CORTOS.map((nombre, i) => {
              const m = i + 1;
              const elegido = m === mes && anioVista === anio;
              const actual = m === mesHoy && anioVista === anioHoy;
              return (
                <button
                  key={nombre}
                  type="button"
                  onClick={() => elegir(m, anioVista)}
                  aria-pressed={elegido}
                  className="h-9 rounded-xl text-[11.5px] font-semibold transition-colors cursor-pointer"
                  style={
                    elegido
                      ? { background: '#381DA0', color: '#fff', boxShadow: '0 2px 8px rgba(56,29,160,0.35)' }
                      : actual
                      ? { background: 'rgba(56,29,160,0.10)', color: '#381DA0', boxShadow: 'inset 0 0 0 1px rgba(56,29,160,0.30)' }
                      : { background: '#F7F7FB', color: '#1A1028' }
                  }
                >
                  {nombre}
                </button>
              );
            })}
          </div>

          {!esHoy && (
            <button
              type="button"
              onClick={() => elegir(mesHoy, anioHoy)}
              className="mt-2.5 w-full text-[11.5px] text-muted-foreground hover:text-[#381DA0] transition-colors py-1 cursor-pointer"
            >
              Ir al mes actual
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default SelectorMes;
