'use client';

import { useAuth, useSession } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '@/lib/api-client';
import { useClubStream } from '@/hooks/useClubStream';
import Link from 'next/link';
import { MemberAvatar } from '@/components/ui/member-avatar';
import {
  Pencil, MapPin, CalendarDays, Globe,
  Camera, Users, Trash2, ImagePlus,
  Phone, Mail, Building2,
} from 'lucide-react';

import { PostCard, Post, PostComment } from '@/components/ui/post-card';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MeResponse {
  status: string;
  user?: {
    id: string;
    clerkId: string;
    name: string;
    email?: string;
    role: string;
    club?: { name: string; logoUrl?: string; city?: string; department?: string; verified?: boolean; deporte?: string };
    picture?: string | null;
    coverUrl?: string | null;
    createdAt?: string;
    category?: string;
    bio?: string;
  };
}

interface MemberMe {
  id: string;
  fullName: string;
  role: string;
  pictureUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  category?: string | null;
  tipo?: string | null;
}

interface PostImage { id: string; imageUrl: string }

interface FollowStats {
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const roleLabels: Record<string, string> = {
  SUPERADMIN: 'Super Admin',
  ADMIN:      'Administrador',
  COACH:      'Entrenador',
  STUDENT:    'Deportista',
};

const roleColors: Record<string, { text: string; bg: string }> = {
  SUPERADMIN: { text: '#EF476F', bg: 'rgba(239,71,111,0.12)' },
  ADMIN:      { text: '#FFB703', bg: 'rgba(255,183,3,0.12)' },
  COACH:      { text: '#06D6A0', bg: 'rgba(6,214,160,0.12)' },
  STUDENT:    { text: '#7C3AED', bg: 'rgba(124,58,237,0.10)' },
};


function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function formatJoinDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
}

// ── Gradientes por rol ────────────────────────────────────────────────────────
const ROLE_GRADIENT: Record<string, string> = {
  SUPERADMIN: 'linear-gradient(135deg,#EF476F,#C1121F)',
  ADMIN:      'linear-gradient(135deg,#FFB703,#FB8500)',
  COACH:      'linear-gradient(135deg,#06D6A0,#0CB68D)',
  STUDENT:    'linear-gradient(135deg,#7C3AED,#A855F7)',
};

// ── Avatar wrapper ────────────────────────────────────────────────────────────
function Avatar({ src, name, size = 36, role }: { src?: string | null; name: string; size?: number; role?: string }) {
  return (
    <MemberAvatar
      name={name}
      photoUrl={src}
      gradient={ROLE_GRADIENT[role ?? ''] ?? ROLE_GRADIENT.STUDENT}
      size={size}
    />
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = ['Publicaciones', 'Fotos', 'Contacto'] as const;
type Tab = typeof TABS[number];

// ── Main ──────────────────────────────────────────────────────────────────────

export default function PerfilPage() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { session } = useSession();
  const router = useRouter();

  const [me, setMe]               = useState<MeResponse | null>(null);
  const [memberMe, setMemberMe]   = useState<MemberMe | null>(null);
  const [posts, setPosts]             = useState<Post[]>([]);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState<Tab>('Publicaciones');
  const [currentUserId, setCurrentUserId] = useState('');
  const [coverUrl, setCoverUrl]       = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverMenuOpen, setCoverMenuOpen]   = useState(false);
  const [deletingCover, setDeletingCover]   = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [postImages, setPostImages]   = useState<PostImage[]>([]);
  const [followStats, setFollowStats] = useState<FollowStats>({ followersCount: 0, followingCount: 0, isFollowing: false });
  const [myClerkId, setMyClerkId]     = useState<string>('');
  const [bio, setBio]                 = useState('');
  const [editingBio, setEditingBio]   = useState(false);
  const [bioDraft, setBioDraft]       = useState('');
  const [savingBio, setSavingBio]     = useState(false);

  // Referencia al nombre del usuario para filtrar posts (evita re-renders)
  const myNameRef = useRef<string>('');

  const loadPosts = async () => {
    if (!isSignedIn) return;
    try {
      const token = await session?.getToken();
      const postsRes = await apiFetch<{ posts: Post[] }>('/posts?scope=public', { token });
      setPosts(postsRes.posts.filter(p => !myNameRef.current || p.authorName === myNameRef.current));
    } catch { /* silencioso */ }
  };

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { router.push('/sign-in'); return; }
    (async () => {
      try {
        const token = await session?.getToken();
        const [meRes, postsRes, memberMeRes] = await Promise.allSettled([
          apiFetch<MeResponse>('/me', { token }),
          apiFetch<{ posts: Post[] }>('/posts?scope=public', { token }),
          apiFetch<{ member: MemberMe | null }>('/members/me', { token }),
        ]);
        if (meRes.status === 'fulfilled') {
          setMe(meRes.value);
          setCoverUrl(meRes.value.user?.coverUrl ?? null);
          setBio(meRes.value.user?.bio ?? '');
          myNameRef.current = meRes.value.user?.name ?? '';
        }
        if (postsRes.status === 'fulfilled') {
          setPosts(postsRes.value.posts.filter(p => !myNameRef.current || p.authorName === myNameRef.current));
        }
        if (memberMeRes.status === 'fulfilled' && memberMeRes.value.member) {
          setMemberMe(memberMeRes.value.member);
        }
        setCurrentUserId(userId ?? '');
        // Cargar follow stats y clerkId
        if (meRes.status === 'fulfilled' && meRes.value.user?.clerkId) {
          const clerkId = meRes.value.user.clerkId;
          setMyClerkId(clerkId);
          try {
            const token2 = await session?.getToken();
            const statsRes = await apiFetch<FollowStats>(`/follows/stats/${clerkId}`, { token: token2 });
            setFollowStats(statsRes);
          } catch { /* silencioso */ }
        }
        // Post images para galería
        if (postsRes.status === 'fulfilled') {
          const imgs = postsRes.value.posts
            .filter(p => p.imageUrl)
            .map(p => ({ id: p.id, imageUrl: p.imageUrl! }));
          setPostImages(imgs);
        }
      } catch { /* silencioso */ } finally { setLoading(false); }
    })();
  }, [isLoaded, isSignedIn, userId, session]);

  // Sincronizar posts en tiempo real via SSE — reacciona a cambios del home
  useClubStream((ev) => {
    if (ev === 'posts') loadPosts();
  });

  async function handleLike(postId: string) {
    const token = await session?.getToken();
    const res = await apiFetch<{ liked: boolean }>(`/posts/${postId}/like`, { token, method: 'POST' });
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      return {
        ...p,
        likes: res.liked
          ? [...p.likes, { userId: currentUserId }]
          : p.likes.filter(l => l.userId !== currentUserId),
      };
    }));
  }

  async function handleComment(postId: string, content: string) {
    const token = await session?.getToken();
    const res = await apiFetch<{ comment: PostComment }>(`/posts/${postId}/comments`, {
      token, method: 'POST', body: JSON.stringify({ content }),
    });
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, comments: [...p.comments, res.comment] } : p
    ));
  }

  async function saveBio() {
    setSavingBio(true);
    try {
      const token = await session?.getToken();
      const res = await apiFetch<{ bio: string | null }>('/me/bio', {
        method: 'PATCH', token, body: JSON.stringify({ bio: bioDraft }),
      });
      setBio(res.bio ?? '');
      setEditingBio(false);
    } catch { /* silencioso */ }
    finally { setSavingBio(false); }
  }

  async function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('La imagen no puede superar 5MB'); return; }
    setUploadingCover(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      try {
        const token = await session?.getToken();
        const res = await apiFetch<{ coverUrl: string }>('/me/cover', {
          method: 'POST', token,
          body: JSON.stringify({ base64 }),
        });
        setCoverUrl(res.coverUrl);
      } catch (err) {
        alert('Error al subir la portada: ' + (err instanceof Error ? err.message : 'intenta de nuevo'));
      } finally { setUploadingCover(false); }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function handleDelete(postId: string) {
    const token = await session?.getToken();
    await apiFetch(`/posts/${postId}`, { token, method: 'DELETE' });
    setPosts(prev => prev.filter(p => p.id !== postId));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: '#7C3AED', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const user  = me?.user;
  const role  = user?.role ?? 'ADMIN';
  const rc    = roleColors[role] ?? roleColors.ADMIN;
  const canDelete = role === 'ADMIN' || role === 'COACH';

  return (
    <div className="min-h-full bg-background">

      {/* ── Tarjeta de perfil ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        className="bg-white border-b border-border"
        style={{ boxShadow: '0 1px 12px rgba(0,0,0,0.06)' }}
      >
        {/* Banner — sin overflow-hidden para que el avatar sobresalga */}
        <div className="relative h-36 sm:h-48"
          style={{ background: coverUrl ? undefined : 'linear-gradient(135deg, #7C3AED 0%, #4361EE 60%, #06D6A0 100%)' }}>

          {/* Imagen de portada */}
          {coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt="Portada" className="absolute inset-0 w-full h-full object-cover" />
          )}

          {/* Patrón decorativo (solo si no hay imagen) */}
          {!coverUrl && (
            <div className="absolute inset-0 opacity-10"
              style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          )}
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.22) 100%)' }} />

          {/* Botón portada — top-right */}
          <div className="absolute top-3 right-3">
            <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />

            {/* Sin foto → solo ícono cámara */}
            {!coverUrl && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => !uploadingCover && coverInputRef.current?.click()}
                disabled={uploadingCover}
                className="flex items-center justify-center w-9 h-9 rounded-xl text-white cursor-pointer disabled:opacity-60"
                style={{ background: 'rgba(255,255,255,0.20)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.30)' }}
              >
                {uploadingCover
                  ? <div className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                  : <Camera className="w-3.5 h-3.5" />
                }
              </motion.button>
            )}

            {/* Con foto → lápiz que abre dropdown */}
            {coverUrl && (
              <div className="relative">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => !uploadingCover && !deletingCover && setCoverMenuOpen(v => !v)}
                  disabled={uploadingCover || deletingCover}
                  className="flex items-center justify-center w-9 h-9 rounded-xl text-white cursor-pointer disabled:opacity-60"
                  style={{ background: 'rgba(255,255,255,0.20)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.30)' }}
                >
                  {(uploadingCover || deletingCover)
                    ? <div className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                    : <Pencil className="w-3.5 h-3.5" />
                  }
                </motion.button>

                <AnimatePresence>
                  {coverMenuOpen && (
                    <>
                      {/* Overlay para cerrar */}
                      <div className="fixed inset-0 z-40" onClick={() => setCoverMenuOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.92, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.92, y: -4 }}
                        transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
                        className="absolute right-0 top-11 z-50 min-w-[160px] rounded-xl overflow-hidden"
                        style={{ background: 'white', boxShadow: '0 8px 24px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)' }}
                      >
                        <button
                          onClick={() => { setCoverMenuOpen(false); coverInputRef.current?.click(); }}
                          className="flex items-center gap-2.5 w-full px-4 py-2.5 text-[13px] font-medium text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
                        >
                          <ImagePlus className="w-4 h-4 text-muted-foreground" />
                          Cambiar foto
                        </button>
                        <button
                          onClick={async () => {
                            setCoverMenuOpen(false);
                            setDeletingCover(true);
                            try {
                              const token = await session?.getToken();
                              await apiFetch('/me/cover', { method: 'DELETE', token });
                              setCoverUrl(null);
                            } catch (err) {
                              alert('Error al eliminar la portada: ' + (err instanceof Error ? err.message : 'intenta de nuevo'));
                            } finally { setDeletingCover(false); }
                          }}
                          className="flex items-center gap-2.5 w-full px-4 py-2.5 text-[13px] font-medium text-red-500 hover:bg-red-50 transition-colors cursor-pointer border-t border-border"
                        >
                          <Trash2 className="w-4 h-4" />
                          Eliminar
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* Info del usuario */}
        <div className="px-5 pb-5 max-w-4xl mx-auto w-full">
          {/* Avatar con badge del club */}
          <div className="flex items-end justify-between" style={{ marginTop: -60 }}>
            <div className="relative z-10">
              <div className="rounded-full border-4 border-white overflow-hidden"
                style={{ boxShadow: '0 4px 16px rgba(124,58,237,0.20)', width: 120, height: 120 }}>
                <Avatar src={user?.picture} name={user?.name ?? 'Usuario'} size={120} role={role} />
              </div>
              {/* Badge del club — esquina inferior derecha */}
              {user?.club?.logoUrl && (
                <div className="absolute bottom-0.5 right-0.5 rounded-full border-2 border-white overflow-hidden"
                  style={{ width: 32, height: 32, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={user.club.logoUrl} alt={user.club.name} className="w-full h-full object-cover" />
                </div>
              )}
              {/* Badge verificado si el club está verificado y no tiene logo */}
              {user?.club?.verified && !user?.club?.logoUrl && (
                <div className="absolute bottom-0.5 right-0.5 rounded-full border-2 border-white flex items-center justify-center"
                  style={{ width: 28, height: 28, background: '#4361EE' }}>
                  <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5">
                    <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </div>
          </div>

          {/* Nombre + badge de rol en la misma línea */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <h1 className="text-[22px] font-bold text-foreground leading-tight">
              {user?.name ?? 'Usuario'}
            </h1>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full tracking-widest"
              style={{ background: rc.bg, color: rc.text }}>
              {roleLabels[role] ?? role}
            </span>
          </div>

          {/* Bio */}
          <div className="mt-2 max-w-lg">
            {editingBio ? (
              <div className="flex flex-col gap-2">
                <textarea
                  autoFocus
                  value={bioDraft}
                  onChange={e => setBioDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') setEditingBio(false); }}
                  maxLength={200}
                  rows={3}
                  placeholder="Cuéntale algo a tu equipo..."
                  className="w-full text-[13px] leading-relaxed rounded-xl px-3 py-2 outline-none resize-none"
                  style={{ background: 'rgba(124,58,237,0.05)', border: '1.5px solid rgba(124,58,237,0.25)', color: '#1A1028' }}
                />
                <div className="flex items-center gap-2">
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={saveBio}
                    disabled={savingBio}
                    className="px-4 py-1.5 rounded-lg text-[12px] font-bold text-white disabled:opacity-60 cursor-pointer"
                    style={{ background: 'linear-gradient(135deg,#7C3AED,#4361EE)' }}>
                    {savingBio ? 'Guardando…' : 'Guardar'}
                  </motion.button>
                  <button onClick={() => setEditingBio(false)}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-muted-foreground hover:bg-secondary transition-colors cursor-pointer">
                    Cancelar
                  </button>
                  <span className="ml-auto text-[11px] text-muted-foreground/50">{bioDraft.length}/200</span>
                </div>
              </div>
            ) : (
              <div
                onClick={() => { setBioDraft(bio); setEditingBio(true); }}
                className="group cursor-pointer">
                {bio ? (
                  <p className="text-[13px] text-foreground/80 leading-relaxed">
                    {bio}
                    <Pencil className="inline-block ml-1.5 w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity" />
                  </p>
                ) : (
                  <p className="text-[13px] text-muted-foreground/50 italic hover:text-muted-foreground/70 transition-colors">
                    + Agregar descripción
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3">
            {user?.club?.name && (
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 shrink-0" style={{ color: '#8E87A8' }} />
                <span className="text-[12px] text-muted-foreground">{user.club.name}</span>
                {user.club.verified && (
                  <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{ background: '#4361EE' }}>
                    <svg viewBox="0 0 24 24" fill="none" className="w-2 h-2">
                      <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </div>
            )}
            {(user?.club?.city || user?.club?.department) && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: '#8E87A8' }} />
                <span className="text-[12px] text-muted-foreground">
                  {[user?.club?.city, user?.club?.department].filter(Boolean).join(', ')}
                </span>
              </div>
            )}
            {user?.createdAt && (
              <div className="flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 shrink-0" style={{ color: '#8E87A8' }} />
                <span className="text-[12px] text-muted-foreground">
                  Miembro desde {formatJoinDate(user.createdAt)}
                </span>
              </div>
            )}
          </div>

          {/* Stats: Publicaciones · Seguidores · Siguiendo */}
          <div className="flex items-center gap-6 mt-4">
            <div className="text-center">
              <p className="text-[18px] font-bold text-foreground leading-none">{posts.length}</p>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#8E87A8', marginTop: 2 }}>Publicaciones</p>
            </div>
            <div className="text-center">
              <p className="text-[18px] font-bold text-foreground leading-none">{followStats.followersCount}</p>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#8E87A8', marginTop: 2 }}>Seguidores</p>
            </div>
            <div className="text-center">
              <p className="text-[18px] font-bold text-foreground leading-none">{followStats.followingCount}</p>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#8E87A8', marginTop: 2 }}>Siguiendo</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-border sticky top-0 z-10">
        <div className="sm:flex">
          {/* Fila de tabs — 50% en desktop */}
          <div className="flex sm:w-1/2">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                // "Contacto" solo en móvil — en desktop siempre visible en columna derecha
                className={`flex-1 py-3.5 relative transition-colors${tab === 'Contacto' ? ' sm:hidden' : ''}`}
                style={{ fontSize: 12, fontWeight: 700, color: activeTab === tab ? '#7C3AED' : '#8E87A8' }}
              >
                {tab}
                {activeTab === tab && (
                  <motion.div layoutId="profile-tab-indicator"
                    className="absolute bottom-0 left-4 right-4 h-[2.5px] rounded-full"
                    style={{ background: '#7C3AED' }} />
                )}
              </button>
            ))}
          </div>
          {/* Tab Contacto — solo en desktop, centrado en el 50% derecho */}
          <div className="hidden sm:flex sm:w-1/2 items-center justify-center">
            <div className="relative py-3.5">
              <span style={{ fontSize: 12, fontWeight: 700, color: '#8E87A8' }}>Contacto</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Contenido del tab ─────────────────────────────────────────────────── */}
      {/* En desktop: 2 columnas — izquierda 50% contenido, derecha 50% reservado */}
      <div className="w-full px-4 sm:px-6 py-4 sm:flex sm:gap-6">
      <div className="sm:w-1/2">
        <AnimatePresence mode="wait">
          {activeTab === 'Publicaciones' && (
            <motion.div key="posts"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}
              className="space-y-4">

              {posts.length === 0 ? (
                <div className="rounded-2xl px-6 py-10 flex flex-col items-center text-center mt-4"
                  style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.04),rgba(67,97,238,0.03))', border: '1px solid rgba(124,58,237,0.10)' }}>
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                    style={{ background: 'linear-gradient(135deg,#7C3AED,#4361EE)' }}>
                    <Globe className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-[14px] font-bold text-foreground mb-1">Sin publicaciones aún</p>
                  <p className="text-[12px] text-muted-foreground">
                    Comparte algo con tu equipo desde el inicio.
                  </p>
                  <Link href="/dashboard">
                    <motion.div whileTap={{ scale: 0.97 }}
                      className="mt-4 px-5 py-2 rounded-full text-[13px] font-bold text-white cursor-pointer"
                      style={{ background: '#7C3AED' }}>
                      Ir al inicio
                    </motion.div>
                  </Link>
                </div>
              ) : (
                posts.map(post => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUserId={currentUserId}
                    canDelete={canDelete}
                    onLike={handleLike}
                    onComment={handleComment}
                    onDelete={handleDelete}
                  />
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'Fotos' && (
            <motion.div key="fotos"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              {postImages.length === 0 ? (
                <div className="rounded-2xl px-6 py-10 flex flex-col items-center text-center mt-4"
                  style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.04),rgba(67,97,238,0.03))', border: '1px solid rgba(124,58,237,0.10)' }}>
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                    style={{ background: 'linear-gradient(135deg,#7C3AED,#4361EE)' }}>
                    <ImagePlus className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-[14px] font-bold text-foreground mb-1">Sin fotos aún</p>
                  <p className="text-[12px] text-muted-foreground">Las fotos de tus publicaciones aparecerán aquí.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1 mt-2">
                  {postImages.slice(0, 5).map((img, idx) => {
                    const isLast = idx === 4 && postImages.length > 5;
                    const remaining = postImages.length - 5;
                    return (
                      <div key={img.id}
                        className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group"
                        style={{ background: '#f0f0f0' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.imageUrl}
                          alt="Foto"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
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
            </motion.div>
          )}

        </AnimatePresence>
      </div>
      {/* Tab Contacto — solo móvil */}
      {activeTab === 'Contacto' && (
        <div className="sm:hidden px-4 py-4 sm:w-1/2">
          <div className="rounded-2xl overflow-hidden"
            style={{ background: 'white', border: '1px solid rgba(124,58,237,0.10)', boxShadow: '0 1px 12px rgba(0,0,0,0.06)' }}>
            <div className="px-5 py-4 border-b border-border/50">
              <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#8E87A8' }}>Información de contacto</p>
            </div>
            <div className="divide-y divide-border/40">
              <div className="flex items-center gap-3 px-5 py-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(124,58,237,0.08)' }}>
                  <Phone className="w-4 h-4" style={{ color: '#7C3AED' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#8E87A8' }}>Teléfono</p>
                  <p className="text-[13px] font-medium text-foreground truncate">
                    {memberMe?.phone || <span className="text-muted-foreground/50 italic text-[12px]">Sin registrar</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-5 py-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(124,58,237,0.08)' }}>
                  <Mail className="w-4 h-4" style={{ color: '#7C3AED' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#8E87A8' }}>Correo electrónico</p>
                  <p className="text-[13px] font-medium text-foreground truncate">
                    {(memberMe?.email || user?.email) || <span className="text-muted-foreground/50 italic text-[12px]">Sin registrar</span>}
                  </p>
                </div>
              </div>
              {user?.club && (
                <div className="flex items-center gap-3 px-5 py-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 overflow-hidden" style={{ background: user.club.logoUrl ? undefined : 'rgba(124,58,237,0.08)' }}>
                    {user.club.logoUrl
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={user.club.logoUrl} alt={user.club.name} className="w-full h-full object-cover" />
                      : <Building2 className="w-4 h-4" style={{ color: '#7C3AED' }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#8E87A8' }}>Club</p>
                    <p className="text-[13px] font-medium text-foreground truncate">{user.club.name}</p>
                  </div>
                </div>
              )}
              {(memberMe?.category || memberMe?.tipo) && (
                <div className="flex items-center gap-3 px-5 py-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(124,58,237,0.08)' }}>
                    <Users className="w-4 h-4" style={{ color: '#7C3AED' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#8E87A8' }}>Categoría</p>
                    <p className="text-[13px] font-medium text-foreground">{[memberMe.category, memberMe.tipo].filter(Boolean).join(' · ')}</p>
                  </div>
                </div>
              )}
              {(user?.club?.city || user?.club?.department) && (
                <div className="flex items-center gap-3 px-5 py-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(124,58,237,0.08)' }}>
                    <MapPin className="w-4 h-4" style={{ color: '#7C3AED' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#8E87A8' }}>Ubicación</p>
                    <p className="text-[13px] font-medium text-foreground">{[user.club.city, user.club.department].filter(Boolean).join(', ')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Columna derecha — tarjeta de contacto, solo desktop, sticky */}
      <div className="hidden sm:block sm:px-0 sm:pr-6 pb-6 sm:w-1/2 sm:py-4 sm:sticky sm:top-4 sm:self-start">
        <div className="rounded-2xl overflow-hidden"
          style={{ background: 'white', border: '1px solid rgba(124,58,237,0.10)', boxShadow: '0 1px 12px rgba(0,0,0,0.06)' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#8E87A8' }}>
              Información de contacto
            </p>
          </div>

          {/* Campos */}
          <div className="divide-y divide-border/40">

            {/* Teléfono */}
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(124,58,237,0.08)' }}>
                <Phone className="w-4 h-4" style={{ color: '#7C3AED' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#8E87A8' }}>Teléfono</p>
                <p className="text-[13px] font-medium text-foreground truncate">
                  {memberMe?.phone || <span className="text-muted-foreground/50 italic text-[12px]">Sin registrar</span>}
                </p>
              </div>
            </div>

            {/* Correo */}
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(124,58,237,0.08)' }}>
                <Mail className="w-4 h-4" style={{ color: '#7C3AED' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#8E87A8' }}>Correo electrónico</p>
                <p className="text-[13px] font-medium text-foreground truncate">
                  {(memberMe?.email || user?.email) || <span className="text-muted-foreground/50 italic text-[12px]">Sin registrar</span>}
                </p>
              </div>
            </div>

            {/* Club */}
            {user?.club && (
              <div className="flex items-center gap-3 px-5 py-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
                  style={{ background: user.club.logoUrl ? undefined : 'rgba(124,58,237,0.08)' }}>
                  {user.club.logoUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={user.club.logoUrl} alt={user.club.name} className="w-full h-full object-cover" />
                    : <Building2 className="w-4 h-4" style={{ color: '#7C3AED' }} />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#8E87A8' }}>Club</p>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[13px] font-medium text-foreground truncate">{user.club.name}</p>
                    {user.club.verified && (
                      <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0" style={{ background: '#4361EE' }}>
                        <svg viewBox="0 0 24 24" fill="none" className="w-2 h-2">
                          <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Categoría / Nivel — solo STUDENT */}
            {(memberMe?.category || memberMe?.tipo) && (
              <div className="flex items-center gap-3 px-5 py-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(124,58,237,0.08)' }}>
                  <Users className="w-4 h-4" style={{ color: '#7C3AED' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#8E87A8' }}>Categoría</p>
                  <p className="text-[13px] font-medium text-foreground">
                    {[memberMe.category, memberMe.tipo].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>
            )}

            {/* Ubicación */}
            {(user?.club?.city || user?.club?.department) && (
              <div className="flex items-center gap-3 px-5 py-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(124,58,237,0.08)' }}>
                  <MapPin className="w-4 h-4" style={{ color: '#7C3AED' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#8E87A8' }}>Ubicación</p>
                  <p className="text-[13px] font-medium text-foreground">
                    {[user.club.city, user.club.department].filter(Boolean).join(', ')}
                  </p>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
