'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Users,
  Trophy,
  CalendarCheck,
  CreditCard,
  Star,
  Bike,
  Waves,
  Dumbbell,
  Zap,
  Target,
  Shield,
} from 'lucide-react';

const SPORTS = [
  { name: 'Ciclismo',    icon: Bike },
  { name: 'Natación',    icon: Waves },
  { name: 'Atletismo',   icon: Zap },
  { name: 'Fútbol',      icon: Target },
  { name: 'Fitness',     icon: Dumbbell },
  { name: 'Multi-deporte', icon: Shield },
];

const StatItem = ({ value, label }: { value: string; label: string }) => (
  <div className="flex flex-col items-center justify-center transition-transform hover:-translate-y-1 cursor-default">
    <span className="text-xl font-bold text-white sm:text-2xl">{value}</span>
    <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium sm:text-xs">{label}</span>
  </div>
);

export default function GlassmorphismHero() {
  return (
    <div className="relative w-full bg-[#0B0220] text-white overflow-hidden font-sans">
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .animate-fade-in {
          animation: fadeSlideIn 0.8s ease-out forwards;
          opacity: 0;
        }
        .animate-marquee {
          animation: marquee 40s linear infinite;
        }
        .delay-100 { animation-delay: 0.1s; }
        .delay-200 { animation-delay: 0.2s; }
        .delay-300 { animation-delay: 0.3s; }
        .delay-400 { animation-delay: 0.4s; }
        .delay-500 { animation-delay: 0.5s; }
      `}</style>

      {/* Fondo con imagen deportiva */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center opacity-30"
        style={{
          backgroundImage: "url(https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=1920&q=80)",
          maskImage: 'linear-gradient(180deg, transparent, black 10%, black 70%, transparent)',
          WebkitMaskImage: 'linear-gradient(180deg, transparent, black 10%, black 70%, transparent)',
        }}
      />

      {/* Halo violeta de fondo */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-[#7C3AED]/20 blur-[120px] pointer-events-none z-0" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col min-h-screen justify-center py-0">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-8 items-center">

          {/* --- COLUMNA IZQUIERDA --- */}
          <div className="lg:col-span-7 flex flex-col justify-center space-y-6 pt-20 lg:pt-0">

            {/* Badge */}
            <div className="animate-fade-in delay-100">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#7C3AED]/30 bg-[#7C3AED]/10 px-3 py-1.5 backdrop-blur-md transition-colors hover:bg-[#7C3AED]/20">
                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-violet-300 flex items-center gap-2">
                  Plataforma multi-deporte
                  <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                </span>
              </div>
            </div>

            {/* Headline */}
            <h1
              className="animate-fade-in delay-200 text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tighter leading-[0.9]"
              style={{
                maskImage: 'linear-gradient(180deg, black 0%, black 80%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(180deg, black 0%, black 80%, transparent 100%)',
              }}
            >
              Gestiona tu club.<br />
              <span className="bg-gradient-to-br from-white via-white to-[#A855F7] bg-clip-text text-transparent">
                Enfócate en
              </span>
              <br />el deporte.
            </h1>

            {/* Descripción */}
            <p className="animate-fade-in delay-300 max-w-xl text-lg text-zinc-400 leading-relaxed">
              VeloClub es la plataforma todo-en-uno para gestionar miembros, asistencia,
              pagos y competencias de tu club deportivo — desde un solo lugar.
            </p>

            {/* CTAs */}
            <div className="animate-fade-in delay-400 flex flex-col sm:flex-row gap-4">
              <Link
                href="/sign-in"
                className="group inline-flex items-center justify-center gap-2 rounded-full px-8 py-4 text-sm font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #7C3AED, #9333EA)' }}
              >
                Iniciar sesión
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>

              <a
                href="#funcionalidades"
                className="group inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-8 py-4 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/10 hover:border-white/20"
              >
                Ver funcionalidades
              </a>
            </div>
          </div>

          {/* --- COLUMNA DERECHA --- */}
          <div className="lg:col-span-5 space-y-4 lg:mt-0">

            {/* Stats Card */}
            <div className="animate-fade-in delay-500 relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl shadow-2xl">
              <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-[#7C3AED]/10 blur-3xl pointer-events-none" />

              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#7C3AED]/20 ring-1 ring-[#7C3AED]/30">
                    <Users className="h-6 w-6 text-violet-300" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold tracking-tight text-white">500+</div>
                    <div className="text-sm text-zinc-400">Deportistas activos</div>
                  </div>
                </div>

                {/* Progress */}
                <div className="space-y-2 mb-5">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Asistencia promedio</span>
                    <span className="text-white font-medium">92%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800/50">
                    <div className="h-full w-[92%] rounded-full bg-gradient-to-r from-[#7C3AED] to-[#A855F7]" />
                  </div>
                </div>

                <div className="h-px w-full bg-white/10 mb-4" />

                {/* Mini Stats */}
                <div className="grid grid-cols-3 gap-4 text-center">
                  <StatItem value="30+" label="Clubes" />
                  <div className="w-px h-full bg-white/10 mx-auto" />
                  <StatItem value="8" label="Deportes" />
                  <div className="w-px h-full bg-white/10 mx-auto" />
                  <StatItem value="4" label="Países" />
                </div>

                {/* Tags */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-medium tracking-wide text-zinc-300">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                    </span>
                    EN PRODUCCIÓN
                  </div>
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-medium tracking-wide text-zinc-300">
                    <Trophy className="w-3 h-3 text-yellow-500" />
                    MULTI-DEPORTE
                  </div>
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-medium tracking-wide text-zinc-300">
                    <CalendarCheck className="w-3 h-3 text-violet-400" />
                    ASISTENCIA QR
                  </div>
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-medium tracking-wide text-zinc-300">
                    <CreditCard className="w-3 h-3 text-[#06D6A0]" />
                    PAGOS
                  </div>
                </div>
              </div>
            </div>

            {/* Marquee Card */}
            <div className="animate-fade-in delay-500 relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 py-8 backdrop-blur-xl">
              <h3 className="mb-6 px-8 text-sm font-medium text-zinc-400">Disciplinas compatibles</h3>

              <div
                className="relative flex overflow-hidden"
                style={{
                  maskImage: 'linear-gradient(to right, transparent, black 20%, black 80%, transparent)',
                  WebkitMaskImage: 'linear-gradient(to right, transparent, black 20%, black 80%, transparent)',
                }}
              >
                <div className="animate-marquee flex gap-12 whitespace-nowrap px-4">
                  {[...SPORTS, ...SPORTS, ...SPORTS].map((sport, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 opacity-50 transition-all hover:opacity-100 hover:scale-105 cursor-default"
                    >
                      <sport.icon className="h-5 w-5 text-violet-400" />
                      <span className="text-base font-bold text-white tracking-tight">
                        {sport.name}
                      </span>
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
