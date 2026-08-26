'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { VortexBackground } from '@/components/ui/vortex-background';
import { CronometroPromo } from '@/components/ui/cronometro-promo';

export default function GlassmorphismHero() {
  return (
    <div className="relative w-full min-h-svh bg-zinc-950 overflow-hidden flex items-start lg:items-center" style={{ WebkitTransform: 'translateZ(0)', transform: 'translateZ(0)', touchAction: 'pan-y', WebkitOverflowScrolling: 'auto' }}>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .vc-fade { animation: fadeSlideIn 0.7s ease-out forwards; opacity: 0; }
        .vc-marquee { animation: marquee 40s linear infinite; }
        .d1 { animation-delay: 0.08s; }
        .d2 { animation-delay: 0.18s; }
        .d3 { animation-delay: 0.28s; }
        .d4 { animation-delay: 0.38s; }
        .d5 { animation-delay: 0.48s; }
        .d6 { animation-delay: 0.58s; }

        /* Entrada linea por linea del titular. El desenfoque hace que el texto
           parezca enfocarse al llegar, en vez de solo deslizarse: es lo que le
           da peso editorial al titular sin recurrir a movimiento largo. */
        @keyframes vcTitleIn {
          from { opacity: 0; transform: translateY(22px); filter: blur(10px) }
          to   { opacity: 1; transform: translateY(0);    filter: blur(0) }
        }
        .vc-line { animation: vcTitleIn .75s cubic-bezier(.23,1,.32,1) both; display: block }

        /* Barrido de luz sobre la promocion. Se mueve con background-position,
           que no fuerza recalculo de layout, y solo recorre el texto. */
        @keyframes vcSweep {
          0%   { background-position: -160% 0 }
          55%  { background-position: 260% 0 }
          100% { background-position: 260% 0 }
        }
        .vc-promo-text {
          background-image: linear-gradient(100deg,
            #E9D5FF 0%, #E9D5FF 38%, #FFFFFF 48%, #C4B5FD 58%, #E9D5FF 74%, #E9D5FF 100%);
          background-size: 220% 100%;
          -webkit-background-clip: text; background-clip: text;
          color: transparent;
          animation: vcSweep 4.5s cubic-bezier(.4,0,.2,1) 1.2s infinite;
        }

        /* El halo del boton respira. Va en box-shadow y no en transform para no
           mover el boton mientras alguien intenta tocarlo. */
        @keyframes vcGlow {
          0%, 100% { box-shadow: 0 6px 24px rgba(56,29,160,.32) }
          50%      { box-shadow: 0 8px 34px rgba(147,51,234,.55) }
        }
        .vc-cta { animation: vcGlow 3.2s ease-in-out 1.6s infinite }

        @media (prefers-reduced-motion: reduce) {
          .vc-cta { animation: none; box-shadow: 0 6px 24px rgba(56,29,160,.32) }
          .vc-line { animation: fadeSlideIn .5s ease-out both }
          .vc-promo-text { animation: none; color: #E9D5FF; background: none; -webkit-text-fill-color: currentColor }
          .vc-marquee { animation: none }
        }
      `}</style>

      {/* 1. Glow violeta — centrado en mobile, desplazado en desktop */}
      <div
        className="absolute inset-0 z-[2] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 280px 420px at 50% 55%, rgba(56,29,160,0.7) 0%, rgba(109,28,209,0.4) 35%, rgba(168,85,247,0.12) 60%, transparent 80%)',
        }}
      />
      <div
        className="absolute inset-0 z-[2] pointer-events-none hidden lg:block"
        style={{
          background: 'radial-gradient(ellipse 360px 560px at 38% 60%, rgba(56,29,160,0.75) 0%, rgba(109,28,209,0.45) 35%, rgba(168,85,247,0.15) 60%, transparent 80%)',
        }}
      />

      {/* 2. Corriente de partículas. Va encima del resplandor para que se lea,
             y por debajo del contenido. Arranca cuando el navegador se
             desocupa, para no competir con el contenido en la primera carga. */}
      <VortexBackground className="z-[3]" opacity={0.7} />

      {/* 3. Sombra lateral derecha */}
      <div
        className="absolute inset-0 z-[2] pointer-events-none hidden lg:block"
        style={{ background: 'linear-gradient(to right, transparent 35%, rgba(9,4,20,0.55) 100%)' }}
      />

      {/* 4. El amanecer. Va encima del resplandor y de las partículas, y por
             debajo del contenido: el fondo se aclara sin que el texto pierda su
             contraste, porque el degradado no arranca hasta pasados los botones.

             Empieza y termina dentro del héroe, en el blanco de la página. Que
             se estire más abajo no lo hace mejor: cruzando el pliegue deja de
             leerse como una transición y se lee como si media página fuera
             morada. Acá muere justo donde acaba la primera pantalla, y de ahí
             para abajo todo es blanco. */}
      <div
        className="absolute inset-0 z-[4] pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, rgba(9,9,11,0) 0%, rgba(9,9,11,0) 46%, rgba(42,26,78,0.78) 66%, rgba(122,106,166,0.94) 84%, rgba(219,215,233,1) 94%, #FFFFFF 100%)',
        }}
      />

      {/* CONTENIDO */}
      <div className="relative z-10 w-full max-w-5xl mx-auto px-5 pt-24 pb-12 sm:pt-28 sm:pb-16 lg:py-0 lg:min-h-svh lg:flex lg:items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 lg:gap-6 items-center">

          {/* COLUMNA — texto */}
          <div className="lg:col-span-7 flex flex-col items-center lg:items-start space-y-5 text-center lg:text-left">

            {/* Cronómetro de campaña. Reemplaza a la pastilla con punto: esa
                forma es la más repetida del software actual y se leía como
                plantilla antes de que alguien alcanzara a leer las palabras.
                El cronómetro sale del mundo del cliente y aprieta solo — el
                número baja sin que nadie despliegue nada. */}
            <div className="vc-fade d1">
              <CronometroPromo />
            </div>

            {/* Titular — nombra el enemigo en vez de describir la categoría.
                «Gestiona tu club» era lo que hace el producto, no lo que le pasa
                a quien lo compra, y cualquier competidor podía firmar esa frase.
                Todo club que todavía no compra está usando un Excel, un cuaderno
                o un grupo de WhatsApp, y al leerlo se reconoce solo.

                La frase va de corrido y no partida: es una sola idea, y cortarla
                obligaba a leerla en dos tiempos. En pantalla angosta baja sola
                donde le toque.

                La promoción es la segunda línea y remata: «múdalo» responde la
                objeción de quien lleva años con su archivo, que no arranca de
                cero. Cuando la campaña termine se borra esa línea y el titular
                sigue en pie solo. */}
            {/* El cuerpo baja de 3.25rem a 2.85rem: la columna esta topada en
                unos 546px por el `max-w-5xl` del contenedor, y a la medida
                anterior la frase no cabia en un renglon.
                `text-balance` es la otra mitad del arreglo: donde igual tenga
                que partirse, reparte las dos lineas en vez de dejar «Excel.»
                solo abajo. */}
            <h1 className="text-[2.05rem] sm:text-[2.5rem] lg:text-[2.85rem] font-semibold tracking-tighter leading-[0.95] text-white">
              <span className="vc-line text-balance" style={{ animationDelay: '.14s' }}>
                Tu club ya no cabe{' '}
                <span className="bg-gradient-to-br from-white via-white to-[#A855F7] bg-clip-text text-transparent">
                  en un Excel.
                </span>
              </span>
              <span className="vc-line" style={{ animationDelay: '.30s' }}>
                <span className="vc-promo-text">Múdalo gratis 2 meses.</span>
              </span>
            </h1>

            {/* Descripción — nombra lo que reemplaza, en vez de «todo en uno»,
                que es la promesa más repetida del software y no dice nada. */}
            <p className="vc-fade d4 text-sm text-zinc-400 leading-relaxed mx-auto lg:mx-0 max-w-sm lg:max-w-md">
              Las listas, las mensualidades, la asistencia y los resultados dejan
              de vivir en cuadernos y grupos de WhatsApp. Sin costo y sin tarjeta.
            </p>

            {/* CTA */}
            <div className="vc-fade d5 flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3">
              <Link
                href="/crear-club"
                className="vc-cta inline-flex items-center justify-center gap-2 rounded-full w-full sm:w-auto px-8 py-3 text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #381DA0, #9333EA)' }}
              >
                Crear mi club gratis
              </Link>
              <a
                href="https://wa.me/573006359008"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full w-full sm:w-auto px-8 py-3 text-sm font-semibold text-white/90 border border-white/25 hover:bg-white/10 transition-all active:scale-[0.98]"
              >
                Hablar por WhatsApp
              </a>
            </div>

          </div>

          {/* Imagen del mockup — UNA sola etiqueta para las dos pantallas.
              Antes habia dos <Image> del mismo archivo, una con lg:hidden y otra
              con hidden lg:flex. Esas clases solo esconden con CSS: los dos
              <img> existian siempre y el navegador precargaba el de escritorio
              tambien en el celular, donde esta oculto. Como hijo directo de la
              grilla, en movil cae debajo del texto y en escritorio ocupa la
              columna derecha, sin necesidad de duplicarla.

              Ahora si lleva `priority`. Antes no lo tenia porque la imagen de
              fondo del hero era la que media el LCP y no convenia poner dos
              preloads a competir. Al quitarse ese fondo, esta paso a ser la
              imagen grande del hero, asi que es la que hay que precargar.

              Tampoco lleva `vc-fade`: esa clase arranca en opacity 0 y con el
              retardo d6 tarda ~1,3 s en verse. El LCP solo cuenta cuando el
              elemento se ve, asi que esconder una imagen grande detras de un
              fade es penalizar la metrica que estamos arreglando. En movil si
              tenia el fade; se quita a proposito. */}
          <div className="lg:col-span-5 flex items-center justify-center overflow-visible w-full pt-2 lg:pt-0">
            <Image
              src="/version-movil.webp"
              alt="VeloClub versión móvil"
              width={780}
              height={540}
              priority
              fetchPriority="high"
              sizes="(max-width: 639px) 20rem, (max-width: 1023px) 24rem, 42rem"
              className="w-full max-w-xs sm:max-w-sm lg:max-w-2xl object-contain drop-shadow-2xl lg:scale-110"
            />
          </div>

        </div>
      </div>
    </div>
  );
}
