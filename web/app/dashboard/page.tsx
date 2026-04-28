'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { Users, MapPin, CalendarCheck, CreditCard, ShieldCheck } from 'lucide-react';

interface MeResponse {
  status: 'ok' | 'superadmin' | 'complete_profile' | 'no_access' | 'inactive';
  user?: { name: string; role: string; club?: { name: string } };
}

const roleLabels: Record<string, string> = {
  SUPERADMIN: 'Super Administrador',
  ADMIN: 'Administrador',
  COACH: 'Entrenador',
  STUDENT: 'Deportista',
};

const roleColors: Record<string, string> = {
  SUPERADMIN: 'bg-purple-100 text-purple-700',
  ADMIN: 'bg-blue-100 text-blue-700',
  COACH: 'bg-green-100 text-green-700',
  STUDENT: 'bg-slate-100 text-slate-600',
};

export default function DashboardPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { router.push('/sign-in'); return; }
    (async () => {
      try {
        const token = await getToken();
        const res = await apiFetch<MeResponse>('/me', { token });
        if (res.status === 'superadmin') { router.push('/superadmin'); return; }
        if (res.status === 'no_access') { router.push('/no-access'); return; }
        if (res.status === 'inactive') { router.push('/inactivo'); return; }
        if (res.status === 'complete_profile') { router.push('/completar-perfil'); return; }
        setMe(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [isLoaded, isSignedIn, getToken, router]);

  if (loading) return <div className="p-8 text-slate-500">Cargando...</div>;

  const user = me?.user;
  const role = user?.role ?? '';

  const cards = [
    { label: 'Miembros', icon: Users, href: '/dashboard/miembros', color: 'bg-blue-50 text-blue-600' },
    { label: 'Sedes', icon: MapPin, href: '/dashboard/sedes', color: 'bg-green-50 text-green-600' },
    { label: 'Asistencia', icon: CalendarCheck, href: '/dashboard/asistencia', color: 'bg-purple-50 text-purple-600' },
    { label: 'Pagos', icon: CreditCard, href: '/dashboard/pagos', color: 'bg-orange-50 text-orange-600' },
  ];

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Bienvenido, {user?.name}</h2>
          {user?.club?.name && (
            <p className="text-slate-500 mt-1">Club: {user.club.name}</p>
          )}
          {role && (
            <span className={`inline-block mt-2 text-xs font-semibold px-3 py-1 rounded-full ${roleColors[role] ?? 'bg-slate-100 text-slate-600'}`}>
              {roleLabels[role] ?? role}
            </span>
          )}
        </div>
        {role === 'SUPERADMIN' && (
          <button
            onClick={() => router.push('/superadmin')}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <ShieldCheck className="w-4 h-4" />
            Panel Superadmin
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, icon: Icon, href, color }) => (
          <a key={href} href={href} className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow flex flex-col gap-3">
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
