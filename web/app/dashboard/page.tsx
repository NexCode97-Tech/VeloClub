'use client';

import { useAuth, useSession } from '@clerk/nextjs';
import { useClubStream } from '@/hooks/useClubStream';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import { apiFetch } from '@/lib/api-client';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, BellOff,
  Heart, Image as ImageIcon, X, Send,
  ChevronRight, Globe, Lock, MessageCircle,
  Paperclip, Video, FileText,
} from 'lucide-react';

// ── Interfaces ────────────────────────────────────────────────────────────────

interface MeResponse {
  status: 'ok' | 'superadmin' | 'complete_profile' | 'no_access' | 'inactive' | 'trial_expired';
  user?: { name: string; role: string; club?: { name: string; logoUrl?: string } };
  trial?: { daysLeft: number; endsAt: string } | null;
}

interface PostLike { userId: string }
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
    image: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=600&q=80',
    label: 'Equipamiento',
    title: 'Nueva Colección Deportiva 2025',
    description: 'Ropa técnica de alto rendimiento para ciclistas',
    url: '#',
    color: '#7C3AED',
  },
  {
    image: 'https://images.unsplash.com/photo-1526676037777-05a232554f77?w=600&q=80',
    label: 'Academia',
    title: 'Academia de Alto Rendimiento',
    description: 'Entrena con los mejores coaches del país',
    url: '#',
    color: '#4361EE',
  },
  {
    image: 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=600&q=80',
    label: 'Nutrición',
    title: 'Plan Nutricional para Deportistas',
    description: 'Optimiza tu rendimiento con nutrición personalizada',
    url: '#',
    color: '#06D6A0',
  },
  {
    image: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=600&q=80',
    label: 'Ciclismo',
    title: 'Trek & Specialized — Tienda Oficial',
    description: 'Las mejores marcas de ciclismo en un solo lugar',
    url: '#',
    color: '#EF476F',
  },
  {
    image: 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=600&q=80',
    label: 'Hidratación',
    title: 'Hidratación Profesional Deportiva',
    description: 'Isotónicos y suplementos para el alto rendimiento',
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

// ── SponsorBanner ─────────────────────────────────────────────────────────────

function SponsorBanner() {
  const [paused, setPaused] = useState(false);
  const items = [...ADS, ...ADS]; // duplicar para loop sin cortes

  return (
    <motion.div variants={cardVariant} className="overflow-hidden">
      <style>{`
        @keyframes scrollLeft {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
      <div
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        style={{
          display: 'flex',
          gap: 12,
          width: 'max-content',
          animation: 'scrollLeft 45s linear infinite',
          animationPlayState: paused ? 'paused' : 'running',
        }}
      >
        {items.map((ad, i) => (
          <a
            key={i}
            href={ad.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 bg-white border border-border rounded-2xl overflow-hidden flex items-stretch cursor-pointer hover:shadow-md transition-shadow"
            style={{ width: 300, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}
          >
            {/* Imagen */}
            <div className="shrink-0 overflow-hidden" style={{ width: 110 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ad.image} alt={ad.title} className="w-full h-full object-cover" />
            </div>
            {/* Texto */}
            <div className="flex-1 px-3 py-3 flex flex-col justify-between min-w-0">
              <div>
                <p className="text-[10px] font-bold mb-1" style={{ color: ad.color }}>
                  ✦ {ad.label}
                </p>
                <p className="text-[12px] font-bold text-foreground leading-snug line-clamp-2">{ad.title}</p>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug line-clamp-2">{ad.description}</p>
              </div>
              <span className="text-[11px] font-bold mt-2 inline-flex items-center gap-0.5" style={{ color: ad.color }}>
                Ver más <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </a>
        ))}
      </div>
    </motion.div>
  );
}

// ── PostCard ──────────────────────────────────────────────────────────────────

function PostCard({
  post, currentUserId, canDelete, onLike, onDelete, onComment, onDeleteComment,
}: {
  post: Post; currentUserId: string; canDelete: boolean;
  onLike: (id: string) => void;
  onDelete: (id: string) => void;
  onComment: (postId: string, content: string) => Promise<void>;
  onDeleteComment: (postId: string, commentId: string) => void;
}) {
  const liked     = post.likes.some(l => l.userId === currentUserId);
  const likeCount = post.likes.length;
  const [confirmDel, setConfirmDel]   = useState(false);
  const [likeAnim, setLikeAnim]       = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);

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
      style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}
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
          <AnimatePresence mode="wait">
            {confirmDel ? (
              <motion.div key="confirm" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.15 }} className="flex items-center gap-1.5">
                <button onClick={() => onDelete(post.id)}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-500 text-white active:scale-95 transition-transform">Eliminar</button>
                <button onClick={() => setConfirmDel(false)}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-secondary text-muted-foreground">Cancelar</button>
              </motion.div>
            ) : (
              <motion.button key="dots" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setConfirmDel(true)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground/50 hover:bg-secondary active:scale-90 transition-all">
                <span className="text-[18px] font-bold leading-none mb-1">···</span>
              </motion.button>
            )}
          </AnimatePresence>
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

      {/* Contadores */}
      {(likeCount > 0 || post.comments.length > 0) && (
        <div className="flex items-center gap-3 px-4 pb-2">
          {likeCount > 0 && (
            <span className="text-[12px] text-muted-foreground">
              {likeCount} Me gusta
            </span>
          )}
          {post.comments.length > 0 && (
            <span className="text-[12px] text-muted-foreground">
              {post.comments.length} comentario{post.comments.length !== 1 ? 's' : ''}
            </span>
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
                        <div className="rounded-2xl rounded-tl-sm px-3 py-2"
                          style={{ background: '#fff', border: '1px solid rgba(124,58,237,0.08)' }}>
                          <p className="text-[11px] font-bold text-foreground mb-0.5">{c.authorName}</p>
                          <p className="text-[13px] text-foreground leading-snug">{c.content}</p>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 pl-1">{timeAgo(c.createdAt)}</p>
                      </div>
                      {canDelete && (
                        <button onClick={() => onDeleteComment(post.id, c.id)}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground/30 hover:text-red-400 hover:bg-red-50 transition-all mt-1 shrink-0">
                          <X className="w-3 h-3" />
                        </button>
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
                    : <Send className="w-3.5 h-3.5 text-white" />
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
      style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>

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
      <input ref={fileRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip"
        className="sr-only"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />

      {/* Barra inferior: adjuntos + publicar */}
      <div className="flex items-center justify-between px-4 pb-4 border-t border-border/60 pt-3">
        <div className="flex items-center gap-1">
          {[
            { icon: ImageIcon, label: 'Foto',      accept: 'image/*' },
            { icon: Video,     label: 'Video',     accept: 'video/*' },
            { icon: Paperclip, label: 'Resultado', accept: '.pdf,.doc,.docx,.xls,.xlsx,.zip' },
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
          className="px-5 py-2 rounded-full text-[13px] font-bold text-white disabled:opacity-50 transition-opacity"
          style={{ background: '#7C3AED' }}>
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
          meRes, notifRes, postsRes,
        ] = await Promise.allSettled([
          apiFetch<MeResponse>('/me', { token }),
          apiFetch<{ notifications: typeof notifs }>('/payments/notifications', { token }),
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
      <div className="w-full px-6 py-4">
      <motion.div
        variants={feedVariants}
        initial="hidden"
        animate="show"
        className="space-y-4"
      >

        {/* ── Banner publicitario deslizante ──────────────────────────────── */}
        <SponsorBanner />

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
              />
            ))}
          </AnimatePresence>
        )}

      </motion.div>
      </div>
    </div>
  );
}
