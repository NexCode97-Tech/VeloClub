'use client';

import { useId, useRef, useState } from 'react';

/**
 * Entra y sale, en línea.
 *
 * Dos series en la misma unidad, así que van en **un solo eje**. Nunca dos
 * escalas: es el error de gráfica más común y hace ver relaciones que no
 * existen.
 *
 * Antes eran barras. La línea cuenta el recorrido en vez de meses sueltos, y
 * con un mes en días la diferencia es enorme: treinta y una barras son una
 * empalizada y no dejan ver la forma del mes.
 *
 * Los colores no se escogieron, se calcularon. El morado del proyecto contra el
 * rojo se separan a 30,9 en protanopía cuando el mínimo aceptable es 8. El
 * verde contra rojo de toda la vida, que es la convención, queda a 1,9: para
 * mucha gente son el mismo color.
 *
 * Y el color nunca va solo: cada punto tiene su cifra escrita en el globo y su
 * etiqueta en el lector de pantalla.
 */

export const ENTRA = '#7C3AED';
export const SALE = '#DC2626';

export interface MesFinanzas {
  /** `aaaa-mm` por mes, o `aaaa-mm-dd` cuando el periodo es un mes solo. */
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

/** El nombre largo, para el globo: «14 de agosto» o «Ago 2026». */
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

/**
 * Curva monótona, con el límite de Fritsch y Carlson.
 *
 * Un spline corriente se pasa de largo entre dos puntos y dibuja subidas que el
 * dato no tiene. Con plata eso es mentir: la línea de gastos llegó a bajar de
 * cero en meses sin un solo gasto.
 *
 * Poner la pendiente en cero cuando cambia el signo no alcanza —así estaba y se
 * salía cinco píxeles y medio—. También hay que recortar las pendientes cuando
 * son grandes frente al tramo: si la suma de sus cuadrados pasa de nueve, las
 * dos se encogen. Con eso la curva no sobrepasa nunca a sus vecinos.
 */
function curva(pts: [number, number][]): string {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : '';
  const n = pts.length;
  const d: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((pts[i + 1][1] - pts[i][1]) / (pts[i + 1][0] - pts[i][0]));
  m.push(d[0]);
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[n - 2]);

  for (let i = 0; i < n - 1; i++) {
    // Tramo plano: los dos extremos quedan planos o la curva se abomba.
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }

  let p = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const dx = (pts[i + 1][0] - pts[i][0]) / 3;
    p += ` C${pts[i][0] + dx},${pts[i][1] + m[i] * dx} ${pts[i + 1][0] - dx},${pts[i + 1][1] - m[i + 1] * dx} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return p;
}

export function GraficaMeses({ meses }: { meses: MesFinanzas[] }) {
  const [encima, setEncima] = useState<number | null>(null);
  const caja = useRef<HTMLDivElement>(null);
  const id = useId().replace(/:/g, '');

  if (meses.length === 0) return null;

  const W = 720, H = 250, PAD_I = 10, PAD_D = 52, PAD_S = 18, PAD_B = 26;
  const anchoUtil = W - PAD_I - PAD_D;
  const altoUtil = H - PAD_S - PAD_B;
  const tope = topeDe(meses.flatMap(m => [m.entra, m.sale]));
  const y = (v: number) => PAD_S + altoUtil - (v / tope) * altoUtil;
  const x = (i: number) => PAD_I + (meses.length === 1 ? anchoUtil / 2 : (i / (meses.length - 1)) * anchoUtil);

  const marcas = [0, 0.25, 0.5, 0.75, 1].map(f => tope * f);
  // Cada cuántos tramos se escribe la etiqueta del eje. Con doce meses, todas.
  const saltoEtiquetas = meses.length > 24 ? 5 : meses.length > 14 ? 2 : 1;

  // Lo que entró en promedio por tramo. Los totales del periodo los llevan las
  // tarjetas de arriba; acá solo hace falta el promedio, que es contra lo que se
  // compara cada punto. Cuenta los tramos en cero: también son parte.
  const promedio = meses.reduce((t, m) => t + m.entra, 0) / meses.length;

  const series = ([
    { clave: 'entra', color: ENTRA, nombre: 'Ingresos' },
    { clave: 'sale', color: SALE, nombre: 'Gastos' },
  ] as const).map(se => {
    const pts = meses.map((m, i) => [x(i), y(m[se.clave])] as [number, number]);
    const d = curva(pts);
    return {
      ...se,
      hay: meses.some(m => m[se.clave] > 0),
      d,
      area: `${d} L${pts[pts.length - 1][0]},${y(0)} L${pts[0][0]},${y(0)} Z`,
    };
  });

  const m = encima !== null ? meses[encima] : null;
  const neto = m ? m.entra - m.sale : 0;

  return (
    <div ref={caja} className="relative">
      {/* La descripción va en aria-label y no en <title>: el <title> de un SVG
          el navegador lo pinta encima como su propio tooltip, con su marco
          gris, tapando la gráfica. El lector de pantalla lee las dos igual. */}
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full overflow-visible"
        role="img"
        aria-label={`Ingresos y gastos, de ${tituloDe(meses[0].mes)} a ${tituloDe(meses[meses.length - 1].mes)}`}>

        <defs>
          {/* La rejilla se ve por dentro del relleno y lo cruza. Esta máscara la
              apaga justo donde hay área: la raya llega al borde y para. */}
          <mask id={`sinArea${id}`} maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
            <rect x={0} y={0} width={W} height={H} fill="#fff" />
            {series.map(se => se.hay ? <path key={se.clave} d={se.area} fill="#000" /> : null)}
          </mask>

          {series.map((se, i) => (
            <g key={se.clave}>
              <linearGradient id={`ar${i}${id}`} x1={0} y1={0} x2={0} y2={1}>
                <stop offset="0%" stopColor={se.color} stopOpacity={0.18} />
                <stop offset="100%" stopColor={se.color} stopOpacity={0} />
              </linearGradient>
              {/* La cuadrícula que vive dentro del área, del color de su serie */}
              <pattern id={`cua${i}${id}`} width={9} height={9} patternUnits="userSpaceOnUse">
                <path d="M9 0H0V9" fill="none" stroke={se.color} strokeWidth={0.7} opacity={0.5} />
              </pattern>
              {/* Y se desvanece hacia abajo, para no competir con la línea */}
              <linearGradient id={`fd${i}${id}`} x1={0} y1={0} x2={0} y2={1}>
                <stop offset="0%" stopColor="#fff" stopOpacity={0.85} />
                <stop offset="100%" stopColor="#fff" stopOpacity={0} />
              </linearGradient>
              <mask id={`mk${i}${id}`} maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
                <rect x={0} y={0} width={W} height={H} fill={`url(#fd${i}${id})`} />
              </mask>
            </g>
          ))}
        </defs>

        {/* Rejilla recesiva: está para orientar, no para competir con el dato */}
        <g mask={`url(#sinArea${id})`}>
          {marcas.filter(v => v > 0).map(v => (
            <line key={v} x1={PAD_I} x2={W - PAD_D} y1={y(v)} y2={y(v)}
              stroke="rgba(26,16,40,0.07)" strokeWidth={1} />
          ))}
        </g>
        {/* La línea de ceros va afuera del recorte: es el borde de abajo del
            área, así que la máscara se la comería entera, y es justo la que no
            puede faltar porque marca el punto de equilibrio. */}
        <line x1={PAD_I} x2={W - PAD_D} y1={y(0)} y2={y(0)} stroke="rgba(26,16,40,0.2)" strokeWidth={1} />

        {marcas.map(v => (
          <text key={v} x={W - PAD_D + 9} y={y(v) + 3.5} textAnchor="start"
            style={{ fontSize: 9.5, fill: '#8E87A8', fontVariantNumeric: 'tabular-nums' }}>
            {corto(v)}
          </text>
        ))}

        {series.map((se, i) => se.hay ? (
          <g key={se.clave}>
            <path d={se.area} fill={`url(#ar${i}${id})`} />
            <path d={se.area} fill={`url(#cua${i}${id})`} mask={`url(#mk${i}${id})`} />
            <path d={se.d} fill="none" stroke={se.color} strokeWidth={2.2}
              strokeLinecap="round" strokeLinejoin="round" className="vc-linea" />
          </g>
        ) : null)}

        {/* La raya del promedio. Un punto solo no dice si el mes fue bueno o
            malo; contra el promedio, sí.

            Va de últimas, encima de todo, y en gris y no en el color de la
            serie: sobre su propia área desaparecería, y esto es una referencia,
            no una tercera serie. */}
        {promedio > 0 && (
          <g>
            <line x1={PAD_I} x2={W - PAD_D} y1={y(promedio)} y2={y(promedio)}
              stroke="#6B6383" strokeWidth={1.4} strokeDasharray="5 4" opacity={0.8} />
            <text x={W - PAD_D - 4} y={y(promedio) - 5} textAnchor="end"
              style={{ fontSize: 9.5, fill: '#4A4360', fontWeight: 600 }}>
              promedio {corto(promedio)}
            </text>
          </g>
        )}

        {/* Etiquetas del eje. Con un mes en días son treinta y una: se pintan
            salteadas para que no se toquen, y la del tramo señalado aparece
            siempre aunque le tocara estar oculta. */}
        {meses.map((mes, i) => (
          (i % saltoEtiquetas === 0 || i === meses.length - 1 || encima === i) ? (
            <text key={mes.mes} x={x(i)} y={H - 8} textAnchor="middle"
              style={{
                fontSize: 9.5,
                fill: encima === i ? '#1A1028' : '#8E87A8',
                fontWeight: encima === i ? 600 : 400,
              }}>
              {etiquetaMes(mes.mes)}
            </text>
          ) : null
        ))}

        {/* La guía y los puntos del tramo señalado */}
        {encima !== null && (
          <g style={{ pointerEvents: 'none' }}>
            <line x1={x(encima)} x2={x(encima)} y1={PAD_S} y2={PAD_S + altoUtil}
              stroke="rgba(26,16,40,0.22)" strokeWidth={1} strokeDasharray="3 3" />
            {series.map(se => (
              <circle key={se.clave} cx={x(encima)} cy={y(meses[encima][se.clave])} r={4.5}
                fill={se.color} stroke="#fff" strokeWidth={2} />
            ))}
          </g>
        )}

        {/* La zona de contacto es todo el ancho del área: apuntarle a una línea
            de 2px con el mouse es trabajo de más. */}
        <rect
          x={PAD_I} y={PAD_S} width={anchoUtil} height={altoUtil}
          fill="transparent" tabIndex={0} className="outline-none focus-visible:fill-primary/5"
          aria-label={m
            ? `${tituloDe(m.mes)}: ingresos ${pesos(m.entra)}, gastos ${pesos(m.sale)}, saldo ${pesos(neto)}`
            : 'Recorré el periodo con las flechas'}
          onMouseMove={e => {
            const r = caja.current?.getBoundingClientRect();
            if (!r) return;
            const vx = ((e.clientX - r.left) / r.width) * W;
            let mejor = 0, dist = Infinity;
            meses.forEach((_, i) => { const d = Math.abs(x(i) - vx); if (d < dist) { dist = d; mejor = i; } });
            setEncima(mejor);
          }}
          onMouseLeave={() => setEncima(null)}
          onFocus={() => setEncima(meses.length - 1)}
          onBlur={() => setEncima(null)}
          onKeyDown={e => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            e.preventDefault();
            const paso = e.key === 'ArrowRight' ? 1 : -1;
            const base = encima === null ? meses.length - 1 : encima;
            setEncima(Math.min(meses.length - 1, Math.max(0, base + paso)));
          }}
        />
      </svg>

      {/* El globo se apoya en el punto más alto del tramo, centrado y siempre a
          la misma distancia. Arriba y nunca debajo —abajo hay que buscarlo con
          la vista y tapa la línea que se está leyendo— y sin tope: en el pico
          más alto se sale de la tarjeta, y así debe ser. Uno que a veces se
          apoya en el punto y a veces salta a otro sitio se lee como un error.

          El centrado es `translate(-50%, -100%)` y no una resta del ancho: así
          no hay que medir el globo ni acertarle de memoria. */}
      {m && (
        <div
          className="absolute pointer-events-none rounded-[10px] px-2.5 py-2 text-[11.5px] leading-relaxed whitespace-nowrap z-20"
          style={{
            background: '#1A1028', color: '#fff',
            left: `${(x(encima!) / W) * 100}%`,
            top: `${(y(Math.max(m.entra, m.sale)) / H) * 100}%`,
            transform: 'translate(-50%, calc(-100% - 12px))',
            boxShadow: '0 8px 22px -8px rgba(26,16,40,0.55)',
          }}
        >
          <p className="font-bold m-0 mb-0.5">{tituloDe(m.mes)}</p>
          <p className="m-0 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: ENTRA }} />
            Ingresos <b className="tabular-nums font-semibold ml-auto">{pesos(m.entra)}</b>
          </p>
          <p className="m-0 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: SALE }} />
            Gastos <b className="tabular-nums font-semibold ml-auto">{pesos(m.sale)}</b>
          </p>
          <p className="m-0 mt-1 pt-1 border-t border-white/20 flex items-center gap-1.5">
            Saldo <b className="tabular-nums font-semibold ml-auto">{neto < 0 ? '-' : ''}{pesos(Math.abs(neto))}</b>
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
