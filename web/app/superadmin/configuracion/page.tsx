'use client';

import { UserProfile, useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

export default function ConfiguracionPage() {
  const { signOut } = useClerk();
  const router = useRouter();

  return (
    <div style={{ background: '#F7F7FB', minHeight: '100%', padding: '16px 16px 80px' }}>

      {/* Mi cuenta — UserProfile embebido */}
      <p className="text-[11px] font-semibold uppercase mb-3 m-0" style={{ color: '#8E87A8', letterSpacing: '0.8px' }}>
        Mi cuenta
      </p>
      <div className="rounded-2xl overflow-hidden mb-4" style={{ border: '1px solid rgba(120,80,200,0.10)' }}>
        <UserProfile
          appearance={{
            elements: {
              rootBox:       { width: '100%' },
              card:          { boxShadow: 'none', borderRadius: 0, width: '100%' },
              navbar:        { display: 'none' },
              pageScrollBox: { padding: '12px' },
            },
          }}
        />
      </div>

      {/* Sistema */}
      <p className="text-[11px] font-semibold uppercase mb-2 m-0" style={{ color: '#8E87A8', letterSpacing: '0.8px' }}>
        Sistema
      </p>
      {[
        { label: 'Versión',       value: 'v1.0.0' },
        { label: 'Autenticación', value: 'Clerk'  },
      ].map(item => (
        <div key={item.label} className="rounded-xl flex items-center justify-between mb-2"
          style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', padding: '11px 14px' }}>
          <span className="text-[13px]" style={{ color: '#8E87A8' }}>{item.label}</span>
          <span className="text-[12px] font-semibold" style={{ color: '#1A1028' }}>{item.value}</span>
        </div>
      ))}

      {/* Cerrar sesión */}
      <button
        onClick={() => signOut(() => router.push('/sign-in'))}
        className="w-full mt-3 py-3 rounded-xl text-[13px] font-bold"
        style={{ background: 'rgba(239,71,111,0.08)', border: '1px solid rgba(239,71,111,0.25)', color: '#EF476F', cursor: 'pointer' }}
      >
        Cerrar sesión
      </button>
    </div>
  );
}
