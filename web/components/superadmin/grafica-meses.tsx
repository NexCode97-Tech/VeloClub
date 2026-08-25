'use client';

import { useId, useRef, useState } from 'react';

/**
 * Entra y sale, mes a mes.
 *
 * Dos series en la misma unidad, así que van en **un solo eje**. Nunca dos
 * escalas: es el error de gráfica más común y hace ver relaciones que no
 * existen.
 *
 * Los colores no se escogieron, se calcularon. Verde para lo que entra y rojo
 * para lo que sale es la convención y es la peor pareja posible: en
 * deuteranopía quedan a distancia 1.9 cuando el mínimo aceptable es 8, o sea
 * que para mucha gente son el mismo color. Verde contra naranja quemado pasa
 * con 9.9 y con visión normal se separan en 25.4.
 *
 * Y el color nunca va solo: cada mes tiene su cifra escrita en el globo y su
 * etiqueta en el lector de pantalla, así que quien no distinga los tonos igual
 * lee la gráfica.
 */

export const ENTRA = '#0E7C57';
export const SALE = '#C2410C';

export interface MesFinanzas {
  mes: string;
  entra: number;
  sale: number;
  clubes: number;
}

const NOMBRE_MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** `2026-08` da «Ago»; `2026-08-14`, el número del día. */
function etiquetaMes(clave: string): string {
  const [, m, d] = clave.split('-');
  if (d) return String(Number(d));
  return NOMBRE_MES[Number(m) - 1] ?? clave;
}

/** El nombre largo, para el globo: «14 de agosto» o «Agosto 2026». */
function tituloDe(clave: string): string {
  const [a, m, d] = clave.split('-');
  const mes = NOMBRE_MES[Number(m) - 1] ?? clave;
  return d ? `${Number(d)} de ${mes.toLowerCase()}` : `${mes} ${a}`;
}

const pesos = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');

/** 630000 → «630k». La escala del eje no necesita el peso completo. */
function corto(n: number): string {
  if (n === 0) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + 'M';
  return Math.round(n / 1000) + 'k';
}

/** Un tope redondo por encima del dato, para que la rejilla dé números limpios. */
function topeDe(valores: number[]): number {
  const max = Math.max(1, ...valores);
  const magnitud = Math.pow(10, Math.floor(Math.log10(max)));
  return Math.ceil(max / magnitud) * magnitud;
}

export function GraficaMeses({ meses }: { meses: MesFinanzas[] }) {
  const [encima, setEncima] = useState<number | null>(null);
  const [x, setX] = useState(0);
  const caja = useRef<HTMLDivElement>(null);
  const id = useId();

  if (meses.length === 0) return null;

  const W = 700, H = 220, PAD_I = 46, PAD_D = 8, PAD_S = 14, PAD_B = 26;
  const anchoUtil = W - PAD_I - PAD_D;
  const altoUtil = H - PAD_S - PAD_B;
  const tope = topeDe(meses.flatMap(m => [m.entra, m.sale]));
  const y = (v: number) => PAD_S + altoUtil - (v / tope) * altoUtil;

  const paso = anchoUtil / meses.length;
  // Poco mas de un tercio del tramo para cada barra: deja el aire entre dias
  // vecinos sin volverlas hilos cuando el mes trae treinta y uno.
  const anchoBarra = Math.min(26, Math.max(3.5, paso * 0.36));
  // Cada cuántos tramos se escribe la etiqueta del eje. Con doce meses, todos.
  const saltoEtiquetas = meses.length > 24 ? 5 : meses.length > 14 ? 2 : 1;
  const marcas = [0, 0.25, 0.5, 0.75, 1].map(f => tope * f);

  const m = encima !== null ? meses[encima] : null;
  const neto = m ? m.entra - m.sale : 0;

  // Lo que entró en promedio por mes. Los totales del periodo los llevan las
  // tarjetas de arriba; acá solo hace falta el promedio, que es contra lo que
  // se compara cada barra. Cuenta los meses en cero: también son parte.
  const promedio = meses.reduce((t, x) => t + x.entra, 0) / meses.length;

  return (
    <div ref={caja} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full overflow-visible"
        role="img" aria-labelledby={id}>
        <title id={id}>
          Lo que entra y lo que sale, de {tituloDe(meses[0].mes)} a{' '}
          {tituloDe(meses[meses.length - 1].mes)}
        </title>

        {/* Rejilla recesiva: está para orientar, no para competir con el dato */}
        {marcas.map(v => (
          <g key={v}>
            <line x1={PAD_I} x2={W - PAD_D} y1={y(v)} y2={y(v)}
              stroke={v === 0 ? 'rgba(26,16,40,0.2)' : 'rgba(26,16,40,0.07)'} strokeWidth={1} />
            <text x={PAD_I - 8} y={y(v) + 3.5} textAnchor="end"
              style={{ fontSize: 9.5, fill: '#8E87A8', fontVariantNumeric: 'tabular-nums' }}>
              {corto(v)}
            </text>
          </g>
        ))}

        {meses.map((mes, i) => {
          const centro = PAD_I + paso * i + paso / 2;
          const activo = encima === i;
          return (
            <g key={mes.mes}>
              {/* 2px de aire entre las dos barras del mismo mes */}
              {([['entra', centro - anchoBarra - 1, mes.entra, ENTRA],
                 ['sale', centro + 1, mes.sale, SALE]] as const).map(([clave, bx, val, color], k) =>
                val > 0 ? (
                  <rect key={clave} x={bx} y={y(val)} width={anchoBarra}
                    height={Math.max(2, y(0) - y(val))} rx={4} fill={color}
                    className="vc-barra"
                    style={{ animationDelay: `${i * 70 + k * 35}ms`, opacity: encima === null || activo ? 1 : 0.45 }} />
                ) : null,
              )}

              {/* Con un mes en días son treinta y una etiquetas: se pintan
                  salteadas para que no se toquen, y la del tramo señalado
                  aparece siempre aunque le tocara estar oculta. */}
              {(i % saltoEtiquetas === 0 || activo) && (
                <text x={centro} y={H - 8} textAnchor="middle"
                  style={{ fontSize: 9.5, fill: activo ? '#1A1028' : '#8E87A8', fontWeight: activo ? 600 : 400 }}>
                  {etiquetaMes(mes.mes)}
                </text>
              )}

              {/* La zona de contacto es el mes entero, no la barra: apuntarle a
                  una barra de 26px con el mouse es trabajo de más. */}
              <rect
                x={PAD_I + paso * i} y={PAD_S} width={paso} height={altoUtil}
                fill="transparent" tabIndex={0} className="outline-none focus-visible:fill-primary/5"
                aria-label={`${tituloDe(mes.mes)}: entró ${pesos(mes.entra)}, salió ${pesos(mes.sale)}, queda ${pesos(mes.entra - mes.sale)}`}
                onMouseMove={e => {
                  const r = caja.current?.getBoundingClientRect();
                  if (r) setX(e.clientX - r.left);
                  setEncima(i);
                }}
                onMouseLeave={() => setEncima(null)}
                onFocus={() => { setEncima(i); setX(((i + 0.5) / meses.length) * (caja.current?.clientWidth ?? 0)); }}
                onBlur={() => setEncima(null)}
              />
            </g>
          );
        })}

        {/* La raya del promedio. Una barra sola no dice si el mes fue bueno o
            malo; contra el promedio, sí.

            Va de últimas, encima de las barras: dibujada antes, cualquier mes
            alto le pasaba por encima y se comía la etiqueta. Y en gris y no en
            el verde de la serie, por dos motivos: sobre una barra verde el
            verde desaparece, y esto es una referencia, no una tercera serie.
            El texto lleva un contorno del color del fondo para que se lea igual
            cuando le cae encima una barra. */}
        {promedio > 0 && (
          <g>
            <line x1={PAD_I} x2={W - PAD_D} y1={y(promedio)} y2={y(promedio)}
              stroke="#6B6383" strokeWidth={1.5} strokeDasharray="5 4" opacity={0.8} />
            <text x={W - PAD_D} y={y(promedio) - 5} textAnchor="end"
              style={{
                fontSize: 9.5, fill: '#4A4360', fontWeight: 600,
                stroke: '#fff', strokeWidth: 3, paintOrder: 'stroke',
              }}>
              promedio {corto(promedio)}
            </text>
          </g>
        )}
      </svg>

      {m && (
        <div
          className="absolute pointer-events-none rounded-[10px] px-2.5 py-2 text-[11.5px] leading-relaxed whitespace-nowrap z-10"
          style={{
            background: '#1A1028', color: '#fff', top: 58,
            left: Math.min(Math.max(x - 60, 4), Math.max(4, (caja.current?.clientWidth ?? 200) - 170)),
            boxShadow: '0 8px 20px -6px rgba(26,16,40,0.45)',
          }}
        >
          <p className="font-bold m-0 mb-0.5">{tituloDe(m.mes)}</p>
          <p className="m-0 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: ENTRA }} />
            Entró <b className="tabular-nums font-semibold">{pesos(m.entra)}</b>
          </p>
          <p className="m-0 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: SALE }} />
            Salió <b className="tabular-nums font-semibold">{pesos(m.sale)}</b>
          </p>
          <p className="m-0 mt-1 pt-1 border-t border-white/20">
            Queda <b className="tabular-nums font-semibold">{neto < 0 ? '-' : ''}{pesos(Math.abs(neto))}</b>
          </p>
        </div>
      )}
    </div>
  );
}

/** Barras horizontales rankeadas: comparan magnitudes con nombre propio. */
export function Ranking({ filas, colores }: {
  filas: { nombre: string; valor: number }[];
  /** Un color, o uno por fila cuando cada una es una categoría distinta. */
  colores: string | string[];
}) {
  if (filas.length === 0) {
    return <p className="text-[12.5px] text-muted-foreground m-0 mt-3">Todavía no hay nada que mostrar.</p>;
  }
  const max = Math.max(...filas.map(f => f.valor), 1);

  return (
    <div className="flex flex-col gap-2 mt-3">
      {filas.map((f, i) => (
        <div key={f.nombre} className="grid grid-cols-[7.5rem_1fr_5.4rem] gap-2 items-center">
          <span className="text-[12px] text-foreground truncate" title={f.nombre}>{f.nombre}</span>
          <span className="h-[15px] rounded bg-[rgba(26,16,40,0.045)] overflow-hidden">
            <i className="vc-franja block h-full rounded"
              style={{
                width: `${(f.valor / max) * 100}%`,
                background: Array.isArray(colores) ? colores[i % colores.length] : colores,
                animationDelay: `${i * 60}ms`,
              }} />
          </span>
          {/* El número va escrito: el largo de la barra compara, la cifra
              informa, y quien no distinga los colores igual lee la fila. */}
          <span className="text-[12px] font-semibold text-right tabular-nums">
            ${Math.round(f.valor).toLocaleString('es-CO')}
          </span>
        </div>
      ))}
    </div>
  );
}
