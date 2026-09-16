'use client';

import { useAuth, useSession } from '@clerk/nextjs';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '@/lib/api-client';
import { MemberAvatar } from '@/components/ui/member-avatar';
import { PostCard, Post, PostComment, LikeUser } from '@/components/ui/post-card';
import { CalendarDays, Users, ImagePlus, UserPlus, UserCheck, MessageSquareOff, X } from 'lucide-react';
import ModuleLoader, { useCargaMinima } from '@/components/ui/module-loader';
import ModuleReveal from '@/components/ui/module-reveal';
import { IconUbicacion } from '@/components/ui/custom-icons';

const roleLabels: Record<string, string> = {
  SUPERADMIN: 'Super admin', ADMIN: 'Administrador',
  ENTRENADOR: 'Entrenador',      DEPORTISTA: 'Deportista',
};
const roleColors: Record<string, { text: string; bg: string }> = {
  SUPERADMIN: { text: '#EF476F', bg: 'rgba(239,71,111,0.12)' },
  ADMIN:      { text: '#FFB703', bg: 'rgba(255,183,3,0.12)' },
  ENTRENADOR:      { text: '#06D6A0', bg: 'rgba(6,214,160,0.12)' },
  DEPORTISTA:    { text: '#381DA0', bg: 'rgba(56,29,160,0.10)' },
};
const ROLE_GRADIENT: Record<string, string> = {
  SUPERADMIN: 'linear-gradient(135deg,#EF476F,#C1121F)',
  ADMIN:      'linear-gradient(135deg,#FFB703,#FB8500)',
  ENTRENADOR:      'linear-gradient(135deg,#06D6A0,#0CB68D)',
  DEPORTISTA:    '#381DA0',
};

const TABS = ['Publicaciones', 'Fotos', 'Información'] as const;
type Tab = typeof TABS[number];

function formatJoinDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
}

// El corte entre los dos disenos. Debajo de 1024px —movil y tablet— manda el
// juego de pestanas, porque a dos columnas la de comentarios queda demasiado
// comprimida para leerse. De ahi para arriba hay ancho de sobra y el perfil se
// abre en feed + costado.
const CORTE_ESCRITORIO = '(min-width: 1024px)';

function useEscritorio(): boolean {
  const [esEscritorio, setEsEscritorio] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(CORTE_ESCRITORIO);
    const aplicar = () => setEsEscritorio(mq.matches);
    aplicar();
    mq.addEventListener('change', aplicar);
    return () => mq.removeEventListener('change', aplicar);
  }, []);
  return esEscritorio;
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
  posts: Post[];
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
  const esEscritorio = useEscritorio();

  const [profile, setProfile]     = useState<PublicProfile | null>(null);
  const [posts, setPosts]         = useState<Post[]>([]);
  const [loading, setLoading]     = useState(true);
  // Sostiene el indicador un minimo de tiempo para que no parpadee
  const mostrarCarga = useCargaMinima(loading);
  const [following, setFollowing] = useState(false);
  const [toggling, setToggling]   = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('Publicaciones');
  // Publicacion abierta desde el mosaico, en el visor
  const [postoAbierto, setPostoAbierto] = useState<string | null>(null);
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
          setPosts(p.posts ?? []);
        }
      } catch { /* silencioso */ }
      finally { setLoading(false); }
    })();
  }, [isLoaded, isSignedIn, userId, targetClerkId, session, router]);

  // Cerrar el visor con Escape, como cualquier otra capa de la app
  useEffect(() => {
    if (!postoAbierto) return;
    const alPresionar = (e: KeyboardEvent) => { if (e.key === 'Escape') setPostoAbierto(null); };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [postoAbierto]);

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

  async function handleLike(postId: string) {
    const token = await session?.getToken();
    const res = await apiFetch<{ liked: boolean }>(`/posts/${postId}/like`, { token, method: 'POST' });
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      return {
        ...p,
        likes: res.liked
          ? [...p.likes, { userId: userId ?? '' }]
          : p.likes.filter(l => l.userId !== userId),
      };
    }));
  }

  async function handleComment(postId: string, content: string, parentId?: string) {
    const token = await session?.getToken();
    const res = await apiFetch<{ comment: PostComment }>(`/posts/${postId}/comments`, {
      token, method: 'POST', body: JSON.stringify({ content, parentId }),
    });
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, comments: [...p.comments, res.comment] } : p
    ));
  }

  async function handleDeleteComment(postId: string, commentId: string) {
    const token = await session?.getToken();
    // El backend borra tambien las respuestas del comentario y devuelve todos
    // los ids: sin esto quedaban en la lista colgando de un padre inexistente.
    const res = await apiFetch<{ eliminados?: string[] }>(
      `/posts/${postId}/comments/${commentId}`, { token, method: 'DELETE' }
    );
    const fuera = new Set(res.eliminados ?? [commentId]);
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, comments: p.comments.filter(c => !fuera.has(c.id)) } : p
    ));
  }

  async function handleEditComment(postId: string, commentId: string, content: string) {
    const token = await session?.getToken();
    const res = await apiFetch<{ comment: PostComment }>(`/posts/${postId}/comments/${commentId}`, {
      token, method: 'PATCH', body: JSON.stringify({ content }),
    });
    setPosts(prev => prev.map(p =>
      p.id === postId
        ? { ...p, comments: p.comments.map(c => (c.id === commentId ? res.comment : c)) }
        : p
    ));
  }

  // Solo alcanzables cuando alguien llega a su propio perfil por esta ruta:
  // PostCard decide quien ve editar y borrar segun el autor de cada tarjeta.
  async function handleDelete(postId: string) {
    const token = await session?.getToken();
    await apiFetch(`/posts/${postId}`, { token, method: 'DELETE' });
    setPosts(prev => prev.filter(p => p.id !== postId));
    setPostoAbierto(null);
  }

  async function handleUpdatePost(id: string, cambios: { content?: string; scope?: 'PUBLIC' | 'PRIVATE' }) {
    const token = await session?.getToken();
    const res = await apiFetch<{ post: Post }>(`/posts/${id}`, {
      token, method: 'PATCH', body: JSON.stringify(cambios),
    });
    setPosts(prev => prev.map(p => (p.id === id ? res.post : p)));
  }

  async function handleFetchLikes(postId: string): Promise<LikeUser[]> {
    const token = await session?.getToken();
    const res = await apiFetch<{ users: LikeUser[] }>(`/posts/${postId}/likes`, { token });
    return res.users;
  }

  if (mostrarCarga) {
    return (
      <ModuleLoader />
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
  const rc   = roleColors[role] ?? roleColors.DEPORTISTA;
  // El mosaico sale del mismo listado que el feed para que nunca se contradigan
  const fotos = posts.filter(p => p.imageUrl);
  const postoEnVisor = posts.find(p => p.id === postoAbierto) ?? null;

  // En un perfil ajeno solo se lee, se reacciona y se comenta: `canDelete` es
  // el permiso de moderacion del cuerpo tecnico y aca no aplica.
  const propsDePost = {
    currentUserId: userId ?? '',
    canDelete: false,
    onLike: handleLike,
    onComment: handleComment,
    onDelete: handleDelete,
    onUpdatePost: handleUpdatePost,
    onDeleteComment: handleDeleteComment,
    onEditComment: handleEditComment,
    onFetchLikes: handleFetchLikes,
  };

  const vacio = (icono: React.ReactNode, titulo: string, detalle: string) => (
    <div className="rounded-2xl px-6 py-10 flex flex-col items-center text-center"
      style={{
        background: 'rgba(56,29,160,0.04)',
        border: '1px solid rgba(56,29,160,0.10)',
      }}>
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: '#381DA0' }}>
        {icono}
      </div>
      <p className="text-[14px] font-semibold text-foreground mb-1">{titulo}</p>
      <p className="text-[12px] text-muted-foreground max-w-[30ch]">{detalle}</p>
    </div>
  );

  const feed = posts.length === 0
    ? vacio(
        <MessageSquareOff className="w-6 h-6 text-white" />,
        'Sin publicaciones todavía',
        `${profile.name.split(' ')[0]} aún no ha publicado nada que puedas ver.`,
      )
    : (
      <div className="space-y-4">
        {posts.map(post => (
          // El ancla la usa el mosaico de movil para saltar a la publicacion
          <div key={post.id} id={`post-${post.id}`} style={{ scrollMarginTop: 64 }}>
            <PostCard post={post} compacto {...propsDePost} />
          </div>
        ))}
      </div>
    );

  const mosaico = (columnas: number, alAbrir: (id: string) => void) =>
    fotos.length === 0
      ? vacio(
          <ImagePlus className="w-6 h-6 text-white" />,
          'Sin fotos publicadas',
          'Cuando publique una foto, aparecerá acá.',
        )
      : (
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0,1fr))` }}>
          {fotos.map(foto => (
            <button
              key={foto.id}
              type="button"
              onClick={() => alAbrir(foto.id)}
              aria-label="Abrir la publicación de esta foto"
              className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ background: '#f0f0f0', outlineColor: '#381DA0' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={foto.imageUrl!} alt="Foto"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: 'rgba(26,16,40,0.28)' }} />
            </button>
          ))}
        </div>
      );

  const fichaClub = profile.club?.name ? (
    <div className="rounded-2xl bg-white p-4"
      style={{ border: '1px solid rgba(120,80,200,0.10)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Club</p>
      <div className="flex items-center gap-3">
        {profile.club.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.club.logoUrl} alt={profile.club.name}
            className="w-10 h-10 rounded-xl object-cover shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-xl shrink-0"
            style={{ background: 'linear-gradient(135deg,#4361EE,#06D6A0)' }} />
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[13px] font-semibold text-foreground truncate">{profile.club.name}</p>
            {profile.club.verified && (
              <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0" style={{ background: '#4361EE' }}>
                <svg viewBox="0 0 24 24" fill="none" className="w-2 h-2">
                  <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            )}
          </div>
          {(profile.club.city || profile.club.department) && (
            <p className="text-[11px] text-muted-foreground truncate">
              {[profile.club.city, profile.club.department].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
      </div>
    </div>
  ) : null;

  const fichaResumen = (
    <div className="rounded-2xl bg-white p-4"
      style={{ border: '1px solid rgba(120,80,200,0.10)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Resumen</p>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[12px] text-muted-foreground">Rol</span>
          <span className="text-[12px] font-semibold text-foreground">{roleLabels[role] ?? role}</span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[12px] text-muted-foreground">Miembro desde</span>
          <span className="text-[12px] font-semibold text-foreground">{formatJoinDate(profile.createdAt)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[12px] text-muted-foreground">Publicaciones</span>
          <span className="text-[12px] font-semibold text-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {posts.length}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[12px] text-muted-foreground">Fotos</span>
          <span className="text-[12px] font-semibold text-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {fotos.length}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-full bg-background">
      <ModuleReveal>
      <div
        className="bg-white border-b border-border"
        style={{ boxShadow: '0 1px 12px rgba(0,0,0,0.06)' }}
      >
        {/* Banner */}
        <div className="relative h-36 sm:h-48"
          style={{ background: profile.coverUrl ? undefined : '#381DA0' }}>
          {profile.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.coverUrl} alt="Portada" className="absolute inset-0 w-full h-full object-cover" />
          )}
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.22) 100%)' }} />
        </div>

        {/* Info */}
        <div className="px-5 pb-5 max-w-5xl mx-auto w-full">
          {/* Avatar + botón Follow */}
          <div className="flex items-end justify-between" style={{ marginTop: -60 }}>
            {/* Foto con badge del club */}
            <div className="relative z-10">
              <div className="rounded-full border-4 border-white overflow-hidden sm:w-[140px] sm:h-[140px]"
                style={{ boxShadow: '0 4px 16px rgba(56,29,160,0.20)', width: 120, height: 120 }}>
                <MemberAvatar
                  name={profile.name}
                  photoUrl={profile.picture}
                  gradient={ROLE_GRADIENT[role] ?? ROLE_GRADIENT.DEPORTISTA}
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
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all cursor-pointer disabled:opacity-60"
                style={following
                  ? { background: 'rgba(56,29,160,0.10)', color: '#381DA0', border: '1.5px solid rgba(56,29,160,0.25)' }
                  : { background: '#381DA0', color: '#fff', border: 'none' }
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
            <h1 className="text-[22px] font-semibold text-foreground leading-tight">
              {profile.name}
            </h1>
            <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full tracking-widest"
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
                <IconUbicacion className="w-3.5 h-3.5 shrink-0" style={{ color: '#8E87A8' }} />
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
              <p className="text-[18px] font-semibold text-foreground leading-none" style={{ fontVariantNumeric: 'tabular-nums' }}>{posts.length}</p>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#8E87A8', marginTop: 2 }}>Publicaciones</p>
            </div>
            <div className="text-center">
              <p className="text-[18px] font-semibold text-foreground leading-none" style={{ fontVariantNumeric: 'tabular-nums' }}>{profile.followersCount}</p>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#8E87A8', marginTop: 2 }}>Seguidores</p>
            </div>
            <div className="text-center">
              <p className="text-[18px] font-semibold text-foreground leading-none" style={{ fontVariantNumeric: 'tabular-nums' }}>{profile.followingCount}</p>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#8E87A8', marginTop: 2 }}>Siguiendo</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Móvil y tablet: pestañas ─────────────────────────────────────────── */}
      {!esEscritorio && (
        <>
          <div className="bg-white border-b border-border sticky top-0 z-10">
            <div className="flex max-w-5xl mx-auto w-full">
              {TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="flex-1 py-3.5 relative transition-colors"
                  style={{ fontSize: 12, fontWeight: 600, color: activeTab === tab ? '#381DA0' : '#8E87A8' }}
                >
                  {tab}
                  {activeTab === tab && (
                    <motion.div layoutId="public-profile-tab-indicator"
                      className="absolute bottom-0 left-4 right-4 h-[2.5px] rounded-full"
                      style={{ background: '#381DA0' }} />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="px-4 py-4 max-w-5xl mx-auto w-full">
            <AnimatePresence mode="wait">
              {activeTab === 'Publicaciones' && (
                <motion.div key="posts"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                  {feed}
                </motion.div>
              )}

              {activeTab === 'Fotos' && (
                <motion.div key="fotos"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                  {/* Tocar una foto lleva a su publicación, en la otra pestaña */}
                  {mosaico(3, id => { setPostoAbierto(null); setActiveTab('Publicaciones');
                    requestAnimationFrame(() => {
                      document.getElementById(`post-${id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
                    });
                  })}
                </motion.div>
              )}

              {activeTab === 'Información' && (
                <motion.div key="info"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}
                  className="flex flex-col gap-3">
                  {profile.bio && (
                    <div className="rounded-2xl bg-white p-4" style={{ border: '1px solid rgba(120,80,200,0.10)' }}>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Sobre</p>
                      <p className="text-[13px] text-foreground/80 leading-relaxed">{profile.bio}</p>
                    </div>
                  )}
                  {fichaClub}
                  {fichaResumen}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}

      {/* ── Escritorio: feed a la izquierda, mosaico y fichas al costado ─────── */}
      {esEscritorio && (
        <div className="px-6 py-5 max-w-5xl mx-auto w-full flex gap-6 items-start">
          <div className="flex-1 min-w-0">{feed}</div>
          <aside className="w-[300px] shrink-0 sticky top-4 flex flex-col gap-3">
            <div className="rounded-2xl bg-white p-4" style={{ border: '1px solid rgba(120,80,200,0.10)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Fotos</p>
              {mosaico(3, setPostoAbierto)}
            </div>
            {fichaClub}
            {fichaResumen}
          </aside>
        </div>
      )}
      </ModuleReveal>

      {/* ── Visor de una publicación abierta desde el mosaico ────────────────── */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {postoEnVisor && (
            <motion.div
              key="visor"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setPostoAbierto(null)}
              className="fixed inset-0 flex items-start justify-center overflow-y-auto p-6"
              style={{ background: 'rgba(20,12,36,0.6)', backdropFilter: 'blur(3px)', zIndex: 70 }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 10 }}
                transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                onClick={e => e.stopPropagation()}
                className="w-full max-w-xl my-auto"
              >
                <div className="flex justify-end mb-2">
                  <button
                    type="button"
                    onClick={() => setPostoAbierto(null)}
                    aria-label="Cerrar"
                    className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
                    style={{ background: 'rgba(255,255,255,0.14)', color: '#fff' }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <PostCard post={postoEnVisor} {...propsDePost} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
