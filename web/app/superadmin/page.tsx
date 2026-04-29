'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { Building2, CheckCircle, XCircle, Users } from 'lucide-react';

interface Club {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  _count: { members: number };
}

export default function SuperadminDashboard() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { router.push('/sign-in'); return; }
    (async () => {
      try {
        const token = await getToken();
        const res = await apiFetch<{ clubs: Club[] }>('/superadmin/clubs', { token });
        setClubs(res.clubs);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [isLoaded, isSignedIn]);

  const total = clubs.length;
  const activos = clubs.filter(c => c.active).length;
  const inactivos = clubs.filter(c => !c.active).length;
  const totalMiembros = clubs.reduce((sum, c) => sum + c._count.members, 0);

  const stats = [
    { label: 'Total Clubs', value: total, icon: Building2, color: 'bg-purple-50 text-purple-600' },
    { label: 'Clubs Activos', value: activos, icon: CheckCircle, color: 'bg-green-50 text-green-600' },
    { label: 'Clubs Inactivos', value: inactivos, icon: XCircle, color: 'bg-red-50 text-red-600' },
    { label: 'Total Miembros', value: totalMiembros, icon: Users, color: 'bg-blue-50 text-blue-600' },
  ];

  if (loading) return <div className="p-8 text-slate-500">Cargando...</div>;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Resumen general de la plataforma</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-6 flex items-center gap-4 shadow-sm">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{value}</p>
              <p className="text-sm text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent clubs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Clubs recientes</h2>
        </div>
        {clubs.length === 0 ? (
          <div className="p-12 text-center text-slate-400">No hay clubs registrados aún.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {clubs.slice(0, 5).map(club => (
              <div key={club.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">{club.name}</p>
                  <p className="text-sm text-slate-500">{club._count.members} miembros · {new Date(club.createdAt).toLocaleDateString('es')}</p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${club.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {club.active ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
