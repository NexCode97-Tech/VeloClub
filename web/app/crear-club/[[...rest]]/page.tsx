'use client';

import { SignUp, useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Trophy, Zap, ShieldCheck } from 'lucide-react';

// Flujo dedicado y con marca propia para el registro self-serve ("Crear mi
// club"), separado de /sign-up (genérico) y /sign-in (usuarios existentes).
// Usa el mismo <SignUp> de Clerk pero con contexto y copy propios, para que
// quede claro que esto es "voy a montar mi club", no un login cualquiera.
export default function CrearClubPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace('/dashboard');
  }, [isLoaded, isSignedIn]);

  if (!isLoaded || isSignedIn) return null;

  return (
    <div className="min-h-screen bg-[#0D0520] flex flex-col lg:flex-row relative overflow-hidden">
      {/* Fondo decorativo */}
      <div className="pointer-events-none absolute inset-0 opacity-40"
        style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(124,58,237,0.35) 0%, transparent 55%), radial-gradient(circle at 80% 80%, rgba(67,97,238,0.30) 0%, transparent 55%)' }}
      />

      <Link
        href="/"
        className="absolute top-4 left-4 z-20 inline-flex items-center gap-1.5 px-3 h-9 rounded-full bg-white/10 border border-white/15 text-white/80 hover:text-white hover:bg-white/15 transition-colors text-[12px] font-semibold backdrop-blur-sm"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Atrás
      </Link>

      {/* Columna izquierda — contexto de marca (solo desktop) */}
      <div className="hidden lg:flex flex-col justify-center flex-1 px-16 relative z-10">
        <Image src="/logo.png" alt="VeloClub" width={44} height={44} className="object-contain mb-8" style={{ borderRadius: 10 }} />
        <h1 className="text-[34px] font-semibold text-white leading-tight mb-3" style={{ fontFamily: 'inherit' }}>
          Crea tu club<br />en un minuto.
        </h1>
        <p className="text-white/60 text-[15px] max-w-md mb-8">
          Gestiona miembros, asistencia, pagos y competencias desde un solo lugar. Empieza gratis 15 días.
        </p>
        <div className="space-y-3.5">
          {[
            { icon: Zap, text: 'Listo para usar en minutos, sin instalaciones' },
            { icon: Trophy, text: 'Miembros, asistencia, pagos y competencias' },
            { icon: ShieldCheck, text: '15 días gratis, sin tarjeta requerida' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(124,58,237,0.20)' }}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <p className="text-white/80 text-[13.5px]">{text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Columna derecha — formulario de Clerk */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-5 py-14 relative z-10">
        {/* Encabezado móvil */}
        <div className="lg:hidden flex flex-col items-center text-center mb-2">
          <Image src="/logo.png" alt="VeloClub" width={40} height={40} className="object-contain mb-3" style={{ borderRadius: 9 }} />
          <h1 className="text-[20px] font-semibold text-white mb-1">Crea tu club</h1>
          <p className="text-white/60 text-[13px] max-w-xs">15 días gratis. Listo en un minuto.</p>
        </div>

        <style>{`
          .cl-logo-custom { height: 60px; width: auto; }
        `}</style>
        <SignUp
          path="/crear-club"
          signInUrl="/sign-in"
          forceRedirectUrl="/dashboard"
          appearance={{
            variables: { colorPrimary: '#7C3AED' },
            elements: {
              card: 'shadow-2xl rounded-2xl border border-white/10',
              logoImage: 'cl-logo-custom',
              formFieldInput: { fontSize: '13px' },
            },
          }}
        />
        <p className="text-[11px] text-white/40">
          Desarrollado por{' '}
          <a
            href="https://nexcode97.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-white/60 hover:text-white/80 transition-colors"
          >
            NexCode97
          </a>
        </p>
      </div>
    </div>
  );
}
