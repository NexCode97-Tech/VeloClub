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

  if (!isLoaded || isSignedIn) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-5">
      <Image
        src="/logo-full.jpg"
        alt="VeloClub"
        width={140}
        height={42}
        className="object-contain rounded-xl"
      />
      <div className="sign-in-wrapper">
        <SignIn
          appearance={{
            elements: {
              footer: 'hidden',
              card: 'shadow-md rounded-2xl border border-slate-200',
              headerTitle: 'hidden',
              headerSubtitle: 'hidden',
              dividerRow: 'hidden',
              socialButtonsBlock: 'signin-social-block',
            },
          }}
        />
      </div>
      <style>{`
        .sign-in-wrapper .cl-socialButtonsBlock::before,
        .sign-in-wrapper [class*="socialButtonsBlock"]::before,
        .sign-in-wrapper .signin-social-block::before {
          content: 'Inicia sesión con:';
          display: block;
          text-align: center;
          font-size: 15px;
          font-weight: 700;
          color: #475569;
          margin-bottom: 12px;
          letter-spacing: 0.01em;
        }
      `}</style>
    </div>
  );
}
