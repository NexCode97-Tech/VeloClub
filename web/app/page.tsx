'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import Image from 'next/image';
import { Users, CalendarCheck, CreditCard, Trophy, CheckCircle2, ChevronRight, Zap, Shield, Smartphone, Menu, X } from 'lucide-react';
import GlassmorphismHero from '@/components/ui/glassmorphism-trust-hero';

const features = [
  {
    icon: Users,
    label: 'Gestión de miembros',
    desc: 'Administra deportistas, entrenadores y admins con perfiles completos y fotos.',
    color: '#7C3AED',
    bg: 'rgba(124,58,237,0.10)',
  },
  {
    icon: CalendarCheck,
    label: 'Asistencia',
    desc: 'Registra presente, ausente, tardanza o excusa médica por sede y fecha.',
    color: '#06D6A0',
    bg: 'rgba(6,214,160,0.10)',
  },
  {
    icon: CreditCard,
    label: 'Pagos y finanzas',
    desc: 'Mensualidades, flujo de caja, ingresos y egresos en tiempo real.',
    color: '#4361EE',
    bg: 'rgba(67,97,238,0.10)',
  },
  {
    icon: Trophy,
    label: 'Resultados',
    desc: 'Historial de competencias y entrenamientos por deportista y prueba.',
    color: '#FFB703',
    bg: 'rgba(255,183,3,0.10)',
  },
];

const benefits = [
  { icon: Zap, text: 'Multi-sede: gestiona varios lugares de entrenamiento desde una cuenta.' },
  { icon: Shield, text: 'Acceso controlado: tú decides quién entra a tu club.' },
  { icon: Users, text: 'Roles diferenciados: admin, entrenador y deportista con acceso personalizado.' },
  { icon: Smartphone, text: 'Instálala como app en tu celular, sin pasar por tiendas.' },
  { icon: CheckCircle2, text: 'Historial completo: asistencia, pagos y resultados de cada deportista.' },
];

const NAV_LINKS = [
  { href: '#funcionalidades', label: 'Funcionalidades' },
  { href: '#por-que', label: '¿Por qué VeloClub?' },
  { href: '/sign-in', label: 'Iniciar sesión' },
];

export default function HomePage() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (isLoaded && isSignedIn) router.push('/dashboard');
  }, [isLoaded, isSignedIn, router]);

  // Close menu on resize to desktop
  useEffect(() => {
    const handler = () => { if (window.innerWidth >= 640) setMenuOpen(false); };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Lock body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  if (!isLoaded || isSignedIn) return null;

  return (
    <main className="min-h-dvh bg-[#F7F7FB] [overflow-x:clip]">

      {/* Nav — transparente, encima del hero */}
      <nav className="fixed top-0 left-0 right-0 z-50">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-5 py-0 sm:h-20">
          {/* Desktop links — izquierda */}
          <div className="hidden sm:flex items-center gap-6">
            <a href="#funcionalidades" className="text-sm font-medium text-white/85 hover:text-white transition-colors">
              Funcionalidades
            </a>
            <a href="#por-que" className="text-sm font-medium text-white/85 hover:text-white transition-colors">
              ¿Por qué VeloClub?
            </a>
          </div>

          <Image
            src="/logo.png"
            alt="VeloClub"
            width={80}
            height={80}
            className="object-contain h-9 w-auto sm:h-10 sm:absolute sm:left-1/2 sm:-translate-x-1/2"
            style={{ filter: 'brightness(0) invert(1)' }}
          />

          {/* Desktop — derecha */}
          <div className="hidden sm:flex items-center gap-3">
            <Link
              href="/sign-in"
              className="text-sm font-semibold text-white/90 hover:text-white transition-colors"
            >
              Iniciar sesión
            </Link>
            <a
              href="https://wa.me/573153171225"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold text-white transition-all hover:scale-[1.02]"
              style={{ background: 'linear-gradient(135deg, #7C3AED, #9333EA)' }}
            >
              Empezar
              <ChevronRight className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Mobile hamburger */}
          <button
            className="sm:hidden p-2.5 rounded-xl text-white hover:bg-white/10 transition-colors"
            onClick={() => setMenuOpen(v => !v)}
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          >
            {menuOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
          </button>
        </div>

        {/* Mobile dropdown menu */}
        <div
          className={`sm:hidden overflow-hidden transition-all duration-300 ease-in-out ${
            menuOpen ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="mx-3 mb-2 px-3 pb-3 pt-2 flex flex-col gap-1 rounded-2xl bg-black/40 backdrop-blur-lg border border-white/15">
            <a
              href="#funcionalidades"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-white/90 hover:bg-white/10 transition-colors"
            >
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                <Zap className="w-3.5 h-3.5 text-white" />
              </div>
              Funcionalidades
            </a>
            <a
              href="#por-que"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-white/90 hover:bg-white/10 transition-colors"
            >
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                <Shield className="w-3.5 h-3.5 text-white" />
              </div>
              ¿Por qué VeloClub?
            </a>
            <Link
              href="/sign-in"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-white/90 hover:bg-white/10 transition-colors"
            >
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                <ChevronRight className="w-3.5 h-3.5 text-white" />
              </div>
              Iniciar sesión
            </Link>
            <a
              href="https://wa.me/573153171225"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-white transition-colors mt-1"
              style={{ background: 'linear-gradient(135deg, #7C3AED, #9333EA)' }}
            >
              <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                <ChevronRight className="w-3.5 h-3.5 text-white" />
              </div>
              Empezar
            </a>
          </div>
        </div>
      </nav>

      {/* Hero glassmorphism */}
      <GlassmorphismHero />

      {/* Features */}
      <section id="funcionalidades" className="px-5 py-16 max-w-5xl mx-auto">
        <p className="text-xs font-bold uppercase tracking-widest text-[#8E87A8] text-center mb-3">Funcionalidades</p>
        <h2
          className="text-2xl sm:text-3xl font-extrabold text-[#1A1028] text-center mb-10 tracking-tight"
          style={{ fontFamily: 'Open Sans, sans-serif' }}
        >
          Todo lo que necesitas
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map(({ icon: Icon, label, desc, color, bg }) => (
            <div
              key={label}
              className="bg-white rounded-2xl p-5 border border-[rgba(120,80,200,0.08)] shadow-sm hover:shadow-md transition-shadow"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                style={{ background: bg }}
              >
                <Icon className="w-5 h-5" style={{ color }} />
              </div>
              <p className="font-bold text-[#1A1028] text-sm mb-1" style={{ fontFamily: 'Open Sans, sans-serif' }}>
                {label}
              </p>
              <p className="text-xs text-[#8E87A8] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section id="por-que" className="px-5 py-16 max-w-5xl mx-auto">
        <div className="bg-white rounded-3xl border border-[rgba(120,80,200,0.08)] shadow-sm p-7 sm:p-10">
          <p className="text-xs font-bold uppercase tracking-widest text-[#8E87A8] mb-3">¿Por qué VeloClub?</p>
          <h2
            className="text-2xl font-extrabold text-[#1A1028] mb-8 tracking-tight"
            style={{ fontFamily: 'Open Sans, sans-serif' }}
          >
            Diseñado para clubes reales
          </h2>
          <ul className="space-y-4">
            {benefits.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-[rgba(124,58,237,0.08)] flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-3.5 h-3.5 text-[#7C3AED]" />
                </div>
                <p className="text-sm text-[#4A4060] leading-relaxed">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA final */}
      <section className="px-5 pb-20 max-w-5xl mx-auto">
        <div
          className="rounded-3xl p-8 sm:p-12 text-center text-white relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #9333EA 60%, #A855F7 100%)' }}
        >
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #fff 0%, transparent 50%)' }}
          />
          <h2
            className="text-2xl sm:text-3xl font-extrabold mb-3 tracking-tight relative"
            style={{ fontFamily: 'Open Sans, sans-serif' }}
          >
            ¿Listo para empezar?
          </h2>
          <p className="text-purple-200 text-sm mb-7 relative">
            Ingresa a tu club y empieza a gestionar todo desde hoy.
          </p>
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-2 px-7 py-3 bg-white text-[#7C3AED] font-bold text-sm rounded-xl shadow-lg transition-all hover:-translate-y-0.5 active:scale-95 relative"
          >
            Iniciar sesión
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[rgba(120,80,200,0.08)] py-6 text-center text-xs text-[#8E87A8] space-y-1">
        <div className="max-w-5xl mx-auto px-5">
        <p>© {new Date().getFullYear()} VeloClub · Todos los derechos reservados</p>
        <p>
          Desarrollado por{' '}
          <a
            href="https://nexcode97.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[#7C3AED] hover:text-[#6D28D9] transition-colors"
          >
            NexCode97
          </a>
        </p>
        </div>
      </footer>
    </main>
  );
}
