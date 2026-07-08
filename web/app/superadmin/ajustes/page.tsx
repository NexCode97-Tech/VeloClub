'use client';

import { useAuth, useUser, useClerk } from '@clerk/nextjs';
import { ChevronRight, LogOut, Lock, User, UserCog } from 'lucide-react';

export default function SuperadminAjustesPage() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();

  const avatarSrc    = user?.imageUrl || null;
  const displayName  = user?.fullName || 'Superadmin';
  const displayEmail = user?.emailAddresses?.[0]?.emailAddress || '';

  return (
    <div style={{ background: '#F7F7FB', minHeight: '100%' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '12px 16px 80px' }}>

        <div style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', borderRadius: 20, overflow: 'hidden' }}>
          {/* Encabezado con avatar */}
          <div style={{ padding: '18px 18px 16px', borderBottom: '1px solid rgba(120,80,200,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', overflow: 'hidden', background: 'rgba(124,58,237,0.10)', border: '1px solid rgba(120,80,200,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {avatarSrc
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={avatarSrc} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <User size={26} color="#7C3AED" />
                }
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1A1028', fontFamily: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</p>
                <span style={{ display: 'inline-block', marginTop: 4, fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 99, background: 'rgba(239,71,111,0.10)', color: '#EF476F', letterSpacing: '0.02em' }}>
                  Superadmin
                </span>
              </div>
            </div>
          </div>

          {/* Correo (solo lectura) */}
          <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(120,80,200,0.08)' }}>
            <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: '#8E87A8' }}>Correo electrónico</p>
            <div style={{ position: 'relative' }}>
              <div style={{ padding: '11px 40px 11px 14px', borderRadius: 12, background: 'rgba(120,80,200,0.05)', border: '1px solid rgba(120,80,200,0.10)', fontSize: 13, color: '#8E87A8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {displayEmail}
              </div>
              <Lock size={14} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(142,135,168,0.45)' }} />
            </div>
          </div>

          {/* Gestionar cuenta */}
          <button
            type="button"
            onClick={() => clerk.openUserProfile()}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '15px 18px', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid rgba(120,80,200,0.08)', cursor: 'pointer' }}
          >
            <UserCog size={17} color="#8E87A8" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1A1028', fontFamily: 'inherit' }}>Gestionar cuenta</p>
              <p style={{ margin: 0, fontSize: 11, color: '#8E87A8' }}>Nombre, contraseña y datos de acceso</p>
            </div>
            <ChevronRight size={16} color="#8E87A8" />
          </button>

          {/* Cerrar sesión */}
          <button
            type="button"
            onClick={() => signOut({ redirectUrl: '/sign-in' })}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '15px 18px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <LogOut size={17} color="#EF476F" style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#EF476F', fontFamily: 'inherit' }}>Cerrar sesión</span>
          </button>
        </div>

      </div>
    </div>
  );
}
