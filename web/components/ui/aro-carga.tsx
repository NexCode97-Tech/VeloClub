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
 * Todo se mueve con `transform` y `opacity`, que son las dos únicas
 * propiedades que el navegador puede animar sin rehacer el diseño en cada
 * fotograma. Por eso no hace falta ninguna librería de animación acá: un aro
 * girando en bucle es justo el caso donde CSS gana.
 */

/** Un arco por deporte, con aire entre uno y otro. */
const ARCO = 360 / PALETA_DEPORTES.length;

/**
 * Los grados de vacío entre un arco y el siguiente. Sin ese corte los doce
 * colores se tocan y el aro se lee como una rueda de color en vez de como doce
 * deportes; es la diferencia entera entre las dos versiones que se probaron.
 */
const AIRE = 6;

function degradado(): string {
  const partes: string[] = [];
  PALETA_DEPORTES.forEach((color, i) => {
    const ini = i * ARCO;
    partes.push(`${color} ${ini + AIRE / 2}deg ${ini + ARCO - AIRE / 2}deg`);
    partes.push(`transparent ${ini + ARCO - AIRE / 2}deg ${ini + ARCO + AIRE / 2}deg`);
  });
  // Arranca arriba y no a la derecha, que es de donde el ojo espera que salga.
  return `conic-gradient(from -90deg, ${partes.join(', ')})`;
}

export const ARO_DEGRADADO = degradado();

/**
 * El CSS del aro, compartido por las dos pantallas y por la cortina de salida,
 * para que el relevo entre una y otra sea idéntico.
 *
 * El anillo se recorta de un disco con una máscara radial en vez de dibujarse
 * con `border`: un borde no admite un degradado cónico, así que la vuelta
 * completa quedaría con una costura visible donde se cierra.
 */
export const ARO_CSS = `
  .vc-aro {
    position: relative; display: flex; align-items: center; justify-content: center;
  }
  .vc-aro::before {
    content: ""; position: absolute; inset: 0; border-radius: 50%;
    background: ${ARO_DEGRADADO};
    -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - var(--grosor)), #000 calc(100% - var(--grosor) + 1px));
            mask: radial-gradient(farthest-side, transparent calc(100% - var(--grosor)), #000 calc(100% - var(--grosor) + 1px));
    will-change: transform;
    animation: vc-aro-girar var(--vuelta) linear infinite;
  }
  /* Velocidad pareja a propósito: un giro con aceleración se lee como si
     tropezara en cada vuelta. */
  @keyframes vc-aro-girar { to { transform: rotate(1turn) } }

  /* El logo se pinta plano con una máscara, no con filtros: así sale blanco
     sobre el morado y morado sobre el fondo claro, sin el degradado ni la «C»
     negra que trae el archivo. */
  .vc-aro-logo {
    -webkit-mask: url('/logo.png') center / contain no-repeat;
            mask: url('/logo.png') center / contain no-repeat;
  }

  /* Con «reducir movimiento» el aro deja de girar pero NO desaparece: es el
     único aviso de que la aplicación está cargando. Se queda quieto y respira,
     que dice lo mismo sin desplazar nada. */
  @media (prefers-reduced-motion: reduce) {
    .vc-aro::before { animation: none }
    .vc-aro { animation: vc-aro-respirar 2.4s ease-in-out infinite }
    @keyframes vc-aro-respirar { 50% { opacity: .55 } }
  }
`;

interface Props {
  /** Diámetro del aro. El logo va dentro, en su proporción real de 1296×868. */
  diametro: number;
  /** Ancho del anillo. */
  grosor: number;
  /** Ancho del logo; el alto sale de su proporción. */
  logo: number;
  /** El color del logo: blanco sobre el morado, morado sobre el fondo claro. */
  tinta: string;
  /** Lo que tarda una vuelta. */
  vuelta?: string;
  /** La cortina de salida lo apaga aparte, sin tocar el aro. */
  className?: string;
}

export default function AroCarga({
  diametro, grosor, logo, tinta, vuelta = '2.6s', className = '',
}: Props) {
  return (
    <div
      className={`vc-aro ${className}`}
      style={{
        width: diametro,
        height: diametro,
        ['--grosor' as string]: `${grosor}px`,
        ['--vuelta' as string]: vuelta,
      } as React.CSSProperties}
      role="img"
      aria-label="Cargando"
    >
      <span
        className="vc-aro-logo"
        style={{ width: logo, height: Math.round(logo * 868 / 1296), background: tinta }}
      />
    </div>
  );
}
