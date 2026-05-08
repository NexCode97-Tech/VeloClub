'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import Image from 'next/image';
import { Users, CalendarCheck, CreditCard, Trophy, CheckCircle2, ChevronRight, Zap, Shield, Smartphone, Menu, X } from 'lucide-react';

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
    <main className="min-h-dvh bg-[#F7F7FB] overflow-x-hidden">

      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[rgba(120,80,200,0.08)]">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-5 py-3.5">
          {/* Desktop links — izquierda */}
          <div className="hidden sm:flex items-center gap-6">
            <a href="#funcionalidades" className="text-sm font-medium text-[#4A4060] hover:text-[#7C3AED] transition-colors">
              Funcionalidades
            </a>
            <a href="#por-que" className="text-sm font-medium text-[#4A4060] hover:text-[#7C3AED] transition-colors">
              ¿Por qué VeloClub?
            </a>
          </div>

          <Image src="/logo-full.jpg" alt="VeloClub" width={72} height={72} className="object-contain h-10 w-auto sm:absolute sm:left-1/2 sm:-translate-x-1/2" />

          {/* Desktop — derecha */}
          <div className="hidden sm:flex items-center">
            <a
              href="https://wa.me/573153171225"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm font-semibold text-[#7C3AED] hover:text-[#6D28D9] transition-colors"
            >
              Soporte
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>

          {/* Mobile hamburger */}
          <button
            className="sm:hidden p-2.5 rounded-xl text-[#4A4060] hover:bg-[rgba(124,58,237,0.06)] transition-colors"
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
          <div className="px-5 pb-4 pt-1 flex flex-col gap-1 border-t border-[rgba(120,80,200,0.08)]">
            <a
              href="#funcionalidades"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-[#4A4060] hover:bg-[rgba(124,58,237,0.06)] hover:text-[#7C3AED] transition-colors"
            >
              <div className="w-7 h-7 rounded-lg bg-[rgba(124,58,237,0.08)] flex items-center justify-center shrink-0">
                <Zap className="w-3.5 h-3.5 text-[#7C3AED]" />
              </div>
              Funcionalidades
            </a>
            <a
              href="#por-que"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-[#4A4060] hover:bg-[rgba(124,58,237,0.06)] hover:text-[#7C3AED] transition-colors"
            >
              <div className="w-7 h-7 rounded-lg bg-[rgba(124,58,237,0.08)] flex items-center justify-center shrink-0">
                <Shield className="w-3.5 h-3.5 text-[#7C3AED]" />
              </div>
              ¿Por qué VeloClub?
            </a>
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
              Soporte
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative px-5 pt-16 pb-20 max-w-2xl mx-auto text-center overflow-hidden">
        {/* Blob de fondo */}
        <div
          className="absolute -top-20 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full opacity-[0.07] blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #7C3AED 0%, #A855F7 60%, transparent 100%)' }}
        />

        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[#7C3AED] bg-[rgba(124,58,237,0.08)] border border-[rgba(124,58,237,0.15)] px-3.5 py-1.5 rounded-full mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-[#7C3AED] animate-pulse" />
          Plataforma para clubes de patinaje
        </span>

        <h1
          className="text-4xl sm:text-5xl font-extrabold text-[#1A1028] leading-[1.15] tracking-tight mb-5"
          style={{ fontFamily: 'var(--font-space-grotesk), Space Grotesk, sans-serif' }}
        >
          Gestiona tu club{' '}
          <span
            className="inline-block"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #A855F7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            desde un solo lugar
          </span>
        </h1>

        <p className="text-base sm:text-lg text-[#8E87A8] leading-relaxed mb-10 max-w-lg mx-auto">
          Todo lo que necesitas para administrar tu club: miembros, asistencia, pagos, resultados y calendario, sin complicaciones.
        </p>

        <Link
          href="/sign-in"
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl text-white font-bold text-base shadow-lg shadow-[rgba(124,58,237,0.35)] transition-all active:scale-95 hover:shadow-xl hover:shadow-[rgba(124,58,237,0.4)] hover:-translate-y-0.5"
          style={{ background: 'linear-gradient(135deg, #7C3AED, #9333EA)' }}
        >
          Entrar a VeloClub
          <ChevronRight className="w-4 h-4" />
        </Link>
      </section>

      {/* Features */}
      <section id="funcionalidades" className="px-5 py-16 max-w-2xl mx-auto">
        <p className="text-xs font-bold uppercase tracking-widest text-[#8E87A8] text-center mb-3">Funcionalidades</p>
        <h2
          className="text-2xl sm:text-3xl font-extrabold text-[#1A1028] text-center mb-10 tracking-tight"
          style={{ fontFamily: 'var(--font-space-grotesk), Space Grotesk, sans-serif' }}
        >
          Todo lo que necesitas
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <p className="font-bold text-[#1A1028] text-sm mb-1" style={{ fontFamily: 'var(--font-space-grotesk), Space Grotesk, sans-serif' }}>
                {label}
              </p>
              <p className="text-xs text-[#8E87A8] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section id="por-que" className="px-5 py-16 max-w-2xl mx-auto">
        <div className="bg-white rounded-3xl border border-[rgba(120,80,200,0.08)] shadow-sm p-7 sm:p-10">
          <p className="text-xs font-bold uppercase tracking-widest text-[#8E87A8] mb-3">¿Por qué VeloClub?</p>
          <h2
            className="text-2xl font-extrabold text-[#1A1028] mb-8 tracking-tight"
            style={{ fontFamily: 'var(--font-space-grotesk), Space Grotesk, sans-serif' }}
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
      <section className="px-5 pb-20 max-w-2xl mx-auto">
        <div
          className="rounded-3xl p-8 sm:p-12 text-center text-white relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #9333EA 60%, #A855F7 100%)' }}
        >
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #fff 0%, transparent 50%)' }}
          />
          <h2
            className="text-2xl sm:text-3xl font-extrabold mb-3 tracking-tight relative"
            style={{ fontFamily: 'var(--font-space-grotesk), Space Grotesk, sans-serif' }}
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
      <footer className="border-t border-[rgba(120,80,200,0.08)] px-5 py-6 text-center text-xs text-[#8E87A8] space-y-1">
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
      </footer>
    </main>
  );
}
