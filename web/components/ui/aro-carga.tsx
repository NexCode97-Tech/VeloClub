'use client';

import { PALETA_DEPORTES } from '@/components/ui/custom-icons';

/**
 * El aro de los deportes: el logo con los doce colores del catálogo girando
 * alrededor.
 *
 * Vive aparte porque lo usan las dos pantallas de carga —la apertura de la
 * aplicación y el cambio de módulo— y son el mismo dibujo a dos tamaños. Antes
 * cada una tenía su propio barrido de luz escrito por separado, y cualquier
 * arreglo había que acordarse de hacerlo dos veces.
 *
 * Se dibuja con SVG y no con un degradado cónico, que sería más corto de
 * escribir, porque un degradado corta los arcos en recto y no sabe
 * redondearlos: `stroke-linecap` solo existe en SVG.
 *
 * Todo se mueve con `transform` y `opacity`, las dos únicas propiedades que el
 * navegador anima sin rehacer el diseño en cada fotograma. Por eso no hace
 * falta ninguna librería de animación: un aro girando en bucle es justo el
 * caso donde CSS gana.
 */

/** El lienzo del SVG. Las medidas de adentro son de 0 a 100, no píxeles. */
const R = 45;
const PERIMETRO = 2 * Math.PI * R;

/** Un arco por deporte. */
const ARCO = 360 / PALETA_DEPORTES.length;

/**
 * Los grados de vacío entre un arco y el siguiente. Sin ese corte los doce
 * colores se tocan y el aro se lee como una rueda de color en vez de como doce
 * deportes; es la diferencia entera entre las dos versiones que se probaron.
 */
const AIRE = 14;

/**
 * Grosor del trazo, en unidades del lienzo. Al ser relativo, los 7 px del aro
 * de la apertura y los 3,4 del módulo salen del mismo número: el dibujo es
 * idéntico y solo cambia a qué tamaño se muestra.
 */
const TRAZO = 5.3;

/**
 * El largo pintado de cada arco.
 *
 * Se le descuenta un trazo entero porque la punta redonda sobresale media
 * anchura por cada lado: sin ese descuento el aire real sería menor que el
 * declarado, y encima cambiaría al tocar el grosor.
 */
const LARGO = PERIMETRO * (ARCO - AIRE) / 360 - TRAZO;

/**
 * El CSS del aro, compartido por las dos pantallas y por la cortina de salida,
 * para que el relevo entre una y otra sea idéntico.
 */
export const ARO_CSS = `
  .vc-aro { position: relative; display: flex; align-items: center; justify-content: center }
  .vc-aro svg {
    position: absolute; inset: 0; width: 100%; height: 100%;
    will-change: transform;
    animation: vc-aro-girar var(--vuelta) linear infinite;
  }
  .vc-aro circle { fill: none; transform-origin: 50% 50% }
  /* Velocidad pareja a propósito: un giro con aceleración se lee como si
     tropezara en cada vuelta. */
  @keyframes vc-aro-girar { to { transform: rotate(1turn) } }

  /* El logo se pinta plano con una máscara, no con filtros: así sale blanco
     sobre el morado y morado sobre el fondo claro, sin el degradado ni la «C»
     negra que trae el archivo. */
  .vc-aro-logo {
    position: relative; z-index: 1; display: block;
    -webkit-mask: url('/logo.png') center / contain no-repeat;
            mask: url('/logo.png') center / contain no-repeat;
  }

  /* Con «reducir movimiento» el aro deja de girar pero NO desaparece: es el
     único aviso de que la aplicación está cargando. Se queda quieto y respira,
     que dice lo mismo sin desplazar nada. */
  @media (prefers-reduced-motion: reduce) {
    .vc-aro svg { animation: none }
    .vc-aro { animation: vc-aro-respirar 2.4s ease-in-out infinite }
    @keyframes vc-aro-respirar { 50% { opacity: .55 } }
  }
`;

interface Props {
  /** Diámetro del aro. El logo va dentro, en su proporción real de 1296×868. */
  diametro: number;
  /** Ancho del logo; el alto sale de su proporción. */
  logo: number;
  /** El color del logo: blanco sobre el morado, morado sobre el fondo claro. */
  tinta: string;
  /** Lo que tarda una vuelta. */
  vuelta?: string;
  /** La cortina de salida lo apaga aparte. */
  className?: string;
}

export default function AroCarga({
  diametro, logo, tinta, vuelta = '2.6s', className = '',
}: Props) {
  return (
    <div
      className={`vc-aro ${className}`}
      style={{
        width: diametro,
        height: diametro,
        ['--vuelta' as string]: vuelta,
      } as React.CSSProperties}
      role="img"
      aria-label="Cargando"
    >
      <svg viewBox="0 0 100 100" aria-hidden="true">
        {PALETA_DEPORTES.map((color, i) => (
          <circle
            key={color + i}
            cx="50"
            cy="50"
            r={R}
            stroke={color}
            strokeWidth={TRAZO}
            strokeLinecap="round"
            strokeDasharray={`${LARGO.toFixed(2)} ${(PERIMETRO - LARGO).toFixed(2)}`}
            // Arranca arriba y no a la derecha, que es de donde el ojo espera
            // que salga.
            style={{ transform: `rotate(${(-90 + i * ARCO + AIRE / 2).toFixed(1)}deg)` }}
          />
        ))}
      </svg>
      <span
        className="vc-aro-logo"
        style={{ width: logo, height: Math.round(logo * 868 / 1296), background: tinta }}
      />
    </div>
  );
}
