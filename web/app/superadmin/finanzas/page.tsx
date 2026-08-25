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

/** El color de cada categoría, en un orden fijo. Nunca se ciclan. */
const COLOR_CATEGORIA: Record<string, string> = {
  INFRAESTRUCTURA: '#7C3AED',
  COMISIONES:      '#DC2626',
  PUBLICIDAD:      '#0369A1',
  HERRAMIENTAS:    '#0E7C57',
  OTROS:           '#A33A4E',
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
    // Los tramos vienen por mes o por día según el rango, así que se recortan a
    // `aaaa-mm` para comparar. Sin esto, al ver un mes en días la clave era
    // `2026-08-14` contra `2026-08` y la tarjeta decía «0 gastos registrados»
    // con la cifra de gastos al lado.
    const dentro = new Set((datos?.meses ?? []).map(m => m.mes.slice(0, 7)));
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
          <button type="button" onClick={() => { setErrorModal(null); setAbierto(true); }}
            className="inline-flex items-center gap-1.5 text-white text-[12.5px] font-semibold px-3.5 h-9 rounded-xl shrink-0 whitespace-nowrap"
            style={{ background: '#7C3AED' }}>
            <Plus className="w-3.5 h-3.5 shrink-0" />
            Registrar gasto
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
              <h2 className="text-[15px] font-semibold text-foreground m-0">El pulso del negocio</h2>
              <p className="text-[11.5px] text-muted-foreground m-0 mb-3">Del registro al primer pago</p>

              {/* El embudo. Seis números planos escondían lo único que de
                  verdad cuenta: de los clubes que se registraron, cuántos
                  llegaron a pagar. Cada etapa lleva su cifra y su porcentaje
                  escritos, así que el color nunca es el único indicio. */}
              <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-3">
                <Etapa
                  icono={<Building2 className="w-3.5 h-3.5 shrink-0" />}
                  titulo="Se registraron"
                  n={datos.pulso.clubesTotal}
                  pct={100}
                  color="#7C3AED"
                  tenue
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
                  color="#7C3AED"
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
function Etapa({ icono, titulo, n, pct, color, glosa, tenue, destacado, demora = 0 }: {
  icono: React.ReactNode;
  titulo: string;
  n: number;
  pct: number;
  color: string;
  glosa: string;
  /** La primera etapa es el total: su riel va apagado, no compite. */
  tenue?: boolean;
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
            style={{ color: tenue ? '#8E87A8' : color }}>
            {pct}%
          </span>
        )}
      </span>
      <span className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(26,16,40,0.05)' }}>
        <i className="vc-franja block h-full rounded-full"
          style={{ width: `${pct}%`, background: color, opacity: tenue ? 0.35 : 1, animationDelay: `${demora}ms` }} />
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
