'use client';

import { SignIn, useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function SignInPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace('/dashboard');
  }, [isLoaded, isSignedIn]);

  if (!isLoaded || isSignedIn) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center bg-white shadow-md rounded-2xl border border-slate-200 overflow-hidden">
        <SignIn
          appearance={{
            elements: {
              card: 'shadow-none border-0 rounded-none',
              logoImage: 'h-20 w-auto',
              logoBox: 'mb-1',
            },
          }}
        />
        <p className="text-[11px] text-slate-400 pb-4 -mt-2">
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
    </div>
  );
}
