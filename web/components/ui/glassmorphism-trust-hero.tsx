'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

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

        /* Latido del punto de la pastilla: un halo que se expande y se apaga */
        @keyframes vcPing {
          0%   { transform: scale(1);   opacity: .65 }
          70%  { transform: scale(2.6); opacity: 0 }
          100% { transform: scale(2.6); opacity: 0 }
        }
        .vc-ping { animation: vcPing 2.4s cubic-bezier(0,0,.2,1) infinite }

        /* El halo del boton respira. Va en box-shadow y no en transform para no
           mover el boton mientras alguien intenta tocarlo. */
        @keyframes vcGlow {
          0%, 100% { box-shadow: 0 6px 24px rgba(124,58,237,.32) }
          50%      { box-shadow: 0 8px 34px rgba(147,51,234,.55) }
        }
        .vc-cta { animation: vcGlow 3.2s ease-in-out 1.6s infinite }

        @media (prefers-reduced-motion: reduce) {
          .vc-cta { animation: none; box-shadow: 0 6px 24px rgba(124,58,237,.32) }
          .vc-line { animation: fadeSlideIn .5s ease-out both }
          .vc-promo-text { animation: none; color: #E9D5FF; background: none; -webkit-text-fill-color: currentColor }
          .vc-ping { animation: none; opacity: .4 }
          .vc-marquee { animation: none }
        }
      `}</style>

      {/* 1. Imagen de fondo — Next.js Image con priority para LCP */}
      <div
        className="absolute inset-0 z-0"
        style={{
          maskImage: 'linear-gradient(180deg, transparent, black 0%, black 70%, transparent)',
          WebkitMaskImage: 'linear-gradient(180deg, transparent, black 0%, black 70%, transparent)',
        }}
      >
        <Image
          src="/hero-bg.webp"
          alt=""
          fill
          priority
          fetchPriority="high"
          sizes="100vw"
          className="object-cover object-center opacity-55"
          style={{
            transform: 'translateZ(0)',
            WebkitTransform: 'translateZ(0)',
            willChange: 'transform',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
          }}
        />
      </div>

      {/* 2. Fondo oscuro base */}
      <div className="absolute inset-0 z-[1] bg-zinc-950/80" />

      {/* 3. Glow violeta — centrado en mobile, desplazado en desktop */}
      <div
        className="absolute inset-0 z-[2] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 280px 420px at 50% 55%, rgba(124,58,237,0.7) 0%, rgba(109,28,209,0.4) 35%, rgba(168,85,247,0.12) 60%, transparent 80%)',
        }}
      />
      <div
        className="absolute inset-0 z-[2] pointer-events-none hidden lg:block"
        style={{
          background: 'radial-gradient(ellipse 360px 560px at 38% 60%, rgba(124,58,237,0.75) 0%, rgba(109,28,209,0.45) 35%, rgba(168,85,247,0.15) 60%, transparent 80%)',
        }}
      />

      {/* 4. Sombra lateral derecha */}
      <div
        className="absolute inset-0 z-[2] pointer-events-none hidden lg:block"
        style={{ background: 'linear-gradient(to right, transparent 35%, rgba(9,4,20,0.55) 100%)' }}
      />

      {/* CONTENIDO */}
      <div className="relative z-10 w-full max-w-5xl mx-auto px-5 pt-24 pb-12 sm:pt-28 sm:pb-16 lg:py-0 lg:min-h-svh lg:flex lg:items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 lg:gap-6 items-center">

          {/* COLUMNA — texto */}
          <div className="lg:col-span-7 flex flex-col items-center lg:items-start space-y-5 text-center lg:text-left">

            {/* Pastilla de campaña — el punto late para que el ojo la registre
                antes de leerla */}
            <div className="vc-fade d1 inline-flex items-center gap-2.5 rounded-full px-3.5 py-1.5"
              style={{ background: 'rgba(124,58,237,0.16)', border: '1px solid rgba(168,85,247,0.35)' }}>
              <span className="relative inline-flex w-1.5 h-1.5 shrink-0">
                <span className="vc-ping absolute inset-0 rounded-full" style={{ background: '#A855F7' }} />
                <span className="relative inline-block w-1.5 h-1.5 rounded-full" style={{ background: '#A855F7' }} />
              </span>
              <span className="text-[12px] font-semibold text-white">Promoción de lanzamiento</span>
              <span className="text-[12px] text-zinc-400">hasta el 31 de octubre</span>
            </div>

            {/* Titular — la promoción es la tercera línea y remata la frase, así
                que se lee de corrido: "Gestiona tu club, enfócate en el deporte,
                con 2 meses gratis". Cada línea entra por separado, con un
                desenfoque que se disipa: el texto parece enfocarse al llegar.
                Cuando la promoción termine se borra esa línea y el titular
                sigue teniendo sentido por sí solo. */}
            <h1 className="text-[2.4rem] sm:text-5xl lg:text-[3.25rem] font-semibold tracking-tighter leading-[0.92] text-white">
              <span className="vc-line" style={{ animationDelay: '.14s' }}>Gestiona tu club.</span>
              <span className="vc-line" style={{ animationDelay: '.26s' }}>
                <span className="bg-gradient-to-br from-white via-white to-[#A855F7] bg-clip-text text-transparent">
                  Enfócate en el deporte.
                </span>
              </span>
              <span className="vc-line" style={{ animationDelay: '.42s' }}>
                <span className="vc-promo-text">Con 2 meses gratis.</span>
              </span>
            </h1>

            {/* Descripción */}
            <p className="vc-fade d4 text-sm text-zinc-400 leading-relaxed mx-auto lg:mx-0 max-w-sm lg:max-w-md">
              La plataforma todo-en-uno para gestionar miembros, asistencia, pagos y
              competencias. Pruébala dos meses sin costo y sin tarjeta.
            </p>

            {/* CTA */}
            <div className="vc-fade d5 flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3">
              <Link
                href="/crear-club"
                className="vc-cta inline-flex items-center justify-center gap-2 rounded-full w-full sm:w-auto px-8 py-3 text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #7C3AED, #9333EA)' }}
              >
                Empezar 2 meses gratis
              </Link>
              <a
                href="https://wa.me/573006359008"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full w-full sm:w-auto px-8 py-3 text-sm font-semibold text-white/90 border border-white/25 hover:bg-white/10 transition-all active:scale-[0.98]"
              >
                Contáctanos
              </a>
            </div>

            {/* Imagen — solo mobile/tablet, debajo del contenido */}
            <div className="vc-fade d6 lg:hidden w-full flex justify-center pt-2">
              <Image
                src="/version-movil.webp"
                alt="VeloClub versión móvil"
                width={720}
                height={400}
                className="w-full max-w-xs sm:max-w-sm object-contain drop-shadow-2xl"
              />
            </div>
          </div>

          {/* Columna derecha — imagen solo desktop */}
          <div className="hidden lg:flex lg:col-span-5 items-center justify-center overflow-visible">
            <Image
              src="/version-movil.webp"
              alt="VeloClub versión móvil"
              width={780}
              height={540}
              priority
              className="w-full max-w-2xl object-contain drop-shadow-2xl scale-110"
            />
          </div>

        </div>
      </div>
    </div>
  );
}
