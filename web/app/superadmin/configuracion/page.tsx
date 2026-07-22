'use client';

import { useClerk, useUser } from '@clerk/nextjs';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { stagger, cardVariant } from '@/lib/page-animations';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Lock, UserCog, ChevronRight, LogOut } from 'lucide-react';

export default function ConfiguracionPage() {
  const clerk = useClerk();
  const { user } = useUser();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  // Mismo criterio que el sidebar: foto de Google (CDN liviana) o inicial.
  // No se usa la imagen proxy de Clerk (img.clerk.com) por su costo de render.
  const googlePhoto = user?.externalAccounts?.find(a => a.provider === 'google')?.imageUrl;
  const avatarSrc = googlePhoto || null;
  const displayName = user?.fullName || 'Superadmin';
  const displayEmail = user?.emailAddresses?.[0]?.emailAddress || '';

  async function handleSignOut() {
    setSigningOut(true);
    await clerk.signOut();
    window.location.href = '/sign-in';
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" style={{ background: '#F7F7FB', minHeight: '100%', padding: '16px 16px 80px' }}>

      {/* Mi cuenta — misma tarjeta de perfil que el administrador */}
      <motion.div variants={cardVariant}>
      <p className="text-[11px] font-semibold uppercase mb-3 m-0" style={{ color: '#8E87A8', letterSpacing: '0.8px' }}>
        Mi cuenta
      </p>
      <div className="bg-white border border-border rounded-2xl overflow-hidden mb-4">
        {/* Encabezado con avatar */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-secondary border border-border shrink-0 flex items-center justify-center">
              {avatarSrc
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={avatarSrc} alt={displayName} className="w-full h-full object-cover" />
                : <User className="w-7 h-7 text-muted-foreground/40" />
              }
            </div>
            <div className="min-w-0">
              <p className="text-[16px] font-semibold text-foreground truncate">{displayName}</p>
              <span
                className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide mt-1"
                style={{ background: 'rgba(239,71,111,0.10)', color: '#EF476F' }}
              >
                Superadmin
              </span>
            </div>
          </div>
        </div>

        {/* Campos */}
        <div className="px-5 py-4 space-y-3 border-b border-border">
          <div className="space-y-1.5">
            <Label className="text-[12px]">Nombre de usuario</Label>
            <Input
              value={displayName} readOnly
              className="text-muted-foreground bg-muted/30 cursor-not-allowed text-sm h-12"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px]">Correo electrónico</Label>
            <div className="relative">
              <Input
                value={displayEmail} readOnly
                className="text-muted-foreground bg-muted/30 cursor-not-allowed pr-10 text-sm h-12"
              />
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
            </div>
          </div>
        </div>

        {/* Gestionar cuenta */}
        <button
          type="button"
          onClick={() => clerk.openUserProfile()}
          className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-secondary/40 active:bg-secondary/60 transition-colors border-b border-border"
        >
          <UserCog className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-foreground">Gestionar cuenta</p>
            <p className="text-[11px] text-muted-foreground">Nombre, contraseña y datos de acceso</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* Cerrar sesión */}
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-red-50 active:bg-red-100 transition-colors disabled:opacity-60"
        >
          <LogOut className="w-4 h-4 shrink-0" style={{ color: '#EF476F' }} />
          <span className="flex-1 text-[13px] font-semibold" style={{ color: '#EF476F' }}>
            {signingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
          </span>
        </button>
      </div>
      </motion.div>

      {/* Sistema */}
      <motion.div variants={cardVariant}>
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
      </motion.div>
    </motion.div>
  );
}
