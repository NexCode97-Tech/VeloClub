'use client';

import { SignIn, useAuth } from '@clerk/nextjs';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function SignInPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace('/dashboard');
    }
    if (isLoaded && !isSignedIn) {
      setVisible(true);
    }
  }, [isLoaded, isSignedIn]);

  if (isSignedIn) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-5"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <Image
        src="/logo-full.jpg"
        alt="VeloClub"
        width={140}
        height={42}
        className="object-contain rounded-xl"
      />
      <SignIn
        appearance={{
          elements: {
            footer: 'hidden',
            card: 'shadow-md rounded-2xl border border-slate-200',
            headerTitle: 'hidden',
            headerSubtitle: 'hidden',
            dividerRow: 'hidden',
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
