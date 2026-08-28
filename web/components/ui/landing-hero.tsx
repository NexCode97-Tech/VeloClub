'use client';

import Link from 'next/link';
import { CronometroPromo } from '@/components/ui/cronometro-promo';

/**
 * El hero de la landing.
 *
 * Reemplaza al glassmorphism oscuro con la imagen del mockup. Ese hero abría
 * con una pantalla negra y un degradado morado que moría en el pliegue; este
 * abre en el mismo blanco cálido del resto de la página, y lo que sostiene la
 * primera pantalla es la tipografía y no el fondo.
 *
 * El titular y la bajada van en dos columnas alineadas por su base. Centrados,
 * los dos competían por la misma línea de lectura; así cada uno tiene la suya
 * y el conjunto arranca por donde se empieza a leer.
 */
export default function LandingHero() {
  return (
    <header className="pt-[120px] pb-10 sm:pt-[136px] sm:pb-14">
      <div className="max-w-[1200px] mx-auto px-[22px]">

        {/* La cuenta regresiva de la campaña. Se apaga sola al pasar la fecha
            de corte, y el titular sigue en pie sin ella. */}
        <div className="mb-[22px]">
          <CronometroPromo claro />
        </div>

        <div className="grid grid-cols-1 min-[860px]:grid-cols-[1.05fr_0.95fr] gap-5 min-[860px]:gap-14 items-start min-[860px]:items-end">
          <h1
            className="text-[2.05rem] sm:text-[2.6rem] min-[860px]:text-[3.25rem] font-semibold leading-[1.06] text-[#1A1028] max-w-[17ch] text-balance"
            style={{ letterSpacing: '-0.032em' }}
          >
            <span className="text-[#381DA0]">Tecnología</span> que mueve al club.
          </h1>

          {/* El `pb` compensa la línea base: sin él, alinear por el borde de las
              cajas deja el párrafo un pelo más abajo que el titular, que lleva
              el interlineado comprimido. */}
          <p className="text-base text-[#8E87A8] leading-[1.65] max-w-[46ch] min-[860px]:pb-[0.35em]">
            Al servicio de los clubes deportivos de Colombia. Desde las
            inscripciones y el control de asistencia, hasta las mensualidades,
            las sedes y los resultados de cada deportista.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-[11px] mt-7">
          <Link
            href="/crear-club"
            className="inline-flex items-center justify-center rounded-full px-[22px] py-[11px] text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98]"
            style={{
              background: '#381DA0',
              boxShadow: '0 1px 2px rgba(56,29,160,.20), 0 3px 8px -2px rgba(56,29,160,.28)',
            }}
          >
            Crear mi club gratis
          </Link>
          <a
            href="https://wa.me/573006359008"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-full px-[22px] py-[11px] text-sm font-semibold text-[#1A1028] border transition-all hover:bg-[#F7F7FB] active:scale-[0.98]"
            style={{
              background: '#FDFCFC',
              borderColor: 'rgba(26,16,40,0.08)',
              boxShadow: '0 1px 2px rgba(26,16,40,.05), 0 2px 6px -2px rgba(26,16,40,.08)',
            }}
          >
            Hablar por WhatsApp
          </a>
        </div>

        <p className="text-[12.5px] text-[#8E87A8] mt-3.5">
          Dos meses sin costo. Sin tarjeta y sin compromiso.
        </p>

      </div>
    </header>
  );
}
