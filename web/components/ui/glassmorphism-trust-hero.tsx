'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Star,
  Bike,
  Waves,
  Dumbbell,
  Zap,
  CircleDot,
  Shield,
} from 'lucide-react';

const SPORTS = [
  { name: 'Ciclismo',      icon: Bike },
  { name: 'Natación',      icon: Waves },
  { name: 'Atletismo',     icon: Zap },
  { name: 'Fútbol',        icon: CircleDot },
  { name: 'Fitness',       icon: Dumbbell },
  { name: 'Multi-deporte', icon: Shield },
];

export default function GlassmorphismHero() {
  return (
    <div className="relative w-full min-h-screen bg-zinc-950 overflow-hidden flex items-center">
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
        }}
      />

      {/* 2. Fondo oscuro base */}
      <div className="absolute inset-0 z-[1] bg-zinc-950/80" />

      {/* 3. Glow violeta */}
      <div
        className="absolute inset-0 z-[2] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 320px 520px at 42% 62%, rgba(124,58,237,0.75) 0%, rgba(109,28,209,0.45) 35%, rgba(168,85,247,0.15) 60%, transparent 80%)',
        }}
      />

      {/* 4. Sombra lateral derecha */}
      <div
        className="absolute inset-0 z-[2] pointer-events-none hidden lg:block"
        style={{ background: 'linear-gradient(to right, transparent 35%, rgba(9,4,20,0.55) 100%)' }}
      />

      {/* CONTENIDO */}
      <div className="relative z-10 w-full max-w-5xl mx-auto px-5 py-24 sm:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-6 items-center">

          {/* COLUMNA IZQUIERDA — texto */}
          <div className="lg:col-span-7 flex flex-col space-y-5">

            {/* Badge */}
            <div className="vc-fade d1">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 backdrop-blur-md">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                  Plataforma multi-deporte
                  <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                </span>
              </div>
            </div>

            {/* Headline */}
            <h1 className="vc-fade d2 text-[2.6rem] sm:text-5xl lg:text-[3.25rem] font-bold tracking-tighter leading-[0.92] text-white">
              Gestiona tu club.<br />
              <span className="bg-gradient-to-br from-white via-white to-[#A855F7] bg-clip-text text-transparent">
                Enfócate en
              </span>
              <br />el deporte.
            </h1>

            {/* Descripción */}
            <p className="vc-fade d3 max-w-md text-sm text-zinc-400 leading-relaxed">
              VeloClub es la plataforma todo-en-uno para gestionar miembros, asistencia,
              pagos y competencias de tu club deportivo — desde un solo lugar.
            </p>

            {/* CTA */}
            <div className="vc-fade d4">
              <a
                href="https://wa.me/573153171225"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #7C3AED, #9333EA)' }}
              >
                Empezar
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </a>
            </div>
          </div>

          {/* COLUMNA DERECHA — marquee */}
          <div className="lg:col-span-5">
            <div className="vc-fade d5 relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 py-4 backdrop-blur-xl">
              <h3 className="mb-3 px-5 text-[11px] font-medium text-zinc-400">Disciplinas compatibles</h3>
              <div
                className="relative flex overflow-hidden"
                style={{
                  maskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)',
                  WebkitMaskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)',
                }}
              >
                <div className="vc-marquee flex gap-8 whitespace-nowrap px-3">
                  {[...SPORTS, ...SPORTS, ...SPORTS].map((sport, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 opacity-50 transition-all hover:opacity-100 hover:scale-105 cursor-default"
                    >
                      <sport.icon className="h-4 w-4 text-violet-400" />
                      <span className="text-sm font-bold text-white tracking-tight">{sport.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
