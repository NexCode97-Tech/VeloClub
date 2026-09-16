'use client';

import { useSession } from '@clerk/nextjs';
import { useCallback, useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { apiFetch } from '@/lib/api-client';
import { AlertTriangle } from 'lucide-react';
import ModuleLoader from '@/components/ui/module-loader';
import { MonthPicker, DateRange } from '@/components/ui/month-picker';
import { AccionesCabecera } from '@/components/superadmin/acciones-cabecera';

/**
 * Uso de la plataforma, club por club.
 *
 * La pregunta que responde no es cuánto cobra un club sino si lo está
 * aprovechando. Un club al día que lleva tres semanas sin entrar no renueva, y
 * eso hoy no se ve en ninguna otra pantalla.
 *
 * La tabla se ordena por riesgo y nunca por tamaño. Un ranking por volumen deja
 * arriba al club más grande aunque lleve un mes sin abrir la app, que es
 * exactamente el caso que hay que cazar.
 */

type Estado = 'activo' | 'enfriandose' | 'inactivo' | 'sin_arrancar';

interface UsoDeClub {
  clubId: string;
  nombre: string;
  activo: boolean;
  deportistas: number;
  diasActivos: number;
  acciones: number;
  ultimaAsistencia: string | null;
  barras: number[];
  personasActivas: number;
  ultimoIngreso: number | null;
  diasSinUsar: number | null;
  estado: Estado;
}

interface Resumen {
  clubes: UsoDeClub[];
  totales: { conActividad: number; total: number; enRiesgo: number; sinArrancar: number; acciones: number };
  serie: { fecha: string; dias: number }[];
  tramo: 'dia' | 'semana';
  ingresosDisponibles: boolean;
}

// Los colores de estado van aparte del morado de marca a propósito: el morado
// identifica la plataforma, estos dicen si algo anda bien o mal.
const ESTADOS: Record<Estado, { texto: string; color: string; fondo: string }> = {
  activo:       { texto: 'Activo',       color: '#06875A', fondo: 'rgba(6,135,90,0.10)' },
  enfriandose:  { texto: 'Enfriándose',  color: '#B26A00', fondo: 'rgba(178,106,0,0.12)' },
  inactivo:     { texto: 'Inactivo',     color: '#C62F50', fondo: 'rgba(198,47,80,0.10)' },
  sin_arrancar: { texto: 'Sin arrancar', color: '#C62F50', fondo: 'rgba(198,47,80,0.10)' },
};

const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function fechaCorta(iso: string): string {
  // El ano no se muestra: son doce semanas, todas del mismo o del anterior, y
  // repetirlo en cada marca del eje solo lo ensucia.
  const [, mes, dia] = iso.split('-').map(Number);
  return `${dia} ${MESES[mes - 1]}`;
}

function haceCuanto(dias: number | null): string {
  if (dias === null) return 'Nunca';
  if (dias === 0)    return 'Hoy';
  if (dias === 1)    return 'Ayer';
  return `Hace ${dias} días`;
}

/**
 * Las doce semanas de un club, en barras.
 *
 * Barras y no línea porque son doce tramos sueltos: una línea sugeriría que hay
 * algo medido entre una semana y la siguiente. Las viejas van más claras y las
 * recientes más oscuras, así la dirección se lee sin comparar alturas.
 */
function Chispa({ barras, color, tramo }: { barras: number[]; color: string; tramo: 'dia' | 'semana' }) {
  const max = Math.max(...barras, 1);
  const an = 104, al = 26;
  // Con treinta barras el hueco de 2 se come la mitad del ancho, asi que se
  // encoge cuando hay muchas.
  const hueco = barras.length > 16 ? 1 : 2;
  const ancho = (an - hueco * (barras.length - 1)) / barras.length;

  return (
    <svg viewBox={`0 0 ${an} ${al}`} className="block w-[104px] h-[26px]"
      role="img" aria-label={`Actividad por ${tramo} en el periodo`}>
      {barras.map((v, i) => {
        const h = v === 0 ? 1.5 : Math.max(2.5, (v / max) * (al - 3));
        const op = v === 0 ? 0.18 : 0.35 + 0.65 * (i / Math.max(1, barras.length - 1));
        return (
          <rect key={i} x={i * (ancho + hueco)} y={al - h} width={ancho} height={h}
            rx={1.5} fill={color} opacity={op} />
        );
      })}
    </svg>
  );
}

function Ficha({ rotulo, cifra, pie, alerta }: {
  rotulo: string; cifra: string; pie: string; alerta?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl px-4 py-3.5 flex flex-col gap-1.5"
      style={{ border: `1px solid ${alerta ? 'rgba(198,47,80,0.28)' : 'rgba(120,80,200,0.10)'}` }}>
      <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[#8E87A8]">{rotulo}</span>
      <span className="text-[26px] font-semibold leading-none tracking-tight"
        style={{ color: alerta ? '#C62F50' : '#1A1028' }}>{cifra}</span>
      <span className="text-[11.5px] text-[#8E87A8]">{pie}</span>
    </div>
  );
}

/** `aaaa-mm-dd` en hora local, sin pasar por UTC, que correria un dia. */
function aISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function UsoPage() {
  const { session } = useSession();
  const [datos, setDatos]       = useState<Resumen | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError]       = useState('');

  // El mes en curso es lo que se abre por defecto: es lo que se pregunta casi
  // siempre, y pedir doce semanas de arranque hacia ver mas ruido que señal.
  const ahora   = new Date();
  const mesHoy  = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
  const [mes, setMes]     = useState<string | null>(null);
  const [rango, setRango] = useState<DateRange | null>(null);

  const mesActivo = mes ?? mesHoy;
  const [anio, numeroMes] = mesActivo.split('-').map(Number);
  // Sin rango marcado dentro del mes, el periodo es el mes completo.
  const desde = rango ? aISO(rango.start) : aISO(new Date(anio, numeroMes - 1, 1));
  const hasta = rango ? aISO(rango.end)   : aISO(new Date(anio, numeroMes, 0));

  const cargar = useCallback(async (d: string, h: string) => {
    try {
      setCargando(true);
      const token = await session?.getToken();
      setDatos(await apiFetch<Resumen>(`/superadmin/uso?desde=${d}&hasta=${h}`, { token }));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos cargar el uso');
    } finally {
      setCargando(false);
    }
  }, [session]);

  useEffect(() => { if (session) void cargar(desde, hasta); }, [session, cargar, desde, hasta]);

  if (cargando) return <div className="px-5 pt-4 pb-8"><ModuleLoader /></div>;

  if (error || !datos) {
    return (
      <div className="px-5 pt-4 pb-8 max-w-5xl mx-auto w-full">
        <div className="rounded-2xl px-6 py-12 flex flex-col items-center text-center"
          style={{ background: 'rgba(198,47,80,0.04)', border: '1px solid rgba(198,47,80,0.14)' }}>
          <AlertTriangle className="w-6 h-6 mb-2" style={{ color: '#C62F50' }} />
          <p className="text-sm text-[#1A1028]">{error || 'No pudimos cargar el uso'}</p>
          <button onClick={() => void cargar(desde, hasta)}
            className="mt-3 text-[12.5px] font-semibold px-4 py-2 rounded-xl text-white"
            style={{ background: '#381DA0' }}>Reintentar</button>
        </div>
      </div>
    );
  }

  const { clubes, totales, serie, ingresosDisponibles } = datos;
  const serieGrafica = serie.map(s => ({ semana: fechaCorta(s.fecha), dias: s.dias }));

  return (
    <div className="px-5 pt-4 pb-8 max-w-5xl mx-auto w-full flex flex-col gap-4">

      {/* El selector vive en la fila del titulo, que la pinta el layout. */}
      <AccionesCabecera>
        <MonthPicker
          value={mes}
          currentMonth={mesHoy}
          dateRange={rango}
          onChange={(m, r) => { setMes(m); setRango(r); }}
          alignRight
        />
      </AccionesCabecera>

      {!ingresosDisponibles && (
        <div className="rounded-xl px-3.5 py-2.5 text-[12px] leading-relaxed flex gap-2"
          style={{ background: 'rgba(178,106,0,0.10)', border: '1px solid rgba(178,106,0,0.24)' }}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px" style={{ color: '#B26A00' }} />
          <span>No pudimos consultar los ingresos a la app. Lo demás sigue siendo correcto,
          pero la columna de personas activas viene vacía.</span>
        </div>
      )}

      {/* ── Resumen ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <Ficha rotulo="Activos"      cifra={`${totales.conActividad} / ${totales.total}`} pie="Entraron esta semana" />
        <Ficha rotulo="En riesgo"    cifra={String(totales.enRiesgo)}     pie="Más de 7 días sin entrar" alerta={totales.enRiesgo > 0} />
        <Ficha rotulo="Sin arrancar" cifra={String(totales.sinArrancar)}  pie="Nunca usaron la app"      alerta={totales.sinArrancar > 0} />
        <Ficha rotulo="Acciones"     cifra={totales.acciones.toLocaleString('es-CO')} pie="Últimas 12 semanas" />
      </div>

      {/* ── La plataforma entera ────────────────────────────────────────── */}
      {/* Una sola serie, así que no lleva leyenda: el título ya dice qué es. */}
      <div className="bg-white rounded-2xl px-4 pt-4 pb-2" style={{ border: '1px solid rgba(120,80,200,0.10)' }}>
        <div className="flex flex-wrap gap-2 items-baseline justify-between mb-1">
          <h2 className="text-[14px] font-semibold text-[#1A1028]">Actividad de la plataforma</h2>
          <span className="text-[11.5px] text-[#8E87A8]">Días con asistencia tomada, todos los clubes</span>
        </div>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={serieGrafica} margin={{ top: 8, right: 6, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id="usoRelleno" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#381DA0" stopOpacity={0.20} />
                  <stop offset="100%" stopColor="#381DA0" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="rgba(120,80,200,0.08)" />
              <XAxis dataKey="semana" tickLine={false} axisLine={false}
                tick={{ fontSize: 10.5, fill: '#8E87A8' }} minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} width={40}
                tick={{ fontSize: 10.5, fill: '#8E87A8' }} allowDecimals={false} />
              <Tooltip
                cursor={{ stroke: '#381DA0', strokeOpacity: 0.3 }}
                contentStyle={{
                  borderRadius: 10, border: '1px solid rgba(120,80,200,0.14)',
                  fontSize: 12, boxShadow: '0 4px 16px rgba(26,16,40,0.08)',
                }}
                formatter={(v) => [`${Number(v ?? 0)} días`, 'Con asistencia']}
                labelFormatter={(_, payload) => `Semana del ${payload?.[0]?.payload?.semana ?? ''}`}
              />
              <Area type="monotone" dataKey="dias" stroke="#381DA0" strokeWidth={2}
                fill="url(#usoRelleno)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Club por club ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(120,80,200,0.10)' }}>
        <div className="px-4 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(120,80,200,0.06)' }}>
          <h2 className="text-[14px] font-semibold text-[#1A1028] mb-0.5">Club por club</h2>
          <p className="text-[11.5px] text-[#8E87A8] leading-relaxed max-w-xl">
            Ordenado por riesgo, no por tamaño. Un club grande que dejó de entrar importa
            más que uno pequeño que entra todos los días.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse">
            <thead>
              <tr>
                {['Club', 'Deportistas', 'Días activos', 'Últimas 12 semanas', 'Última vez', 'Estado'].map((h, i) => (
                  <th key={h} scope="col"
                    className={`text-[10px] font-semibold uppercase tracking-wider text-[#8E87A8] px-3.5 py-2.5 whitespace-nowrap ${i === 1 || i === 2 ? 'text-right' : 'text-left'}`}
                    style={{ borderBottom: '1px solid rgba(120,80,200,0.06)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clubes.map(c => {
                const e = ESTADOS[c.estado];
                return (
                  <tr key={c.clubId} className="transition-colors hover:bg-[rgba(56,29,160,0.03)]">
                    <td className="px-3.5 py-3" style={{ borderBottom: '1px solid rgba(120,80,200,0.06)' }}>
                      <div className="text-[13px] font-medium text-[#1A1028]">{c.nombre}</div>
                      <div className="text-[11px] text-[#8E87A8]">
                        {c.acciones.toLocaleString('es-CO')} acciones
                        {ingresosDisponibles && c.personasActivas > 0 && ` · ${c.personasActivas} usando la app`}
                      </div>
                    </td>
                    <td className="px-3.5 py-3 text-[13px] text-right tabular-nums text-[#1A1028]"
                      style={{ borderBottom: '1px solid rgba(120,80,200,0.06)' }}>{c.deportistas}</td>
                    <td className="px-3.5 py-3 text-[13px] text-right tabular-nums text-[#1A1028]"
                      style={{ borderBottom: '1px solid rgba(120,80,200,0.06)' }}>{c.diasActivos}</td>
                    <td className="px-3.5 py-3" style={{ borderBottom: '1px solid rgba(120,80,200,0.06)' }}>
                      <Chispa barras={c.barras} color={e.color} tramo={datos.tramo} />
                    </td>
                    <td className="px-3.5 py-3 text-[12.5px] text-[#8E87A8] whitespace-nowrap"
                      style={{ borderBottom: '1px solid rgba(120,80,200,0.06)' }}>{haceCuanto(c.diasSinUsar)}</td>
                    <td className="px-3.5 py-3" style={{ borderBottom: '1px solid rgba(120,80,200,0.06)' }}>
                      {/* El color nunca va solo: lleva su punto y su palabra. */}
                      <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold rounded-full whitespace-nowrap"
                        style={{ background: e.fondo, color: e.color, padding: '3px 9px 3px 7px' }}>
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: e.color }} />
                        {e.texto}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
