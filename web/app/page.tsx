'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Users, CalendarCheck, CreditCard, CheckCircle2, ChevronRight, Zap, Shield, Smartphone, Menu, X } from 'lucide-react';
import LandingHero from '@/components/ui/landing-hero';
import LandingFeaturesTabs from '@/components/ui/landing-features-tabs';
import LandingTrustedBy from '@/components/ui/landing-trusted-by';
import {
  IconUsers, IconUbicacion, IconAsistencias, IconFinanzas, IconResultados,
  IconMensualidades, IconFlujoCaja, IconCompetencias, IconEntrenamientos,
} from '@/components/ui/custom-icons';

// Mismo color/fondo para los cuatro, para que los iconos queden unificados en
// vez de multicolor.
const FEATURE_COLOR = '#381DA0';
const FEATURE_BG = 'rgba(56,29,160,0.10)';

// Sin sub-pestañas: las entradas de cada modulo se ven todas a la vez, en dos
// columnas. Los iconos son los mismos que usa la aplicacion por dentro.
const features = [
  {
    key: 'miembros',
    icon: IconUsers,
    label: 'Miembros',
    color: FEATURE_COLOR,
    bg: FEATURE_BG,
    sub: [
      { key: 'perfiles', label: 'Perfiles', icon: IconUsers,
        desc: 'Deja de tener a tu club repartido entre cuadernos y chats. Compartes un enlace, cada quien registra sus datos y los permisos van por rol, así el entrenador trabaja con su gente y las finanzas quedan en la administración.' },
      { key: 'sedes', label: 'Sedes', icon: IconUbicacion,
        desc: 'Ubicar el entrenamiento deja de depender de indicaciones sueltas. Cada sede queda con su punto exacto y su ruta en Google Maps, Waze o Apple Maps, disponible para todo el club desde el primer día.' },
    ],
  },
  {
    key: 'asistencia',
    icon: IconAsistencias,
    label: 'Asistencia',
    color: FEATURE_COLOR,
    bg: FEATURE_BG,
    sub: [
      { key: 'registro', label: 'Registro', icon: IconAsistencias,
        desc: 'Deja la planilla de papel donde está. El entrenador abre el día, marca presente, ausente, tarde o excusa médica, y el historial de cada deportista queda armado por sede y por fecha.' },
    ],
  },
  {
    key: 'finanzas',
    icon: IconFinanzas,
    label: 'Finanzas',
    color: FEATURE_COLOR,
    bg: FEATURE_BG,
    sub: [
      { key: 'mensualidades', label: 'Mensualidades', icon: IconMensualidades,
        desc: 'Cobrar deja de depender de que alguien se acuerde. Se define la cuota y el día de cada deportista, el recordatorio sale solo por WhatsApp y cada pago genera su recibo y queda guardado con su comprobante.' },
      { key: 'flujo', label: 'Flujo de caja', icon: IconFlujoCaja,
        desc: 'Ingresos y egresos del club, actualizados en tiempo real.' },
    ],
  },
  {
    key: 'rendimiento',
    icon: IconResultados,
    label: 'Rendimiento',
    color: FEATURE_COLOR,
    bg: FEATURE_BG,
    sub: [
      { key: 'competencias', label: 'Competencias', icon: IconCompetencias,
        desc: 'Historial de competencias y resultados por deportista y prueba.' },
      { key: 'entrenamientos', label: 'Entrenamientos', icon: IconEntrenamientos,
        desc: 'Registra sesiones de entrenamiento y el avance de cada atleta.' },
    ],
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

// El año del pie se fija en la zona de Colombia y no en la del reloj de quien
// renderiza. Con new Date().getFullYear() a secas, el servidor va en UTC y el
// navegador en UTC-5, así que durante las cinco horas siguientes a la medianoche
// del 31 de diciembre cada uno escribe un año distinto y React tira un error de
// hidratación. Es el único dato de esta página que dependía del reloj.
const ANIO = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  year: 'numeric',
}).format(new Date());

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Antes aquí se preguntaba por la sesión con useAuth() y se devolvía null
  // mientras Clerk cargaba. Esa pregunta ahora vive en el middleware: la landing
  // se pinta igual para todo el mundo, así que Next.js la puede prerenderizar
  // completa y el navegador encuentra la imagen del hero en el HTML inicial en
  // vez de esperar a que arranque el JavaScript.

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
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

  return (
    <main className="min-h-dvh bg-[#FDFCFC] [overflow-x:clip]">

      {/* Nav — opaca desde el primer pixel. El borde inferior existe siempre
          en transparente y solo se le pinta el color al bajar: si se agregara
          al aparecer, la barra creceria un pixel y la pagina daria un salto. */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 bg-[#FDFCFC] border-b transition-colors duration-200"
        style={{ borderBottomColor: scrolled ? 'rgba(26,16,40,0.08)' : 'transparent' }}
      >
        <div className="relative max-w-[1200px] mx-auto flex items-center justify-between gap-[18px] px-[22px] py-3 sm:py-0 sm:h-[72px]">
          <Link href="/" aria-label="VeloClub" className="flex items-center shrink-0">
            <Image
              src="/logo-vc.png"
              alt="VeloClub"
              width={40}
              height={40}
              priority
              className="object-contain h-9 w-9 sm:h-[38px] sm:w-[38px]"
              style={{ borderRadius: '50%' }}
            />
          </Link>

          {/* Enlaces — centrados en la barra */}
          <div className="hidden sm:flex items-center gap-7 absolute left-1/2 -translate-x-1/2">
            <a href="#funcionalidades" className="text-sm font-medium text-[#8E87A8] hover:text-[#1A1028] transition-colors">
              Funcionalidades
            </a>
            <a href="#por-que" className="text-sm font-medium text-[#8E87A8] hover:text-[#1A1028] transition-colors">
              ¿Por qué VeloClub?
            </a>
          </div>

          {/* Desktop — derecha */}
          <div className="hidden sm:flex items-center gap-3">
            <Link
              href="/sign-in"
              className="inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold text-[#1A1028] border transition-colors hover:bg-[#F7F7FB]"
              style={{ background: '#FDFCFC', borderColor: 'rgba(26,16,40,0.08)' }}
            >
              Iniciar sesión
            </Link>
            <Link
              href="/crear-club"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2 rounded-full transition-all hover:scale-[1.03] active:scale-95"
              style={{ background: '#381DA0' }}
            >
              Crear mi club
            </Link>
          </div>

          {/* Mobile — botón crear club + hamburguesa */}
          <div className="sm:hidden flex items-center gap-2">
            <Link
              href="/crear-club"
              className="inline-flex items-center text-[13px] font-semibold text-white px-3.5 py-2 rounded-full"
              style={{ background: '#381DA0' }}
            >
              Crear mi club
            </Link>
            <button
              className="p-2.5 rounded-xl text-[#1A1028] hover:bg-[rgba(26,16,40,0.06)] transition-colors"
              onClick={() => setMenuOpen(v => !v)}
              aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            >
              {menuOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
            </button>
          </div>
        </div>

      </nav>

      {/* Menú móvil — overlay a pantalla completa */}
      <div
        className={`sm:hidden fixed inset-0 z-[60] bg-[#FDFCFC] flex flex-col transition-opacity duration-300 ${
          menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center justify-between px-[22px] py-4 border-b border-[rgba(120,80,200,0.08)]">
          <Image
            src="/logo-vc.png"
            alt="VeloClub"
            width={36}
            height={36}
            className="object-contain h-8 w-8"
            style={{ borderRadius: '50%' }}
          />
          <button
            className="p-2 rounded-xl text-[#1A1028] hover:bg-[rgba(56,29,160,0.06)] transition-colors"
            onClick={() => setMenuOpen(false)}
            aria-label="Cerrar menú"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          <a
            href="#funcionalidades"
            onClick={() => setMenuOpen(false)}
            className="flex items-center justify-between px-[22px] py-4 border-b border-[rgba(120,80,200,0.06)] text-[15px] font-medium text-[#1A1028]"
          >
            Funcionalidades
            <ChevronRight className="w-4 h-4 text-[#9B95AC]" />
          </a>
          <a
            href="#por-que"
            onClick={() => setMenuOpen(false)}
            className="flex items-center justify-between px-[22px] py-4 border-b border-[rgba(120,80,200,0.06)] text-[15px] font-medium text-[#1A1028]"
          >
            ¿Por qué VeloClub?
            <ChevronRight className="w-4 h-4 text-[#9B95AC]" />
          </a>
        </div>

        <div
          className="px-[22px] pt-3 border-t border-[rgba(120,80,200,0.08)] flex flex-col gap-2.5"
          style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
        >
          <Link
            href="/crear-club"
            onClick={() => setMenuOpen(false)}
            className="w-full text-center text-sm font-semibold text-white px-4 py-3 rounded-full"
            style={{ background: '#381DA0' }}
          >
            Crear mi club
          </Link>
          <Link
            href="/sign-in"
            onClick={() => setMenuOpen(false)}
            className="w-full text-center text-sm font-semibold text-[#1A1028] px-4 py-3 rounded-full border border-[rgba(120,80,200,0.15)]"
          >
            Iniciar sesión
          </Link>
        </div>
      </div>

      {/* Hero glassmorphism */}
      <LandingHero />

      {/* Features — ya en blanco. El amanecer entero pasa dentro del héroe, así
          que de acá para abajo no queda rastro del degradado. */}
      <section id="funcionalidades" className="px-[22px] py-16 max-w-[1200px] mx-auto">
        <LandingFeaturesTabs features={features} />
      </section>

      {/* Clubes que confían en VeloClub */}
      <LandingTrustedBy />

      {/* Benefits */}
      <section id="por-que" className="px-[22px] py-16 max-w-[1200px] mx-auto">
        {/* Gris sobre blanco, al reves que antes: con la pagina en blanco puro
            una tarjeta blanca no se separaria del fondo. */}
        <div className="bg-[#F4F3F8] rounded-3xl border border-[rgba(26,16,40,0.05)] p-7 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#8E87A8] mb-3">¿Por qué VeloClub?</p>
          <h2
            className="text-2xl font-semibold text-[#1A1028] mb-8 tracking-tight"
          >
            Diseñado para clubes reales
          </h2>
          <ul className="space-y-4">
            {benefits.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                {/* Blanco solido: el violeta translucido que habia se perdia
                    dentro del gris de la tarjeta. */}
                <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-3.5 h-3.5 text-[#381DA0]" />
                </div>
                <p className="text-sm text-[#4A4060] leading-relaxed">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA final */}
      <section className="px-[22px] pb-20 max-w-[1200px] mx-auto">
        <div
          className="rounded-3xl p-8 sm:p-12 text-center text-white relative overflow-hidden"
          style={{ background: '#381DA0' }}
        >
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #fff 0%, transparent 50%)' }}
          />
          <h2
            className="text-2xl sm:text-3xl font-semibold mb-3 tracking-tight relative"
          >
            ¿Listo para empezar?
          </h2>
          <p className="text-purple-200 text-sm mb-7 relative">
            Crea tu club y gestiona todo desde hoy. 2 meses gratis registrándote antes
            del 31 de octubre, sin tarjeta y sin compromiso.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 relative">
            <Link
              href="/crear-club"
              className="inline-flex items-center gap-2 px-7 py-3 bg-white text-[#381DA0] font-semibold text-sm rounded-xl shadow-lg transition-all hover:-translate-y-0.5 active:scale-95 w-full sm:w-auto justify-center"
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
        <div className="max-w-[1200px] mx-auto px-[22px]">
        <p>© {ANIO} VeloClub · Todos los derechos reservados</p>
        <p>
          Desarrollado por{' '}
          <a
            href="https://nexcode97.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[#381DA0] hover:text-[#6D28D9] transition-colors"
          >
            NexCode97
          </a>
        </p>
        </div>
      </footer>
    </main>
  );
}
