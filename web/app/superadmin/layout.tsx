'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { UserButton, useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import LoadingScreen from '@/components/ui/loading-screen';
import {
  LayoutDashboard,
  Building2,
  Settings,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/superadmin',               label: 'Dashboard',     icon: LayoutDashboard, exact: true  },
  { href: '/superadmin/clubs',         label: 'Clubs',         icon: Building2,       exact: false },
  { href: '/superadmin/configuracion', label: 'Configuración', icon: Settings,        exact: false },
];

export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { router.push('/sign-in'); return; }
    (async () => {
      try {
        const token = await getToken();
        const res = await apiFetch<{ status: string }>('/me', { token });
        if (res.status !== 'superadmin') { router.replace('/dashboard'); return; }
        setChecking(false);
      } catch {
        router.replace('/sign-in');
      }
    })();
  }, [isLoaded, isSignedIn]);

  if (checking) return <LoadingScreen />;

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-50">

      {/* Sidebar — iconos en móvil, iconos+texto en desktop */}
      <aside className="w-14 md:w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 transition-all duration-200">

        {/* Logo + refresh */}
        <div className="flex items-center justify-center md:justify-between px-0 md:px-5 py-4 border-b border-slate-200 min-h-[60px]">
          <Image
            src="/logo.png"
            alt="VeloClub"
            width={80}
            height={24}
            className="object-contain hidden md:block"
          />
          <Image
            src="/favicon.png"
            alt="VeloClub"
            width={28}
            height={28}
            className="object-contain md:hidden rounded-md"
          />
          <button
            onClick={() => window.location.reload()}
            title="Actualizar"
            className="hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Role badge — solo en desktop */}
        <div className="hidden md:flex px-4 py-3 border-b border-slate-100 items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-purple-600" />
          <span className="text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
            Super Administrador
          </span>
        </div>

        {/* Badge ícono — solo en móvil */}
        <div className="md:hidden flex justify-center py-2 border-b border-slate-100">
          <ShieldCheck className="w-4 h-4 text-purple-600" />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                title={label}
                className={cn(
                  'flex items-center justify-center md:justify-start gap-3 px-0 md:px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                )}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="hidden md:block">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Mi cuenta */}
        <div className="flex items-center justify-center md:justify-start gap-3 px-0 md:px-4 py-4 border-t border-slate-200 shrink-0">
          <UserButton />
          <span className="hidden md:block text-sm text-slate-600 truncate">Mi cuenta</span>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
