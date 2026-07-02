'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { apiFetch } from '@/lib/api-client';
import { ArrowLeft, BadgeCheck, MapPin, Users } from 'lucide-react';

interface PublicClub {
  id: string; name: string; city?: string | null; department?: string | null;
  deporte?: string | null; logoUrl?: string | null; coverUrl?: string | null;
  verified?: boolean; description?: string | null;
  _count: { members: number };
}
interface ClubMember {
  id: string; fullName: string; pictureUrl?: string | null; role: string; clerkId: string | null;
}
interface MainLocation { id: string; name: string; address?: string | null; }
interface Payload {
  club: PublicClub; members: ClubMember[]; followersCount: number; mainLocation: MainLocation | null;
}

const ROLE_LABEL: Record<string, string> = { ADMIN: 'Admin', COACH: 'Entrenador', STUDENT: 'Deportista' };

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

export default function PublicClubPage() {
  const params = useParams();
  const router = useRouter();
  const { getToken } = useAuth();
  const id = String(params.id);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const res = await apiFetch<Payload>(`/clubs/${id}/public`, { token });
        setData(res);
        setFollowers(res.followersCount);
        // Estado de seguimiento del usuario actual
        apiFetch<{ isFollowing: boolean }>(`/follows/stats/club:${id}`, { token })
          .then(r => setFollowing(r.isFollowing))
          .catch(() => {});
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, getToken]);

  async function toggleFollow() {
    if (!data || toggling) return;
    setToggling(true);
    try {
      const token = await getToken();
      const res = await apiFetch<{ following: boolean }>(`/follows/toggle/club:${data.club.id}`, { token, method: 'POST' });
      setFollowing(res.following);
      setFollowers(prev => prev + (res.following ? 1 : -1));
    } catch {
      /* ignorar */
    } finally {
      setToggling(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-[14px] font-semibold text-foreground">Club no encontrado</p>
        <button onClick={() => router.back()} className="mt-4 text-[13px] font-semibold text-primary">Volver</button>
      </div>
    );
  }

  const { club, members, mainLocation } = data;
  const meta = [club.deporte, club.city, club.department].filter(Boolean).join(' · ');

  return (
    <div className="min-h-full bg-background pb-10">
      {/* Portada */}
      <div className="relative">
        <div
          className="w-full"
          style={{
            height: 180,
            background: club.coverUrl
              ? `url(${club.coverUrl}) center/cover`
              : 'linear-gradient(135deg,#7C3AED,#4361EE)',
          }}
        />
        <button
          onClick={() => router.back()}
          className="absolute top-3 left-3 w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.9)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
        >
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
      </div>

      <div className="px-4 max-w-3xl mx-auto">
        {/* Logo + nombre */}
        <div className="flex items-end gap-3 -mt-10">
          {club.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={club.logoUrl} alt={club.name}
              className="w-20 h-20 rounded-full object-cover shrink-0"
              style={{ border: '3px solid #fff', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }} />
          ) : (
            <div className="w-20 h-20 rounded-full shrink-0 flex items-center justify-center text-2xl font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#7C3AED,#4361EE)', border: '3px solid #fff' }}>
              {initials(club.name)}
            </div>
          )}
        </div>

        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-[20px] font-bold text-foreground">{club.name}</h1>
              {club.verified && <BadgeCheck className="w-5 h-5 shrink-0" style={{ color: '#4361EE' }} />}
            </div>
            {meta && <p className="text-[13px] text-muted-foreground mt-0.5">{meta}</p>}
          </div>
          {/* Botón seguir */}
          <button
            onClick={toggleFollow}
            disabled={toggling}
            className="shrink-0 px-4 py-2 rounded-xl text-[13px] font-bold transition-all disabled:opacity-60"
            style={following
              ? { background: '#fff', color: '#7C3AED', border: '1.5px solid rgba(124,58,237,0.35)' }
              : { background: 'linear-gradient(135deg,#7C3AED,#4361EE)', color: '#fff' }
            }
          >
            {following ? 'Siguiendo' : 'Seguir'}
          </button>
        </div>

        {/* Stats */}
        <div className="flex gap-5 mt-3">
          <div><span className="font-bold text-foreground">{club._count.members}</span>{' '}
            <span className="text-[13px] text-muted-foreground">miembros</span></div>
          <div><span className="font-bold text-foreground">{followers}</span>{' '}
            <span className="text-[13px] text-muted-foreground">seguidores</span></div>
        </div>

        {club.description && (
          <p className="text-[13px] text-foreground/90 mt-3 leading-relaxed whitespace-pre-line">{club.description}</p>
        )}

        {mainLocation && (
          <div className="flex items-center gap-2 mt-3 text-[13px] text-muted-foreground">
            <MapPin className="w-4 h-4 shrink-0" style={{ color: '#06D6A0' }} />
            <span>{mainLocation.name}{mainLocation.address ? ` · ${mainLocation.address}` : ''}</span>
          </div>
        )}

        {/* Miembros */}
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4" style={{ color: '#7C3AED' }} />
            <h2 className="text-[14px] font-bold text-foreground">Miembros</h2>
          </div>
          {members.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">Este club aún no tiene miembros con perfil público.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {members.map(m => {
                const inner = (
                  <div className="flex items-center gap-2.5 bg-card border border-border rounded-xl px-3 py-2.5 h-full">
                    {m.pictureUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.pictureUrl} alt={m.fullName} className="w-9 h-9 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold text-white"
                        style={{ background: 'linear-gradient(135deg,#7C3AED,#4361EE)' }}>
                        {initials(m.fullName)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-foreground truncate">{m.fullName}</p>
                      <p className="text-[10px] text-muted-foreground">{ROLE_LABEL[m.role] ?? m.role}</p>
                    </div>
                  </div>
                );
                return m.clerkId
                  ? <Link key={m.id} href={`/dashboard/perfil/${m.clerkId}`} className="block hover:opacity-90 transition-opacity">{inner}</Link>
                  : <div key={m.id}>{inner}</div>;
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
