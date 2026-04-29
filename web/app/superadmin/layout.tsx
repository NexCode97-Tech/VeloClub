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
  Menu,
  X,
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  // Cerrar sidebar al cambiar de ruta en móvil
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  if (checking) return <LoadingScreen />;

  const SidebarContent = (
    <>
      {/* Logo + botones */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 md:px-6 md:py-4">
        <Image src="/logo.png" alt="VeloClub" width={80} height={24} className="object-contain" />
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.location.reload()}
            title="Actualizar"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Role badge */}
      <div className="px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-purple-600" />
          <span className="text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
            Super Administrador
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Mi cuenta — siempre visible al fondo */}
      <div className="px-4 py-4 border-t border-slate-200 flex items-center gap-3 shrink-0">
        <UserButton />
        <span className="text-sm text-slate-600 truncate">Mi cuenta</span>
      </div>
    </>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-50">

      {/* Overlay móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 ease-in-out',
        'md:relative md:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {SidebarContent}
      </aside>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header móvil */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Image src="/logo.png" alt="VeloClub" width={70} height={20} className="object-contain" />
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
