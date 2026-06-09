'use client';

import { useAuth, useSession } from '@clerk/nextjs';
import { useClubStream } from '@/hooks/useClubStream';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { apiFetch } from '@/lib/api-client';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, BellOff,
  Heart, Image as ImageIcon, X, SendHorizontal,
  Globe, Lock, MessageCircle,
  Paperclip, Video, FileText,
  MoreHorizontal, Pencil, Trash2,
  ChevronRight, CalendarDays, Trophy, Users, Gift,
} from 'lucide-react';
import { Slideshow } from '@/components/ui/slideshow';
import { MemberAvatar } from '@/components/ui/member-avatar';

// ── Interfaces ────────────────────────────────────────────────────────────────

interface MeResponse {
  status: 'ok' | 'superadmin' | 'complete_profile' | 'no_access' | 'inactive' | 'trial_expired';
  user?: { name: string; role: string; picture?: string | null; club?: { name: string; logoUrl?: string } };
  trial?: { daysLeft: number; endsAt: string } | null;
}

interface PostLike { userId: string }
interface LikeUser { name: string; picture?: string | null; role?: string }
interface PostComment {
  id: string;
  authorName: string;
  authorRole: string;
  authorAvatar?: string | null;
  content: string;
  createdAt: string;
}
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
  comments: PostComment[];
  createdAt: string;
}

type FeedScope = 'public' | 'private';

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

// ── Ads (placeholder — reemplazar con datos reales desde API) ────────────────

const ADS = [
  {
    image: '/foto-equipamiento.jpg',
    label: 'Equipamiento',
    title: 'Nueva Colección Deportiva 2025',
    description: 'Descubre la línea de ropa técnica diseñada para ciclistas de alto rendimiento. Tejidos transpirables, corte aerodinámico y protección UV para cada etapa.',
    url: '#',
    color: '#7C3AED',
  },
  {
    image: '/foto-academia.jpg',
    label: 'Academia',
    title: 'Academia de Alto Rendimiento',
    description: 'Programas de entrenamiento personalizados con los mejores coaches del país. Metodología basada en datos, seguimiento semanal y planes adaptados a tu nivel.',
    url: '#',
    color: '#4361EE',
  },
  {
    image: '/foto-nutricion.png',
    label: 'Nutrición',
    title: 'Plan Nutricional para Deportistas',
    description: 'Optimiza tu rendimiento con planes de alimentación diseñados para atletas. Incluye recetas, guías de hidratación y suplementación estratégica por fase de entrenamiento.',
    url: '#',
    color: '#06D6A0',
  },
  {
    image: '/foto-bicicleta.jpg',
    label: 'Ciclismo',
    title: 'Trek & Specialized — Tienda Oficial',
    description: 'Las marcas líderes del ciclismo mundial en un solo lugar. Bicicletas de ruta, MTB, accesorios y componentes con garantía oficial y asesoría especializada.',
    url: '#',
    color: '#EF476F',
  },
  {
    image: '/foto-hidratacion.png',
    label: 'Hidratación',
    title: 'Hidratación Profesional Deportiva',
    description: 'Isotónicos, geles energéticos y suplementos formulados para resistencia y recuperación. Soluciones probadas por atletas de élite para antes, durante y después del esfuerzo.',
    url: '#',
    color: '#FFB703',
  },
];

// ── Framer variants ───────────────────────────────────────────────────────────

const feedVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const cardVariant = {
  hidden: { opacity: 0, y: 18 },
  show:   { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 320, damping: 28 } },
};

// ── Gradientes por rol (mismo que Miembros) ───────────────────────────────────
const ROLE_GRADIENT: Record<string, string> = {
  SUPERADMIN: 'linear-gradient(135deg,#EF476F,#C1121F)',
  ADMIN:      'linear-gradient(135deg,#FFB703,#FB8500)',
  COACH:      'linear-gradient(135deg,#06D6A0,#0CB68D)',
  STUDENT:    'linear-gradient(135deg,#7C3AED,#A855F7)',
};

// ── Avatar wrapper que usa MemberAvatar con gradiente por rol ─────────────────
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


// ── PostCard ──────────────────────────────────────────────────────────────────

function PostCard({
  post, currentUserId, canDelete, onLike, onDelete, onComment, onDeleteComment, onEditComment, onFetchLikes,
}: {
  post: Post; currentUserId: string; canDelete: boolean;
  onLike: (id: string) => void;
  onDelete: (id: string) => void;
  onComment: (postId: string, content: string) => Promise<void>;
  onDeleteComment: (postId: string, commentId: string) => void;
  onEditComment: (postId: string, commentId: string, content: string) => Promise<void>;
  onFetchLikes: (postId: string) => Promise<LikeUser[]>;
}) {
  const liked     = post.likes.some(l => l.userId === currentUserId);
  const likeCount = post.likes.length;
  const [postMenuOpen, setPostMenuOpen] = useState(false);
  const [confirmDel, setConfirmDel]     = useState(false);
  const [likeAnim, setLikeAnim]         = useState(false);
  const postMenuRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdown del post al clic fuera
  useEffect(() => {
    if (!postMenuOpen) return;
    function close(e: MouseEvent) {
      if (postMenuRef.current && !postMenuRef.current.contains(e.target as Node)) setPostMenuOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [postMenuOpen]);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);

  // Popover de likes
  const [showLikesPopover, setShowLikesPopover] = useState(false);
  const [likeUsers, setLikeUsers]               = useState<LikeUser[]>([]);
  const [loadingLikes, setLoadingLikes]         = useState(false);
  const likesButtonRef = useRef<HTMLButtonElement>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);

  async function handleShowLikes() {
    if (showLikesPopover) { setShowLikesPopover(false); return; }
    // Calcular posición antes de mostrar
    if (likesButtonRef.current) {
      const rect = likesButtonRef.current.getBoundingClientRect();
      setPopoverPos({ top: rect.bottom + 6, left: rect.left });
    }
    setShowLikesPopover(true);
    if (likeUsers.length === 0) {
      setLoadingLikes(true);
      try {
        const users = await onFetchLikes(post.id);
        setLikeUsers(users);
      } finally { setLoadingLikes(false); }
    }
  }

  // Menú ⋯ por comentario
  const [commentMenu, setCommentMenu]       = useState<string | null>(null); // commentId con menú abierto
  const [editingComment, setEditingComment] = useState<string | null>(null); // commentId en modo edición
  const [editText, setEditText]             = useState('');
  const [savingEdit, setSavingEdit]         = useState(false);

  async function handleSaveEdit(commentId: string) {
    if (!editText.trim()) return;
    setSavingEdit(true);
    try {
      await onEditComment(post.id, commentId, editText.trim());
      setEditingComment(null);
    } finally { setSavingEdit(false); }
  }

  function handleLike() {
    setLikeAnim(true);
    setTimeout(() => setLikeAnim(false), 500);
    onLike(post.id);
  }

  async function handleComment() {
    const text = commentText.trim();
    if (!text) return;
    setSendingComment(true);
    try {
      await onComment(post.id, text);
      setCommentText('');
    } finally { setSendingComment(false); }
  }

  // Detectar si media es video por extensión o URL
  const isVideo = post.imageUrl && /\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(post.imageUrl);
  const isFile  = post.imageUrl && !isVideo && /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar)(\?|$)/i.test(post.imageUrl);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 10 }}
      animate={{ opacity: 1, scale: 1,    y: 0 }}
      exit={{    opacity: 0, scale: 0.95, y: -8 }}
      transition={{ type: 'spring' as const, stiffness: 300, damping: 26 }}
      layout
      className="bg-white border border-border rounded-2xl overflow-hidden"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(0,0,0,0.06)' }}
    >
      {/* Autor */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-3">
          <Avatar src={post.authorAvatar} name={post.authorName} size={42} role={post.authorRole} />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[14px] font-bold text-foreground leading-tight">{post.authorName || 'Usuario'}</p>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                style={{ background: 'rgba(124,58,237,0.10)', color: '#7C3AED' }}>
                {roleLabels[post.authorRole] ?? post.authorRole}
              </span>
              {post.scope === 'PUBLIC' && post.clubName && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(67,97,238,0.10)', color: '#4361EE' }}>
                  {post.clubName}
                </span>
              )}
            </div>
            <p className="text-[12px] text-muted-foreground mt-0.5">{timeAgo(post.createdAt)}</p>
          </div>
        </div>
        {canDelete && (
          <div ref={postMenuRef} className="relative">
            <button
              onClick={() => { setPostMenuOpen(v => !v); setConfirmDel(false); }}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-secondary active:scale-90 transition-all cursor-pointer"
              style={{ color: '#8E87A8' }}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            <AnimatePresence>
              {postMenuOpen && !confirmDel && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: -4 }}
                  transition={{ duration: 0.13, ease: [0.23, 1, 0.32, 1] }}
                  className="absolute right-0 top-9 z-30 rounded-xl overflow-hidden"
                  style={{
                    background: '#fff',
                    border: '1px solid rgba(0,0,0,0.08)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    minWidth: 148,
                  }}
                >
                  <button
                    onClick={() => { setPostMenuOpen(false); setConfirmDel(true); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Eliminar
                  </button>
                  <button
                    onClick={() => setPostMenuOpen(false)}
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
                  style={{
                    background: '#fff',
                    border: '1px solid rgba(239,71,111,0.20)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    minWidth: 164,
                  }}
                >
                  <p className="px-4 pt-3 pb-1 text-[11px] text-muted-foreground">¿Eliminar publicación?</p>
                  <div className="flex gap-2 px-3 pb-3 pt-1">
                    <button
                      onClick={() => { onDelete(post.id); setConfirmDel(false); }}
                      className="flex-1 text-[11px] font-bold py-1.5 rounded-lg bg-red-500 text-white cursor-pointer active:scale-95 transition-transform"
                    >
                      Eliminar
                    </button>
                    <button
                      onClick={() => setConfirmDel(false)}
                      className="flex-1 text-[11px] font-semibold py-1.5 rounded-lg bg-secondary text-muted-foreground cursor-pointer"
                    >
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
          {isVideo ? (
            <video src={post.imageUrl} controls className="w-full" style={{ maxHeight: 360 }} />
          ) : isFile ? (
            <a href={post.imageUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 mx-4 px-4 py-3 rounded-xl border border-border hover:bg-secondary transition-colors">
              <FileText className="w-5 h-5 shrink-0" style={{ color: '#4361EE' }} />
              <span className="text-[13px] font-semibold text-foreground truncate">Ver archivo adjunto</span>
            </a>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.imageUrl} alt="Publicación" className="w-full object-cover" style={{ maxHeight: 360 }} />
          )}
        </div>
      )}

      {/* Contadores clicables */}
      {(likeCount > 0 || post.comments.length > 0) && (
        <div className="relative flex items-center gap-3 px-4 pb-2">
          {likeCount > 0 && (
            <button
              ref={likesButtonRef}
              onClick={handleShowLikes}
              className="text-[12px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {likeCount} Me gusta
            </button>
          )}
          {post.comments.length > 0 && (
            <button
              onClick={() => { setShowComments(true); setTimeout(() => commentInputRef.current?.focus(), 150); }}
              className="text-[12px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {post.comments.length} comentario{post.comments.length !== 1 ? 's' : ''}
            </button>
          )}

          {/* Popover de likes — renderizado en portal para evitar overflow clipping */}
          {showLikesPopover && popoverPos && typeof document !== 'undefined' && createPortal(
            <AnimatePresence>
              <>
                <div className="fixed inset-0 z-[9998]" onClick={() => setShowLikesPopover(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.93, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.93, y: -6 }}
                  transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
                  style={{
                    position: 'fixed',
                    top: popoverPos.top,
                    left: popoverPos.left,
                    zIndex: 9999,
                    background: '#fff',
                    border: '1px solid rgba(124,58,237,0.12)',
                    borderRadius: 14,
                    boxShadow: '0 8px 28px rgba(0,0,0,0.13)',
                    minWidth: 180,
                    maxWidth: 240,
                    padding: '10px 0',
                  }}
                >
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-3.5 mb-2">
                    Les gustó a
                  </p>
                  {loadingLikes ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#7C3AED', borderTopColor: 'transparent' }} />
                    </div>
                  ) : likeUsers.length === 0 ? (
                    <p className="text-[12px] text-muted-foreground px-3.5 py-2">Sin datos</p>
                  ) : (
                    <div className="flex flex-col">
                      {likeUsers.map((u, i) => (
                        <div key={i} className="flex items-center gap-2.5 px-3.5 py-1.5 hover:bg-secondary/50 transition-colors">
                          <Avatar src={u.picture} name={u.name} size={26} role={u.role} />
                          <span className="text-[12px] font-semibold text-foreground leading-tight truncate">{u.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              </>
            </AnimatePresence>,
            document.body
          )}
        </div>
      )}

      {/* Acciones */}
      <div className="flex items-center border-t border-border/60">
        {/* Me gusta */}
        <motion.button onClick={handleLike} whileTap={{ scale: 0.95 }}
          transition={{ type: 'spring' as const, stiffness: 500, damping: 15 }}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 transition-colors hover:bg-secondary/60">
          <motion.div animate={likeAnim ? { scale: [1, 1.4, 1] } : { scale: 1 }} transition={{ duration: 0.35, ease: 'easeInOut' }}>
            <Heart className="w-[17px] h-[17px] transition-colors" fill={liked ? '#EF476F' : 'none'}
              style={{ color: liked ? '#EF476F' : '#8E87A8' }} />
          </motion.div>
          <span className="text-[13px] font-semibold" style={{ color: liked ? '#EF476F' : '#8E87A8' }}>Me gusta</span>
        </motion.button>

        <div className="w-px h-7 bg-border/60" />

        {/* Comentar */}
        <motion.button
          onClick={() => { setShowComments(v => !v); setTimeout(() => commentInputRef.current?.focus(), 150); }}
          whileTap={{ scale: 0.95 }}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 transition-colors hover:bg-secondary/60">
          <MessageCircle className="w-[17px] h-[17px]" style={{ color: showComments ? '#4361EE' : '#8E87A8' }} />
          <span className="text-[13px] font-semibold" style={{ color: showComments ? '#4361EE' : '#8E87A8' }}>Comentar</span>
        </motion.button>

        <div className="w-px h-7 bg-border/60" />

        {/* Compartir */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 transition-colors hover:bg-secondary/60"
          onClick={() => { if (navigator.share) navigator.share({ text: post.content }); }}>
          <ChevronRight className="w-[17px] h-[17px] rotate-[-45deg]" style={{ color: '#8E87A8' }} />
          <span className="text-[13px] font-semibold text-muted-foreground">Compartir</span>
        </motion.button>
      </div>

      {/* Comentarios */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-4 pb-4 space-y-3 border-t border-border/40 pt-3"
              style={{ background: 'rgba(124,58,237,0.02)' }}>

              {/* Lista de comentarios */}
              {post.comments.length > 0 && (
                <div className="space-y-2.5">
                  {post.comments.map(c => (
                    <div key={c.id} className="flex items-start gap-2.5">
                      <Avatar src={c.authorAvatar} name={c.authorName} size={28} role={c.authorRole} />
                      <div className="flex-1 min-w-0">
                        {editingComment === c.id ? (
                          /* ── Modo edición inline ── */
                          <div className="rounded-2xl rounded-tl-sm px-3 py-2"
                            style={{ background: '#fff', border: '1px solid rgba(124,58,237,0.18)' }}>
                            <p className="text-[11px] font-bold text-foreground mb-1">{c.authorName}</p>
                            <textarea
                              value={editText}
                              onChange={e => setEditText(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(c.id); } if (e.key === 'Escape') setEditingComment(null); }}
                              className="w-full text-[13px] text-foreground leading-snug outline-none bg-transparent resize-none"
                              rows={2}
                              autoFocus
                            />
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <button onClick={() => handleSaveEdit(c.id)} disabled={savingEdit || !editText.trim()}
                                className="text-[11px] font-bold px-2.5 py-0.5 rounded-full text-white disabled:opacity-40"
                                style={{ background: '#7C3AED' }}>
                                {savingEdit ? 'Guardando…' : 'Guardar'}
                              </button>
                              <button onClick={() => setEditingComment(null)}
                                className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full text-muted-foreground"
                                style={{ background: 'rgba(0,0,0,0.06)' }}>
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-2xl rounded-tl-sm px-3 py-2"
                            style={{ background: '#fff', border: '1px solid rgba(124,58,237,0.08)' }}>
                            <p className="text-[11px] font-bold text-foreground mb-0.5">{c.authorName}</p>
                            <p className="text-[13px] text-foreground leading-snug">{c.content}</p>
                          </div>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-0.5 pl-1">{timeAgo(c.createdAt)}</p>
                      </div>

                      {/* ── Botón ⋯ con dropdown ── */}
                      {canDelete && editingComment !== c.id && (
                        <div className="relative mt-1 shrink-0">
                          <button
                            onClick={() => setCommentMenu(commentMenu === c.id ? null : c.id)}
                            className="w-6 h-6 rounded-full flex items-center justify-center transition-all"
                            style={{ color: '#C4C2CF' }}
                          >
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </button>
                          <AnimatePresence>
                            {commentMenu === c.id && (
                              <>
                                {/* Overlay para cerrar */}
                                <div className="fixed inset-0 z-40" onClick={() => setCommentMenu(null)} />
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.92, y: -4 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.92, y: -4 }}
                                  transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
                                  className="absolute right-0 top-7 z-50 flex flex-col overflow-hidden"
                                  style={{
                                    background: '#fff',
                                    border: '1px solid rgba(124,58,237,0.12)',
                                    borderRadius: 12,
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                                    minWidth: 130,
                                  }}
                                >
                                  <button
                                    onClick={() => { setCommentMenu(null); setEditingComment(c.id); setEditText(c.content); }}
                                    className="flex items-center gap-2 px-3.5 py-2.5 text-[12px] font-semibold text-foreground hover:bg-secondary/60 transition-colors text-left"
                                  >
                                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" /> Editar
                                  </button>
                                  <div style={{ height: 1, background: 'rgba(124,58,237,0.07)' }} />
                                  <button
                                    onClick={() => { setCommentMenu(null); onDeleteComment(post.id, c.id); }}
                                    className="flex items-center gap-2 px-3.5 py-2.5 text-[12px] font-semibold text-red-500 hover:bg-red-50 transition-colors text-left"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" /> Eliminar
                                  </button>
                                  <div style={{ height: 1, background: 'rgba(124,58,237,0.07)' }} />
                                  <button
                                    onClick={() => setCommentMenu(null)}
                                    className="flex items-center gap-2 px-3.5 py-2.5 text-[12px] font-semibold text-muted-foreground hover:bg-secondary/60 transition-colors text-left"
                                  >
                                    <X className="w-3.5 h-3.5" /> Cancelar
                                  </button>
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Input nuevo comentario */}
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 rounded-full px-3 py-2"
                  style={{ background: '#fff', border: '1px solid rgba(124,58,237,0.12)' }}>
                  <input
                    ref={commentInputRef}
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComment(); } }}
                    placeholder="Escribe un comentario..."
                    className="flex-1 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none bg-transparent"
                  />
                </div>
                <motion.button
                  onClick={handleComment}
                  disabled={!commentText.trim() || sendingComment}
                  whileTap={{ scale: 0.9 }}
                  className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-40 transition-opacity"
                  style={{ background: 'linear-gradient(135deg,#7C3AED,#4361EE)' }}>
                  {sendingComment
                    ? <div className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                    : <SendHorizontal className="w-4 h-4 text-white" />
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

// ── Composer (crear post) ─────────────────────────────────────────────────────

function PostComposer({
  userName, userRole, userAvatar, onSubmit, loading, token,
}: {
  userName: string; userRole: string; userAvatar?: string | null;
  onSubmit: (content: string, mediaUrl?: string, mediaPublicId?: string) => Promise<void>;
  loading: boolean; token: string | null;
}) {
  const [open, setOpen]         = useState(false);
  const [content, setContent]   = useState('');
  const [media, setMedia]       = useState<{ url: string; publicId: string; type: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending]   = useState(false);
  const textRef    = useRef<HTMLTextAreaElement>(null);
  const fileRef    = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const type = file.type.startsWith('video') ? 'video' : file.type.startsWith('image') ? 'image' : 'raw';
      const reader = new FileReader();
      const base64 = await new Promise<string>(res => {
        reader.onload = e => res(e.target?.result as string);
        reader.readAsDataURL(file);
      });
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/posts/upload-media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ data: base64, type }),
      });
      const data = await res.json();
      if (data.url) setMedia({ url: data.url, publicId: data.publicId, type: data.mediaType, name: file.name });
    } catch { /* silencioso */ } finally { setUploading(false); }
  }

  async function handleSubmit() {
    const text = content.trim();
    if (!text) return;
    setSending(true);
    try {
      await onSubmit(text, media?.url, media?.publicId);
      setContent(''); setMedia(null); setOpen(false);
    } finally { setSending(false); }
  }

  const mediaIsVideo = media?.type === 'video';
  const mediaIsFile  = media && !['image', 'video'].includes(media.type);

  return (
    <motion.div variants={cardVariant} className="bg-white border border-border rounded-2xl overflow-hidden"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(0,0,0,0.06)' }}>

      {/* Cabecera con avatar + textarea */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <Avatar src={userAvatar} name={userName} size={40} role={userRole} />
        <textarea
          ref={textRef}
          value={content}
          onChange={e => { setContent(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Comparte algo con tu equipo..."
          rows={open ? 3 : 1}
          className="flex-1 text-[14px] text-foreground placeholder:text-muted-foreground/50 resize-none outline-none bg-transparent leading-relaxed"
        />
      </div>

      {/* Preview de media */}
      <AnimatePresence>
        {media && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}
            className="mx-4 mb-3 relative rounded-xl overflow-hidden border border-border">
            {mediaIsVideo ? (
              <video src={media.url} controls className="w-full" style={{ maxHeight: 200 }} />
            ) : mediaIsFile ? (
              <div className="flex items-center gap-3 px-4 py-3 bg-secondary">
                <FileText className="w-5 h-5" style={{ color: '#4361EE' }} />
                <span className="text-[12px] font-semibold text-foreground truncate flex-1">{media.name}</span>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={media.url} alt="preview" className="w-full object-cover" style={{ maxHeight: 200 }} />
            )}
            <button onClick={() => setMedia(null)}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input file oculto */}
      <input ref={fileRef} type="file" accept="image/*,video/*"
        className="sr-only"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />

      {/* Barra inferior: adjuntos + publicar */}
      <div className="flex items-center justify-between px-4 pb-4 border-t border-border/60 pt-3 gap-3">
        <div className="flex items-center gap-1 min-w-0">
          {[
            { icon: ImageIcon, label: 'Foto',  accept: 'image/*' },
            { icon: Video,     label: 'Video', accept: 'video/*' },
          ].map(btn => (
            <motion.button key={btn.label} whileTap={{ scale: 0.9 }}
              disabled={uploading}
              onClick={() => { if (fileRef.current) { fileRef.current.accept = btn.accept; fileRef.current.click(); } }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50">
              {uploading
                ? <div className="w-3.5 h-3.5 rounded-full border border-t-transparent animate-spin border-muted-foreground" />
                : <btn.icon className="w-4 h-4" />}
              <span>{btn.label}</span>
            </motion.button>
          ))}
        </div>
        <motion.button onClick={handleSubmit}
          disabled={!content.trim() || sending || loading || uploading}
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'spring' as const, stiffness: 500, damping: 15 }}
          className="shrink-0 px-5 py-2 rounded-full text-[13px] font-bold text-white disabled:opacity-50 transition-opacity"
          style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #4361EE 100%)' }}>
          {sending
            ? <div className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
            : 'Publicar'
          }
        </motion.button>
      </div>
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

  // Widgets — Próximos Eventos y Cumpleaños
  const [upcomingEvents, setUpcomingEvents] = useState<{
    id: string; title: string; type: string; startDate: string; allDay: boolean;
    location?: { name: string } | null;
  }[]>([]);
  const [birthdays, setBirthdays] = useState<{
    id: string; fullName: string; pictureUrl?: string | null; role: string;
    birthDate: string; daysUntil: number;
  }[]>([]);
  const [widgetsLoading, setWidgetsLoading] = useState(true);

  // currentUserId (clerkId del usuario autenticado)
  const [currentUserId, setCurrentUserId] = useState('');
  const [authToken, setAuthToken] = useState<string | null>(null);

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
        setAuthToken(token ?? null);

        const [
          meRes, notifRes, postsRes, eventsRes, birdaysRes,
        ] = await Promise.allSettled([
          apiFetch<MeResponse>('/me', { token }),
          apiFetch<{ notifications: typeof notifs }>('/payments/notifications', { token }),
          apiFetch<{ posts: Post[] }>('/posts?scope=public', { token }),
          apiFetch<{ events: typeof upcomingEvents }>('/events/upcoming', { token }),
          apiFetch<{ birthdays: typeof birthdays }>('/members/birthdays', { token }),
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

        // Widgets
        if (eventsRes.status === 'fulfilled') setUpcomingEvents(eventsRes.value.events);
        if (birdaysRes.status === 'fulfilled') setBirthdays(birdaysRes.value.birthdays);
        setWidgetsLoading(false);

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

  async function handleCreatePost(content: string, mediaUrl?: string, mediaPublicId?: string) {
    const token = await session?.getToken();
    const res = await apiFetch<{ post: Post }>('/posts', {
      token, method: 'POST',
      body: JSON.stringify({
        content,
        scope: feedScope === 'public' ? 'PUBLIC' : 'PRIVATE',
        ...(mediaUrl ? { mediaUrl, mediaPublicId } : {}),
      }),
    });
    setPosts(prev => [res.post, ...prev]);
  }

  async function handleComment(postId: string, content: string) {
    const token = await session?.getToken();
    const res = await apiFetch<{ comment: PostComment }>(`/posts/${postId}/comments`, {
      token, method: 'POST',
      body: JSON.stringify({ content }),
    });
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, comments: [...p.comments, res.comment] } : p
    ));
  }

  function handleDeleteComment(postId: string, commentId: string) {
    session?.getToken().then(token => {
      apiFetch(`/posts/${postId}/comments/${commentId}`, { token, method: 'DELETE' }).catch(() => {});
    });
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, comments: p.comments.filter(c => c.id !== commentId) } : p
    ));
  }

  async function handleFetchLikes(postId: string): Promise<LikeUser[]> {
    const token = await session?.getToken();
    const res = await apiFetch<{ users: LikeUser[] }>(`/posts/${postId}/likes`, { token });
    return res.users;
  }

  async function handleEditComment(postId: string, commentId: string, content: string) {
    const token = await session?.getToken();
    const res = await apiFetch<{ comment: PostComment }>(`/posts/${postId}/comments/${commentId}`, {
      token, method: 'PATCH',
      body: JSON.stringify({ content }),
    });
    setPosts(prev => prev.map(p =>
      p.id === postId
        ? { ...p, comments: p.comments.map(c => c.id === commentId ? res.comment : c) }
        : p
    ));
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

      {/* ── Slideshow publicitario — ancho completo ─────────────────────────── */}
      <div className="w-full px-6 pt-4">
        <Slideshow
          slides={ADS.map(ad => ({ img: ad.image, label: ad.label, title: ad.title, description: ad.description, url: ad.url }))}
          className="min-h-[400px] md:min-h-[190px]"
        />
      </div>

      {/* ── Contenido principal — desktop: 50% izquierdo, 50% derecho reservado ── */}
      <div className="w-full px-6 py-4 sm:flex sm:items-start sm:gap-6">
      <div className="sm:w-1/2">
      <motion.div
        variants={feedVariants}
        initial="hidden"
        animate="show"
        className="space-y-4"
      >
        {/* ── Widgets móvil — grid 2 cols, encima de los tabs ─────────────── */}
        <motion.div variants={cardVariant} className="sm:hidden grid grid-cols-2 gap-3">
          {/* Próximos Eventos */}
          <div className="rounded-2xl bg-white border border-border overflow-hidden"
            style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <div className="flex items-center gap-2 px-3 pt-3 pb-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg,#4361EE,#7C3AED)' }}>
                <CalendarDays className="w-3 h-3 text-white" />
              </div>
              <p className="text-[11px] font-bold text-foreground truncate">Próximos Eventos</p>
            </div>
            {widgetsLoading ? (
              <div className="px-3 pb-3 flex flex-col gap-1.5">
                {[1,2].map(i => <div key={i} className="h-8 rounded-lg bg-secondary animate-pulse" />)}
              </div>
            ) : upcomingEvents.length === 0 ? (
              <div className="px-3 pb-4 flex flex-col items-center gap-1 pt-1">
                <CalendarDays className="w-6 h-6" style={{ color: '#C4BFDB' }} />
                <p className="text-[10px] text-muted-foreground text-center">Sin eventos próximos</p>
              </div>
            ) : (
              <div className="px-3 pb-3 flex flex-col gap-1">
                {upcomingEvents.slice(0, 3).map(ev => {
                  const d = new Date(ev.startDate);
                  const typeColors: Record<string, { bg: string; text: string }> = {
                    TRAINING:    { bg: 'rgba(6,214,160,0.10)',  text: '#06D6A0' },
                    MEETUP:      { bg: 'rgba(67,97,238,0.10)',  text: '#4361EE' },
                    COMPETITION: { bg: 'rgba(239,71,111,0.10)', text: '#EF476F' },
                  };
                  const tc = typeColors[ev.type] ?? typeColors.MEETUP;
                  return (
                    <div key={ev.id} className="flex items-center gap-2 py-1.5 rounded-lg">
                      <div className="flex flex-col items-center justify-center w-8 h-8 rounded-lg shrink-0"
                        style={{ background: tc.bg }}>
                        <span className="text-[11px] font-black leading-none" style={{ color: tc.text }}>{d.getDate()}</span>
                        <span className="text-[8px] font-semibold uppercase leading-none" style={{ color: tc.text }}>
                          {d.toLocaleDateString('es-CO', { month: 'short' })}
                        </span>
                      </div>
                      <p className="text-[11px] font-semibold text-foreground truncate flex-1">{ev.title.charAt(0).toUpperCase() + ev.title.slice(1).toLowerCase()}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cumpleaños */}
          <div className="rounded-2xl bg-white border border-border overflow-hidden"
            style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <div className="flex items-center gap-2 px-3 pt-3 pb-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg,#EF476F,#FFB703)' }}>
                <Gift className="w-3 h-3 text-white" />
              </div>
              <p className="text-[11px] font-bold text-foreground">Cumpleaños</p>
            </div>
            {widgetsLoading ? (
              <div className="px-3 pb-3 flex flex-col gap-1.5">
                {[1,2].map(i => <div key={i} className="h-8 rounded-lg bg-secondary animate-pulse" />)}
              </div>
            ) : birthdays.length === 0 ? (
              <div className="px-3 pb-4 flex flex-col items-center gap-1 pt-1">
                <Gift className="w-6 h-6" style={{ color: '#C4BFDB' }} />
                <p className="text-[10px] text-muted-foreground text-center">Sin cumpleaños en 30 días</p>
              </div>
            ) : (
              <div className="px-3 pb-3 flex flex-col gap-1">
                {birthdays.slice(0, 3).map(b => {
                  const isToday    = b.daysUntil === 0;
                  const isTomorrow = b.daysUntil === 1;
                  const daysBg    = isToday ? 'rgba(239,71,111,0.12)' : 'rgba(124,58,237,0.10)';
                  const daysColor = isToday ? '#EF476F' : '#7C3AED';
                  return (
                    <div key={b.id} className="flex items-center gap-2 py-1.5 rounded-lg">
                      <div className="w-8 h-8 rounded-lg flex flex-col items-center justify-center shrink-0"
                        style={{ background: daysBg }}>
                        {isToday ? (
                          <span className="text-[14px] leading-none">🎂</span>
                        ) : (
                          <>
                            <p className="text-[12px] font-bold leading-none" style={{ color: daysColor }}>
                              {isTomorrow ? '1' : b.daysUntil}
                            </p>
                            <p className="text-[7px] font-bold uppercase leading-none mt-0.5" style={{ color: daysColor }}>
                              {isTomorrow ? 'mañ' : 'días'}
                            </p>
                          </>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-foreground truncate">{b.fullName}</p>
                        <p className="text-[10px]" style={{ color: isToday ? '#EF476F' : '#8E87A8', fontWeight: 500 }}>
                          {isToday ? '¡Hoy!' : isTomorrow ? 'Mañana' : `En ${b.daysUntil} días`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Tabs Público / Privado ──────────────────────────────────────── */}
        <motion.div variants={cardVariant}>
          <div
            className="relative flex rounded-2xl p-1 gap-1"
            style={{ background: '#FFFFFF', boxShadow: '0 1px 4px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(0,0,0,0.06)' }}
          >
            {([
              { key: 'public'  as FeedScope, label: 'Público',  icon: Globe, desc: 'Todos los clubes' },
              { key: 'private' as FeedScope, label: 'Mi Club',   icon: Lock,  desc: 'Solo interno' },
            ] as const).map(tab => {
              const active = feedScope === tab.key;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setFeedScope(tab.key)}
                  className="relative flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl z-10"
                >
                  {/* Pill deslizante */}
                  {active && (
                    <motion.div
                      layoutId="feed-tab-pill"
                      className="absolute inset-0 rounded-xl"
                      style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #4361EE 100%)', boxShadow: '0 4px 20px rgba(124,58,237,0.40)' }}
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                  <Icon className="relative w-3.5 h-3.5 z-10" style={{ color: active ? '#fff' : '#8E87A8' }} />
                  <div className="relative text-left z-10">
                    <p className="text-[12px] font-bold leading-none" style={{ color: active ? '#fff' : '#8E87A8' }}>
                      {tab.label}
                    </p>
                    <p className="text-[9px] leading-none mt-0.5" style={{ color: active ? 'rgba(255,255,255,0.70)' : '#B0ABCA' }}>
                      {tab.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Composer — solo ADMIN y COACH */}
        {canPost && (
          <PostComposer
            userName={user?.name ?? ''}
            userRole={role}
            userAvatar={user?.picture ?? null}
            onSubmit={handleCreatePost}
            loading={postsLoading}
            token={authToken}
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
                onComment={handleComment}
                onDeleteComment={handleDeleteComment}
                onEditComment={handleEditComment}
                onFetchLikes={handleFetchLikes}
              />
            ))}
          </AnimatePresence>
        )}

      </motion.div>
      </div>
      {/* Columna derecha — Widgets sticky */}
      <div className="hidden sm:flex sm:flex-col sm:w-1/2 sm:pr-6 gap-4 sm:sticky sm:top-4 sm:self-start">

        {/* Widget — Próximos Eventos */}
        <div className="rounded-2xl bg-white border border-border overflow-hidden"
          style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,#4361EE,#7C3AED)' }}>
                <CalendarDays className="w-3.5 h-3.5 text-white" />
              </div>
              <p className="text-[13px] font-bold text-foreground">Próximos Eventos</p>
            </div>
            <Link href="/dashboard/calendario"
              className="text-[11px] font-semibold text-purple-600 hover:underline cursor-pointer">
              Ver todos
            </Link>
          </div>

          {widgetsLoading ? (
            <div className="px-4 pb-4 flex flex-col gap-2">
              {[1,2,3].map(i => (
                <div key={i} className="h-10 rounded-xl bg-secondary animate-pulse" />
              ))}
            </div>
          ) : upcomingEvents.length === 0 ? (
            <div className="px-4 pb-5 flex flex-col items-center gap-1.5 pt-2">
              <CalendarDays className="w-7 h-7" style={{ color: '#C4BFDB' }} />
              <p className="text-[12px] text-muted-foreground text-center">Sin eventos próximos</p>
            </div>
          ) : (
            <div className="px-4 pb-3 flex flex-col gap-1">
              {upcomingEvents.map(ev => {
                const d = new Date(ev.startDate);
                const day   = d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
                const time  = ev.allDay ? 'Todo el día' : d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
                const typeColors: Record<string, { bg: string; text: string }> = {
                  TRAINING:    { bg: 'rgba(6,214,160,0.10)',   text: '#06D6A0' },
                  MEETUP:      { bg: 'rgba(67,97,238,0.10)',   text: '#4361EE' },
                  COMPETITION: { bg: 'rgba(239,71,111,0.10)',  text: '#EF476F' },
                };
                const tc = typeColors[ev.type] ?? typeColors.MEETUP;
                const typeLabel: Record<string, string> = {
                  TRAINING: 'Entrenamiento', MEETUP: 'Reunión', COMPETITION: 'Competencia',
                };
                return (
                  <div key={ev.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/60 transition-colors cursor-default">
                    {/* Fecha */}
                    <div className="flex flex-col items-center justify-center w-10 h-10 rounded-xl shrink-0"
                      style={{ background: tc.bg }}>
                      <span className="text-[13px] font-black leading-none" style={{ color: tc.text }}>
                        {d.getDate()}
                      </span>
                      <span className="text-[9px] font-semibold uppercase leading-none mt-0.5" style={{ color: tc.text }}>
                        {d.toLocaleDateString('es-CO', { month: 'short' })}
                      </span>
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-foreground truncate">{ev.title.charAt(0).toUpperCase() + ev.title.slice(1).toLowerCase()}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: tc.bg, color: tc.text }}>
                          {typeLabel[ev.type] ?? ev.type}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{time}</span>
                        {ev.location?.name && (
                          <span className="text-[10px] text-muted-foreground truncate">· {ev.location.name}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Widget — Recordatorios de Cumpleaños */}
        <div className="rounded-2xl bg-white border border-border overflow-hidden"
          style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center gap-2 px-4 pt-4 pb-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#EF476F,#FFB703)' }}>
              <Gift className="w-3.5 h-3.5 text-white" />
            </div>
            <p className="text-[13px] font-bold text-foreground">Cumpleaños</p>
          </div>

          {widgetsLoading ? (
            <div className="px-4 pb-4 flex flex-col gap-2">
              {[1,2].map(i => (
                <div key={i} className="h-10 rounded-xl bg-secondary animate-pulse" />
              ))}
            </div>
          ) : birthdays.length === 0 ? (
            <div className="px-4 pb-5 flex flex-col items-center gap-1.5 pt-2">
              <Gift className="w-7 h-7" style={{ color: '#C4BFDB' }} />
              <p className="text-[12px] text-muted-foreground text-center">Sin cumpleaños en los próximos 30 días</p>
            </div>
          ) : (
            <div className="px-4 pb-3 flex flex-col gap-1">
              {birthdays.map(b => {
                const isToday    = b.daysUntil === 0;
                const isTomorrow = b.daysUntil === 1;
                const daysBg  = isToday ? 'rgba(239,71,111,0.12)' : 'rgba(124,58,237,0.10)';
                const daysColor = isToday ? '#EF476F' : '#7C3AED';
                return (
                  <div key={b.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/60 transition-colors cursor-default">
                    {/* Días restantes en lugar del avatar */}
                    <div className="w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0"
                      style={{ background: daysBg }}>
                      {isToday ? (
                        <span className="text-[18px] leading-none">🎂</span>
                      ) : (
                        <>
                          <p className="text-[14px] font-bold leading-none" style={{ color: daysColor }}>
                            {isTomorrow ? '1' : b.daysUntil}
                          </p>
                          <p className="text-[8px] font-bold uppercase tracking-wide leading-none mt-0.5" style={{ color: daysColor }}>
                            {isTomorrow ? 'mañana' : 'días'}
                          </p>
                        </>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-foreground truncate">{b.fullName}</p>
                      <p className="text-[11px]" style={{ color: isToday ? '#EF476F' : '#8E87A8', fontWeight: 500 }}>
                        {isToday ? '¡Hoy es su cumpleaños!' : isTomorrow ? 'Mañana es su cumpleaños' : `En ${b.daysUntil} días`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
      </div>
    </div>
  );
}
