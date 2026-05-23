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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#fff', borderRadius: '1rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 16px 0 rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <SignIn
          appearance={{
            elements: {
              card: { boxShadow: 'none', border: 'none', borderRadius: 0, paddingBottom: 0 },
              footer: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
              logoImage: { height: '72px', width: 'auto' },
              logoBox: { marginBottom: '4px' },
              formButtonPrimary: { backgroundColor: '#7C3AED', '&:hover': { backgroundColor: '#6D28D9' } },
            },
          }}
        />
        <p style={{ fontSize: '11px', color: '#94a3b8', paddingBottom: '16px', marginTop: '-8px' }}>
          Desarrollado por{' '}
          <a
            href="https://nexcode97.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontWeight: 600, color: '#64748b' }}
          >
            NexCode97
          </a>
        </p>
      </div>
    </div>
  );
}
