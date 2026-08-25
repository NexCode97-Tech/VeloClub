'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { Plus, Trash2, X } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { AccionesCabecera } from '@/components/superadmin/acciones-cabecera';
import { Desplegable } from '@/components/ui/desplegable';
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

const RANGOS = [
  { meses: 1,  texto: 'Mes' },
  { meses: 6,  texto: '6 meses' },
  { meses: 12, texto: 'Año' },
  { meses: 36, texto: 'Todo' },
];

interface Gasto {
  id: string;
  fecha: string;
  monto: number;
  categoria: string;
  descripcion: string;
}

interface Finanzas {
  meses: MesFinanzas[];
  categorias: { categoria: string; monto: number }[];
  clubes: { clubId: string; nombre: string; total: number }[];
  mensual: { monto: number; clubes: number };
}

const pesos = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');

function hoyISO(): string {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
}

const VACIO = { fecha: hoyISO(), monto: '', categoria: 'INFRAESTRUCTURA', descripcion: '' };

export default function FinanzasSuperadmin() {
  const { getToken } = useAuth();
  const [rango, setRango] = useState(6);
  const [datos, setDatos] = useState<Finanzas | null>(null);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [abierto, setAbierto] = useState(false);
  const [nuevo, setNuevo] = useState(VACIO);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const token = await getToken();
      const [f, g] = await Promise.all([
        apiFetch<Finanzas>(`/superadmin/finanzas?meses=${rango}`, { token }),
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
  }, [getToken, rango]);

  useEffect(() => { cargar(); }, [cargar]);

  // El mes en curso es el último del arreglo: el backend siembra todos los del
  // rango, incluso los vacíos, así que siempre está.
  const mes = datos?.meses[datos.meses.length - 1];
  const neto = mes ? mes.entra - mes.sale : 0;
  const gastosDelMes = useMemo(() => {
    if (!mes) return 0;
    return gastos.filter(g => g.fecha.slice(0, 7) === mes.mes).length;
  }, [gastos, mes]);

  async function guardar() {
    const monto = Number(nuevo.monto.replace(/[^\d]/g, ''));
    if (!monto || nuevo.descripcion.trim().length < 2) {
      setError('Falta el monto o la descripción del gasto.');
      return;
    }
    setGuardando(true);
    setError(null);
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
      setError('No se pudo guardar el gasto. Intenta de nuevo.');
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
        <div className="flex items-center gap-1 p-[2px] rounded-[10px] bg-white border border-border">
          {RANGOS.map(r => (
            <button key={r.meses} type="button" onClick={() => setRango(r.meses)}
              className={`text-[11.5px] font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                rango === r.meses ? 'text-primary bg-secondary' : 'text-muted-foreground'
              }`}>
              {r.texto}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setAbierto(a => !a)}
          className="inline-flex items-center gap-1.5 text-white text-[12px] font-semibold px-3 py-2 rounded-xl shrink-0"
          style={{ background: abierto ? '#8E87A8' : '#7C3AED' }}>
          {abierto ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {abierto ? 'Cancelar' : 'Registrar gasto'}
        </button>
      </AccionesCabecera>

      <div className="px-4 pt-4 pb-24 flex flex-col gap-3 max-w-5xl mx-auto">

        {error && (
          <p className="text-[12px] rounded-xl px-3 py-2 m-0"
            style={{ background: 'rgba(239,71,111,0.1)', color: '#A33A4E' }}>
            {error}
          </p>
        )}

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
              <Cifra rotulo="Entró este mes" valor={pesos(mes?.entra ?? 0)} color={ENTRA}
                nota={`${mes?.clubes ?? 0} ${mes?.clubes === 1 ? 'club pagó' : 'clubes pagaron'}`} />
              <Cifra rotulo="Salió este mes" valor={pesos(mes?.sale ?? 0)} color={SALE}
                nota={`${gastosDelMes} ${gastosDelMes === 1 ? 'gasto registrado' : 'gastos registrados'}`} />
              <Cifra rotulo="Queda" valor={`${neto < 0 ? '-' : ''}${pesos(Math.abs(neto))}`}
                nota={mes && mes.entra > 0 ? `${Math.round((neto / mes.entra) * 100)}% de lo que entró` : 'sin ingresos este mes'} />
              <Cifra rotulo="Ingreso mensual" valor={pesos(datos.mensual.monto)}
                nota={`${datos.mensual.clubes} clubes al día, plan a mes`} />
            </div>

            <Tarjeta>
              <div className="flex items-baseline gap-2 flex-wrap">
                <h2 className="text-[15px] font-semibold text-foreground m-0">Entra y sale, mes a mes</h2>
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

            {/* El registro manual */}
            {abierto && (
              <motion.div
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              >
                <Tarjeta>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <h2 className="text-[15px] font-semibold text-foreground m-0">Registrar un gasto</h2>
                    <span className="text-[11.5px] text-muted-foreground">
                      Se suma al mes de la fecha que pongas
                    </span>
                  </div>

                  <div className="grid gap-2.5 sm:grid-cols-3 mt-3">
                    <Campo etiqueta="Fecha">
                      <input type="date" value={nuevo.fecha} max={hoyISO()}
                        onChange={e => setNuevo(n => ({ ...n, fecha: e.target.value }))}
                        style={{ appearance: 'none', WebkitAppearance: 'none' }}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-[13px] outline-none focus:border-primary" />
                    </Campo>
                    <Campo etiqueta="Categoría">
                      <Desplegable valor={nuevo.categoria} opciones={CATEGORIAS} vacio="Elegir"
                        titulo="Categoría del gasto"
                        onElegir={v => setNuevo(n => ({ ...n, categoria: v }))} />
                    </Campo>
                    <Campo etiqueta="Monto">
                      <input inputMode="numeric" value={nuevo.monto} placeholder="$ 92.000"
                        onChange={e => {
                          const limpio = e.target.value.replace(/[^\d]/g, '');
                          setNuevo(n => ({ ...n, monto: limpio ? Number(limpio).toLocaleString('es-CO') : '' }));
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-[13px] tabular-nums outline-none focus:border-primary" />
                    </Campo>
                    <div className="sm:col-span-3">
                      <Campo etiqueta="Descripción">
                        <input value={nuevo.descripcion}
                          onChange={e => setNuevo(n => ({ ...n, descripcion: e.target.value }))}
                          placeholder="Railway, Vercel y Neon de octubre"
                          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-[13px] outline-none focus:border-primary" />
                      </Campo>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-1">
                    <button type="button" onClick={() => setAbierto(false)}
                      className="text-[12.5px] font-semibold px-3.5 py-2 rounded-xl border border-border text-muted-foreground">
                      Cancelar
                    </button>
                    <button type="button" onClick={guardar} disabled={guardando}
                      className="text-[12.5px] font-semibold px-4 py-2 rounded-xl text-white bg-primary disabled:opacity-60">
                      {guardando ? 'Guardando...' : 'Guardar gasto'}
                    </button>
                  </div>
                </Tarjeta>
              </motion.div>
            )}

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
                      <span className="text-foreground truncate" title={g.descripcion}>{g.descripcion}</span>
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
                      <button type="button" onClick={() => borrar(g)} aria-label={`Borrar ${g.descripcion}`}
                        className="text-muted-foreground hover:text-[#A33A4E] transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Tarjeta>
          </>
        )}
      </div>
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

function Cifra({ rotulo, valor, nota, color }: {
  rotulo: string; valor: string; nota: string; color?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-border p-3.5 flex flex-col gap-0.5">
      <span className="text-[10.5px] font-semibold tracking-[0.06em] uppercase text-muted-foreground flex items-center gap-1.5">
        {color && <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: color }} />}
        {rotulo}
      </span>
      <b className="text-[22px] font-bold tracking-tight tabular-nums leading-tight" style={{ color }}>
        {valor}
      </b>
      <span className="text-[11px] text-muted-foreground">{nota}</span>
    </div>
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
