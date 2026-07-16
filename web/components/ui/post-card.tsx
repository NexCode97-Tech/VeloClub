'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MemberAvatar } from '@/components/ui/member-avatar';
import {
  Globe, Lock, Heart, MessageCircle, ChevronRight,
  Send, X, Trash2, MoreHorizontal,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PostLike { userId: string }
export interface PostComment {
  id: string; authorClerkId?: string | null; authorName: string; authorRole: string;
  authorAvatar?: string | null; content: string; createdAt: string;
}
export interface Post {
  id: string; clubId: string; clubName: string;
  authorClerkId?: string | null;
  authorName: string; authorRole: string; authorAvatar?: string | null;
  content: string; imageUrl?: string | null;
  scope: 'PUBLIC' | 'PRIVATE';
  likes: PostLike[]; comments: PostComment[]; createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROLE_GRADIENT: Record<string, string> = {
  SUPERADMIN: 'linear-gradient(135deg,#EF476F,#C1121F)',
  ADMIN:      'linear-gradient(135deg,#FFB703,#FB8500)',
  COACH:      'linear-gradient(135deg,#06D6A0,#0CB68D)',
  STUDENT:    'linear-gradient(135deg,#7C3AED,#A855F7)',
};

export function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return 'Hace un momento';
  if (diff < 3600)  return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)}h`;
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

function Avatar({ src, name, size = 36, role }: {
  src?: string | null; name: string; size?: number; role?: string;
}) {
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

export function PostCard({ post, currentUserId, onLike, onComment, canDelete, onDelete }: {
  post: Post; currentUserId: string; canDelete: boolean;
  onLike: (id: string) => void;
  onDelete: (id: string) => void;
  onComment: (postId: string, content: string) => Promise<void>;
}) {
  const router    = useRouter();
  const liked     = post.likes.some(l => l.userId === currentUserId);
  const likeCount = post.likes.length;
  const [likeAnim, setLikeAnim]         = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText]   = useState('');
  const [sending, setSending]           = useState(false);
  const [menuOpen, setMenuOpen]         = useState(false);
  const [confirmDel, setConfirmDel]     = useState(false);
  const [lightbox, setLightbox]         = useState(false);
  const menuRef    = useRef<HTMLDivElement>(null);
  const commentRef = useRef<HTMLInputElement>(null);

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
          <button
            type="button"
            onClick={() => post.authorClerkId && router.push(`/dashboard/perfil/${post.authorClerkId}`)}
            className={post.authorClerkId ? 'cursor-pointer shrink-0' : 'cursor-default shrink-0'}
          >
            <Avatar src={post.authorAvatar} name={post.authorName} size={40} role={post.authorRole} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <p
                className={`text-[14px] font-semibold text-foreground ${post.authorClerkId ? 'cursor-pointer hover:underline' : ''}`}
                onClick={() => post.authorClerkId && router.push(`/dashboard/perfil/${post.authorClerkId}`)}
              >{post.authorName}</p>
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
                      className="flex-1 text-[11px] font-semibold py-1.5 rounded-lg bg-red-500 text-white cursor-pointer active:scale-95 transition-transform">
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
            ? <video src={post.imageUrl} controls className="w-full" style={{ maxHeight: 520 }} />
            : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.imageUrl} alt="Publicación"
                className="w-full object-contain cursor-zoom-in"
                style={{ maxHeight: 520, background: '#f4f4f6' }}
                onClick={() => setLightbox(true)}
              />
            )
          }
        </div>
      )}

      {/* Lightbox — portal para escapar del transform de Framer Motion */}
      {lightbox && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)' }}
            onClick={() => setLightbox(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="relative"
              onClick={e => e.stopPropagation()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.imageUrl!} alt="Publicación ampliada"
                className="rounded-2xl object-contain shadow-2xl"
                style={{ maxWidth: '92vw', maxHeight: '88vh' }}
              />
              <button
                onClick={() => setLightbox(false)}
                className="absolute -top-3 -right-3 w-8 h-8 rounded-full flex items-center justify-center shadow-lg cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)' }}
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
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
                  <button
                    type="button"
                    onClick={() => c.authorClerkId && router.push(`/dashboard/perfil/${c.authorClerkId}`)}
                    className={c.authorClerkId ? 'cursor-pointer shrink-0' : 'cursor-default shrink-0'}
                  >
                    <Avatar src={c.authorAvatar} name={c.authorName} size={28} role={c.authorRole} />
                  </button>
                  <div className="rounded-2xl rounded-tl-sm px-3 py-2 flex-1"
                    style={{ background: '#fff', border: '1px solid rgba(124,58,237,0.08)' }}>
                    <p className="text-[11px] font-semibold text-foreground mb-0.5">{c.authorName}</p>
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
