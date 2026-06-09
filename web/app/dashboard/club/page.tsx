'use client';

import { useAuth, useSession } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '@/lib/api-client';
import { MemberAvatar } from '@/components/ui/member-avatar';
import { MapPin, Camera, Pencil, Trash2, ImagePlus, BadgeCheck, Users, Lock } from 'lucide-react';
import Link from 'next/link';
import { PostCard, Post, PostComment } from '@/components/ui/post-card';

const ROLE_GRADIENT: Record<string, string> = {
  SUPERADMIN: 'linear-gradient(135deg,#EF476F,#C1121F)',
  ADMIN:      'linear-gradient(135deg,#FFB703,#FB8500)',
  COACH:      'linear-gradient(135deg,#06D6A0,#0CB68D)',
  STUDENT:    'linear-gradient(135deg,#7C3AED,#A855F7)',
};

interface ClubMember {
  id: string; fullName: string; pictureUrl?: string | null;
  role: string; clerkId?: string | null;
}

interface ClubProfile {
  id: string; name: string; city?: string | null; department?: string | null;
  deporte?: string | null; logoUrl?: string | null; coverUrl?: string | null;
  verified: boolean; createdAt: string; description?: string | null;
  _count: { members: number };
}

const TABS = ['Publicaciones', 'Miembros'] as const;
type Tab = typeof TABS[number];

export default function ClubProfilePage() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { session } = useSession();
  const router = useRouter();

  const [club, setClub]                   = useState<ClubProfile | null>(null);
  const [members, setMembers]             = useState<ClubMember[]>([]);
  const [followersCount, setFollowers]    = useState(0);
  const [loading, setLoading]             = useState(true);
  const [userRole, setUserRole]           = useState<string>('');
  const [coverUrl, setCoverUrl]           = useState<string | null>(null);
  const [uploadingCover, setUploadingCover]   = useState(false);
  const [coverMenuOpen, setCoverMenuOpen]     = useState(false);
  const [deletingCover, setDeletingCover]     = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [posts, setPosts]                 = useState<Post[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [activeTab, setActiveTab]         = useState<Tab>('Publicaciones');
  const [description, setDescription]     = useState<string>('');
  const [editingDesc, setEditingDesc]     = useState(false);
  const [descDraft, setDescDraft]         = useState('');
  const [savingDesc, setSavingDesc]       = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { router.push('/sign-in'); return; }
    (async () => {
      try {
        const token = await session?.getToken();
        const [meRes, clubRes, postsRes] = await Promise.allSettled([
          apiFetch<{ status: string; user?: { role: string } }>('/me', { token }),
          apiFetch<{ club: ClubProfile; members: ClubMember[]; followersCount: number }>(
            '/clubs/profile', { token }
          ),
          apiFetch<{ posts: Post[] }>('/posts?scope=private', { token }),
        ]);
        if (meRes.status === 'fulfilled') setUserRole(meRes.value.user?.role ?? '');
        if (clubRes.status === 'fulfilled') {
          setClub(clubRes.value.club);
          setCoverUrl(clubRes.value.club.coverUrl ?? null);
          setMembers(clubRes.value.members);
          setFollowers(clubRes.value.followersCount);
          setDescription(clubRes.value.club.description ?? '');
        }
        if (postsRes.status === 'fulfilled') setPosts(postsRes.value.posts);
        setCurrentUserId(userId ?? '');
      } catch { /* silencioso */ }
      finally { setLoading(false); }
    })();
  }, [isLoaded, isSignedIn, session, router, userId]);

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

  async function handleDelete(postId: string) {
    const token = await session?.getToken();
    await apiFetch(`/posts/${postId}`, { token, method: 'DELETE' });
    setPosts(prev => prev.filter(p => p.id !== postId));
  }

  async function saveDescription() {
    setSavingDesc(true);
    try {
      const token = await session?.getToken();
      const res = await apiFetch<{ description: string | null }>('/clubs/description', {
        method: 'PATCH', token, body: JSON.stringify({ description: descDraft }),
      });
      setDescription(res.description ?? '');
      setEditingDesc(false);
    } catch { /* silencioso */ }
    finally { setSavingDesc(false); }
  }

  async function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('La imagen no puede superar 5MB'); return; }
    setUploadingCover(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      try {
        const token = await session?.getToken();
        const res = await apiFetch<{ coverUrl: string }>('/clubs/cover', {
          method: 'POST', token, body: JSON.stringify({ base64 }),
        });
        setCoverUrl(res.coverUrl);
      } catch (err) {
        alert('Error al subir la portada: ' + (err instanceof Error ? err.message : 'intenta de nuevo'));
      } finally { setUploadingCover(false); }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: '#7C3AED', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!club) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-[14px] text-muted-foreground">Club no encontrado</p>
      </div>
    );
  }

  const isAdmin = userRole === 'ADMIN';

  return (
    <div className="min-h-full bg-background">

      {/* ── Header del club ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        className="bg-white border-b border-border"
        style={{ boxShadow: '0 1px 12px rgba(0,0,0,0.06)' }}
      >
        {/* Banner portada — sin overflow-hidden para que el logo sobresalga */}
        <div className="relative h-36 sm:h-48"
          style={{ background: coverUrl ? undefined : 'linear-gradient(135deg, #4361EE 0%, #7C3AED 60%, #06D6A0 100%)' }}>
          {coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt="Portada" className="absolute inset-0 w-full h-full object-cover" />
          )}
          {!coverUrl && (
            <div className="absolute inset-0 opacity-10"
              style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          )}
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.22) 100%)' }} />

          {/* Botón portada — solo ADMIN */}
          {isAdmin && (
            <div className="absolute top-3 right-3">
              <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
              {!coverUrl ? (
                <motion.button whileTap={{ scale: 0.95 }}
                  onClick={() => !uploadingCover && coverInputRef.current?.click()}
                  disabled={uploadingCover}
                  className="flex items-center justify-center w-9 h-9 rounded-xl text-white cursor-pointer disabled:opacity-60"
                  style={{ background: 'rgba(255,255,255,0.20)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.30)' }}>
                  {uploadingCover
                    ? <div className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                    : <Camera className="w-3.5 h-3.5" />}
                </motion.button>
              ) : (
                <div className="relative">
                  <motion.button whileTap={{ scale: 0.95 }}
                    onClick={() => !uploadingCover && !deletingCover && setCoverMenuOpen(v => !v)}
                    disabled={uploadingCover || deletingCover}
                    className="flex items-center justify-center w-9 h-9 rounded-xl text-white cursor-pointer disabled:opacity-60"
                    style={{ background: 'rgba(255,255,255,0.20)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.30)' }}>
                    {(uploadingCover || deletingCover)
                      ? <div className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                      : <Pencil className="w-3.5 h-3.5" />}
                  </motion.button>
                  {coverMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setCoverMenuOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.92, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="absolute right-0 top-11 z-50 min-w-[160px] rounded-xl overflow-hidden"
                        style={{ background: 'white', boxShadow: '0 8px 24px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)' }}>
                        <button onClick={() => { setCoverMenuOpen(false); coverInputRef.current?.click(); }}
                          className="flex items-center gap-2.5 w-full px-4 py-2.5 text-[13px] font-medium text-foreground hover:bg-muted/60 transition-colors cursor-pointer">
                          <ImagePlus className="w-4 h-4 text-muted-foreground" /> Cambiar foto
                        </button>
                        <button
                          onClick={async () => {
                            setCoverMenuOpen(false); setDeletingCover(true);
                            try {
                              const token = await session?.getToken();
                              await apiFetch('/clubs/cover', { method: 'DELETE', token });
                              setCoverUrl(null);
                            } catch (err) {
                              alert('Error: ' + (err instanceof Error ? err.message : 'intenta de nuevo'));
                            } finally { setDeletingCover(false); }
                          }}
                          className="flex items-center gap-2.5 w-full px-4 py-2.5 text-[13px] font-medium text-red-500 hover:bg-red-50 transition-colors cursor-pointer border-t border-border">
                          <Trash2 className="w-4 h-4" /> Eliminar
                        </button>
                      </motion.div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Info del club */}
        <div className="px-5 pb-5 max-w-4xl mx-auto w-full">
          {/* Logo — sobresale el banner, mismo patrón que avatar de perfil */}
          <div className="flex items-end justify-between" style={{ marginTop: -60 }}>
            <div className="relative z-10">
              {/* Mobile: 120px | Desktop: 140px */}
              <div
                className="rounded-full border-4 border-white overflow-hidden sm:w-[140px] sm:h-[140px]"
                style={{
                  width: 120, height: 120,
                  boxShadow: '0 4px 16px rgba(67,97,238,0.22)',
                  background: club.logoUrl ? undefined : 'linear-gradient(135deg,#4361EE,#7C3AED)',
                }}>
                {club.logoUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={club.logoUrl} alt={club.name} className="w-full h-full object-cover" />
                  : (
                    <div className="w-full h-full flex items-center justify-center text-white font-bold"
                      style={{ fontSize: 44 }}>
                      {club.name.charAt(0).toUpperCase()}
                    </div>
                  )
                }
              </div>
              {/* Badge verificado — esquina inferior derecha */}
              {club.verified && (
                <div className="absolute bottom-0.5 right-0.5 rounded-full border-2 border-white flex items-center justify-center"
                  style={{ width: 28, height: 28, background: '#4361EE' }}>
                  <BadgeCheck className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
          </div>

          {/* Nombre del club */}
          <div className="mt-3 flex items-center gap-2">
            <h1 className="text-[24px] font-semibold text-foreground leading-tight">
              {club.name}
            </h1>
          </div>
          {club.deporte && (
            <span className="inline-block mt-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full tracking-widest uppercase"
              style={{ background: 'rgba(67,97,238,0.10)', color: '#4361EE' }}>
              {club.deporte}
            </span>
          )}

          {/* Descripción del club */}
          <div className="mt-3 max-w-lg">
            {editingDesc ? (
              <div className="flex flex-col gap-2">
                <textarea
                  autoFocus
                  value={descDraft}
                  onChange={e => setDescDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') setEditingDesc(false); }}
                  maxLength={300}
                  rows={3}
                  placeholder="Describe tu club..."
                  className="w-full text-[13px] leading-relaxed rounded-xl px-3 py-2 outline-none resize-none"
                  style={{ background: 'rgba(67,97,238,0.05)', border: '1.5px solid rgba(67,97,238,0.25)', color: '#1A1028' }}
                />
                <div className="flex items-center gap-2">
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={saveDescription}
                    disabled={savingDesc}
                    className="px-4 py-1.5 rounded-lg text-[12px] font-bold text-white disabled:opacity-60 cursor-pointer"
                    style={{ background: 'linear-gradient(135deg,#4361EE,#7C3AED)' }}>
                    {savingDesc ? 'Guardando…' : 'Guardar'}
                  </motion.button>
                  <button onClick={() => setEditingDesc(false)}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-muted-foreground hover:bg-secondary transition-colors cursor-pointer">
                    Cancelar
                  </button>
                  <span className="ml-auto text-[11px] text-muted-foreground/50">{descDraft.length}/300</span>
                </div>
              </div>
            ) : (
              <div
                onClick={() => { if (isAdmin) { setDescDraft(description); setEditingDesc(true); } }}
                className={`group ${isAdmin ? 'cursor-pointer' : ''}`}>
                {description ? (
                  <p className="text-[13px] text-foreground/75 leading-relaxed">
                    {description}
                    {isAdmin && (
                      <Pencil className="inline-block ml-1.5 w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity" />
                    )}
                  </p>
                ) : isAdmin ? (
                  <p className="text-[13px] text-muted-foreground/50 italic hover:text-muted-foreground/70 transition-colors">
                    + Agregar descripción del club
                  </p>
                ) : null}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6 mt-4">
            <div className="text-center">
              <p className="text-[18px] font-bold text-foreground leading-none">{posts.length}</p>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#8E87A8', marginTop: 2 }}>Publicaciones</p>
            </div>
            <div className="text-center">
              <p className="text-[18px] font-bold text-foreground leading-none">{followersCount}</p>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#8E87A8', marginTop: 2 }}>Seguidores</p>
            </div>
            <div className="text-center">
              <p className="text-[18px] font-bold text-foreground leading-none">{club._count.members}</p>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#8E87A8', marginTop: 2 }}>Miembros</p>
            </div>
          </div>

          {/* Ubicación */}
          {(club.city || club.department) && (
            <div className="flex items-center gap-1.5 mt-3">
              <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: '#8E87A8' }} />
              <span className="text-[12px] text-muted-foreground">
                {[club.city, club.department].filter(Boolean).join(', ')}
              </span>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Tabs ──────────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-border sticky top-0 z-10">
        <div className="flex">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 py-3.5 relative transition-colors"
              style={{ fontSize: 12, fontWeight: 700, color: activeTab === tab ? '#4361EE' : '#8E87A8' }}
            >
              {tab}
              {activeTab === tab && (
                <motion.div layoutId="club-tab-indicator"
                  className="absolute bottom-0 left-4 right-4 h-[2.5px] rounded-full"
                  style={{ background: '#4361EE' }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Contenido del tab ──────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">

        {/* Tab: Miembros */}
        {activeTab === 'Miembros' && (
          <motion.div key="miembros"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}
            className="px-4 sm:px-6 py-4 max-w-4xl mx-auto">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-3.5 h-3.5" style={{ color: '#8E87A8' }} />
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {club._count.members} miembro{club._count.members !== 1 ? 's' : ''}
              </p>
            </div>
            {members.length === 0 ? (
              <div className="rounded-2xl px-6 py-10 flex flex-col items-center text-center"
                style={{ background: 'linear-gradient(135deg,rgba(67,97,238,0.04),rgba(124,58,237,0.03))', border: '1px solid rgba(67,97,238,0.10)' }}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: 'linear-gradient(135deg,#4361EE,#7C3AED)' }}>
                  <Users className="w-6 h-6 text-white" />
                </div>
                <p className="text-[14px] font-bold text-foreground mb-1">Sin miembros activos</p>
                <p className="text-[12px] text-muted-foreground">Los miembros aprobados aparecerán aquí.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {members.map(m => (
                  <Link
                    key={m.id}
                    href={m.clerkId ? `/dashboard/perfil/${m.clerkId}` : '#'}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-secondary transition-colors cursor-pointer"
                  >
                    <div className="rounded-full overflow-hidden" style={{ width: 56, height: 56 }}>
                      <MemberAvatar
                        name={m.fullName}
                        photoUrl={m.pictureUrl}
                        gradient={ROLE_GRADIENT[m.role] ?? ROLE_GRADIENT.STUDENT}
                        size={56}
                      />
                    </div>
                    <p className="text-[11px] font-semibold text-foreground text-center leading-tight line-clamp-2">
                      {m.fullName.split(' ')[0]}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Tab: Publicaciones */}
        {activeTab === 'Publicaciones' && (
          <motion.div key="publicaciones"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}
            className="px-4 sm:px-6 py-4 w-full max-w-2xl sm:max-w-none mx-auto">
            <div className="flex items-center gap-2 mb-3">
              <Lock className="w-3.5 h-3.5" style={{ color: '#8E87A8' }} />
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Solo visibles para el club</p>
            </div>
            {posts.length === 0 ? (
              <div className="rounded-2xl px-6 py-10 flex flex-col items-center text-center"
                style={{ background: 'linear-gradient(135deg,rgba(67,97,238,0.04),rgba(124,58,237,0.03))', border: '1px solid rgba(67,97,238,0.10)' }}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: 'linear-gradient(135deg,#4361EE,#7C3AED)' }}>
                  <Lock className="w-6 h-6 text-white" />
                </div>
                <p className="text-[14px] font-bold text-foreground mb-1">Sin publicaciones del club aún</p>
                <p className="text-[12px] text-muted-foreground">
                  Las publicaciones privadas del club aparecerán aquí.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {posts.map(post => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUserId={currentUserId}
                    canDelete={isAdmin}
                    onLike={handleLike}
                    onComment={handleComment}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
