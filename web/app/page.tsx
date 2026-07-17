'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import Image from 'next/image';
import { Users, CalendarCheck, CreditCard, Trophy, CheckCircle2, ChevronRight, Zap, Shield, Smartphone, Menu, X } from 'lucide-react';
import GlassmorphismHero from '@/components/ui/glassmorphism-trust-hero';

// Mismo color/fondo para los 4 (el de "Gestión de miembros"), para que los
// íconos de "Todo lo que necesitas" queden unificados en vez de multicolor.
const FEATURE_COLOR = '#7C3AED';
const FEATURE_BG = 'rgba(124,58,237,0.10)';
const features = [
  {
    icon: Users,
    label: 'Gestión de miembros',
    desc: 'Administra deportistas, entrenadores y admins con perfiles completos y fotos.',
    color: FEATURE_COLOR,
    bg: FEATURE_BG,
  },
  {
    icon: CalendarCheck,
    label: 'Asistencia',
    desc: 'Registra presente, ausente, tardanza o excusa médica por sede y fecha.',
    color: FEATURE_COLOR,
    bg: FEATURE_BG,
  },
  {
    icon: CreditCard,
    label: 'Pagos y finanzas',
    desc: 'Mensualidades, flujo de caja, ingresos y egresos en tiempo real.',
    color: FEATURE_COLOR,
    bg: FEATURE_BG,
  },
  {
    icon: Trophy,
    label: 'Rendimiento',
    desc: 'Historial de competencias y entrenamientos por deportista y prueba.',
    color: FEATURE_COLOR,
    bg: FEATURE_BG,
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
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (isLoaded && isSignedIn) router.push('/dashboard');
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#0D0520]/95 backdrop-blur-md border-b border-white/5 shadow-lg shadow-black/30' : ''}`}>
        <div className="max-w-5xl mx-auto flex items-center justify-between px-5 py-3 sm:py-0 sm:h-20">
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
          <div className="hidden sm:flex items-center gap-4">
            <Link
              href="/sign-in"
              className="text-sm font-semibold text-white/90 hover:text-white transition-colors"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/crear-club"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2 rounded-full transition-all hover:scale-[1.03] active:scale-95"
              style={{ background: 'linear-gradient(135deg, #7C3AED, #9333EA)' }}
            >
              Crear mi club
            </Link>
          </div>

          {/* Mobile — botón crear club + hamburguesa */}
          <div className="sm:hidden flex items-center gap-2">
            <Link
              href="/crear-club"
              className="inline-flex items-center text-[13px] font-semibold text-white px-3.5 py-2 rounded-full"
              style={{ background: 'linear-gradient(135deg, #7C3AED, #9333EA)' }}
            >
              Crear mi club
            </Link>
            <button
              className="p-2.5 rounded-xl text-white hover:bg-white/10 transition-colors"
              onClick={() => setMenuOpen(v => !v)}
              aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            >
              {menuOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
            </button>
          </div>
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
              className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-white/90 hover:bg-white/10 transition-colors mt-1"
            >
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                <ChevronRight className="w-3.5 h-3.5 text-white" />
              </div>
              Iniciar sesión
            </Link>
            <Link
              href="/crear-club"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-white transition-colors"
              style={{ background: 'linear-gradient(135deg, #7C3AED, #9333EA)' }}
            >
              <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                <ChevronRight className="w-3.5 h-3.5 text-white" />
              </div>
              Crear mi club
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero glassmorphism */}
      <GlassmorphismHero />

      {/* Features */}
      <section id="funcionalidades" className="px-5 py-16 max-w-5xl mx-auto">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#8E87A8] text-center mb-3">Funcionalidades</p>
        <h2
          className="text-2xl sm:text-3xl font-semibold text-[#1A1028] text-center mb-10 tracking-tight"
          style={{ fontFamily: 'Open Sans, sans-serif' }}
        >
          Todo lo que necesitas
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
              <p className="font-semibold text-[#1A1028] text-sm mb-1" style={{ fontFamily: 'Open Sans, sans-serif' }}>
                {label}
              </p>
              <p className="text-xs text-[#8E87A8] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* App móvil preview — solo mobile/tablet (en desktop está en el hero) */}
      <section className="lg:hidden w-full bg-white py-10">
        <div className="max-w-5xl mx-auto px-5 flex justify-center">
          <Image
            src="/version-movil.webp"
            alt="VeloClub versión móvil"
            width={720}
            height={400}
            className="w-full max-w-2xl object-contain"
          />
        </div>
      </section>

      {/* Benefits */}
      <section id="por-que" className="px-5 py-16 max-w-5xl mx-auto">
        <div className="bg-white rounded-3xl border border-[rgba(120,80,200,0.08)] shadow-sm p-7 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#8E87A8] mb-3">¿Por qué VeloClub?</p>
          <h2
            className="text-2xl font-semibold text-[#1A1028] mb-8 tracking-tight"
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
            className="text-2xl sm:text-3xl font-semibold mb-3 tracking-tight relative"
            style={{ fontFamily: 'Open Sans, sans-serif' }}
          >
            ¿Listo para empezar?
          </h2>
          <p className="text-purple-200 text-sm mb-7 relative">
            Crea tu club gratis y empieza a gestionar todo desde hoy. 15 días de prueba.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 relative">
            <Link
              href="/crear-club"
              className="inline-flex items-center gap-2 px-7 py-3 bg-white text-[#7C3AED] font-semibold text-sm rounded-xl shadow-lg transition-all hover:-translate-y-0.5 active:scale-95 w-full sm:w-auto justify-center"
            >
              Crear mi club gratis
              <ChevronRight className="w-4 h-4" />
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-2 px-7 py-3 text-white font-semibold text-sm rounded-xl border border-white/40 hover:bg-white/10 transition-all active:scale-95 w-full sm:w-auto justify-center"
            >
              Ya tengo cuenta
            </Link>
          </div>
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
