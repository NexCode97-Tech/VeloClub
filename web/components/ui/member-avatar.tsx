'use client';

/**
 * MemberAvatar — muestra la foto de perfil si existe, si no las iniciales.
 * Funciona para miembros (pictureUrl) y usuarios staff (picture de Clerk/Google).
 */

interface MemberAvatarProps {
  name: string;
  photoUrl?: string | null;
  /** Gradiente CSS para el fondo de las iniciales */
  gradient?: string;
  /** Tamaño en píxeles — default 36 */
  size?: number;
  /** Clases adicionales */
  className?: string;
  /** Texto extra pequeño dentro del círculo (reemplaza iniciales si no hay foto) */
  fallbackLabel?: string;
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
}

const DEFAULT_GRADIENT = 'linear-gradient(135deg,#7C3AED,#A855F7)';

export function MemberAvatar({
  name,
  photoUrl,
  gradient = DEFAULT_GRADIENT,
  size = 36,
  className = '',
  fallbackLabel,
}: MemberAvatarProps) {
  const fontSize = Math.max(10, Math.round(size * 0.33));

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        width={size}
        height={size}
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
          display: 'block',
        }}
      />
    );
  }

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: gradient,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
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
