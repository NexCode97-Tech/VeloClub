'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import { CheckCircle2, Users, CalendarCheck, CreditCard, Trophy } from 'lucide-react';

const features = [
  { icon: Users, label: 'Gestión de miembros', desc: 'Administra alumnos, entrenadores y perfiles completos.' },
  { icon: CalendarCheck, label: 'Asistencia', desc: 'Registra presente, ausente, tarde o excusa médica.' },
  { icon: CreditCard, label: 'Pagos y flujo de caja', desc: 'Mensualidades, ingresos, egresos y saldo en tiempo real.' },
  { icon: Trophy, label: 'Logros y competencias', desc: 'Historial de resultados por deportista y prueba.' },
];

export default function HomePage() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && isSignedIn) router.push('/dashboard');
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded || isSignedIn) return null;

  return (
    <main className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="flex items-center px-8 py-4 border-b border-slate-100">
        <Image src="/logo.png" alt="VeloClub" width={140} height={40} className="object-contain" />
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center text-center px-6 py-24 max-w-3xl mx-auto">
        <span className="text-xs font-semibold uppercase tracking-widest text-blue-600 bg-blue-50 px-3 py-1 rounded-full mb-6">
          Plataforma para clubes de patinaje
        </span>
        <h1 className="text-5xl font-extrabold text-slate-900 leading-tight mb-6">
          Gestiona tu club<br />desde un solo lugar
        </h1>
        <p className="text-lg text-slate-500 mb-10 max-w-xl">
          VeloClub es la herramienta todo en uno para clubes de patinaje. Miembros, asistencia, pagos, logros y calendario, sin complicaciones.
        </p>
        <Link href="/sign-in">
          <Button size="lg" className="px-10">Iniciar sesión</Button>
        </Link>
      </section>

      {/* Features */}
      <section className="bg-slate-50 px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-12">Todo lo que necesitas</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {features.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="bg-white rounded-xl p-6 border border-slate-200 flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 mb-1">{label}</p>
                  <p className="text-sm text-slate-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="px-6 py-20 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-slate-900 text-center mb-10">¿Por qué VeloClub?</h2>
        <ul className="space-y-4">
          {[
            'Multi-sede: gestiona varios lugares de entrenamiento desde una sola cuenta.',
            'Roles diferenciados: admin, entrenador y alumno con acceso personalizado.',
            'Acceso controlado: tú decides quién entra a tu club.',
            'Historial completo: asistencia, pagos y logros de cada deportista.',
            'Disponible desde cualquier dispositivo con conexión a internet.',
          ].map(item => (
            <li key={item} className="flex items-start gap-3 text-slate-600">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 px-8 py-6 text-center text-sm text-slate-400">
        © {new Date().getFullYear()} VeloClub · Todos los derechos reservados
      </footer>
    </main>
  );
}
