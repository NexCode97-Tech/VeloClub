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
  { name: 'Ciclismo',      icon: Bike },
  { name: 'Natación',      icon: Waves },
  { name: 'Atletismo',     icon: Zap },
  { name: 'Fútbol',        icon: Target },
  { name: 'Fitness',       icon: Dumbbell },
  { name: 'Multi-deporte', icon: Shield },
];

const StatItem = ({ value, label }: { value: string; label: string }) => (
  <div className="flex flex-col items-center justify-center transition-transform hover:-translate-y-0.5 cursor-default">
    <span className="text-base font-bold text-white">{value}</span>
    <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-medium">{label}</span>
  </div>
);

export default function GlassmorphismHero() {
  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 pt-24 pb-8 flex items-center justify-center min-h-screen bg-zinc-950">
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

      {/* Caja contenida */}
      <div className="relative w-full max-w-5xl rounded-3xl overflow-hidden border border-white/10 shadow-2xl">

        {/* ── FONDOS ── */}

        {/* 1. Imagen silueta deportista de espalda */}
        <div
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: "url(https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=1920&q=80)",
            opacity: 0.55,
            maskImage: 'linear-gradient(180deg, transparent, black 0%, black 70%, transparent)',
            WebkitMaskImage: 'linear-gradient(180deg, transparent, black 0%, black 70%, transparent)',
          }}
        />

        {/* 2. Fondo oscuro base */}
        <div className="absolute inset-0 z-[1] bg-zinc-950/80" />

        {/* 3. Puerta violeta — radial glow */}
        <div
          className="absolute inset-0 z-[2] pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 320px 520px at 42% 62%, rgba(124,58,237,0.75) 0%, rgba(109,28,209,0.45) 35%, rgba(168,85,247,0.15) 60%, transparent 80%)',
          }}
        />

        {/* 4. Sombra lateral derecha para cards */}
        <div
          className="absolute inset-0 z-[2] pointer-events-none"
          style={{
            background: 'linear-gradient(to right, transparent 35%, rgba(9,4,20,0.55) 100%)',
          }}
        />

        {/* ── CONTENIDO ── */}
        <div className="relative z-10 px-8 py-10 lg:px-12 lg:py-12">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-6 items-center">

            {/* COLUMNA IZQUIERDA */}
            <div className="lg:col-span-7 flex flex-col justify-center space-y-5">

              {/* Badge */}
              <div className="vc-fade d1">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 backdrop-blur-md transition-colors hover:bg-white/10">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                    Plataforma multi-deporte
                    <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                  </span>
                </div>
              </div>

              {/* Headline */}
              <h1 className="vc-fade d2 text-4xl sm:text-5xl lg:text-[3.25rem] font-bold tracking-tighter leading-[0.92] text-white">
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

              {/* CTAs */}
              <div className="vc-fade d4 flex flex-col sm:flex-row gap-3">
                <Link
                  href="/sign-in"
                  className="group inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg, #7C3AED, #9333EA)' }}
                >
                  Iniciar sesión
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <a
                  href="#funcionalidades"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/10"
                >
                  Ver funcionalidades
                </a>
              </div>
            </div>

            {/* COLUMNA DERECHA */}
            <div className="lg:col-span-5 flex flex-col gap-3">

              {/* Stats Card */}
              <div className="vc-fade d5 relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl shadow-xl">
                <div className="absolute top-0 right-0 -mr-10 -mt-10 h-40 w-40 rounded-full bg-[#7C3AED]/10 blur-2xl pointer-events-none" />

                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#7C3AED]/20 ring-1 ring-[#7C3AED]/30">
                      <Users className="h-4 w-4 text-violet-300" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold tracking-tight text-white leading-none">500+</div>
                      <div className="text-xs text-zinc-400 mt-0.5">Deportistas activos</div>
                    </div>
                  </div>

                  <div className="space-y-1.5 mb-4">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-400">Asistencia promedio</span>
                      <span className="text-white font-medium">92%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800/60">
                      <div className="h-full w-[92%] rounded-full bg-gradient-to-r from-[#7C3AED] to-[#A855F7]" />
                    </div>
                  </div>

                  <div className="h-px w-full bg-white/10 mb-3" />

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <StatItem value="30+" label="Clubes" />
                    <div className="w-px bg-white/10 mx-auto" />
                    <StatItem value="8" label="Deportes" />
                    <div className="w-px bg-white/10 mx-auto" />
                    <StatItem value="4" label="Países" />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-medium tracking-wide text-zinc-300">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                      </span>
                      EN PRODUCCIÓN
                    </div>
                    <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-medium tracking-wide text-zinc-300">
                      <Trophy className="w-2.5 h-2.5 text-yellow-500" />
                      MULTI-DEPORTE
                    </div>
                    <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-medium tracking-wide text-zinc-300">
                      <CalendarCheck className="w-2.5 h-2.5 text-violet-400" />
                      ASISTENCIA QR
                    </div>
                    <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-medium tracking-wide text-zinc-300">
                      <CreditCard className="w-2.5 h-2.5 text-[#06D6A0]" />
                      PAGOS
                    </div>
                  </div>
                </div>
              </div>

              {/* Marquee Card */}
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
    </div>
  );
}
