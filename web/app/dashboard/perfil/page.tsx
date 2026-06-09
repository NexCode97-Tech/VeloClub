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
  Heart, MessageCircle, ChevronRight, Send, X, Camera, Users, Trash2, ImagePlus, MoreHorizontal,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MeResponse {
  status: string;
  user?: {
    id: string;
    clerkId: string;
    name: string;
    role: string;
    club?: { name: string; logoUrl?: string; city?: string; department?: string; verified?: boolean; deporte?: string };
    picture?: string | null;
    coverUrl?: string | null;
    createdAt?: string;
    category?: string;
    bio?: string;
  };
}

interface PostImage { id: string; imageUrl: string }

interface FollowStats {
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
}

interface PostLike { userId: string }
interface PostComment {
  id: string; authorName: string; authorRole: string;
  authorAvatar?: string | null; content: string; createdAt: string;
}
interface Post {
  id: string; clubId: string; clubName: string;
  authorName: string; authorRole: string; authorAvatar?: string | null;
  content: string; imageUrl?: string | null;
  scope: 'PUBLIC' | 'PRIVATE';
  likes: PostLike[]; comments: PostComment[]; createdAt: string;
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

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return 'Hace un momento';
  if (diff < 3600)  return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)}h`;
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

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

// ── PostCard mini ─────────────────────────────────────────────────────────────

function PostCard({ post, currentUserId, onLike, onComment, canDelete, onDelete }: {
  post: Post; currentUserId: string; canDelete: boolean;
  onLike: (id: string) => void;
  onDelete: (id: string) => void;
  onComment: (postId: string, content: string) => Promise<void>;
}) {
  const liked     = post.likes.some(l => l.userId === currentUserId);
  const likeCount = post.likes.length;
  const [likeAnim, setLikeAnim]         = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText]   = useState('');
  const [sending, setSending]           = useState(false);
  const [menuOpen, setMenuOpen]         = useState(false);
  const [confirmDel, setConfirmDel]     = useState(false);
  const menuRef    = useRef<HTMLDivElement>(null);
  const commentRef = useRef<HTMLInputElement>(null);

  // Cerrar dropdown al clic fuera
  useEffect(() => {
    if (!menuOpen) return;
    function close(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  function handleLike() {
    setLikeAnim(true); setTimeout(() => setLikeAnim(false), 500);
    onLike(post.id);
  }

  async function handleComment() {
    const text = commentText.trim(); if (!text) return;
    setSending(true);
    try { await onComment(post.id, text); setCommentText(''); }
    finally { setSending(false); }
  }

  const isVideo = post.imageUrl && /\.(mp4|webm|mov)(\?|$)/i.test(post.imageUrl);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-border rounded-2xl overflow-hidden"
      style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-3">
          <Avatar src={post.authorAvatar} name={post.authorName} size={40} role={post.authorRole} />
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[14px] font-bold text-foreground">{post.authorName}</p>
              {post.scope === 'PUBLIC'
                ? <Globe className="w-3 h-3 text-muted-foreground/40" />
                : <Lock className="w-3 h-3 text-muted-foreground/40" />}
            </div>
            <p className="text-[12px] text-muted-foreground">{timeAgo(post.createdAt)}</p>
          </div>
        </div>
        {canDelete && (
          <div ref={menuRef} className="relative">
            <button
              onClick={() => { setMenuOpen(v => !v); setConfirmDel(false); }}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-secondary transition-colors cursor-pointer"
              style={{ color: '#8E87A8' }}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            <AnimatePresence>
              {menuOpen && !confirmDel && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: -4 }}
                  transition={{ duration: 0.13, ease: [0.23, 1, 0.32, 1] }}
                  className="absolute right-0 top-9 z-30 rounded-xl overflow-hidden"
                  style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 148 }}
                >
                  <button
                    onClick={() => { setMenuOpen(false); setConfirmDel(true); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Eliminar
                  </button>
                  <button
                    onClick={() => setMenuOpen(false)}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold text-muted-foreground hover:bg-secondary transition-colors cursor-pointer border-t border-border/50"
                  >
                    <X className="w-3.5 h-3.5" /> Cancelar
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {confirmDel && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: -4 }}
                  transition={{ duration: 0.13, ease: [0.23, 1, 0.32, 1] }}
                  className="absolute right-0 top-9 z-30 rounded-xl overflow-hidden"
                  style={{ background: '#fff', border: '1px solid rgba(239,71,111,0.20)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 164 }}
                >
                  <p className="px-4 pt-3 pb-1 text-[11px] text-muted-foreground">¿Eliminar publicación?</p>
                  <div className="flex gap-2 px-3 pb-3 pt-1">
                    <button onClick={() => { onDelete(post.id); setConfirmDel(false); }}
                      className="flex-1 text-[11px] font-bold py-1.5 rounded-lg bg-red-500 text-white cursor-pointer active:scale-95 transition-transform">
                      Eliminar
                    </button>
                    <button onClick={() => setConfirmDel(false)}
                      className="flex-1 text-[11px] font-semibold py-1.5 rounded-lg bg-secondary text-muted-foreground cursor-pointer">
                      Cancelar
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Contenido */}
      <p className="px-4 py-3 text-[14px] text-foreground leading-relaxed whitespace-pre-wrap">{post.content}</p>

      {/* Media */}
      {post.imageUrl && (
        <div className="mb-3 overflow-hidden">
          {isVideo
            ? <video src={post.imageUrl} controls className="w-full" style={{ maxHeight: 360 }} />
            // eslint-disable-next-line @next/next/no-img-element
            : <img src={post.imageUrl} alt="Publicación" className="w-full object-cover" style={{ maxHeight: 360 }} />
          }
        </div>
      )}

      {/* Contadores */}
      {(likeCount > 0 || post.comments.length > 0) && (
        <div className="flex items-center gap-3 px-4 pb-2">
          {likeCount > 0 && <span className="text-[12px] text-muted-foreground">{likeCount} Me gusta</span>}
          {post.comments.length > 0 && <span className="text-[12px] text-muted-foreground">{post.comments.length} comentario{post.comments.length !== 1 ? 's' : ''}</span>}
        </div>
      )}

      {/* Acciones */}
      <div className="flex items-center border-t border-border/60">
        <motion.button onClick={handleLike} whileTap={{ scale: 0.95 }}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 hover:bg-secondary/60 transition-colors">
          <motion.div animate={likeAnim ? { scale: [1, 1.4, 1] } : { scale: 1 }} transition={{ duration: 0.35 }}>
            <Heart className="w-[17px] h-[17px]" fill={liked ? '#EF476F' : 'none'} style={{ color: liked ? '#EF476F' : '#8E87A8' }} />
          </motion.div>
          <span className="text-[13px] font-semibold" style={{ color: liked ? '#EF476F' : '#8E87A8' }}>Me gusta</span>
        </motion.button>
        <div className="w-px h-7 bg-border/60" />
        <motion.button whileTap={{ scale: 0.95 }}
          onClick={() => { setShowComments(v => !v); setTimeout(() => commentRef.current?.focus(), 150); }}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 hover:bg-secondary/60 transition-colors">
          <MessageCircle className="w-[17px] h-[17px]" style={{ color: showComments ? '#4361EE' : '#8E87A8' }} />
          <span className="text-[13px] font-semibold" style={{ color: showComments ? '#4361EE' : '#8E87A8' }}>Comentar</span>
        </motion.button>
        <div className="w-px h-7 bg-border/60" />
        <motion.button whileTap={{ scale: 0.95 }}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 hover:bg-secondary/60 transition-colors"
          onClick={() => { if (navigator.share) navigator.share({ text: post.content }); }}>
          <ChevronRight className="w-[17px] h-[17px] rotate-[-45deg]" style={{ color: '#8E87A8' }} />
          <span className="text-[13px] font-semibold text-muted-foreground">Compartir</span>
        </motion.button>
      </div>

      {/* Comentarios */}
      <AnimatePresence>
        {showComments && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} style={{ overflow: 'hidden' }}>
            <div className="px-4 pb-4 pt-3 border-t border-border/40 space-y-3" style={{ background: 'rgba(124,58,237,0.02)' }}>
              {post.comments.map(c => (
                <div key={c.id} className="flex items-start gap-2.5">
                  <Avatar src={c.authorAvatar} name={c.authorName} size={28} role={c.authorRole} />
                  <div className="rounded-2xl rounded-tl-sm px-3 py-2 flex-1"
                    style={{ background: '#fff', border: '1px solid rgba(124,58,237,0.08)' }}>
                    <p className="text-[11px] font-bold text-foreground mb-0.5">{c.authorName}</p>
                    <p className="text-[13px] text-foreground leading-snug">{c.content}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 rounded-full px-3 py-2"
                  style={{ background: '#fff', border: '1px solid rgba(124,58,237,0.12)' }}>
                  <input ref={commentRef} value={commentText} onChange={e => setCommentText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleComment(); } }}
                    placeholder="Escribe un comentario..."
                    className="flex-1 text-[13px] outline-none bg-transparent placeholder:text-muted-foreground/50" />
                </div>
                <motion.button onClick={handleComment} disabled={!commentText.trim() || sending}
                  whileTap={{ scale: 0.9 }}
                  className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg,#7C3AED,#4361EE)' }}>
                  {sending
                    ? <div className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                    : <Send className="w-3.5 h-3.5 text-white" />}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = ['Publicaciones', 'Fotos', 'Acerca de'] as const;
type Tab = typeof TABS[number];

// ── Main ──────────────────────────────────────────────────────────────────────

export default function PerfilPage() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { session } = useSession();
  const router = useRouter();

  const [me, setMe]               = useState<MeResponse | null>(null);
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
        const [meRes, postsRes] = await Promise.allSettled([
          apiFetch<MeResponse>('/me', { token }),
          apiFetch<{ posts: Post[] }>('/posts?scope=public', { token }),
        ]);
        if (meRes.status === 'fulfilled') {
          setMe(meRes.value);
          setCoverUrl(meRes.value.user?.coverUrl ?? null);
          myNameRef.current = meRes.value.user?.name ?? '';
        }
        if (postsRes.status === 'fulfilled') {
          setPosts(postsRes.value.posts.filter(p => !myNameRef.current || p.authorName === myNameRef.current));
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

          {/* Nombre y rol */}
          <div className="mt-3">
            <h1 className="text-[24px] font-semibold text-foreground leading-tight"
              style={{ fontFamily: 'inherit' }}>
              {user?.name ?? 'Usuario'}
            </h1>
            <span className="inline-block mt-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full tracking-widest"
              style={{ background: rc.bg, color: rc.text }}>
              {roleLabels[role] ?? role}
            </span>
          </div>

          {/* Stats: Publicaciones · Seguidores · Siguiendo */}
          <div className="flex items-center gap-6 mt-4">
            <div className="text-center">
              <p className="text-[18px] font-bold text-foreground leading-none" style={{ fontFamily: 'inherit' }}>{posts.length}</p>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#8E87A8', marginTop: 2 }}>Publicaciones</p>
            </div>
            <div className="text-center">
              <p className="text-[18px] font-bold text-foreground leading-none" style={{ fontFamily: 'inherit' }}>{followStats.followersCount}</p>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#8E87A8', marginTop: 2 }}>Seguidores</p>
            </div>
            <div className="text-center">
              <p className="text-[18px] font-bold text-foreground leading-none" style={{ fontFamily: 'inherit' }}>{followStats.followingCount}</p>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#8E87A8', marginTop: 2 }}>Siguiendo</p>
            </div>
          </div>

          {/* Bio */}
          {user?.bio && (
            <p className="mt-3 text-[13px] text-foreground/80 leading-relaxed max-w-lg">{user.bio}</p>
          )}

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3">
            {user?.club?.name && (
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 shrink-0" style={{ color: '#8E87A8' }} />
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
        </div>
      </motion.div>

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-border sticky top-0 z-10">
        {/* Fila principal */}
        <div className="flex">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 py-3.5 relative transition-colors"
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

      </div>

      {/* ── Contenido del tab ─────────────────────────────────────────────────── */}
      <div className="w-full px-4 sm:px-6 py-4 max-w-2xl">
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

          {activeTab === 'Acerca de' && (
            <motion.div key="about"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}
              className="mt-4 space-y-3">
              <div className="bg-white border border-border rounded-2xl divide-y divide-border"
                style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                {[
                  { label: 'Nombre', value: user?.name },
                  { label: 'Rol', value: roleLabels[role] ?? role },
                  { label: 'Club', value: user?.club?.name },
                  { label: 'Categoría', value: user?.category },
                  { label: 'Ciudad', value: [user?.club?.city, user?.club?.department].filter(Boolean).join(', ') || undefined },
                  { label: 'Miembro desde', value: user?.createdAt ? formatJoinDate(user.createdAt) : undefined },
                ].filter(r => r.value).map(row => (
                  <div key={row.label} className="flex items-center justify-between px-4 py-3">
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{row.label}</span>
                    <span className="text-[13px] font-semibold text-foreground text-right max-w-[55%] truncate">{row.value}</span>
                  </div>
                ))}
              </div>

              <Link href="/dashboard/ajustes">
                <motion.div whileTap={{ scale: 0.98 }}
                  className="flex items-center justify-between px-4 py-3.5 bg-white border border-border rounded-2xl cursor-pointer hover:bg-secondary transition-colors mt-3"
                  style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: 'rgba(124,58,237,0.10)' }}>
                      <Pencil className="w-4 h-4" style={{ color: '#7C3AED' }} />
                    </div>
                    <span className="text-[14px] font-semibold text-foreground">Editar información</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                </motion.div>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
