'use client';

import { useAuth, UserButton } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

interface MeResponse {
  user: { name: string; club: { name: string } } | null;
  needsOnboarding: boolean;
}

export default function DashboardPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<MeResponse['user']>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }
    (async () => {
      try {
        const token = await getToken();
        const me = await apiFetch<MeResponse>('/me', { token });
        if (me.needsOnboarding) {
          router.push('/onboarding');
        } else {
          setData(me.user);
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    })();
  }, [isLoaded, isSignedIn, getToken, router]);

  if (loading) return <p className="p-8">Cargando...</p>;

  return (
    <div className="min-h-screen p-8 bg-slate-50">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-slate-600">
            Bienvenido, {data?.name} — Club: {data?.club.name}
          </p>
        </div>
        <UserButton />
      </div>
      <div className="bg-white rounded-lg p-6 shadow">
        <p>Aquí va el contenido del dashboard (próximos planes).</p>
      </div>
    </div>
  );
}
