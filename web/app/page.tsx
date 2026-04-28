'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.push('/dashboard');
    }
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded || isSignedIn) return null;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 bg-slate-50">
      <h1 className="text-5xl font-bold">VeloClub</h1>
      <p className="text-lg text-slate-600">La plataforma de tu club de patinaje</p>
      <div className="flex gap-3">
        <Link href="/sign-in">
          <Button size="lg">Iniciar sesión</Button>
        </Link>
        <Link href="/sign-up">
          <Button size="lg" variant="outline">Crear cuenta</Button>
        </Link>
      </div>
    </main>
  );
}
