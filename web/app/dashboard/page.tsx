'use client';

import { useAuth, useSession } from '@clerk/nextjs';
import { useClubStream } from '@/hooks/useClubStream';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import { apiFetch } from '@/lib/api-client';
import { parseLocalDate } from '@/lib/utils';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, BellOff, Trophy, CalendarDays, Dumbbell,
  Plus, Heart, Trash2, Image as ImageIcon, X, Send,
  ChevronRight, Cake, Globe, Lock,
} from 'lucide-react';

// ── Interfaces ────────────────────────────────────────────────────────────────

interface MeResponse {
  status: 'ok' | 'superadmin' | 'complete_profile' | 'no_access' | 'inactive' | 'trial_expired';
  user?: { name: string; role: string; club?: { name: string; logoUrl?: string } };
  trial?: { daysLeft: number; endsAt: string } | null;
}

interface PostLike { userId: string }
interface Post {
  id: string;
  clubId: string;
  clubName: string;
  authorName: string;
  authorRole: string;
  authorAvatar?: string | null;
  content: string;
  imageUrl?: string | null;
  scope: 'PUBLIC' | 'PRIVATE';
  likes: PostLike[];
  createdAt: string;
}

type FeedScope = 'public' | 'private';

interface ProximoEvento {
  id: string; titulo: string; tipo: 'COMPETITION' | 'TRAINING'; fecha: Date; lugar?: string | null;
}

interface Cumpleanero {
  id: string; fullName: string; birthDate: string; pictureUrl?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const roleLabels: Record<string, string> = {
  SUPERADMIN: 'SUPER ADMIN',
  ADMIN:      'ADMINISTRADOR',
  COACH:      'ENTRENADOR',
  STUDENT:    'DEPORTISTA',
};

const roleColors: Record<string, { text: string; bg: string }> = {
  SUPERADMIN: { text: '#EF476F', bg: 'rgba(239,71,111,0.12)' },
  ADMIN:      { text: '#FFB703', bg: 'rgba(255,183,3,0.12)' },
  COACH:      { text: '#06D6A0', bg: 'rgba(6,214,160,0.12)' },
  STUDENT:    { text: '#7C3AED', bg: 'rgba(124,58,237,0.10)' },
};

function todayLabel() {
  const d = new Date();
  const day  = d.toLocaleDateString('es-CO', { weekday: 'long' });
  const rest = d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
  return `${day.charAt(0).toUpperCase() + day.slice(1)}, ${rest}`;
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)   return 'Hace un momento';
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)}h`;
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function isBirthdayToday(birthDateStr: string): boolean {
  const bd  = new Date(birthDateStr);
  const now = new Date();
  return bd.getMonth() === now.getMonth() && bd.getDate() === now.getDate();
}

function isBirthdayThisWeek(birthDateStr: string): boolean {
  const bd   = new Date(birthDateStr);
  const now  = new Date();
  const year = now.getFullYear();
  const bdThisYear = new Date(year, bd.getMonth(), bd.getDate());
  const diff = (bdThisYear.getTime() - now.getTime()) / 86_400_000;
  return diff >= 0 && diff <= 6;
}

// ── Framer variants ───────────────────────────────────────────────────────────

const feedVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const cardVariant = {
  hidden: { opacity: 0, y: 18 },
  show:   { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 320, damping: 28 } },
};

// ── Avatar inline ─────────────────────────────────────────────────────────────

function Avatar({ src, name, size = 36, role }: { src?: string | null; name: string; size?: number; role?: string }) {
  const rc = role ? (roleColors[role] ?? roleColors.ADMIN) : { text: '#7C3AED', bg: 'rgba(124,58,237,0.12)' };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} style={{ width: size, height: size, borderRadius: size / 2, objectFit: 'cover' }} />;
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: size / 2,
      background: rc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ fontSize: size * 0.35, fontWeight: 800, color: rc.text }}>{getInitials(name)}</span>
    </div>
  );
}

// ── PostCard ──────────────────────────────────────────────────────────────────

function PostCard({
  post, currentUserId, canDelete, onLike, onDelete,
}: {
  post: Post;
  currentUserId: string;
  canDelete: boolean;
  onLike: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const liked     = post.likes.some(l => l.userId === currentUserId);
  const likeCount = post.likes.length;
  const [confirmDel, setConfirmDel] = useState(false);
  const [likeAnim, setLikeAnim]     = useState(false);

  function handleLike() {
    setLikeAnim(true);
    setTimeout(() => setLikeAnim(false), 500);
    onLike(post.id);
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 10 }}
      animate={{ opacity: 1, scale: 1,    y: 0 }}
      exit={{    opacity: 0, scale: 0.95, y: -8 }}
      transition={{ type: 'spring' as const, stiffness: 300, damping: 26 }}
      layout
      className="bg-white border border-border rounded-2xl overflow-hidden"
      style={{ boxShadow: '0 2px 12px rgba(124,58,237,0.06)' }}
    >
      {/* Autor */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <Avatar src={post.authorAvatar} name={post.authorName} size={40} role={post.authorRole} />
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-[13px] font-bold text-foreground leading-tight">{post.authorName}</p>
              {post.scope === 'PUBLIC' && post.clubName && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(67,97,238,0.10)', color: '#4361EE' }}>
                  {post.clubName}
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">{timeAgo(post.createdAt)}</p>
          </div>
        </div>
        {canDelete && (
          <AnimatePresence mode="wait">
            {confirmDel ? (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-1.5"
              >
                <button
                  onClick={() => onDelete(post.id)}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-500 text-white active:scale-95 transition-transform"
                >Eliminar</button>
                <button
                  onClick={() => setConfirmDel(false)}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-secondary text-muted-foreground"
                >Cancelar</button>
              </motion.div>
            ) : (
              <motion.button
                key="trash"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setConfirmDel(true)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground/40 hover:bg-red-50 hover:text-red-400 active:scale-90 transition-all"
              >
                <Trash2 className="w-[15px] h-[15px]" />
              </motion.button>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Imagen */}
      {post.imageUrl && (
        <div className="mx-4 mb-3 rounded-xl overflow-hidden" style={{ maxHeight: 280 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.imageUrl}
            alt="Publicación"
            className="w-full h-full object-cover"
            style={{ maxHeight: 280 }}
          />
        </div>
      )}

      {/* Contenido */}
      <p className="px-4 pb-3 text-[14px] text-foreground leading-relaxed whitespace-pre-wrap">
        {post.content}
      </p>

      {/* Acciones */}
      <div className="flex items-center gap-2 px-4 pb-4 border-t border-border/60 pt-3">
        <motion.button
          onClick={handleLike}
          whileTap={{ scale: 0.85 }}
          transition={{ type: 'spring' as const, stiffness: 500, damping: 15 }}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors"
          style={{
            background: liked ? 'rgba(239,71,111,0.10)' : 'transparent',
          }}
        >
          <motion.div
            animate={likeAnim ? { scale: [1, 1.5, 1] } : { scale: 1 }}
            transition={{ duration: 0.4, ease: 'easeInOut' }}
          >
            <Heart
              className="w-[18px] h-[18px] transition-colors"
              fill={liked ? '#EF476F' : 'none'}
              style={{ color: liked ? '#EF476F' : '#8E87A8' }}
            />
          </motion.div>
          {likeCount > 0 && (
            <span className="text-[12px] font-semibold" style={{ color: liked ? '#EF476F' : '#8E87A8' }}>
              {likeCount}
            </span>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
}

// ── Composer (crear post) ─────────────────────────────────────────────────────

function PostComposer({
  userName, userRole, userAvatar, onSubmit, loading,
}: {
  userName: string; userRole: string; userAvatar?: string | null;
  onSubmit: (content: string, imageUrl?: string) => Promise<void>;
  loading: boolean;
}) {
  const [open, setOpen]       = useState(false);
  const [content, setContent] = useState('');
  const [imgUrl, setImgUrl]   = useState('');
  const [sending, setSending] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  async function handleSubmit() {
    const text = content.trim();
    if (!text) return;
    setSending(true);
    try {
      await onSubmit(text, imgUrl.trim() || undefined);
      setContent('');
      setImgUrl('');
      setOpen(false);
    } finally { setSending(false); }
  }

  return (
    <motion.div
      variants={cardVariant}
      className="bg-white border border-border rounded-2xl overflow-hidden"
      style={{ boxShadow: '0 2px 12px rgba(124,58,237,0.06)' }}
    >
      {/* Trigger row */}
      <button
        onClick={() => { setOpen(o => !o); setTimeout(() => textRef.current?.focus(), 100); }}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
      >
        <Avatar src={userAvatar} name={userName} size={38} role={userRole} />
        <div className="flex-1 rounded-full px-4 py-2 text-[13px] text-muted-foreground/60 font-medium"
          style={{ background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.10)' }}>
          ¿Qué quieres compartir con el club?
        </div>
        <div className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg,#7C3AED,#4361EE)' }}>
          <Plus className="w-4 h-4 text-white" />
        </div>
      </button>

      {/* Expanded composer */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-4 pb-4 space-y-3 border-t border-border/60 pt-3">
              <textarea
                ref={textRef}
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Escribe algo para el club..."
                rows={3}
                className="w-full rounded-xl px-4 py-3 text-[14px] text-foreground placeholder:text-muted-foreground/50 resize-none outline-none focus:ring-2 border border-border"
                style={{ background: 'rgba(124,58,237,0.03)' }}
              />

              {/* URL imagen opcional */}
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                <input
                  type="url"
                  value={imgUrl}
                  onChange={e => setImgUrl(e.target.value)}
                  placeholder="URL de imagen (opcional)"
                  className="flex-1 text-[12px] text-foreground outline-none border-b border-border pb-1 placeholder:text-muted-foreground/40 bg-transparent"
                />
                {imgUrl && (
                  <button onClick={() => setImgUrl('')} className="text-muted-foreground/40 hover:text-muted-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Acciones */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => { setOpen(false); setContent(''); setImgUrl(''); }}
                  className="text-[12px] font-semibold text-muted-foreground px-3 py-1.5 rounded-full hover:bg-secondary transition-colors"
                >Cancelar</button>
                <motion.button
                  onClick={handleSubmit}
                  disabled={!content.trim() || sending || loading}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: 'spring' as const, stiffness: 500, damping: 15 }}
                  className="flex items-center gap-2 px-5 py-2 rounded-full text-[13px] font-bold text-white disabled:opacity-50 transition-opacity"
                  style={{ background: 'linear-gradient(135deg,#7C3AED,#4361EE)' }}
                >
                  {sending
                    ? <div className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                    : <><Send className="w-3.5 h-3.5" /><span>Publicar</span></>
                  }
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { isLoaded, isSignedIn, userId, sessionId } = useAuth();
  const { session } = useSession();
  const router = useRouter();

  const [me, setMe]         = useState<MeResponse | null>(null);
  const [trial, setTrial]   = useState<{ daysLeft: number; endsAt: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Notifs
  const notifRef = useRef<HTMLDivElement>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<{
    type: 'overdue' | 'due_soon';
    memberName: string; memberId: string; paymentId: string;
    daysLate?: number; daysLeft?: number;
  }[]>([]);

  // Feed
  const [feedScope, setFeedScope]   = useState<FeedScope>('public');
  const [posts, setPosts]           = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);

  // Próximos eventos
  const [proximosEventos, setProximosEventos] = useState<ProximoEvento[]>([]);

  // Cumpleañeros
  const [cumpleaneros, setCumpleaneros] = useState<Cumpleanero[]>([]);

  // currentUserId (clerkId del usuario autenticado)
  const [currentUserId, setCurrentUserId] = useState('');

  // Close notif panel when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const fetchPosts = useCallback(async (scope: FeedScope = 'public') => {
    const token = await session?.getToken();
    setPostsLoading(true);
    try {
      const res = await apiFetch<{ posts: Post[] }>(`/posts?scope=${scope}`, { token });
      setPosts(res.posts);
    } catch { /* silencioso */ } finally {
      setPostsLoading(false);
    }
  }, [session]);

  // Recargar posts cuando cambia el tab
  useEffect(() => {
    if (session) fetchPosts(feedScope).catch(() => {});
  }, [feedScope, session]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { router.push('/sign-in'); return; }

    setMe(null); setLoading(true);

    (async () => {
      try {
        const token = await session?.getToken();
        const now   = new Date();
        const month = now.getMonth() + 1;
        const year  = now.getFullYear();

        const [
          meRes, notifRes, compRes, trainingRes, membersRes, postsRes,
        ] = await Promise.allSettled([
          apiFetch<MeResponse>('/me', { token }),
          apiFetch<{ notifications: typeof notifs }>('/payments/notifications', { token }),
          apiFetch<{ competitions: { id: string; name: string; date: string; place?: string | null; events: unknown[] }[] }>('/competitions', { token }),
          apiFetch<{ sessions: { id: string; title: string; date: string; location?: { name: string } | null }[] }>(`/training?month=${month}&year=${year}`, { token }),
          apiFetch<{ members: { id: string; fullName: string; birthDate?: string | null; pictureUrl?: string | null }[] }>('/members', { token }),
          apiFetch<{ posts: Post[] }>('/posts?scope=public', { token }),
        ]);

        if (meRes.status === 'rejected') return;
        const res = meRes.value;
        if (res.status === 'superadmin')       { router.push('/superadmin');       return; }
        if (res.status === 'no_access')        { router.push('/no-access');        return; }
        if (res.status === 'inactive')         { router.push('/inactivo');         return; }
        if (res.status === 'trial_expired')    { router.push('/trial-expirado');   return; }
        if (res.status === 'complete_profile') { router.push('/completar-perfil'); return; }
        setMe(res);
        setTrial(res.trial ?? null);

        // ClerkId actual — viene del token de Clerk
        const clerkId = userId ?? '';
        setCurrentUserId(clerkId);

        const role = res.user?.role ?? 'ADMIN';
        if (role === 'ADMIN' && notifRes.status === 'fulfilled') setNotifs(notifRes.value.notifications);

        // Posts
        if (postsRes.status === 'fulfilled') setPosts(postsRes.value.posts);

        // Próximos eventos
        const comps  = compRes.status === 'fulfilled' ? compRes.value.competitions : [];
        const trains = trainingRes.status === 'fulfilled' ? trainingRes.value.sessions : [];
        const futuros: ProximoEvento[] = [
          ...comps.map(c  => ({ id: c.id,  titulo: c.name,  tipo: 'COMPETITION' as const, fecha: parseLocalDate(c.date), lugar: c.place ?? null })),
          ...trains.map(s => ({ id: s.id,  titulo: s.title, tipo: 'TRAINING'     as const, fecha: parseLocalDate(s.date), lugar: s.location?.name ?? null })),
        ]
          .filter(e => e.fecha >= now)
          .sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
          .slice(0, 3);
        setProximosEventos(futuros);

        // Cumpleañeros esta semana
        if (membersRes.status === 'fulfilled') {
          const cumple = membersRes.value.members.filter(m =>
            m.birthDate && isBirthdayThisWeek(m.birthDate)
          ) as Cumpleanero[];
          // Ordenar: hoy primero
          cumple.sort((a, b) => {
            const aToday = isBirthdayToday(a.birthDate) ? 0 : 1;
            const bToday = isBirthdayToday(b.birthDate) ? 0 : 1;
            return aToday - bToday;
          });
          setCumpleaneros(cumple);
        }

      } catch { /* silencioso */ } finally {
        setLoading(false);
      }
    })();
  }, [isLoaded, isSignedIn, userId, sessionId]);

  // SSE tiempo real
  useClubStream((ev) => {
    if (!me?.user?.role) return;
    if (ev === 'posts') fetchPosts(feedScope).catch(() => {});
    if (['members', 'payments'].includes(ev) && me.user.role === 'ADMIN') {
      // recargar notificaciones
      (async () => {
        const token = await session?.getToken();
        const res = await apiFetch<{ notifications: typeof notifs }>('/payments/notifications', { token });
        setNotifs(res.notifications);
      })().catch(() => {});
    }
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleCreatePost(content: string, imageUrl?: string) {
    const token = await session?.getToken();
    const res = await apiFetch<{ post: Post }>('/posts', {
      token, method: 'POST',
      body: JSON.stringify({
        content,
        scope: feedScope === 'public' ? 'PUBLIC' : 'PRIVATE',
        ...(imageUrl ? { imageUrl } : {}),
      }),
    });
    setPosts(prev => [res.post, ...prev]);
  }

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

  async function handleDelete(postId: string) {
    const token = await session?.getToken();
    await apiFetch(`/posts/${postId}`, { token, method: 'DELETE' });
    setPosts(prev => prev.filter(p => p.id !== postId));
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: '#7C3AED', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const user      = me?.user;
  const role      = user?.role ?? 'ADMIN';
  const firstName = user?.name?.split(' ')[0] ?? '';
  const rc        = roleColors[role] ?? roleColors.ADMIN;
  const canPost   = role === 'ADMIN' || role === 'COACH';

  return (
    <div className="min-h-full bg-background">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        className="px-5 pt-5 pb-4 border-b border-border"
        style={{ background: 'linear-gradient(135deg,#fff 0%,#F0EEF8 100%)' }}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">{todayLabel()}</p>
              <div className="flex items-center gap-3">
                {/* Logo del club */}
                <div
                  className="w-14 h-14 rounded-2xl border border-border bg-secondary overflow-hidden flex items-center justify-center shrink-0"
                  style={{ boxShadow: '0 4px 12px rgba(67,97,238,0.15)' }}
                >
                  {user?.club?.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.club.logoUrl} alt="Logo" className="w-full h-full" style={{ objectFit: 'cover' }} />
                  ) : (
                    <span className="text-[18px] font-extrabold text-primary" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                      {(user?.club?.name ?? 'V').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <h1 className="text-[22px] font-extrabold text-foreground leading-tight" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                    ¡Hola, {firstName}! 👋
                  </h1>
                  <p className="text-[14px] font-semibold text-foreground/70 mt-0.5">{user?.club?.name ?? 'VeloClub'}</p>
                </div>
              </div>
              <span
                className="inline-block mt-2 text-[10px] font-bold px-2.5 py-0.5 rounded-full tracking-wider"
                style={{ background: rc.bg, color: rc.text }}
              >
                {roleLabels[role] ?? role}
              </span>
            </div>
          </div>

          {/* Notificaciones — solo ADMIN */}
          {role === 'ADMIN' && (
            <div className="relative mt-1" ref={notifRef}>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setNotifOpen(o => !o)}
                className={`w-9 h-9 rounded-full border border-border bg-white flex items-center justify-center relative transition-colors ${notifOpen ? 'bg-secondary' : ''}`}
              >
                <Bell className="w-[15px] h-[15px] text-muted-foreground" />
                {notifs.length > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring' as const, stiffness: 600, damping: 15 }}
                    className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center"
                  >
                    {notifs.length > 9 ? '9+' : notifs.length}
                  </motion.span>
                )}
              </motion.button>

              <AnimatePresence>
                {notifOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                    className="absolute right-0 top-11 w-72 bg-white border border-border rounded-2xl shadow-xl z-50 overflow-hidden"
                    style={{ transformOrigin: 'top right' }}
                  >
                    <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                      <p className="text-[13px] font-bold text-foreground">Notificaciones</p>
                      {notifs.length > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-500">
                          {notifs.length} alerta{notifs.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {notifs.length === 0 ? (
                      <div className="flex flex-col items-center py-8 px-4 text-center">
                        <BellOff className="w-8 h-8 mb-2 text-muted-foreground/30" />
                        <p className="text-[12px] font-semibold text-muted-foreground">Sin notificaciones</p>
                        <p className="text-[11px] text-muted-foreground/60 mt-0.5">Todo está al día</p>
                      </div>
                    ) : (
                      <div className="max-h-72 overflow-y-auto divide-y divide-border">
                        {notifs.map((n, i) => (
                          <Link
                            key={i}
                            href="/dashboard/finanzas"
                            onClick={() => setNotifOpen(false)}
                            className="flex items-start gap-3 px-4 py-3 hover:bg-secondary transition-colors"
                          >
                            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.type === 'overdue' ? 'bg-red-500' : 'bg-amber-400'}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-semibold text-foreground truncate">{n.memberName}</p>
                              <p className={`text-[11px] mt-0.5 ${n.type === 'overdue' ? 'text-red-500' : 'text-amber-500'}`}>
                                {n.type === 'overdue'
                                  ? `Vencido hace ${n.daysLate} día${n.daysLate !== 1 ? 's' : ''}`
                                  : n.daysLeft === 0 ? 'Vence hoy'
                                  : `Vence en ${n.daysLeft} día${n.daysLeft !== 1 ? 's' : ''}`}
                              </p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Banner trial ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {trial !== null && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          >
            <div
              className="mx-4 mt-3 rounded-2xl px-4 py-3 flex items-center gap-3"
              style={{
                background: trial.daysLeft <= 3 ? 'rgba(239,71,111,0.08)' : 'rgba(255,183,3,0.09)',
                border: `1px solid ${trial.daysLeft <= 3 ? 'rgba(239,71,111,0.20)' : 'rgba(255,183,3,0.25)'}`,
              }}
            >
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-[14px]"
                style={{ background: trial.daysLeft <= 3 ? 'rgba(239,71,111,0.12)' : 'rgba(255,183,3,0.15)' }}
              >{trial.daysLeft <= 3 ? '⚠️' : '🧪'}</div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold" style={{ color: trial.daysLeft <= 3 ? '#EF476F' : '#B88A00' }}>
                  {trial.daysLeft === 0
                    ? 'Tu período de prueba vence hoy'
                    : `Período de prueba · ${trial.daysLeft} día${trial.daysLeft !== 1 ? 's' : ''} restante${trial.daysLeft !== 1 ? 's' : ''}`}
                </p>
                {trial.daysLeft <= 3 && (
                  <p className="text-[11px] mt-0.5" style={{ color: '#EF476F', opacity: 0.8 }}>
                    Contacta a NexCode97 para activar tu plan
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Contenido principal ───────────────────────────────────────────── */}
      <motion.div
        variants={feedVariants}
        initial="hidden"
        animate="show"
        className="px-4 py-4 space-y-4"
      >

        {/* Tarjeta de dos columnas: Próximo evento + Cumpleaños */}
        {(proximosEventos.length > 0 || cumpleaneros.length > 0) && (
          <motion.div variants={cardVariant} className="grid grid-cols-2 gap-3">

            {/* Col izquierda — Próximo evento */}
            {proximosEventos.length > 0 ? (
              <Link href="/dashboard/calendario" className="block active:scale-[0.97] transition-transform">
                <div
                  className="h-full rounded-2xl p-3.5 flex flex-col gap-2"
                  style={{
                    background: proximosEventos[0].tipo === 'COMPETITION'
                      ? 'linear-gradient(135deg,rgba(239,71,111,0.09) 0%,rgba(239,71,111,0.03) 100%)'
                      : 'linear-gradient(135deg,rgba(67,97,238,0.09) 0%,rgba(67,97,238,0.03) 100%)',
                    border: `1px solid ${proximosEventos[0].tipo === 'COMPETITION' ? 'rgba(239,71,111,0.18)' : 'rgba(67,97,238,0.18)'}`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: proximosEventos[0].tipo === 'COMPETITION' ? 'rgba(239,71,111,0.15)' : 'rgba(67,97,238,0.15)',
                      }}
                    >
                      {proximosEventos[0].tipo === 'COMPETITION'
                        ? <Trophy className="w-4 h-4" style={{ color: '#EF476F' }} />
                        : <Dumbbell className="w-4 h-4" style={{ color: '#4361EE' }} />
                      }
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5 leading-none"
                      style={{ color: proximosEventos[0].tipo === 'COMPETITION' ? '#EF476F' : '#4361EE' }}>
                      Próximo evento
                    </p>
                    <p className="text-[12px] font-bold text-foreground leading-tight line-clamp-2">
                      {proximosEventos[0].titulo}
                    </p>
                    {proximosEventos[0].lugar && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{proximosEventos[0].lugar}</p>
                    )}
                  </div>
                  <p className="text-[13px] font-extrabold mt-auto"
                    style={{ color: proximosEventos[0].tipo === 'COMPETITION' ? '#EF476F' : '#4361EE', fontFamily: 'var(--font-space-grotesk)' }}>
                    {proximosEventos[0].fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              </Link>
            ) : <div />}

            {/* Col derecha — Cumpleaños esta semana */}
            {cumpleaneros.length > 0 ? (
              <div
                className="h-full rounded-2xl p-3.5 flex flex-col gap-2"
                style={{
                  background: 'linear-gradient(135deg,rgba(255,183,3,0.09) 0%,rgba(255,183,3,0.03) 100%)',
                  border: '1px solid rgba(255,183,3,0.20)',
                }}
              >
                <div className="flex items-center gap-1.5">
                  <Cake className="w-4 h-4 shrink-0" style={{ color: '#FFB703' }} />
                  <p className="text-[9px] font-bold uppercase tracking-widest leading-none" style={{ color: '#B88A00' }}>
                    Cumpleaños
                  </p>
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  {cumpleaneros.slice(0, 3).map(m => {
                    const today = isBirthdayToday(m.birthDate);
                    return (
                      <div key={m.id} className="flex items-center gap-1.5">
                        <Avatar src={m.pictureUrl} name={m.fullName} size={22} />
                        <span
                          className="text-[11px] font-semibold truncate"
                          style={{ color: today ? '#8A6300' : '#6B5000' }}
                        >
                          {m.fullName.split(' ')[0]}{today && ' 🎂'}
                        </span>
                      </div>
                    );
                  })}
                  {cumpleaneros.length > 3 && (
                    <p className="text-[10px] text-muted-foreground">+{cumpleaneros.length - 3} más</p>
                  )}
                </div>
              </div>
            ) : <div />}

          </motion.div>
        )}

        {/* ── Tabs Público / Privado ──────────────────────────────────────── */}
        <motion.div variants={cardVariant}>
          <div
            className="flex rounded-2xl p-1 gap-1"
            style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.10)' }}
          >
            {([
              { key: 'public'  as FeedScope, label: 'Público',  icon: Globe, desc: 'Todos los clubes' },
              { key: 'private' as FeedScope, label: 'Mi Club',   icon: Lock,  desc: 'Solo interno' },
            ] as const).map(tab => {
              const active = feedScope === tab.key;
              const Icon = tab.icon;
              return (
                <motion.button
                  key={tab.key}
                  onClick={() => setFeedScope(tab.key)}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring' as const, stiffness: 500, damping: 20 }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all"
                  style={active
                    ? { background: '#fff', boxShadow: '0 2px 10px rgba(124,58,237,0.15)' }
                    : {}
                  }
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: active ? '#7C3AED' : '#8E87A8' }} />
                  <div className="text-left">
                    <p className="text-[12px] font-bold leading-none" style={{ color: active ? '#7C3AED' : '#8E87A8' }}>
                      {tab.label}
                    </p>
                    <p className="text-[9px] leading-none mt-0.5" style={{ color: active ? '#9B72F0' : '#B0ABCA' }}>
                      {tab.desc}
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* Composer — solo ADMIN y COACH */}
        {canPost && (
          <PostComposer
            userName={user?.name ?? ''}
            userRole={role}
            userAvatar={undefined}
            onSubmit={handleCreatePost}
            loading={postsLoading}
          />
        )}

        {/* Feed */}
        {postsLoading && posts.length === 0 ? (
          <motion.div variants={cardVariant} className="flex flex-col items-center py-10 gap-3">
            <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: '#7C3AED', borderTopColor: 'transparent' }} />
            <p className="text-[12px] text-muted-foreground">Cargando publicaciones...</p>
          </motion.div>
        ) : posts.length === 0 ? (
          <motion.div variants={cardVariant}>
            <div
              className="rounded-2xl px-6 py-10 flex flex-col items-center text-center"
              style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.04) 0%,rgba(67,97,238,0.03) 100%)', border: '1px solid rgba(124,58,237,0.10)' }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'linear-gradient(135deg,#7C3AED,#4361EE)' }}
              >
                {feedScope === 'public' ? <Globe className="w-6 h-6 text-white" /> : <Lock className="w-6 h-6 text-white" />}
              </div>
              <p className="text-[14px] font-bold text-foreground mb-1">
                {feedScope === 'public' ? 'El feed público está vacío' : 'No hay publicaciones internas aún'}
              </p>
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                {canPost
                  ? feedScope === 'public'
                    ? 'Sé el primero en publicar algo visible para todos los clubes.'
                    : 'Comparte noticias o novedades exclusivas para tu club.'
                  : feedScope === 'public'
                    ? 'Aún no hay publicaciones públicas. Vuelve pronto.'
                    : 'Tu club no ha publicado nada aún.'}
              </p>
            </div>
          </motion.div>
        ) : (
          <AnimatePresence initial={false}>
            {posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={currentUserId}
                canDelete={canPost}
                onLike={handleLike}
                onDelete={handleDelete}
              />
            ))}
          </AnimatePresence>
        )}

      </motion.div>
    </div>
  );
}
