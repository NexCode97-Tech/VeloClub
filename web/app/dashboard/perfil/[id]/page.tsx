'use client';

import { useAuth, useSession } from '@clerk/nextjs';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { apiFetch } from '@/lib/api-client';
import { MemberAvatar } from '@/components/ui/member-avatar';
import { MapPin, CalendarDays, Users, ImagePlus, UserPlus, UserCheck } from 'lucide-react';

const roleLabels: Record<string, string> = {
  SUPERADMIN: 'Super Admin', ADMIN: 'Administrador',
  COACH: 'Entrenador',      STUDENT: 'Deportista',
};
const roleColors: Record<string, { text: string; bg: string }> = {
  SUPERADMIN: { text: '#EF476F', bg: 'rgba(239,71,111,0.12)' },
  ADMIN:      { text: '#FFB703', bg: 'rgba(255,183,3,0.12)' },
  COACH:      { text: '#06D6A0', bg: 'rgba(6,214,160,0.12)' },
  STUDENT:    { text: '#7C3AED', bg: 'rgba(124,58,237,0.10)' },
};
const ROLE_GRADIENT: Record<string, string> = {
  SUPERADMIN: 'linear-gradient(135deg,#EF476F,#C1121F)',
  ADMIN:      'linear-gradient(135deg,#FFB703,#FB8500)',
  COACH:      'linear-gradient(135deg,#06D6A0,#0CB68D)',
  STUDENT:    'linear-gradient(135deg,#7C3AED,#A855F7)',
};

function formatJoinDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
}

interface PublicProfile {
  clerkId: string;
  name: string;
  picture?: string | null;
  coverUrl?: string | null;
  bio?: string | null;
  role: string;
  createdAt: string;
  club?: { id: string; name: string; city?: string; department?: string; logoUrl?: string; verified?: boolean };
  postImages: { id: string; imageUrl: string }[];
  followersCount: number;
  followingCount: number;
}

export default function PublicProfilePage() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { session } = useSession();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const targetClerkId = params.id;

  const [profile, setProfile]     = useState<PublicProfile | null>(null);
  const [loading, setLoading]     = useState(true);
  const [following, setFollowing] = useState(false);
  const [toggling, setToggling]   = useState(false);
  const isOwnProfile              = userId === targetClerkId;

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { router.push('/sign-in'); return; }
    (async () => {
      try {
        const token = await session?.getToken();
        const [profileRes, statsRes] = await Promise.allSettled([
          apiFetch<{ profile: PublicProfile }>(`/profiles/${targetClerkId}`, { token }),
          apiFetch<{ followersCount: number; followingCount: number; isFollowing: boolean }>(
            `/follows/stats/${targetClerkId}`, { token }
          ),
        ]);
        if (profileRes.status === 'fulfilled') {
          const p = profileRes.value.profile;
          if (statsRes.status === 'fulfilled') {
            p.followersCount = statsRes.value.followersCount;
            p.followingCount = statsRes.value.followingCount;
            setFollowing(statsRes.value.isFollowing);
          }
          setProfile(p);
        }
      } catch { /* silencioso */ }
      finally { setLoading(false); }
    })();
  }, [isLoaded, isSignedIn, userId, targetClerkId, session, router]);

  async function handleFollow() {
    if (!profile || toggling) return;
    setToggling(true);
    try {
      const token = await session?.getToken();
      const res = await apiFetch<{ following: boolean }>(
        `/follows/toggle/${targetClerkId}`, { token, method: 'POST' }
      );
      setFollowing(res.following);
      setProfile(p => p ? {
        ...p,
        followersCount: p.followersCount + (res.following ? 1 : -1),
      } : p);
    } catch { /* silencioso */ }
    finally { setToggling(false); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: '#7C3AED', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2">
        <p className="text-[14px] font-semibold text-muted-foreground">Perfil no encontrado</p>
        <button onClick={() => router.back()}
          className="text-[13px] text-purple-600 font-medium hover:underline cursor-pointer">
          Volver
        </button>
      </div>
    );
  }

  const role = profile.role;
  const rc   = roleColors[role] ?? roleColors.STUDENT;

  return (
    <div className="min-h-full bg-background">
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        className="bg-white border-b border-border"
        style={{ boxShadow: '0 1px 12px rgba(0,0,0,0.06)' }}
      >
        {/* Banner */}
        <div className="relative h-36 sm:h-48"
          style={{ background: profile.coverUrl ? undefined : 'linear-gradient(135deg, #7C3AED 0%, #4361EE 60%, #06D6A0 100%)' }}>
          {profile.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.coverUrl} alt="Portada" className="absolute inset-0 w-full h-full object-cover" />
          )}
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.22) 100%)' }} />
        </div>

        {/* Info */}
        <div className="px-5 pb-5 max-w-4xl mx-auto w-full">
          {/* Avatar + botón Follow */}
          <div className="flex items-end justify-between" style={{ marginTop: -60 }}>
            {/* Foto con badge del club */}
            <div className="relative z-10">
              <div className="rounded-full border-4 border-white overflow-hidden sm:w-[140px] sm:h-[140px]"
                style={{ boxShadow: '0 4px 16px rgba(124,58,237,0.20)', width: 120, height: 120 }}>
                <MemberAvatar
                  name={profile.name}
                  photoUrl={profile.picture}
                  gradient={ROLE_GRADIENT[role] ?? ROLE_GRADIENT.STUDENT}
                  size={120}
                />
              </div>
              {profile.club?.logoUrl && (
                <div className="absolute bottom-0.5 right-0.5 rounded-full border-2 border-white overflow-hidden"
                  style={{ width: 32, height: 32, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={profile.club.logoUrl} alt={profile.club.name} className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            {/* Botón Follow — solo si no es el propio perfil */}
            {!isOwnProfile && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleFollow}
                disabled={toggling}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold transition-all cursor-pointer disabled:opacity-60"
                style={following
                  ? { background: 'rgba(124,58,237,0.10)', color: '#7C3AED', border: '1.5px solid rgba(124,58,237,0.25)' }
                  : { background: 'linear-gradient(135deg,#7C3AED,#4361EE)', color: '#fff', border: 'none' }
                }
              >
                {following
                  ? <><UserCheck className="w-4 h-4" /> Siguiendo</>
                  : <><UserPlus className="w-4 h-4" /> Seguir</>
                }
              </motion.button>
            )}
          </div>

          {/* Nombre + badge de rol en la misma línea */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <h1 className="text-[22px] font-bold text-foreground leading-tight">
              {profile.name}
            </h1>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full tracking-widest"
              style={{ background: rc.bg, color: rc.text }}>
              {roleLabels[role] ?? role}
            </span>
          </div>

          {/* Bio — solo lectura */}
          {profile.bio && (
            <div className="mt-2 max-w-lg">
              <p className="text-[13px] text-foreground/75 leading-relaxed">{profile.bio}</p>
            </div>
          )}

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3">
            {profile.club?.name && (
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 shrink-0" style={{ color: '#8E87A8' }} />
                <span className="text-[12px] text-muted-foreground">{profile.club.name}</span>
                {profile.club.verified && (
                  <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{ background: '#4361EE' }}>
                    <svg viewBox="0 0 24 24" fill="none" className="w-2 h-2">
                      <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </div>
            )}
            {(profile.club?.city || profile.club?.department) && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: '#8E87A8' }} />
                <span className="text-[12px] text-muted-foreground">
                  {[profile.club?.city, profile.club?.department].filter(Boolean).join(', ')}
                </span>
              </div>
            )}
            {profile.createdAt && (
              <div className="flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 shrink-0" style={{ color: '#8E87A8' }} />
                <span className="text-[12px] text-muted-foreground">
                  Miembro desde {formatJoinDate(profile.createdAt)}
                </span>
              </div>
            )}
          </div>

          {/* Stats: Publicaciones · Seguidores · Siguiendo */}
          <div className="flex items-center gap-6 mt-4">
            <div className="text-center">
              <p className="text-[18px] font-bold text-foreground leading-none">{profile.postImages.length}</p>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#8E87A8', marginTop: 2 }}>Publicaciones</p>
            </div>
            <div className="text-center">
              <p className="text-[18px] font-bold text-foreground leading-none">{profile.followersCount}</p>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#8E87A8', marginTop: 2 }}>Seguidores</p>
            </div>
            <div className="text-center">
              <p className="text-[18px] font-bold text-foreground leading-none">{profile.followingCount}</p>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#8E87A8', marginTop: 2 }}>Siguiendo</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Galería de fotos */}
      <div className="px-4 sm:px-6 py-4 max-w-4xl mx-auto">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Fotos</p>
        {profile.postImages.length === 0 ? (
          <div className="rounded-2xl px-6 py-8 flex flex-col items-center text-center"
            style={{ background: 'rgba(124,58,237,0.03)', border: '1px solid rgba(124,58,237,0.08)' }}>
            <ImagePlus className="w-8 h-8 mb-2" style={{ color: '#8E87A8' }} />
            <p className="text-[13px] text-muted-foreground">Sin fotos publicadas</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {profile.postImages.slice(0, 5).map((img, idx) => {
              const isLast    = idx === 4 && profile.postImages.length > 5;
              const remaining = profile.postImages.length - 5;
              return (
                <div key={img.id}
                  className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group"
                  style={{ background: '#f0f0f0' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.imageUrl} alt="Foto"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  {isLast && (
                    <div className="absolute inset-0 flex items-center justify-center"
                      style={{ background: 'rgba(0,0,0,0.52)' }}>
                      <span className="text-white font-bold text-[22px]">+{remaining}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
