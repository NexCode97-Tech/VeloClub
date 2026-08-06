'use client';

import { useAuth, useSession } from '@clerk/nextjs';
import { useClubStream } from '@/hooks/useClubStream';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef, useLayoutEffect, Fragment } from 'react';
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
  Clock, CheckSquare, Wallet, MapPin,
} from 'lucide-react';
import { Slideshow } from '@/components/ui/slideshow';
import { InicioHeaderMovil } from '@/components/ui/inicio-header-movil';

// Ficha de resumen de Inicio en movil. Un numero grande y su contexto: lo
// suficiente para saber si hay que entrar al modulo o no.
function FichaInicio({ icono, etiqueta, valor, sufijo }: {
  icono: React.ReactNode; etiqueta: string; valor: string; sufijo?: string;
}) {
  return (
    <div className="flex-1 min-w-0 bg-white rounded-xl px-3 py-2.5" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
      <div className="flex items-center gap-1.5 mb-0.5">
        {icono}
        <span className="text-[10px] text-muted-foreground truncate">{etiqueta}</span>
      </div>
      <p className="text-[17px] font-semibold text-foreground leading-tight" style={{ fontFamily: 'inherit' }}>
        {valor}
        {sufijo && <span className="text-[11px] font-normal text-muted-foreground">{sufijo}</span>}
      </p>
    </div>
  );
}
import { MemberAvatar } from '@/components/ui/member-avatar';
import ModuleLoader, { useCargaMinima } from '@/components/ui/module-loader';
import ModuleReveal from '@/components/ui/module-reveal';
import { ContenidoGuardado, MS_GUARDADO, type EstadoGuardado } from '@/components/ui/save-button-state';

// ── Interfaces ────────────────────────────────────────────────────────────────

interface MeResponse {
  status: 'ok' | 'superadmin' | 'complete_profile' | 'no_access' | 'needs_onboarding' | 'inactive' | 'member_inactive' | 'trial_expired';
  user?: { name: string; role: string; picture?: string | null; club?: { name: string; logoUrl?: string; verified?: boolean } };
  trial?: { daysLeft: number; endsAt: string } | null;
}

interface PostLike { userId: string }
interface LikeUser { name: string; picture?: string | null; role?: string }
interface PostComment {
  id: string;
  authorClerkId?: string | null;
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
  authorClerkId?: string | null;
  authorName: string;
  authorRole: string;
  authorAvatar?: string | null;
  content: string;
  imageUrl?: string | null;
  ubicacion?: string | null;
  scope: 'PUBLIC' | 'PRIVATE';
  likes: PostLike[];
  comments: PostComment[];
  createdAt: string;
}

type FeedScope = 'public' | 'private';

// ── Helpers ───────────────────────────────────────────────────────────────────

// Etiqueta del autor con el color de su rol, el mismo que usa el sidebar: el
// administrador en ambar, el entrenador en verde y el deportista en violeta.
const roleBadge: Record<string, { texto: string; fondo: string }> = {
  SUPERADMIN: { texto: '#B02A47', fondo: 'rgba(239,71,111,0.12)' },
  ADMIN:      { texto: '#854F0B', fondo: 'rgba(255,183,3,0.16)'  },
  COACH:      { texto: '#057A5C', fondo: 'rgba(6,214,160,0.14)'  },
  STUDENT:    { texto: '#6D28D9', fondo: 'rgba(124,58,237,0.10)' },
};

const roleLabels: Record<string, string> = {
  SUPERADMIN: 'Super admin',
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
    title: 'Nueva colección deportiva 2025',
    description: 'Descubre la línea de ropa técnica diseñada para ciclistas de alto rendimiento. Tejidos transpirables, corte aerodinámico y protección UV para cada etapa.',
    url: '#',
    color: '#7C3AED',
  },
  {
    image: '/natural.png',
    label: 'Publicidad',
    title: 'Natural Ropa Deportiva, lycras para patinaje',
    description: 'Lycras y uniformes para patinaje, hechos para competir y entrenar. Confección a la medida del deportista y diseños personalizados para tu club.',
    url: 'https://wa.me/573138296551',
    color: '#4361EE',
  },
  {
    image: '/cafe-orquidea.png',
    label: 'Publicidad',
    title: 'Café Orquídea de la Meseta',
    description: 'Café colombiano de la meseta santandereana en presentación de 450 gramos: energía para todo un mes.',
    // Número que aparece en la pieza del anunciante
    url: 'https://wa.me/573153171225',
    color: '#06D6A0',
  },
  {
    image: '/foto-bicicleta.jpg',
    label: 'Ciclismo',
    title: 'Trek & Specialized — tienda oficial',
    description: 'Las marcas líderes del ciclismo mundial en un solo lugar. Bicicletas de ruta, MTB, accesorios y componentes con garantía oficial y asesoría especializada.',
    url: '#',
    color: '#EF476F',
  },
  {
    image: '/foto-hidratacion.png',
    label: 'Hidratación',
    title: 'Hidratación profesional deportiva',
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
  post, currentUserId, canDelete, onLike, onDelete, onComment, onDeleteComment, onEditComment, onFetchLikes, onUpdatePost,
}: {
  post: Post; currentUserId: string; canDelete: boolean;
  onLike: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdatePost: (id: string, cambios: { content?: string; scope?: 'PUBLIC' | 'PRIVATE' }) => Promise<void>;
  onComment: (postId: string, content: string) => Promise<void>;
  onDeleteComment: (postId: string, commentId: string) => void;
  onEditComment: (postId: string, commentId: string, content: string) => Promise<void>;
  onFetchLikes: (postId: string) => Promise<LikeUser[]>;
}) {
  const router    = useRouter();
  const liked     = post.likes.some(l => l.userId === currentUserId);
  const likeCount = post.likes.length;
  const [postMenuOpen, setPostMenuOpen] = useState(false);
  // Editar solo cambia la descripcion. La foto, el autor y la fecha no se tocan.
  const [editandoPost, setEditandoPost] = useState(false);
  const [textoEdicion, setTextoEdicion] = useState('');
  const [guardandoPost, setGuardandoPost] = useState(false);
  const [moviendoPost, setMoviendoPost]   = useState(false);

  async function handleGuardarEdicion() {
    const texto = textoEdicion.trim();
    if (!texto || texto === post.content) { setEditandoPost(false); return; }
    setGuardandoPost(true);
    try {
      await onUpdatePost(post.id, { content: texto });
      setEditandoPost(false);
    } finally { setGuardandoPost(false); }
  }

  async function handleMoverPost() {
    setMoviendoPost(true);
    try {
      await onUpdatePost(post.id, { scope: post.scope === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC' });
    } finally { setMoviendoPost(false); }
  }
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
  // Solo foto y video parten la tarjeta en dos: un adjunto es una fila de
  // enlace y no llena una columna. Sin media, la tarjeta va a lo ancho.
  const parteEnDos = !!post.imageUrl && !isFile;

  // En escritorio los comentarios se muestran abiertos: son los que llenan la
  // columna derecha. Se detecta tras montar y no durante el render, porque el
  // servidor no conoce el ancho de la pantalla y romperia la hidratacion.
  const [esEscritorio, setEsEscritorio] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const aplicar = () => setEsEscritorio(mq.matches);
    aplicar();
    mq.addEventListener('change', aplicar);
    return () => mq.removeEventListener('change', aplicar);
  }, []);
  const comentariosVisibles = showComments || esEscritorio;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 10 }}
      animate={{ opacity: 1, scale: 1,    y: 0 }}
      exit={{    opacity: 0, scale: 0.95, y: -8 }}
      transition={{ type: 'spring' as const, stiffness: 300, damping: 26 }}
      layout
      className={`bg-white border border-border rounded-2xl overflow-hidden${
        parteEnDos ? ' md:grid md:grid-cols-[22rem_1fr] md:grid-rows-[auto_1fr]' : ''}`}
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(0,0,0,0.06)' }}
    >
      {/* En escritorio la tarjeta es una rejilla de 2x2: la imagen ocupa la
          columna izquierda completa y el contenido se reparte en dos celdas a
          la derecha. Son dos y no cinco a proposito: con una celda por seccion,
          las filas se estiraban para igualar el alto de la imagen y el autor,
          el texto y los botones quedaban separados por huecos enormes. */}
      {/* Bloque de arriba: autor y texto. Va en una celda propia para que
          no se estire a lo alto igualando la imagen. */}
      <div className="md:col-start-2 md:row-start-1 md:min-w-0">
        {/* Autor */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => post.authorClerkId && router.push(`/dashboard/perfil/${post.authorClerkId}`)}
              className={post.authorClerkId ? 'cursor-pointer shrink-0' : 'cursor-default shrink-0'}
            >
              <Avatar src={post.authorAvatar} name={post.authorName} size={42} role={post.authorRole} />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p
                  className={`text-[14px] md:text-[13px] font-semibold text-foreground leading-tight ${post.authorClerkId ? 'cursor-pointer hover:underline' : ''}`}
                  onClick={() => post.authorClerkId && router.push(`/dashboard/perfil/${post.authorClerkId}`)}
                >{post.authorName || 'Usuario'}</p>
                <span className="text-[11px] md:text-[10px] font-semibold px-2.5 md:px-2 py-0.5 rounded-full shrink-0"
                  style={{
                    background: (roleBadge[post.authorRole] ?? roleBadge.STUDENT).fondo,
                    color:      (roleBadge[post.authorRole] ?? roleBadge.STUDENT).texto,
                  }}>
                  {roleLabels[post.authorRole] ?? post.authorRole}
                </span>
              </div>
              <p className="text-[12px] md:text-[11px] text-muted-foreground mt-0.5 truncate">
                {post.scope === 'PUBLIC' && post.clubName && <>{post.clubName}{' · '}</>}
                {timeAgo(post.createdAt)}
                {post.ubicacion && (
                  <>
                    {' · '}
                    <MapPin className="inline w-3 h-3 -mt-0.5" style={{ color: '#8E87A8' }} />
                    {' '}{post.ubicacion}
                  </>
                )}
              </p>
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
                      onClick={() => { setPostMenuOpen(false); setEditandoPost(true); setTextoEdicion(post.content); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold text-foreground hover:bg-secondary transition-colors cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </button>
                    {/* Mover cambia la pestaña donde aparece la publicacion:
                        de Publico a Mi club y al reves. El texto dice a donde
                        va, no donde esta, para que no haya que adivinar. */}
                    <button
                      onClick={() => { setPostMenuOpen(false); handleMoverPost(); }}
                      disabled={moviendoPost}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold text-foreground hover:bg-secondary transition-colors cursor-pointer border-t border-border/50 disabled:opacity-50"
                    >
                      {post.scope === 'PUBLIC'
                        ? <><Lock className="w-3.5 h-3.5" /> Mover a Mi club</>
                        : <><Globe className="w-3.5 h-3.5" /> Mover a Público</>}
                    </button>
                    <button
                      onClick={() => { setPostMenuOpen(false); setConfirmDel(true); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold text-red-500 hover:bg-red-50 transition-colors cursor-pointer border-t border-border/50"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Eliminar
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
                        className="flex-1 text-[11px] font-semibold py-1.5 rounded-lg bg-red-500 text-white cursor-pointer active:scale-95 transition-transform"
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
        <div className="md:border-y md:border-border/60">
        {editandoPost ? (
          <div className="px-4 py-3">
            <textarea
              value={textoEdicion}
              onChange={e => setTextoEdicion(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') setEditandoPost(false); }}
              rows={3}
              autoFocus
              className="w-full text-[14px] md:text-[13px] text-foreground leading-relaxed outline-none resize-none rounded-xl px-3 py-2"
              style={{ background: '#fff', border: '1px solid rgba(124,58,237,0.25)' }}
            />
            <div className="flex items-center justify-end gap-2 mt-2">
              <button
                onClick={() => setEditandoPost(false)}
                className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-muted-foreground hover:bg-secondary transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardarEdicion}
                disabled={guardandoPost || !textoEdicion.trim()}
                className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white disabled:opacity-50 cursor-pointer"
                style={{ background: 'linear-gradient(135deg,#7C3AED,#4361EE)' }}
              >
                {guardandoPost ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        ) : (
          <p className="px-4 py-3 text-[14px] md:text-[13px] text-foreground leading-relaxed whitespace-pre-wrap">{post.content}</p>
        )}
        </div>

      </div>

      {/* Media — proporcion fija para que el feed no salte de altura:
          1:1 en fotos (como Instagram) y 9:16 en video. La imagen va completa
          con `contain`, nunca recortada, y el sobrante queda en gris neutro.
          En escritorio ocupa la columna izquierda de altura completa. */}
      {post.imageUrl && (
        <div className={`overflow-hidden${
          parteEnDos
            ? ' mb-3 md:mb-0 md:col-start-1 md:row-start-1 md:row-span-2 md:self-start'
            : ' mb-3'}`}>
          {isVideo ? (
            <div className="w-full mx-auto" style={{ aspectRatio: '9 / 16', maxWidth: 360, background: '#f4f4f6' }}>
              <video src={post.imageUrl} controls className="w-full h-full object-contain" />
            </div>
          ) : isFile ? (
            <a href={post.imageUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 mx-4 px-4 py-3 rounded-xl border border-border hover:bg-secondary transition-colors">
              <FileText className="w-5 h-5 shrink-0" style={{ color: '#4361EE' }} />
              <span className="text-[13px] font-semibold text-foreground truncate">Ver archivo adjunto</span>
            </a>
          ) : (
            <div className="w-full mx-auto" style={{ aspectRatio: '1 / 1', maxWidth: 560, background: '#f4f4f6' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.imageUrl} alt="Publicación" className="w-full h-full object-contain" />
            </div>
          )}
        </div>
      )}

      {/* Bloque de abajo: contadores, acciones y comentarios. Ocupa el alto
          restante para que los botones queden anclados al fondo. */}
      <div className="md:col-start-2 md:row-start-2 md:min-w-0 md:flex md:flex-col">

        {/* Contadores clicables */}
        {(likeCount > 0 || post.comments.length > 0) && (
          <div className="relative flex items-center gap-3 px-4 pb-2 md:hidden">
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

            {/* Popover de likes — en portal para evitar el recorte por overflow.
                La condicion va DENTRO de AnimatePresence: envolviendo al portal,
                al cerrar se desmontaba todo de golpe y la animacion de salida
                competia con el borrado de React sobre los mismos nodos, que es lo
                que produce el "removeChild" repetido en /dashboard. Los hijos
                ademas necesitan key propia; un fragmento sin claves impide que
                AnimatePresence los siga. */}
            {typeof document !== 'undefined' && createPortal(
              <AnimatePresence>
                {showLikesPopover && popoverPos && (
                <Fragment key="likes-popover">
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
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3.5 mb-2">
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
                </Fragment>
                )}
              </AnimatePresence>,
              document.body
            )}
          </div>
        )}

        {/* Acciones */}
        <div className="flex items-center border-t border-border/60 md:mt-auto md:gap-6 md:px-4 md:py-1">
          {/* Me gusta */}
          <motion.button onClick={handleLike} whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring' as const, stiffness: 500, damping: 15 }}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 transition-colors hover:bg-secondary/60 md:flex-none md:justify-start md:gap-1.5 md:hover:bg-transparent">
            <motion.div animate={likeAnim ? { scale: [1, 1.4, 1] } : { scale: 1 }} transition={{ duration: 0.35, ease: 'easeInOut' }}>
              <Heart className="w-[17px] h-[17px] md:w-4 md:h-4 transition-colors" fill={liked ? '#EF476F' : 'none'}
                style={{ color: liked ? '#EF476F' : '#8E87A8' }} />
            </motion.div>
            <span className="text-[13px] md:text-[12px] font-semibold" style={{ color: liked ? '#EF476F' : '#8E87A8' }}>Me gusta</span>
            {/* En escritorio el numero acompaña a la palabra: la fila de
                contadores de arriba no se muestra ahi */}
            {likeCount > 0 && (
              <span className="hidden md:inline text-[12px] font-semibold" style={{ color: liked ? '#EF476F' : '#8E87A8' }}>{likeCount}</span>
            )}
          </motion.button>

          <div className="w-px h-7 bg-border/60 md:hidden" />

          {/* Comentar */}
          <motion.button
            onClick={() => { setShowComments(v => !v); setTimeout(() => commentInputRef.current?.focus(), 150); }}
            whileTap={{ scale: 0.95 }}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 transition-colors hover:bg-secondary/60 md:flex-none md:justify-start md:hover:bg-transparent">
            <MessageCircle className="w-[17px] h-[17px] md:w-4 md:h-4" style={{ color: showComments ? '#4361EE' : '#8E87A8' }} />
            <span className="text-[13px] md:text-[12px] font-semibold" style={{ color: showComments ? '#4361EE' : '#8E87A8' }}>Comentar</span>
          </motion.button>

          <div className="w-px h-7 bg-border/60 md:hidden" />

          {/* Compartir */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 transition-colors hover:bg-secondary/60 md:flex-none md:justify-start md:hover:bg-transparent"
            onClick={() => { if (navigator.share) navigator.share({ text: post.content }); }}>
            <ChevronRight className="w-[17px] h-[17px] md:w-4 md:h-4 rotate-[-45deg]" style={{ color: '#8E87A8' }} />
            <span className="text-[13px] md:text-[12px] font-semibold text-muted-foreground">Compartir</span>
          </motion.button>
        </div>

        {/* Comentarios */}
        <AnimatePresence>
          {comentariosVisibles && (
            <motion.div
                initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              style={{ overflow: 'hidden' }}
            >
              {/* En escritorio los comentarios se desplazan dentro de su columna:
                  sin tope, una publicacion con veinte comentarios estiraria la
                  tarjeta y dejaria la imagen flotando con un vacio al lado. */}
              <div className="px-4 pb-4 space-y-3 border-t border-border/40 pt-3 md:border-t-0 md:bg-transparent"
                style={{ background: 'rgba(124,58,237,0.02)' }}>

                {/* Lista de comentarios */}
                {/* Scroll interno: sin tope, una publicacion con treinta
                    comentarios estira la tarjeta hasta el infinito y en
                    escritorio deja la imagen flotando con un vacio al lado.
                    El campo de escribir queda fuera del scroll, siempre visible. */}
                {post.comments.length > 0 && (
                  <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1"
                    style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain' }}>
                    {post.comments.map(c => (
                      <div key={c.id} className="flex items-start gap-2.5 md:gap-2">
                        <button
                          type="button"
                          onClick={() => c.authorClerkId && router.push(`/dashboard/perfil/${c.authorClerkId}`)}
                          className={c.authorClerkId ? 'cursor-pointer shrink-0' : 'cursor-default shrink-0'}
                        >
                          <Avatar src={c.authorAvatar} name={c.authorName} size={28} role={c.authorRole} />
                        </button>
                        <div className="flex-1 min-w-0">
                          {editingComment === c.id ? (
                            /* ── Modo edición inline ── */
                            <div className="rounded-2xl rounded-tl-sm px-3 py-2"
                              style={{ background: '#fff', border: '1px solid rgba(124,58,237,0.18)' }}>
                              <p className="text-[11px] font-semibold text-foreground mb-1">{c.authorName}</p>
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
                                  className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full text-white disabled:opacity-40"
                                  style={{ background: '#7C3AED' }}>
                                  <ContenidoGuardado
                                    estado={savingEdit ? 'guardando' : 'idle'}
                                    textoIdle="Guardar"
                                    textoGuardando="Guardando"
                                    textoGuardado="Guardado"
                                    color="#fff"
                                  />
                                </button>
                                <button onClick={() => setEditingComment(null)}
                                  className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full text-muted-foreground"
                                  style={{ background: 'rgba(0,0,0,0.06)' }}>
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-2xl rounded-tl-sm px-3 py-2 md:rounded-none md:px-0 md:py-0 md:border-0 md:bg-transparent"
                              style={{ background: '#fff', border: '1px solid rgba(124,58,237,0.08)' }}>
                              <p className="text-[11px] font-semibold text-foreground mb-0.5 md:hidden">{c.authorName}</p>
                              <p className="text-[13px] md:text-[12px] text-foreground leading-snug">
                                <span className="hidden md:inline font-semibold">{c.authorName} </span>
                                {c.content}
                              </p>
                            </div>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-0.5 pl-1 md:pl-0">{timeAgo(c.createdAt)}</p>
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

                {/* Input nuevo comentario — con linea arriba en escritorio,
                    para cerrar el bloque de comentarios como en el diseño */}
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
      </div>
    </motion.div>
  );
}

// ── Composer (crear post) ─────────────────────────────────────────────────────

function PostComposer({
  userName, userRole, userAvatar, onSubmit, loading,
}: {
  userName: string; userRole: string; userAvatar?: string | null;
  onSubmit: (content: string, mediaUrl?: string, mediaPublicId?: string, ubicacion?: string) => Promise<void>;
  loading: boolean;
}) {
  const { session: composerSession } = useSession();
  const [open, setOpen]         = useState(false);
  const [content, setContent]   = useState('');
  const [media, setMedia]       = useState<{ url: string; publicId: string; type: string; name: string } | null>(null);
  // Ubicacion en texto libre. No hay mapas ni sedes de por medio: es la
  // etiqueta que el autor le quiere poner a la publicacion.
  const [ubicacion, setUbicacion] = useState('');
  const [uploading, setUploading] = useState(false);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const [sending, setSending]   = useState(false);
  const [estadoPublicado, setEstadoPublicado] = useState<EstadoGuardado>('idle');
  const textRef    = useRef<HTMLTextAreaElement>(null);
  const fileRef    = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    // Único punto de subida que no validaba nada. El backend ahora rechaza lo que
    // no sea imagen, video o PDF, así que conviene avisar antes de leer el archivo.
    const esVideo = file.type.startsWith('video');
    const esImagen = file.type.startsWith('image');
    const esPdf = file.type === 'application/pdf';
    if (!esVideo && !esImagen && !esPdf) {
      setErrorArchivo('Solo se permiten imágenes, videos o PDF.');
      return;
    }
    const maxMB = esVideo ? 40 : esImagen ? 5 : 10;
    if (file.size > maxMB * 1024 * 1024) {
      setErrorArchivo(`El archivo supera el máximo de ${maxMB} MB.`);
      return;
    }
    setErrorArchivo(null);

    setUploading(true);
    try {
      const type = esVideo ? 'video' : esImagen ? 'image' : 'raw';
      const reader = new FileReader();
      const base64 = await new Promise<string>(res => {
        reader.onload = e => res(e.target?.result as string);
        reader.readAsDataURL(file);
      });
      const freshToken = await composerSession?.getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/posts/upload-media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(freshToken ? { Authorization: `Bearer ${freshToken}` } : {}) },
        body: JSON.stringify({ data: base64, type }),
      });
      const data = await res.json();
      if (data.url) setMedia({ url: data.url, publicId: data.publicId, type: data.mediaType, name: file.name });
    } catch { /* silencioso */ } finally { setUploading(false); }
  }

  async function handleSubmit() {
    const text = content.trim();
    if (!text) return;
    setSending(true); setEstadoPublicado('guardando');
    try {
      await onSubmit(text, media?.url, media?.publicId, ubicacion.trim() || undefined);
      // Confirma antes de cerrar el compositor, para que quede claro que la
      // publicacion si entro
      setEstadoPublicado('guardado');
      await new Promise(r => setTimeout(r, MS_GUARDADO));
      setContent(''); setMedia(null); setUbicacion(''); setOpen(false);
      setEstadoPublicado('idle');
    } catch {
      setEstadoPublicado('idle');
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
        {/* Atajo de foto mientras el compositor esta plegado: sin el, la fila
            compacta de movil no ofreceria ninguna accion */}
        {!open && !content && !media && (
          <button
            type="button"
            aria-label="Agregar foto"
            onClick={() => { if (fileRef.current) { fileRef.current.accept = 'image/*'; fileRef.current.click(); } }}
            className="sm:hidden shrink-0 mt-1.5"
          >
            <ImageIcon className="w-[18px] h-[18px]" style={{ color: '#7C3AED' }} />
          </button>
        )}
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

      {/* Aviso de archivo rechazado por tipo o tamaño */}
      <AnimatePresence>
        {errorArchivo && (
          <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}
            className="mx-4 mb-3 text-[12px] font-medium" style={{ color: '#DC2626' }}>
            {errorArchivo}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Input file oculto */}
      <input ref={fileRef} type="file" accept="image/*,video/*"
        className="sr-only"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />

      {/* Barra inferior: adjuntos + publicar */}
      {/* Ubicacion — texto libre, aparece con el compositor desplegado */}
      {(open || content || media) && (
        <div className="flex items-center gap-2 px-4 pb-2">
          <MapPin className="w-4 h-4 shrink-0" style={{ color: '#8E87A8' }} />
          <input
            value={ubicacion}
            onChange={e => setUbicacion(e.target.value)}
            placeholder="Agregar ubicación (opcional)"
            maxLength={120}
            className="flex-1 min-w-0 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none bg-transparent"
          />
          {ubicacion && (
            <button type="button" onClick={() => setUbicacion('')} aria-label="Quitar ubicación" className="shrink-0">
              <X className="w-3.5 h-3.5" style={{ color: '#8E87A8' }} />
            </button>
          )}
        </div>
      )}

      <div className={`${open || content || media ? 'flex' : 'hidden sm:flex'} items-center justify-between px-4 pb-4 border-t border-border/60 pt-3 gap-3`}>
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
          className="shrink-0 px-5 py-2 rounded-full text-[13px] font-semibold text-white disabled:opacity-50 transition-opacity"
          style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #4361EE 100%)' }}>
          <ContenidoGuardado
            estado={estadoPublicado}
            textoIdle="Publicar"
            textoGuardando="Publicando"
            textoGuardado="Publicado"
            color="#fff"
          />
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
  // Fichas de Inicio en movil: tres numeros que antes obligaban a entrar a cada modulo
  const [resumen, setResumen] = useState<{ deportistas: number; asistenciaHoy: number; pagosAlDia?: number | null } | null>(null);
  const [loading, setLoading] = useState(true);
  // Sostiene el indicador un minimo de tiempo para que no parpadee
  const mostrarCarga = useCargaMinima(loading);

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

  // Widgets — Próximos eventos y Cumpleaños
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
          meRes, notifRes, postsRes, eventsRes, birdaysRes, resumenRes,
        ] = await Promise.allSettled([
          apiFetch<MeResponse>('/me', { token }),
          apiFetch<{ notifications: typeof notifs }>('/payments/notifications', { token }),
          apiFetch<{ posts: Post[] }>('/posts?scope=public', { token }),
          apiFetch<{ events: typeof upcomingEvents }>('/events/upcoming', { token }),
          apiFetch<{ birthdays: typeof birthdays }>('/members/birthdays', { token }),
          apiFetch<{ deportistas: number; asistenciaHoy: number; pagosAlDia?: number | null }>(
            `/clubs/resumen-inicio?fecha=${new Date().toLocaleDateString('en-CA')}`, { token },
          ),
        ]);

        if (meRes.status === 'rejected') return;
        const res = meRes.value;
        if (res.status === 'superadmin')       { router.push('/superadmin');       return; }
        if (res.status === 'needs_onboarding'){ router.push('/onboarding');        return; }
        if (res.status === 'no_access')        { router.push('/no-access');        return; }
        if (res.status === 'inactive')         { router.push('/inactivo');         return; }
        if (res.status === 'member_inactive')  { router.push('/cuenta-pausada');   return; }
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
        // Falla en silencio a proposito: un deportista no tiene permiso y las
        // fichas simplemente no se muestran, sin romper el resto de Inicio
        if (resumenRes.status === 'fulfilled') setResumen(resumenRes.value);
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

  async function handleCreatePost(content: string, mediaUrl?: string, mediaPublicId?: string, ubicacion?: string) {
    const token = await session?.getToken();
    const res = await apiFetch<{ post: Post }>('/posts', {
      token, method: 'POST',
      body: JSON.stringify({
        content,
        scope: feedScope === 'public' ? 'PUBLIC' : 'PRIVATE',
        ...(mediaUrl ? { mediaUrl, mediaPublicId } : {}),
        ...(ubicacion ? { ubicacion } : {}),
      }),
    });
    setPosts(prev => [res.post, ...prev]);
  }

  async function handleUpdatePost(id: string, cambios: { content?: string; scope?: 'PUBLIC' | 'PRIVATE' }) {
    const token = await session?.getToken();
    const res = await apiFetch<{ post: Post }>(`/posts/${id}`, {
      token, method: 'PATCH', body: JSON.stringify(cambios),
    });
    // Si cambio de pestaña, desaparece de la lista actual: el feed que se ve
    // esta filtrado por alcance y la publicacion ya no pertenece a este.
    const cambioDePestana = cambios.scope !== undefined
      && cambios.scope !== (feedScope === 'public' ? 'PUBLIC' : 'PRIVATE');
    setPosts(prev => cambioDePestana
      ? prev.filter(p => p.id !== id)
      : prev.map(p => (p.id === id ? res.post : p)));
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

  if (mostrarCarga) {
    return (
      <ModuleLoader />
    );
  }

  const user      = me?.user;
  const role      = user?.role ?? 'ADMIN';
  const firstName = user?.name?.split(' ')[0] ?? '';
  const rc        = roleColors[role] ?? roleColors.ADMIN;
  const canPost   = role === 'ADMIN' || role === 'COACH';

  return (
    <div className="min-h-full bg-background">
      <ModuleReveal>

      {/* ── Banner trial ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {trial !== null && role === 'ADMIN' && (
          <motion.div
            className="hidden sm:block"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          >
            <div
              className="mx-4 mt-3 rounded-2xl px-4 py-3"
              style={{
                background: trial.daysLeft <= 3 ? 'rgba(239,71,111,0.08)' : 'rgba(255,183,3,0.09)',
                border: `1px solid ${trial.daysLeft <= 3 ? 'rgba(239,71,111,0.20)' : 'rgba(255,183,3,0.25)'}`,
              }}
            >
              <div className="flex flex-col items-center justify-center gap-2 lg:flex-row lg:gap-4">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-[16px] leading-none">⏳</span>
                  <p className="text-[12px] font-semibold" style={{ color: trial.daysLeft <= 3 ? '#EF476F' : '#B88A00' }}>
                    {trial.daysLeft === 0
                      ? 'Tu período de prueba vence hoy'
                      : `Período de prueba · ${trial.daysLeft} día${trial.daysLeft !== 1 ? 's' : ''} restante${trial.daysLeft !== 1 ? 's' : ''}`}
                  </p>
                </div>
                <Link
                  href="/dashboard/ajustes?tab=suscripcion"
                  className="block w-fit px-4 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: trial.daysLeft <= 3 ? '#EF476F' : '#B88A00' }}
                >
                  {trial.daysLeft <= 3 ? 'Activar plan ahora y no perder el acceso' : 'Activar plan ahora'}
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <InicioHeaderMovil
        clubName={me?.user?.club?.name ?? null}
        clubLogoUrl={me?.user?.club?.logoUrl ?? null}
        userName={me?.user?.name ?? null}
        userPicture={me?.user?.picture ?? null}
        verified={me?.user?.club?.verified}
      />

      {/* ── Móvil: prueba y fichas ──────────────────────────────────────────
          La tarjeta de prueba se encogio a proposito: la version de escritorio
          ocupa un bloque entero con un boton grande, y en un celular eso empuja
          el contenido real fuera de la pantalla. Aqui informa igual, con la
          fecha exacta de fin en vez de solo los dias, sin gritar.

          No se monta sobre el degradado: el encabezado va fijo, asi que al
          hacer scroll la tarjeta terminaria metiendose debajo de el. */}
      <div className="sm:hidden px-4 pt-3 space-y-3">
        {trial !== null && role === 'ADMIN' && (
          <div
            className="rounded-2xl px-3.5 py-3 flex items-center gap-3 bg-white"
            style={{ boxShadow: '0 4px 18px rgba(80,50,160,0.12)' }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: trial.daysLeft <= 3 ? 'rgba(239,71,111,0.10)' : 'rgba(255,183,3,0.14)' }}
            >
              <Clock className="w-[18px] h-[18px]" style={{ color: trial.daysLeft <= 3 ? '#EF476F' : '#854F0B' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-foreground">
                {trial.daysLeft === 0
                  ? 'Tu prueba vence hoy'
                  : `${trial.daysLeft} día${trial.daysLeft !== 1 ? 's' : ''} de prueba`}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                Termina el {new Date(trial.endsAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}
              </p>
            </div>
            <Link
              href="/dashboard/ajustes?tab=suscripcion"
              className="shrink-0 px-3 py-2 rounded-lg text-[11px] font-semibold text-white"
              style={{ background: trial.daysLeft <= 3 ? '#EF476F' : 'linear-gradient(135deg,#7C3AED,#4361EE)' }}
            >
              Activar
            </Link>
          </div>
        )}

        {/* Fichas — el dato ya existia, pero obligaba a entrar a cada módulo */}
        {resumen && (
          <div className="flex gap-2">
            <FichaInicio
              icono={<CheckSquare className="w-[13px] h-[13px]" style={{ color: '#1D9E75' }} />}
              etiqueta="Hoy"
              valor={String(resumen.asistenciaHoy)}
              sufijo={`/${resumen.deportistas}`}
            />
            {/* Solo se oculta si el rol no ve finanzas. Si el mes aun no tiene
                cobros, se muestra con guion: una ficha que desaparece se lee
                como un error, no como "todavia no hay nada" */}
            {resumen.pagosAlDia !== undefined && (
            <FichaInicio
              icono={<Wallet className="w-[13px] h-[13px]" style={{ color: '#BA7517' }} />}
              etiqueta="Al día"
              valor={resumen.pagosAlDia === null ? '—' : String(resumen.pagosAlDia)}
              sufijo={resumen.pagosAlDia === null ? undefined : '%'}
            />
            )}
            <FichaInicio
              icono={<CalendarDays className="w-[13px] h-[13px]" style={{ color: '#D4537E' }} />}
              etiqueta="Eventos"
              valor={String(upcomingEvents.length)}
            />
          </div>
        )}
      </div>

      {/* ── Eventos y cumpleaños (móvil) ────────────────────────────────────
          Suben por encima de la publicidad: Inicio abre mejor con informacion
          del club que con un anuncio. Es `sm:hidden`, asi que escritorio
          conserva sus widgets en la columna derecha. */}
      <div className="sm:hidden px-4 pt-4">
      {/* ── Widgets móvil — grid 2 cols, encima de los tabs ─────────────── */}
      <motion.div variants={cardVariant} className="sm:hidden grid grid-cols-2 gap-3">
        {/* Próximos eventos */}
        <div className="rounded-2xl bg-white border border-border overflow-hidden"
          style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center gap-2 px-3 pt-3 pb-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg,#4361EE,#7C3AED)' }}>
              <CalendarDays className="w-3 h-3 text-white" />
            </div>
            <p className="text-[11px] font-semibold text-foreground truncate">Próximos eventos</p>
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
                      <span className="text-[11px] font-semibold leading-none" style={{ color: tc.text }}>{d.getDate()}</span>
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
            <p className="text-[11px] font-semibold text-foreground">Cumpleaños</p>
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
                          <p className="text-[12px] font-semibold leading-none" style={{ color: daysColor }}>
                            {isTomorrow ? '1' : b.daysUntil}
                          </p>
                          <p className="text-[7px] font-semibold uppercase leading-none mt-0.5" style={{ color: daysColor }}>
                            {isTomorrow ? 'mañ' : 'días'}
                          </p>
                        </>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-foreground truncate">{b.fullName}</p>
                      <p className="text-[10px]" style={{ color: isToday ? '#EF476F' : '#8E87A8', fontWeight: 500 }}>
                        {(() => { const d = new Date(b.birthDate); return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' }); })()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
      </div>

      {/* ── Slideshow publicitario — ancho completo ─────────────────────────── */}
      <div className="w-full px-6 pt-4">
        <Slideshow
          slides={ADS.map(ad => ({ img: ad.image, label: ad.label, title: ad.title, description: ad.description, url: ad.url }))}
        />
      </div>

      {/* ── Contenido principal — desktop: 50% izquierdo, 50% derecho reservado ── */}
      <div className="w-full px-6 py-4">
      {/* Eventos y cumpleaños (escritorio) — en una fila, sobre el feed.
          Antes vivian apilados en una columna derecha que se comia la mitad
          del ancho, dejando las publicaciones en media pantalla. */}
      <div className="hidden sm:grid sm:grid-cols-2 gap-4 mb-4">

        {/* Widget — Próximos eventos */}
        <div className="rounded-2xl bg-white border border-border overflow-hidden"
          style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,#4361EE,#7C3AED)' }}>
                <CalendarDays className="w-3.5 h-3.5 text-white" />
              </div>
              <p className="text-[13px] font-semibold text-foreground">Próximos eventos</p>
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
                      <span className="text-[13px] font-semibold leading-none" style={{ color: tc.text }}>
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
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: tc.bg, color: tc.text }}>
                          {typeLabel[ev.type] ?? ev.type}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{time}</span>
                        {ev.location?.name && (
                          <span className="text-[10px] text-muted-foreground truncate">· {ev.location.name.charAt(0).toUpperCase() + ev.location.name.slice(1).toLowerCase()}</span>
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
            <p className="text-[13px] font-semibold text-foreground">Cumpleaños</p>
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
                          <p className="text-[14px] font-semibold leading-none" style={{ color: daysColor }}>
                            {isTomorrow ? '1' : b.daysUntil}
                          </p>
                          <p className="text-[8px] font-semibold uppercase tracking-wide leading-none mt-0.5" style={{ color: daysColor }}>
                            {isTomorrow ? 'mañana' : 'días'}
                          </p>
                        </>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-foreground truncate">{b.fullName}</p>
                      <p className="text-[11px]" style={{ color: isToday ? '#EF476F' : '#8E87A8', fontWeight: 500 }}>
                        {(() => { const d = new Date(b.birthDate); return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' }); })()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
      <div className="w-full">
      <motion.div
        variants={feedVariants}
        initial="hidden"
        animate="show"
        className="space-y-4 md:space-y-8"
      >

        {/* ── Tabs Público / Privado ──────────────────────────────────────── */}
        <motion.div variants={cardVariant}>
          <div
            className="relative flex rounded-2xl p-1 gap-1"
            style={{ background: '#FFFFFF', boxShadow: '0 1px 4px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(0,0,0,0.06)' }}
          >
            {([
              { key: 'public'  as FeedScope, label: 'Público',  icon: Globe, desc: 'Todos los clubes' },
              { key: 'private' as FeedScope, label: 'Mi club',   icon: Lock,  desc: 'Solo interno' },
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
                    <p className="text-[12px] font-semibold leading-none" style={{ color: active ? '#fff' : '#8E87A8' }}>
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
              <p className="text-[14px] font-semibold text-foreground mb-1">
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
                onUpdatePost={handleUpdatePost}
              />
            ))}
          </AnimatePresence>
        )}

      </motion.div>
      </div>
      </div>
      </ModuleReveal>
    </div>
  );
}
