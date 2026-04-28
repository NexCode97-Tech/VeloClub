'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { Users, MapPin, CalendarCheck, CreditCard } from 'lucide-react';

interface MeResponse {
  user: { name: string; role: string; club: { name: string } } | null;
  needsOnboarding: boolean;
}

export default function DashboardPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<MeResponse['user']>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { router.push('/sign-in'); return; }
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

  if (loading) return <div className="p-8 text-slate-500">Cargando...</div>;

  const cards = [
    { label: 'Miembros', icon: Users, href: '/dashboard/miembros', color: 'bg-blue-50 text-blue-600' },
    { label: 'Sedes', icon: MapPin, href: '/dashboard/sedes', color: 'bg-green-50 text-green-600' },
    { label: 'Asistencia', icon: CalendarCheck, href: '/dashboard/asistencia', color: 'bg-purple-50 text-purple-600' },
    { label: 'Pagos', icon: CreditCard, href: '/dashboard/pagos', color: 'bg-orange-50 text-orange-600' },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Bienvenido, {data?.name}</h2>
        <p className="text-slate-500 mt-1">Club: {data?.club.name}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, icon: Icon, href, color }) => (
          <a
            key={href}
            href={href}
            className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow flex flex-col gap-3"
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <span className="font-medium text-slate-700">{label}</span>
          </a>
        ))}
      </div>

      <div className="mt-8 bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <p className="text-slate-500 text-sm">Próximamente: asistencia del día, pagos pendientes y saldo del club.</p>
      </div>
    </div>
  );
}
