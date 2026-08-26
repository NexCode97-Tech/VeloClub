'use client';

import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function SignInPage() {
  // Antes esta pagina devolvia null mientras Clerk cargaba, asi que el
  // prerenderizado quedaba vacio y el visitante veia una pantalla en blanco
  // hasta que arrancara el JavaScript. Ahora la estructura se pinta de una y el
  // widget de Clerk aparece dentro cuando termina de cargar. A quien ya tenga
  // sesion lo manda al panel el propio componente de Clerk, guiado por
  // signInForceRedirectUrl del ClerkProvider.
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 relative">
      <Link
        href="/"
        className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 h-9 rounded-full bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors text-[12px] font-semibold shadow-sm"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Atrás
      </Link>
      <style>{`
        .cl-logo-custom { height: 72px; width: auto; }
        @media (max-width: 767px) { .cl-logo-custom { height: 110px !important; width: auto !important; } }
      `}</style>
      <SignIn
        appearance={{
          variables: { colorPrimary: '#381DA0' },
          elements: {
            card: 'shadow-md rounded-2xl border border-slate-200',
            logoImage: 'cl-logo-custom',
            formFieldInput: { fontSize: '13px' },
          },
        }}
      />
      <p className="text-[11px] text-slate-400">
        Desarrollado por{' '}
        <a
          href="https://nexcode97.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-slate-500 hover:text-slate-700 transition-colors"
        >
          NexCode97
        </a>
      </p>
    </div>
  );
}
