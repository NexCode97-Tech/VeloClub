'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight, Menu, X } from 'lucide-react';

const WHATSAPP = 'https://wa.me/573006359008';

// Los enlaces apuntan a la raíz y no al ancla suelta: desde /precios un
// «#funcionalidades» a secas no lleva a ningún lado.
const ENLACES = [
  { href: '/#funcionalidades', label: 'Funcionalidades' },
  { href: '/precios', label: 'Precios' },
  { href: WHATSAPP, label: 'Contáctanos', externo: true },
];

/**
 * La barra de la landing, compartida entre el home y precios.
 *
 * Opaca desde el primer píxel. El borde inferior existe siempre en
 * transparente y solo se le pinta el color al bajar: si se agregara al
 * aparecer, la barra crecería un píxel y la página daría un salto.
 */
export default function LandingNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handler = () => { if (window.innerWidth >= 640) setMenuOpen(false); };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  return (
    <>
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

          {/* Los enlaces se centran contra la barra y no dentro del flujo, así
              quedan en la mitad exacta sin depender de cuánto midan la marca de
              un lado y los botones del otro. */}
          <div className="hidden sm:flex items-center gap-7 absolute left-1/2 -translate-x-1/2">
            {ENLACES.map(e => (
              <a
                key={e.label}
                href={e.href}
                {...(e.externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="text-sm font-medium text-[#8E87A8] hover:text-[#1A1028] transition-colors"
              >
                {e.label}
              </a>
            ))}
          </div>

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
          {ENLACES.map(e => (
            <a
              key={e.label}
              href={e.href}
              {...(e.externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              onClick={() => setMenuOpen(false)}
              className="flex items-center justify-between px-[22px] py-4 border-b border-[rgba(120,80,200,0.06)] text-[15px] font-medium text-[#1A1028]"
            >
              {e.label}
              <ChevronRight className="w-4 h-4 text-[#9B95AC]" />
            </a>
          ))}
        </div>

        {/* El área segura se suma al margen propio; con `max()` el botón queda
            pegado al borde en los teléfonos que sí declaran inset. */}
        <div
          className="px-[22px] pt-3 border-t border-[rgba(120,80,200,0.08)] flex flex-col gap-2.5"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 2rem)' }}
        >
          <Link
            href="/crear-club"
            onClick={() => setMenuOpen(false)}
            className="w-full text-center text-sm font-semibold text-white px-4 py-3 rounded-full"
            style={{ background: '#381DA0' }}
          >
            Crear mi club gratis
          </Link>
          <Link
            href="/sign-in"
            onClick={() => setMenuOpen(false)}
            className="w-full text-center text-sm font-semibold text-[#1A1028] px-4 py-3 rounded-full border"
            style={{ borderColor: 'rgba(26,16,40,0.08)' }}
          >
            Iniciar sesión
          </Link>
        </div>
      </div>
    </>
  );
}
