'use client';

/**
 * MemberAvatar — muestra la foto de perfil si existe, si no las iniciales.
 * Forma: círculo perfecto. Tamaño estándar: 48px.
 */

interface MemberAvatarProps {
  name: string;
  photoUrl?: string | null;
  gradient?: string;
  size?: number;
  className?: string;
  fallbackLabel?: string;
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

const DEFAULT_GRADIENT = 'linear-gradient(135deg,#7C3AED,#A855F7)';

export function MemberAvatar({
  name,
  photoUrl,
  gradient = DEFAULT_GRADIENT,
  size = 48,
  className = '',
  fallbackLabel,
}: MemberAvatarProps) {
  const fontSize = Math.max(11, Math.round(size * 0.33));
  const shared = { width: size, height: size, borderRadius: size / 2, flexShrink: 0 as const };

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className={className}
        style={{ ...shared, objectFit: 'cover', display: 'block' }}
      />
    );
  }

  return (
    <div
      className={className}
      style={{
        ...shared,
        background: gradient,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize,
        fontWeight: 700,
        color: '#fff',
        letterSpacing: '0.02em',
        userSelect: 'none',
      }}
    >
      {fallbackLabel ?? initials(name)}
    </div>
  );
}
