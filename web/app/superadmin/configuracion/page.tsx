'use client';

import { UserButton } from '@clerk/nextjs';

function SAHeader({ title }: { title: string }) {
  return (
    <div
      className="flex items-center gap-2 shrink-0"
      style={{ padding: '12px 16px 10px', background: '#F7F7FB', borderBottom: '1px solid rgba(120,80,200,0.10)' }}
    >
      <h2 className="flex-1 text-[17px] font-bold m-0" style={{ fontFamily: 'Space Grotesk, sans-serif', color: '#1A1028' }}>
        {title}
      </h2>
    </div>
  );
}

const INFO_ITEMS = [
  { label: 'Versión',        value: 'v1.0.0' },
  { label: 'Entorno',        value: 'Producción' },
  { label: 'Base de datos',  value: 'PostgreSQL · Render' },
  { label: 'Autenticación',  value: 'Clerk' },
  { label: 'Frontend',       value: 'Next.js · Vercel' },
];

export default function ConfiguracionPage() {
  return (
    <div style={{ background: '#F7F7FB', minHeight: '100%' }}>
      <SAHeader title="Configuración" />

      <div style={{ padding: '16px 16px 80px' }}>
        {/* Mi cuenta */}
        <p className="text-[11px] font-semibold uppercase mb-2 m-0" style={{ color: '#8E87A8', letterSpacing: '0.8px' }}>
          Mi cuenta
        </p>
        <div
          className="rounded-2xl flex items-center gap-3 mb-3.5"
          style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', padding: 14 }}
        >
          <div
            className="w-[46px] h-[46px] rounded-full flex items-center justify-center text-[16px] font-extrabold text-white shrink-0"
            style={{ background: 'linear-gradient(135deg,#7C3AED,#A855F7)' }}
          >
            SA
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold m-0" style={{ color: '#1A1028' }}>Super Admin</p>
            <p className="text-[11px] m-0 mt-0.5" style={{ color: '#8E87A8' }}>superadmin@veloclub.app</p>
            <span
              className="inline-block mt-1 text-[9px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(124,58,237,0.12)', color: '#7C3AED' }}
            >
              SUPER ADMIN
            </span>
          </div>
          <UserButton />
        </div>

        {/* Sistema */}
        <p className="text-[11px] font-semibold uppercase mb-2 m-0" style={{ color: '#8E87A8', letterSpacing: '0.8px' }}>
          Sistema
        </p>
        {INFO_ITEMS.map(item => (
          <div
            key={item.label}
            className="rounded-xl flex items-center justify-between mb-2"
            style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', padding: '11px 14px' }}
          >
            <span className="text-[13px]" style={{ color: '#8E87A8' }}>{item.label}</span>
            <span className="text-[12px] font-semibold" style={{ color: '#1A1028' }}>{item.value}</span>
          </div>
        ))}

        <div
          className="rounded-xl text-center mt-3"
          style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.20)', padding: 14 }}
        >
          <p className="text-[12px] font-semibold m-0" style={{ color: '#7C3AED' }}>VeloClub · Panel SuperAdmin</p>
          <p className="text-[11px] m-0 mt-1" style={{ color: '#8E87A8' }}>Acceso restringido · Solo personal autorizado</p>
        </div>
      </div>
    </div>
  );
}
