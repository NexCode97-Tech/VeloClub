'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Building2, Clock, CreditCard, DollarSign, Plus, TrendingUp, Trash2, Zap } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
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

/**
 * El color de cada categoría, en un orden fijo. Nunca se ciclan.
 *
 * «Otros» va en el negro del texto y no en un color propio, que además es lo
 * que corresponde: es el cajón de lo que no cae en ninguna, no una categoría
 * con identidad. Un neutro dice eso mismo sin tener que explicarlo.
 *
 * Esta tabla es la única fuente: el ranking, la pastilla de la tabla y el punto
 * del desplegable salen todos de acá, así que un color se cambia una vez.
 */
const COLOR_CATEGORIA: Record<string, string> = {
  INFRAESTRUCTURA: '#7C3AED',
  COMISIONES:      '#DC2626',
  PUBLICIDAD:      '#38BDF8',
  HERRAMIENTAS:    '#0E7C57',
  OTROS:           '#1A1028',
};

/**
 * Cada categoría lleva su color al desplegable: es el mismo con el que sale en
 * el ranking «En qué se va» y en la pastilla de la tabla. Sin eso hay que
 * aprenderse la correspondencia de memoria.
 */
const CATEGORIAS = [
  { valor: 'INFRAESTRUCTURA', texto: 'Infraestructura', nota: 'Servidores, base de datos, imágenes' },
  { valor: 'COMISIONES',      texto: 'Comisiones',      nota: 'Lo que cobra la pasarela de pagos' },
  { valor: 'PUBLICIDAD',      texto: 'Publicidad',      nota: 'Pauta y promoción' },
  { valor: 'HERRAMIENTAS',    texto: 'Herramientas',    nota: 'Programas y servicios de trabajo' },
  { valor: 'OTROS',           texto: 'Otros' },
].map(c => ({ ...c, color: COLOR_CATEGORIA[c.valor] }));

/**
 * Con qué se abre la pantalla: el año en curso, de enero al mes de hoy.
 *
 * Antes arrancaba en los últimos seis meses pero el botón decía «Ago 2026», que
 * es el mes actual: el control afirmaba una cosa y la gráfica mostraba otra. El
 * año es además el periodo con el que se piensa un negocio.
 *
 * No llega a diciembre a propósito: los meses que no han pasado dibujarían
 * media gráfica en blanco como si no hubiera habido movimiento.
 */
function anioEnCurso(): DateRange {
  const h = new Date();
  return { start: new Date(h.getFullYear(), 0, 1), end: new Date(h.getFullYear(), h.getMonth() + 1, 0) };
}

interface Gasto {
  id: string;
  fecha: string;
  monto: number;
  categoria: string;
  descripcion: string;
  /** Lo anotó el sistema, no una persona. Hoy solo la comisión de la pasarela. */
  origen?: string | null;
}

/**
 * Plata que entró sin pasar por la pasarela: el saldo que un club paga por
 * Bre-B, una consultoría, lo que sea. Se anota a mano, igual que un gasto.
 */
interface Ingreso {
  id: string;
  fecha: string;
  monto: number;
  concepto: string;
  clubNombre?: string | null;
}

/** Una fila de la lista, venga de donde venga. */
type Movimiento =
  | { tipo: 'gasto'; id: string; fecha: string; monto: number; texto: string; categoria: string; origen?: string | null }
  | { tipo: 'ingreso'; id: string; fecha: string; monto: number; texto: string; club?: string | null };

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

const VACIO = { fecha: hoyISO(), monto: '', categoria: 'INFRAESTRUCTURA', descripcion: '', club: '' };

export default function FinanzasSuperadmin() {
  const { getToken } = useAuth();
  // El mismo selector de Analíticas, en su modo de meses: un mes, o el rango
  // entre dos. No hay un segundo filtro con el que pelear.
  const [mesElegido, setMesElegido] = useState<string | null>(() => `${new Date().getFullYear()}-01`);
  const [rangoFechas, setRangoFechas] = useState<DateRange | null>(anioEnCurso);
  const [datos, setDatos] = useState<Finanzas | null>(null);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [abierto, setAbierto] = useState(false);
  // Qué se está anotando. El modal es el mismo: cambia el color, el campo de
  // categoría por el del club, y a dónde se manda.
  const [tipo, setTipo] = useState<'gasto' | 'ingreso'>('gasto');
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
      const rango = rangoFechas ?? anioEnCurso();
      const busqueda = rangoFechas
        ? `desde=${aISO(rango.start)}&hasta=${aISO(rango.end)}`
        : mesElegido
          ? `desde=${mesElegido}-01&hasta=${mesElegido}-01`
          : `desde=${aISO(rango.start)}&hasta=${aISO(rango.end)}`;
      const [f, g, i] = await Promise.all([
        apiFetch<Finanzas>(`/superadmin/finanzas?${busqueda}`, { token }),
        apiFetch<{ gastos: Gasto[] }>('/superadmin/finanzas/gastos', { token }),
        apiFetch<{ ingresos: Ingreso[] }>('/superadmin/finanzas/ingresos', { token }),
      ]);
      setDatos(f);
      setGastos(g.gastos);
      setIngresos(i.ingresos);
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

  /** Cuántos meses distintos abarca lo que se está viendo. Nunca cero. */
  const mesesDelPeriodo = useMemo(() => {
    const meses = new Set((datos?.meses ?? []).map(m => m.mes.slice(0, 7)));
    return Math.max(1, meses.size);
  }, [datos]);

  /** Gastos e ingresos en una sola lista, del más nuevo al más viejo. */
  const movimientos = useMemo<Movimiento[]>(() => [
    ...gastos.map(g => ({
      tipo: 'gasto' as const, id: g.id, fecha: g.fecha, monto: g.monto,
      texto: g.descripcion, categoria: g.categoria, origen: g.origen,
    })),
    ...ingresos.map(i => ({
      tipo: 'ingreso' as const, id: i.id, fecha: i.fecha, monto: i.monto,
      texto: i.concepto, club: i.clubNombre,
    })),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha)), [gastos, ingresos]);

  const gastosDelPeriodo = useMemo(() => {
    // Los tramos vienen por mes o por día según el rango, así que se recortan a
    // `aaaa-mm` para comparar. Sin esto, al ver un mes en días la clave era
    // `2026-08-14` contra `2026-08` y la tarjeta decía «0 gastos registrados»
    // con la cifra de gastos al lado.
    const dentro = new Set((datos?.meses ?? []).map(m => m.mes.slice(0, 7)));
    return gastos.filter(g => dentro.has(g.fecha.slice(0, 7))).length;
  }, [gastos, datos]);

  /** Cuántos ingresos a mano caen en el periodo, para la nota de la tarjeta. */
  const ingresosAMano = useMemo(() => {
    const dentro = new Set((datos?.meses ?? []).map(m => m.mes.slice(0, 7)));
    return ingresos.filter(i => dentro.has(i.fecha.slice(0, 7))).length;
  }, [ingresos, datos]);

  async function guardar() {
    const monto = Number(nuevo.monto.replace(/[^\d]/g, ''));
    if (!monto || nuevo.descripcion.trim().length < 2) {
      setErrorModal(`Falta el monto o la descripción del ${tipo}.`);
      return;
    }
    setGuardando(true);
    setErrorModal(null);
    try {
      const token = await getToken();
      // Cada uno tiene sus campos: el gasto va a una categoría y el ingreso a un
      // club. Se arma el cuerpo explícito y no un `...nuevo`, que le mandaría al
      // servidor los campos del otro.
      const cuerpo = tipo === 'gasto'
        ? { fecha: nuevo.fecha, monto, categoria: nuevo.categoria, descripcion: nuevo.descripcion }
        : { fecha: nuevo.fecha, monto, concepto: nuevo.descripcion, clubNombre: nuevo.club || undefined };
      await apiFetch(`/superadmin/finanzas/${tipo === 'gasto' ? 'gastos' : 'ingresos'}`, {
        method: 'POST', token,
        body: JSON.stringify(cuerpo),
      });
      setNuevo({ ...VACIO, categoria: nuevo.categoria });
      setAbierto(false);
      await cargar();
    } catch {
      setErrorModal(`No se pudo guardar el ${tipo}. Intenta de nuevo.`);
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(g: Movimiento) {
    if (!confirm(`¿Borrar el ${g.tipo} de ${pesos(g.monto)}?\n\n${g.texto}`)) return;
    try {
      const token = await getToken();
      const ruta = g.tipo === 'gasto' ? 'gastos' : 'ingresos';
      await apiFetch(`/superadmin/finanzas/${ruta}/${g.id}`, { method: 'DELETE', token });
      await cargar();
    } catch {
      setError('No se pudo borrar. Intenta de nuevo.');
    }
  }

  return (
    <div style={{ background: '#F7F7FB', minHeight: '100%' }}>
      <div className="px-4 pt-4 pb-24 flex flex-col gap-3 max-w-5xl mx-auto">

        {error && (
          <p className="text-[12px] rounded-xl px-3 py-2 m-0"
            style={{ background: 'rgba(239,71,111,0.1)', color: '#A33A4E' }}>
            {error}
          </p>
        )}

        {/* Los dos únicos controles de la pantalla, juntos. El periodo hace
            todo por sí solo —un mes, o el rango entre dos—, así que no hay un
            segundo filtro con el que pelear; y el botón vive acá y no en la
            cabecera, para que la acción quede al lado de lo que filtra. */}
        <div className="flex items-center justify-end gap-2">
          <MonthPicker
            value={mesElegido}
            currentMonth={new Date().toISOString().slice(0, 7)}
            dateRange={rangoFechas}
            onChange={(mes, r) => { setMesElegido(mes); setRangoFechas(r); }}
            modo="meses"
            alignRight
          />
          {/* Siempre dice lo mismo. Un botón que cambia a «Cancelar» obliga a
              leerlo antes de tocarlo; el modal ya tiene su propio cancelar. */}
          <button type="button"
            onClick={() => { setErrorModal(null); setTipo('gasto'); setAbierto(true); }}
            className="inline-flex items-center gap-1.5 text-white text-[12.5px] font-semibold px-3.5 h-9 rounded-xl shrink-0 whitespace-nowrap"
            style={{ background: '#7C3AED' }}>
            <Plus className="w-3.5 h-3.5 shrink-0" />
            Registrar movimiento
          </button>
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
              {/* Si hubo plata anotada a mano se dice, porque explica una
                  diferencia real: esos pesos no están en ningún cobro de la
                  pasarela y si no se nombran, la cifra parece descuadrada. */}
              <Cifra rotulo="Ingresos" valor={pesos(periodo.entra)} color={ENTRA} sinPunto
                nota={ingresosAMano > 0
                  ? `${datos.pulso.clubesQuePagan} clubes · ${ingresosAMano} a mano`
                  : datos.granularidad === 'dia'
                    ? `${datos.pulso.clubesQuePagan} clubes, 1 mes`
                    : `${datos.pulso.clubesQuePagan} clubes, ${datos.meses.length} meses`} />
              <Cifra rotulo="Gastos" valor={pesos(periodo.sale)} color={SALE} sinPunto
                nota={`${gastosDelPeriodo} ${gastosDelPeriodo === 1 ? 'gasto registrado' : 'gastos registrados'}`} />
              <Cifra rotulo="Saldo del periodo"
                valor={`${saldo < 0 ? '-' : ''}${pesos(Math.abs(saldo))}`}
                pastilla={periodo.entra > 0
                  ? { texto: `${Math.round((saldo / periodo.entra) * 100)}% de margen`, bien: saldo >= 0 }
                  : undefined}
                nota={periodo.entra > 0 ? undefined : 'sin ingresos en el periodo'} />
              {/* Los meses del periodo, no los tramos: al ver un mes en días
                  los tramos son 31 y el promedio mensual sería el de un día. */}
              <Cifra rotulo="Promedio mensual"
                valor={pesos(periodo.entra / mesesDelPeriodo)}
                nota={mesesDelPeriodo === 1 ? 'de ingresos en el mes' : `de ingresos, en ${mesesDelPeriodo} meses`} />
            </div>

            <Tarjeta>
              <div className="flex items-baseline gap-2 flex-wrap">
                <h2 className="text-[15px] font-semibold text-foreground m-0">
                  {datos.granularidad === 'dia' ? 'Ingresos y gastos por día' : 'Ingresos y gastos por mes'}
                </h2>
                {/* Con dos series la leyenda va siempre: la identidad no puede
                    depender solo del color. */}
                <span className="ml-auto flex gap-3">
                  <Punto color={ENTRA}>Ingresos</Punto>
                  <Punto color={SALE}>Gastos</Punto>
                </span>
              </div>
              <GraficaMeses meses={datos.meses} />
            </Tarjeta>

            {/* El pulso: lo que no cuentan las cifras de arriba. No depende del
                filtro, porque son preguntas sobre el negocio entero. */}
            <Tarjeta>
              <h2 className="text-[15px] font-semibold text-foreground m-0">El pulso del negocio</h2>
              <p className="text-[11.5px] text-muted-foreground m-0 mb-3">Del registro al primer pago</p>

              {/* El embudo. Seis números planos escondían lo único que de
                  verdad cuenta: de los clubes que se registraron, cuántos
                  llegaron a pagar. Cada etapa lleva su cifra y su porcentaje
                  escritos, así que el color nunca es el único indicio. */}
              <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-3">
                {/* Los tres colores son los que ya usa el superadmin en su
                    pantalla de inicio: el amarillo de «Total clubes» y el verde
                    de «Total recaudado». Y de paso arman una progresión que se
                    lee sola: amarillo lo que apenas llegó, ámbar lo que está en
                    camino, verde lo que ya cerró.

                    Los dos son claros y sobre blanco tienen poco contraste, así
                    que la cifra y el porcentaje van escritos al lado: el color
                    acompaña la lectura, nunca la sostiene solo. */}
                <Etapa
                  icono={<Building2 className="w-3.5 h-3.5 shrink-0" />}
                  titulo="Se registraron"
                  n={datos.pulso.clubesTotal}
                  pct={100}
                  color="#FFB703"
                  glosa="Clubes creados desde el primer día"
                />
                <Etapa
                  icono={<Clock className="w-3.5 h-3.5 shrink-0" />}
                  titulo="Están probando"
                  n={datos.pulso.enPrueba}
                  pct={porcentaje(datos.pulso.enPrueba, datos.pulso.clubesTotal)}
                  color="#B45309"
                  glosa="Todavía dentro del periodo gratis"
                  demora={80}
                />
                <Etapa
                  icono={<CreditCard className="w-3.5 h-3.5 shrink-0" />}
                  titulo="Ya pagan"
                  n={datos.pulso.clubesQuePagan}
                  pct={porcentaje(datos.pulso.clubesQuePagan, datos.pulso.clubesTotal)}
                  color="#06D6A0"
                  glosa="Con al menos un pago acreditado"
                  destacado
                  demora={160}
                />
              </div>

              <div className="h-px bg-border my-4" />

              {/* Una sola malla y no dos bloques sueltos: así las cuatro cifras
                  caen en la misma línea base y se comparan de un barrido. */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-y-2.5">
                <TituloGrupo icono={<DollarSign className="w-3.5 h-3.5 shrink-0" />}>Lo que deja</TituloGrupo>
                <TituloGrupo icono={<TrendingUp className="w-3.5 h-3.5 shrink-0" />} segundo>Cómo crece</TituloGrupo>

                <Dato n={pesos(datos.mensual.monto)} u="al mes" q="Ingreso recurrente" primero />
                <Dato n={pesos(datos.pulso.promedioPorClub)} q="Promedio por club" />
                <Dato n={datos.pulso.clubesNuevosPorMes.toLocaleString('es-CO')} u="al mes" q="Clubes nuevos" abreGrupo />
                <Dato n={datos.pulso.deportistas.toLocaleString('es-CO')} q="Deportistas" />
              </div>
            </Tarjeta>

            <div className="grid gap-3 lg:grid-cols-2">
              <Tarjeta>
                {/* Una sola serie: sin caja de leyenda, el título la nombra. */}
                <h2 className="text-[15px] font-semibold text-foreground m-0">Ingresos por club</h2>
                <p className="text-[11.5px] text-muted-foreground m-0">Total pagado desde el primer día</p>
                <Ranking colores="#7C3AED"
                  filas={datos.clubes.map(c => ({ nombre: c.nombre, valor: c.total }))} />
              </Tarjeta>

              <Tarjeta>
                <h2 className="text-[15px] font-semibold text-foreground m-0">Gastos por categoría</h2>
                <p className="text-[11.5px] text-muted-foreground m-0">Dentro del periodo seleccionado</p>
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
                <h2 className="text-[15px] font-semibold text-foreground m-0">Movimientos registrados</h2>
                <p className="text-[11.5px] text-muted-foreground m-0 mt-0.5">
                  Lo que se anota a mano. Los cobros de la pasarela entran solos.
                </p>
              </div>
              {movimientos.length === 0 ? (
                <p className="text-[12.5px] text-muted-foreground m-0 px-4 py-6 text-center">
                  Todavía no has registrado ningún movimiento.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  {movimientos.map(m => (
                    <div key={`${m.tipo}-${m.id}`}
                      className="grid grid-cols-[4.5rem_minmax(9rem,1fr)_7.5rem_7rem_1.8rem] gap-2 items-center px-4 py-2.5 border-b border-border/50 last:border-b-0 text-[12.5px] min-w-[31rem]">
                      <span className="text-muted-foreground tabular-nums">
                        {new Date(m.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                      </span>
                      <span className="text-foreground truncate flex items-center gap-1.5" title={m.texto}>
                        {/* El rayo dice que lo puso el sistema. No es solo un
                            adorno: es el motivo por el que no tiene papelera. */}
                        {m.tipo === 'gasto' && m.origen && (
                          <Zap className="w-3 h-3 shrink-0" style={{ color: '#7C3AED' }} aria-label="Registrado automáticamente" />
                        )}
                        <span className="truncate">{m.texto}</span>
                      </span>
                      <span>
                        {m.tipo === 'gasto' ? (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                            style={{
                              background: `${COLOR_CATEGORIA[m.categoria] ?? '#8E87A8'}1A`,
                              color: COLOR_CATEGORIA[m.categoria] ?? '#8E87A8',
                            }}>
                            {CATEGORIAS.find(c => c.valor === m.categoria)?.texto ?? m.categoria}
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground truncate block" title={m.club ?? ''}>
                            {m.club || 'Ingreso'}
                          </span>
                        )}
                      </span>
                      {/* El signo va escrito, no solo el color: en una lista
                          mezclada, saber si suma o resta no puede depender de
                          distinguir dos tonos. */}
                      <span className="text-right font-semibold tabular-nums"
                        style={{ color: m.tipo === 'gasto' ? SALE : ENTRA }}>
                        {m.tipo === 'gasto' ? '−' : '+'}{pesos(m.monto)}
                      </span>
                      {m.tipo === 'gasto' && m.origen ? <span /> : (
                        <button type="button" onClick={() => borrar(m)} aria-label={`Borrar ${m.texto}`}
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
        titulo="Registrar un movimiento"
        ayuda="Se suma al mes de la fecha que pongas"
        ancho="md"
        pie={
          <div className="flex gap-2">
            <button type="button" onClick={() => setAbierto(false)}
              className="flex-1 text-[12.5px] font-semibold px-3.5 py-2.5 rounded-xl border border-border text-muted-foreground">
              Cancelar
            </button>
            <button type="button" onClick={guardar} disabled={guardando}
              className="flex-[1.4] text-[12.5px] font-semibold px-4 py-2.5 rounded-xl text-white disabled:opacity-60"
              style={{ background: tipo === 'gasto' ? SALE : ENTRA }}>
              {guardando ? 'Guardando...' : `Guardar ${tipo}`}
            </button>
          </div>
        }
      >
        {/* Lo primero es qué se anota: cambia el resto del formulario, así que
            preguntarlo después obligaría a releer lo ya escrito. */}
        <div className="flex gap-1 p-[3px] rounded-xl bg-secondary mb-3">
          {(['gasto', 'ingreso'] as const).map(t => (
            <button key={t} type="button"
              onClick={() => { setTipo(t); setErrorModal(null); }}
              aria-pressed={tipo === t}
              className="flex-1 text-[12.5px] font-semibold py-2 rounded-lg transition-colors capitalize"
              style={tipo === t
                ? { background: '#fff', color: t === 'gasto' ? SALE : ENTRA, boxShadow: '0 1px 3px rgba(26,16,40,0.08)' }
                : { color: '#8E87A8' }}>
              {t === 'gasto' ? 'Sale' : 'Entra'}
            </button>
          ))}
        </div>

        <div className="grid gap-2.5 grid-cols-2">
          <Campo etiqueta="Fecha">
            {/* El calendario del proyecto, nunca el del navegador: ese se dibuja
                distinto en cada sistema y no se parece a nada de la app. */}
            <DatePicker
              value={nuevo.fecha}
              onChange={v => setNuevo(n => ({ ...n, fecha: v || hoyISO() }))}
              maxDate={new Date()}
              compacto
              limpiable={false}
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
            {tipo === 'gasto' ? (
              <Campo etiqueta="Categoría">
                <Desplegable valor={nuevo.categoria} opciones={CATEGORIAS} vacio="Elegir"
                  titulo="Categoría del gasto"
                  onElegir={v => setNuevo(n => ({ ...n, categoria: v }))} />
              </Campo>
            ) : (
              <Campo etiqueta="De qué club · opcional">
                <input value={nuevo.club}
                  onChange={e => setNuevo(n => ({ ...n, club: e.target.value }))}
                  placeholder="Correcaminos"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-[13px] outline-none focus:border-primary" />
              </Campo>
            )}
          </div>
          <div className="col-span-2">
            <Campo etiqueta="Descripción">
              <input value={nuevo.descripcion}
                onChange={e => setNuevo(n => ({ ...n, descripcion: e.target.value }))}
                placeholder={tipo === 'gasto' ? 'Railway, Vercel y Neon de agosto' : 'Saldo del trimestre por Bre-B'}
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
function Cifra({ rotulo, valor, nota, color, pastilla, sinPunto }: {
  rotulo: string;
  valor: string;
  nota?: string;
  color?: string;
  pastilla?: { texto: string; bien: boolean };
  /** El punto sobra cuando la cifra ya va en el color de su serie. */
  sinPunto?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-border p-3.5 flex flex-col">
      <span className="text-[12px] font-medium text-muted-foreground flex items-center gap-1.5">
        {color && !sinPunto && <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: color }} />}
        {rotulo}
      </span>
      <b className="text-[24px] font-bold tracking-tight tabular-nums leading-tight mt-0.5" style={{ color }}>
        {valor}
      </b>
      {/* Verde vivo, pero el vivo va en el fondo: puesto en el texto da 3,04
          de contraste y en una pastilla de 11px no se lee. */}
      {pastilla && (
        <span className="text-[11px] font-bold rounded-full px-2 py-0.5 mt-1 self-start"
          style={pastilla.bien
            ? { background: '#EAFBF0', color: '#15803D' }
            : { background: 'rgba(220,38,38,0.1)', color: SALE }}>
          {pastilla.texto}
        </span>
      )}
      {nota && <span className="text-[11.5px] text-muted-foreground mt-0.5">{nota}</span>}
    </div>
  );
}

/** Cuánto de `total` es `parte`, redondeado. Sin total no hay porcentaje. */
function porcentaje(parte: number, total: number): number {
  return total > 0 ? Math.round((parte / total) * 100) : 0;
}

/**
 * Una etapa del embudo.
 *
 * El riel es la proporción y la cifra es el dato: van juntos a propósito, para
 * que quien no distinga los colores igual lea la etapa completa.
 */
function Etapa({ icono, titulo, n, pct, color, glosa, destacado, demora = 0 }: {
  icono: React.ReactNode;
  titulo: string;
  n: number;
  pct: number;
  color: string;
  glosa: string;
  /** La última lleva el porcentaje en pastilla: es la pregunta del bloque. */
  destacado?: boolean;
  demora?: number;
}) {
  return (
    <div className="rounded-xl border border-border p-3 flex flex-col gap-2 transition-colors hover:border-primary/30 hover:bg-primary/[0.03]">
      <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground">
        {icono}{titulo}
      </span>
      <span className="flex items-baseline gap-2">
        <b className="text-[25px] font-bold tracking-tighter tabular-nums leading-none">{n}</b>
        {destacado ? (
          <span className="text-[11.5px] font-semibold tabular-nums rounded-full px-2 py-0.5"
            style={{ background: '#EAFBF0', color: '#15803D' }}>
            {pct}%
          </span>
        ) : (
          <span className="text-[11.5px] font-semibold tabular-nums"
            style={{ color: pct === 100 ? '#8E87A8' : color }}>
            {pct}%
          </span>
        )}
      </span>
      <span className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(26,16,40,0.05)' }}>
        <i className="vc-franja block h-full rounded-full"
          style={{ width: `${pct}%`, background: color, animationDelay: `${demora}ms` }} />
      </span>
      <span className="text-[11px] text-muted-foreground leading-snug">{glosa}</span>
    </div>
  );
}

/** El rótulo de un grupo de cifras. Abarca sus dos columnas. */
function TituloGrupo({ icono, children, segundo }: {
  icono: React.ReactNode;
  children: React.ReactNode;
  segundo?: boolean;
}) {
  return (
    <span className={`col-span-2 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground ${
      segundo ? 'mt-3 md:mt-0 md:pl-3.5' : ''
    }`}>
      {icono}{children}
    </span>
  );
}

/**
 * Un número del pulso: la cifra grande, su unidad y qué mide.
 *
 * La unidad no es decoración: «4,8» solo no significa nada, «4,8 al mes» sí.
 */
function Dato({ n, q, u, primero, abreGrupo }: {
  n: string;
  q: string;
  u?: string;
  /** Sin línea ni sangría a la izquierda: es el borde de la tarjeta. */
  primero?: boolean;
  /** Abre el segundo grupo, así que su línea va más marcada. */
  abreGrupo?: boolean;
}) {
  return (
    <span className={`flex flex-col gap-0.5 min-w-0 ${primero ? '' : 'pl-3.5 border-l'} ${
      abreGrupo ? 'max-md:pl-0 max-md:border-l-0 md:border-primary/20' : 'max-md:odd:pl-0 max-md:odd:border-l-0 border-border'
    }`}>
      <b className="text-[19px] font-bold tracking-tight tabular-nums leading-tight">
        {n}{u && <span className="text-[12px] font-medium text-muted-foreground ml-1 tracking-normal">{u}</span>}
      </b>
      <span className="text-[11.5px] text-muted-foreground leading-snug">{q}</span>
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
