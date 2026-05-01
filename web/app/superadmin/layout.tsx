'use client';

import { usePathname, useRouter } from 'next/navigation';
import { UserButton, useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import LoadingScreen from '@/components/ui/loading-screen';
import Link from 'next/link';

const TABS = [
  {
    href: '/superadmin',
    label: 'Dashboard',
    exact: true,
    icon: (c: string) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    href: '/superadmin/clubs',
    label: 'Clubs',
    exact: false,
    icon: (c: string) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    href: '/superadmin/finanzas',
    label: 'Finanzas',
    exact: false,
    icon: (c: string) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
  },
  {
    href: '/superadmin/configuracion',
    label: 'Config',
    exact: false,
    icon: (c: string) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
];

const ACCENT = '#7C3AED';

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
    <div
      className="flex flex-col h-dvh overflow-hidden"
      style={{ background: '#F7F7FB', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
    >
      {/* Main content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        {children}
      </main>

      {/* Bottom Tab Nav */}
      <div
        className="shrink-0"
        style={{
          background: '#FFFFFF',
          borderTop: '1.5px solid rgba(120,80,200,0.10)',
          boxShadow: '0 -4px 24px rgba(124,58,237,0.06)',
        }}
      >
        <div className="flex items-center pt-1.5 pb-1">
          {TABS.map((tab) => {
            const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
            const color = active ? ACCENT : '#8E87A8';
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="flex-1 flex flex-col items-center gap-1 py-1 relative"
              >
                {active && (
                  <div
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-11 h-8 rounded-xl"
                    style={{ background: 'rgba(124,58,237,0.08)' }}
                  />
                )}
                <div className="relative z-10">{tab.icon(color)}</div>
                <span
                  className="relative z-10 text-[9.5px] tracking-wide"
                  style={{ color, fontWeight: active ? 700 : 500 }}
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}
          {/* Account button */}
          <div className="flex-1 flex flex-col items-center gap-1 py-1">
            <UserButton />
          </div>
        </div>
        {/* Home indicator */}
        <div className="flex justify-center pb-1.5">
          <div className="w-24 h-1 rounded-full bg-[#8E87A8] opacity-20" />
        </div>
      </div>
    </div>
  );
}
