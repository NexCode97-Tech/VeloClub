'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Star } from 'lucide-react';

export default function GlassmorphismHero() {
  return (
    <div className="relative w-full min-h-dvh bg-zinc-950 overflow-hidden flex items-center" style={{ WebkitTransform: 'translateZ(0)', transform: 'translateZ(0)' }}>
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
      `}</style>

      {/* 1. Imagen de fondo */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url(/hero-bg.webp)",
          opacity: 0.55,
          maskImage: 'linear-gradient(180deg, transparent, black 0%, black 70%, transparent)',
          WebkitMaskImage: 'linear-gradient(180deg, transparent, black 0%, black 70%, transparent)',
          transform: 'translateZ(0)',
          WebkitTransform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
        }}
      />

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
      <div className="relative z-10 w-full max-w-5xl mx-auto px-5 pt-24 pb-12 sm:pt-28 sm:pb-16 lg:py-0 lg:min-h-dvh lg:flex lg:items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 lg:gap-6 items-center">

          {/* COLUMNA — texto */}
          <div className="lg:col-span-7 flex flex-col items-center lg:items-start space-y-5 text-center lg:text-left">

            {/* Badge */}
            <div className="vc-fade d1 flex justify-center lg:justify-start">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 backdrop-blur-md">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                  Plataforma multi-deporte
                  <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                </span>
              </div>
            </div>

            {/* Headline */}
            <h1 className="vc-fade d2 text-[2.4rem] sm:text-5xl lg:text-[3.25rem] font-bold tracking-tighter leading-[0.92] text-white">
              Gestiona tu club.<br />
              <span className="bg-gradient-to-br from-white via-white to-[#A855F7] bg-clip-text text-transparent">
                Enfócate en
              </span>
              <br />el deporte.
            </h1>

            {/* Descripción */}
            <p className="vc-fade d3 text-sm text-zinc-400 leading-relaxed mx-auto lg:mx-0 max-w-sm lg:max-w-md">
              VeloClub es la plataforma todo-en-uno para gestionar miembros, asistencia,
              pagos y competencias de tu club deportivo — desde un solo lugar.
            </p>

            {/* CTA */}
            <div className="vc-fade d4 flex justify-center lg:justify-start">
              <a
                href="https://wa.me/573153171225"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center justify-center gap-2 rounded-full w-full sm:w-auto px-8 py-3 text-sm font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #7C3AED, #9333EA)' }}
              >
                Contáctanos
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </a>
            </div>
          </div>

          {/* Columna derecha — imagen solo desktop */}
          <div className="hidden lg:flex lg:col-span-5 items-center justify-center">
            <Image
              src="/version-movil.webp"
              alt="VeloClub versión móvil"
              width={600}
              height={420}
              priority
              className="w-full max-w-lg object-contain drop-shadow-2xl"
            />
          </div>

        </div>
      </div>
    </div>
  );
}
