'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Plus, Trash2, Zap } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { AccionesCabecera } from '@/components/superadmin/acciones-cabecera';
import { Desplegable } from '@/components/ui/desplegable';
import { DatePicker } from '@/components/ui/date-picker';
import { HojaInferior } from '@/components/ui/hoja-inferior';
import { MonthPicker, type DateRange } from '@/components/ui/month-picker';
import { GraficaMeses, Ranking, ENTRA, SALE, type MesFinanzas } from '@/components/superadmin/grafica-meses';

/**
 * Las finanzas del negocio.
 *
 * Lo que entra por las suscripciones de los clubes y lo que sale por sostener
 * la plataforma. No se cruza con el flujo de caja de ningún club: esa es plata
 * de otra persona y sumarlas daría un número que no significa nada.
 *
 * Los ingresos salen solos de los pagos. Los gastos se escriben a mano, porque
 * las facturas de Railway o de Cloudinary no llegan a ningún sitio que el
 * sistema pueda leer.
 */

const CATEGORIAS = [
  { valor: 'INFRAESTRUCTURA', texto: 'Infraestructura', nota: 'Servidores, base de datos, imágenes' },
  { valor: 'COMISIONES',      texto: 'Comisiones',      nota: 'Lo que cobra la pasarela de pagos' },
  { valor: 'PUBLICIDAD',      texto: 'Publicidad',      nota: 'Pauta y promoción' },
  { valor: 'HERRAMIENTAS',    texto: 'Herramientas',    nota: 'Programas y servicios de trabajo' },
  { valor: 'OTROS',           texto: 'Otros' },
];

/** El color de cada categoría, en el orden fijo de arriba. Nunca se ciclan. */
const COLOR_CATEGORIA: Record<string, string> = {
  INFRAESTRUCTURA: '#7C3AED',
  COMISIONES:      '#C2410C',
  PUBLICIDAD:      '#0369A1',
  HERRAMIENTAS:    '#0E7C57',
  OTROS:           '#A33A4E',
};

/**
 * Con qué se abre la pantalla, mientras nadie toque el selector: los últimos
 * seis meses sin salirse del año en curso. Un mes solo no deja ver ninguna
 * tendencia, y el año entero arranca con medio gráfico vacío.
 */
const RANGO_INICIAL = '6m';

interface Gasto {
  id: string;
  fecha: string;
  monto: number;
  categoria: string;
  descripcion: string;
  /** Lo anotó el sistema, no una persona. Hoy solo la comisión de la pasarela. */
  origen?: string | null;
}

interface Pulso {
  totalAcumulado: number;
  clubesNuevosPorMes: number;
  clubesTotal: number;
  clubesQuePagan: number;
  enPrueba: number;
  promedioPorClub: number;
  deportistas: number;
}

interface Finanzas {
  meses: MesFinanzas[];
  categorias: { categoria: string; monto: number }[];
  clubes: { clubId: string; nombre: string; total: number }[];
  mensual: { monto: number; clubes: number };
  pulso: Pulso;
  /** Si las barras son meses o dias. Lo decide el servidor por el rango. */
  granularidad: 'dia' | 'mes';
}

/** Una fecha local a aaaa-mm-dd, sin pasar por UTC. */
function aISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const pesos = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');

function hoyISO(): string {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
}

const VACIO = { fecha: hoyISO(), monto: '', categoria: 'INFRAESTRUCTURA', descripcion: '' };

export default function FinanzasSuperadmin() {
  const { getToken } = useAuth();
  // El mismo selector de Analíticas, en su modo de meses: un mes, o el rango
  // entre dos. No hay un segundo filtro con el que pelear.
  const [mesElegido, setMesElegido] = useState<string | null>(null);
  const [rangoFechas, setRangoFechas] = useState<DateRange | null>(null);
  const [datos, setDatos] = useState<Finanzas | null>(null);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [abierto, setAbierto] = useState(false);
  const [nuevo, setNuevo] = useState(VACIO);
  const [guardando, setGuardando] = useState(false);
  // El error del formulario vive aparte del de la pantalla: con el modal abierto,
  // un aviso arriba de la pagina queda detras del velo y nadie lo lee.
  const [errorModal, setErrorModal] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const token = await getToken();
      // El servidor redondea a meses completos, así que el día que se mande da
      // igual mientras caiga dentro del mes.
      const busqueda = rangoFechas
        ? `desde=${aISO(rangoFechas.start)}&hasta=${aISO(rangoFechas.end)}`
        : mesElegido
          ? `desde=${mesElegido}-01&hasta=${mesElegido}-01`
          : `rango=${RANGO_INICIAL}`;
      const [f, g] = await Promise.all([
        apiFetch<Finanzas>(`/superadmin/finanzas?${busqueda}`, { token }),
        apiFetch<{ gastos: Gasto[] }>('/superadmin/finanzas/gastos', { token }),
      ]);
      setDatos(f);
      setGastos(g.gastos);
      setError(null);
    } catch {
      setError('No se pudieron cargar las finanzas. Intenta de nuevo.');
    } finally {
      setCargando(false);
    }
  }, [getToken, mesElegido, rangoFechas]);

  useEffect(() => { cargar(); }, [cargar]);

  // Las cifras son del periodo completo que se está viendo, no del mes en
  // curso: al mover el filtro, unas tarjetas que no cambian confunden más de lo
  // que informan.
  const periodo = useMemo(
    () => (datos?.meses ?? []).reduce(
      (t, m) => ({ entra: t.entra + m.entra, sale: t.sale + m.sale }),
      { entra: 0, sale: 0 },
    ),
    [datos],
  );
  const saldo = periodo.entra - periodo.sale;

  const gastosDelPeriodo = useMemo(() => {
    const dentro = new Set((datos?.meses ?? []).map(m => m.mes));
    return gastos.filter(g => dentro.has(g.fecha.slice(0, 7))).length;
  }, [gastos, datos]);

  async function guardar() {
    const monto = Number(nuevo.monto.replace(/[^\d]/g, ''));
    if (!monto || nuevo.descripcion.trim().length < 2) {
      setErrorModal('Falta el monto o la descripción del gasto.');
      return;
    }
    setGuardando(true);
    setErrorModal(null);
    try {
      const token = await getToken();
      await apiFetch('/superadmin/finanzas/gastos', {
        method: 'POST', token,
        body: JSON.stringify({ ...nuevo, monto }),
      });
      setNuevo({ ...VACIO, categoria: nuevo.categoria });
      setAbierto(false);
      await cargar();
    } catch {
      setErrorModal('No se pudo guardar el gasto. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(g: Gasto) {
    if (!confirm(`¿Borrar el gasto de ${pesos(g.monto)}?\n\n${g.descripcion}`)) return;
    try {
      const token = await getToken();
      await apiFetch(`/superadmin/finanzas/gastos/${g.id}`, { method: 'DELETE', token });
      await cargar();
    } catch {
      setError('No se pudo borrar. Intenta de nuevo.');
    }
  }

  return (
    <div style={{ background: '#F7F7FB', minHeight: '100%' }}>
      <AccionesCabecera>
        {/* Siempre dice lo mismo. Un boton que cambia a «Cancelar» obliga a
            leerlo antes de tocarlo; el modal ya tiene su propio cancelar. */}
        <button type="button" onClick={() => { setErrorModal(null); setAbierto(true); }}
          className="inline-flex items-center gap-1.5 text-white text-[12px] font-semibold px-3 py-2 rounded-xl shrink-0"
          style={{ background: '#7C3AED' }}>
          <Plus className="w-3.5 h-3.5" />
          Registrar gasto
        </button>
      </AccionesCabecera>

      <div className="px-4 pt-4 pb-24 flex flex-col gap-3 max-w-5xl mx-auto">

        {error && (
          <p className="text-[12px] rounded-xl px-3 py-2 m-0"
            style={{ background: 'rgba(239,71,111,0.1)', color: '#A33A4E' }}>
            {error}
          </p>
        )}

        {/* Un solo control para el periodo. Antes convivía con tres botones de
            preajuste, y dos filtros peleando por lo mismo obligan a mirar los
            dos para saber qué se está viendo. El selector ya hace todo: un mes,
            o el rango entre dos. */}
        <div className="flex items-center justify-end">
          <MonthPicker
            value={mesElegido}
            currentMonth={new Date().toISOString().slice(0, 7)}
            dateRange={rangoFechas}
            onChange={(mes, r) => { setMesElegido(mes); setRangoFechas(r); }}
            modo="meses"
            alignRight
          />
        </div>

        {cargando ? (
          <div className="h-40 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : !datos ? null : (
          <>
            {/* Cifras. Son números sueltos y no gráficas: el trabajo de un
                titular es responder «cuánto» de un vistazo, y dibujarle una
                gráfica a un solo dato le quita velocidad sin agregar nada. */}
            <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
              <Cifra rotulo="Ingresos" valor={pesos(periodo.entra)} color={ENTRA}
                nota={datos.granularidad === 'dia'
                  ? `${datos.pulso.clubesQuePagan} clubes, 1 mes`
                  : `${datos.pulso.clubesQuePagan} clubes, ${datos.meses.length} meses`} />
              <Cifra rotulo="Gastos" valor={pesos(periodo.sale)} color={SALE}
                nota={`${gastosDelPeriodo} ${gastosDelPeriodo === 1 ? 'gasto registrado' : 'gastos registrados'}`} />
              <Cifra rotulo="Saldo del periodo"
                valor={`${saldo < 0 ? '-' : ''}${pesos(Math.abs(saldo))}`}
                pastilla={periodo.entra > 0
                  ? { texto: `${Math.round((saldo / periodo.entra) * 100)}% de margen`, bien: saldo >= 0 }
                  : undefined}
                nota={periodo.entra > 0 ? undefined : 'sin ingresos en el periodo'} />
              <Cifra rotulo="Total acumulado"
                valor={`${datos.pulso.totalAcumulado < 0 ? '-' : ''}${pesos(Math.abs(datos.pulso.totalAcumulado))}`}
                nota="toda la historia, sin importar el filtro" />
            </div>

            <Tarjeta>
              <div className="flex items-baseline gap-2 flex-wrap">
                <h2 className="text-[15px] font-semibold text-foreground m-0">
                  {datos.granularidad === 'dia' ? 'Entra y sale, día a día' : 'Entra y sale, mes a mes'}
                </h2>
                {/* Con dos series la leyenda va siempre: la identidad no puede
                    depender solo del color. */}
                <span className="ml-auto flex gap-3">
                  <Punto color={ENTRA}>Entra</Punto>
                  <Punto color={SALE}>Sale</Punto>
                </span>
              </div>
              <p className="text-[11.5px] text-muted-foreground m-0 mb-1">
                La línea de ceros marca el punto de equilibrio.
              </p>
              <GraficaMeses meses={datos.meses} />
            </Tarjeta>

            {/* El pulso: lo que no cuentan las cifras de arriba. No depende del
                filtro, porque son preguntas sobre el negocio entero. */}
            <Tarjeta>
              <div className="flex items-baseline gap-2 flex-wrap">
                <h2 className="text-[15px] font-semibold text-foreground m-0">El pulso del negocio</h2>
                <span className="text-[11.5px] text-muted-foreground ml-auto">
                  Lo que no cuentan las cifras de arriba
                </span>
              </div>
              <div className="grid gap-x-5 gap-y-3 mt-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
                <Dato n={datos.pulso.clubesNuevosPorMes.toLocaleString('es-CO')} q="Clubes nuevos por mes" />
                <Dato n={pesos(datos.mensual.monto)} q="Ingreso recurrente" />
                <Dato n={`${datos.pulso.clubesQuePagan} de ${datos.pulso.clubesTotal}`} q="Clubes que pagan" />
                <Dato n={String(datos.pulso.enPrueba)} q="En periodo de prueba" />
                <Dato n={pesos(datos.pulso.promedioPorClub)} q="Promedio por club" />
                <Dato n={datos.pulso.deportistas.toLocaleString('es-CO')} q="Deportistas" />
              </div>
            </Tarjeta>

            <div className="grid gap-3 lg:grid-cols-2">
              <Tarjeta>
                {/* Una sola serie: sin caja de leyenda, el título la nombra. */}
                <h2 className="text-[15px] font-semibold text-foreground m-0">De dónde viene</h2>
                <p className="text-[11.5px] text-muted-foreground m-0">Total pagado por club, desde que arrancó</p>
                <Ranking colores="#7C3AED"
                  filas={datos.clubes.map(c => ({ nombre: c.nombre, valor: c.total }))} />
              </Tarjeta>

              <Tarjeta>
                <h2 className="text-[15px] font-semibold text-foreground m-0">En qué se va</h2>
                <p className="text-[11.5px] text-muted-foreground m-0">Gastos del periodo, por categoría</p>
                <Ranking
                  filas={datos.categorias.map(c => ({
                    nombre: CATEGORIAS.find(x => x.valor === c.categoria)?.texto ?? c.categoria,
                    valor: c.monto,
                  }))}
                  colores={datos.categorias.map(c => COLOR_CATEGORIA[c.categoria] ?? '#8E87A8')}
                />
              </Tarjeta>
            </div>

            <Tarjeta sinAire>
              <div className="px-4 py-3 border-b border-border">
                <h2 className="text-[15px] font-semibold text-foreground m-0">Gastos registrados</h2>
              </div>
              {gastos.length === 0 ? (
                <p className="text-[12.5px] text-muted-foreground m-0 px-4 py-6 text-center">
                  Todavía no has registrado ningún gasto.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  {gastos.map(g => (
                    <div key={g.id}
                      className="grid grid-cols-[4.5rem_minmax(9rem,1fr)_7.5rem_6rem_1.8rem] gap-2 items-center px-4 py-2.5 border-b border-border/50 last:border-b-0 text-[12.5px] min-w-[30rem]">
                      <span className="text-muted-foreground tabular-nums">
                        {new Date(g.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                      </span>
                      <span className="text-foreground truncate flex items-center gap-1.5" title={g.descripcion}>
                        {/* El rayo dice que lo puso el sistema. No es solo un
                            adorno: es el motivo por el que no tiene papelera. */}
                        {g.origen && <Zap className="w-3 h-3 shrink-0" style={{ color: '#7C3AED' }} aria-label="Registrado automáticamente" />}
                        <span className="truncate">{g.descripcion}</span>
                      </span>
                      <span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={{
                            background: `${COLOR_CATEGORIA[g.categoria] ?? '#8E87A8'}1A`,
                            color: COLOR_CATEGORIA[g.categoria] ?? '#8E87A8',
                          }}>
                          {CATEGORIAS.find(c => c.valor === g.categoria)?.texto ?? g.categoria}
                        </span>
                      </span>
                      <span className="text-right font-semibold tabular-nums" style={{ color: SALE }}>
                        {pesos(g.monto)}
                      </span>
                      {g.origen ? <span /> : (
                        <button type="button" onClick={() => borrar(g)} aria-label={`Borrar ${g.descripcion}`}
                          className="text-muted-foreground hover:text-[#A33A4E] transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Tarjeta>
          </>
        )}
      </div>

      {/* El registro manual. En modal y no al final de la pagina: ahi quedaba
          debajo de las graficas y de la tabla, tan lejos que el boton parecia
          no hacer nada. */}
      <HojaInferior
        abierta={abierto}
        onCerrar={() => setAbierto(false)}
        titulo="Registrar un gasto"
        ayuda="Se suma al mes de la fecha que pongas"
        ancho="md"
        pie={
          <div className="flex gap-2">
            <button type="button" onClick={() => setAbierto(false)}
              className="flex-1 text-[12.5px] font-semibold px-3.5 py-2.5 rounded-xl border border-border text-muted-foreground">
              Cancelar
            </button>
            <button type="button" onClick={guardar} disabled={guardando}
              className="flex-[1.4] text-[12.5px] font-semibold px-4 py-2.5 rounded-xl text-white bg-primary disabled:opacity-60">
              {guardando ? 'Guardando...' : 'Guardar gasto'}
            </button>
          </div>
        }
      >
        <div className="grid gap-2.5 grid-cols-2">
          <Campo etiqueta="Fecha">
            {/* El calendario del proyecto, nunca el del navegador: ese se dibuja
                distinto en cada sistema y no se parece a nada de la app. */}
            <DatePicker
              value={nuevo.fecha}
              onChange={v => setNuevo(n => ({ ...n, fecha: v || hoyISO() }))}
              maxDate={new Date()}
            />
          </Campo>
          <Campo etiqueta="Monto">
            <input inputMode="numeric" value={nuevo.monto} placeholder="$ 92.000"
              onChange={e => {
                const limpio = e.target.value.replace(/[^\d]/g, '');
                setNuevo(n => ({ ...n, monto: limpio ? Number(limpio).toLocaleString('es-CO') : '' }));
              }}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-[13px] tabular-nums font-semibold outline-none focus:border-primary" />
          </Campo>
          <div className="col-span-2">
            <Campo etiqueta="Categoría">
              <Desplegable valor={nuevo.categoria} opciones={CATEGORIAS} vacio="Elegir"
                titulo="Categoría del gasto"
                onElegir={v => setNuevo(n => ({ ...n, categoria: v }))} />
            </Campo>
          </div>
          <div className="col-span-2">
            <Campo etiqueta="Descripción">
              <input value={nuevo.descripcion}
                onChange={e => setNuevo(n => ({ ...n, descripcion: e.target.value }))}
                placeholder="Railway, Vercel y Neon de agosto"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-[13px] outline-none focus:border-primary" />
            </Campo>
          </div>
        </div>

        {errorModal && (
          <p className="text-[12px] rounded-xl px-3 py-2 mt-2.5 mb-0"
            style={{ background: 'rgba(239,71,111,0.1)', color: '#A33A4E' }}>
            {errorModal}
          </p>
        )}
      </HojaInferior>
    </div>
  );
}

function Tarjeta({ children, sinAire }: { children: React.ReactNode; sinAire?: boolean }) {
  return (
    <div className={`bg-white rounded-2xl border border-border ${sinAire ? '' : 'p-4'}`}>
      {children}
    </div>
  );
}

/**
 * Una cifra de cabecera.
 *
 * El rótulo va en minúscula y no en versalitas: en este proyecto no se usa
 * `uppercase` en ningún rótulo, y era justo lo que hacía ver estas tarjetas
 * como una plantilla ajena.
 */
function Cifra({ rotulo, valor, nota, color, pastilla }: {
  rotulo: string;
  valor: string;
  nota?: string;
  color?: string;
  pastilla?: { texto: string; bien: boolean };
}) {
  return (
    <div className="bg-white rounded-2xl border border-border p-3.5 flex flex-col">
      <span className="text-[12px] font-medium text-muted-foreground flex items-center gap-1.5">
        {color && <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: color }} />}
        {rotulo}
      </span>
      <b className="text-[24px] font-bold tracking-tight tabular-nums leading-tight mt-0.5" style={{ color }}>
        {valor}
      </b>
      {pastilla && (
        <span className="text-[11px] font-bold rounded-full px-2 py-0.5 mt-1 self-start"
          style={pastilla.bien
            ? { background: 'rgba(14,124,87,0.1)', color: ENTRA }
            : { background: 'rgba(194,65,12,0.1)', color: SALE }}>
          {pastilla.texto}
        </span>
      )}
      {nota && <span className="text-[11.5px] text-muted-foreground mt-0.5">{nota}</span>}
    </div>
  );
}

/** Un número del pulso: la cifra grande y qué mide, debajo. */
function Dato({ n, q }: { n: string; q: string }) {
  return (
    <span className="flex flex-col">
      <b className="text-[17px] font-bold tracking-tight tabular-nums leading-tight">{n}</b>
      <span className="text-[11.5px] text-muted-foreground">{q}</span>
    </span>
  );
}

function Punto({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground font-medium">
      <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: color }} />
      {children}
    </span>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold text-muted-foreground">{etiqueta}</label>
      {children}
    </div>
  );
}
