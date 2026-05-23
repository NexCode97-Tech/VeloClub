'use client';

import { SignIn, useAuth } from '@clerk/nextjs';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function SignInPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace('/dashboard');
    }
  }, [isLoaded, isSignedIn]);

  if (!isLoaded) return <div className="min-h-screen bg-slate-50" />;
  if (isSignedIn) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-5">
      <Image
        src="/logo-full.jpg"
        alt="VeloClub"
        width={140}
        height={42}
        className="object-contain rounded-xl"
      />
      <div className="relative">
        <SignIn
          appearance={{
            elements: {
              footer: 'hidden',
              card: 'shadow-md rounded-2xl border border-slate-200 pt-8',
              headerTitle: 'hidden',
              headerSubtitle: 'hidden',
              dividerRow: 'hidden',
            },
          }}
        />
        <p className="absolute top-4 left-0 right-0 text-center text-[14px] font-semibold text-slate-500 pointer-events-none">
          Inicia sesión con:
        </p>
      </div>
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
