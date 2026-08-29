'use client';

import { useState, useRef, useEffect, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@clerk/nextjs';
import { apiFetch } from '@/lib/api-client';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MemberAvatar } from '@/components/ui/member-avatar';
import { ContenidoGuardado } from '@/components/ui/save-button-state';
import { VisorImagen } from '@/components/ui/visor-imagen';
import {
  IconChat, IconEditar, IconEliminar, IconMeGusta, IconMeGustaVacio, IconUbicacion,
} from '@/components/ui/custom-icons';
import {
  Globe, Lock, ChevronRight, FileText, SendHorizontal, X, MoreHorizontal, Flag,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PostLike { userId: string }
export interface LikeUser { name: string; picture?: string | null; role?: string }
export interface PostComment {
  id: string; authorClerkId?: string | null; authorName: string; authorRole: string;
  authorAvatar?: string | null; content: string; createdAt: string;
  // Comentario raiz al que responde. Solo hay un nivel: el backend cuelga toda
  // respuesta del raiz, asi que un comentario con parentId nunca tiene hijos.
  parentId?: string | null;
}
export interface Post {
  id: string; clubId: string; clubName: string;
  authorClerkId?: string | null;
  authorName: string; authorRole: string; authorAvatar?: string | null;
  content: string; imageUrl?: string | null; ubicacion?: string | null;
  scope: 'PUBLIC' | 'PRIVATE';
  likes: PostLike[]; comments: PostComment[]; createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROLE_GRADIENT: Record<string, string> = {
  SUPERADMIN: 'linear-gradient(135deg,#EF476F,#C1121F)',
  ADMIN:      'linear-gradient(135deg,#FFB703,#FB8500)',
  ENTRENADOR:      'linear-gradient(135deg,#06D6A0,#0CB68D)',
  DEPORTISTA:    '#381DA0',
};

// Etiqueta del autor con el color de su rol, el mismo que usa el sidebar.
const roleBadge: Record<string, { texto: string; fondo: string }> = {
  SUPERADMIN: { texto: '#B02A47', fondo: 'rgba(239,71,111,0.12)' },
  ADMIN:      { texto: '#854F0B', fondo: 'rgba(255,183,3,0.16)'  },
  ENTRENADOR:      { texto: '#057A5C', fondo: 'rgba(6,214,160,0.14)'  },
  DEPORTISTA:    { texto: '#6D28D9', fondo: 'rgba(56,29,160,0.10)' },
};

const roleLabels: Record<string, string> = {
  SUPERADMIN: 'Super admin',
  ADMIN:      'Administrador',
  ENTRENADOR:      'Entrenador',
  DEPORTISTA:    'Deportista',
};

// Motivos de reporte. Salen de la seccion 5 de los Terminos, que es lo que el
// usuario acepto: si un motivo no corresponde a una regla escrita, no hay con
// que sustentar el retiro del contenido despues.
const MOTIVOS: { valor: string; etiqueta: string }[] = [
  { valor: 'SPAM',             etiqueta: 'Spam o publicidad engañosa' },
  { valor: 'ACOSO',            etiqueta: 'Acoso, insultos o difamación' },
  { valor: 'ODIO',             etiqueta: 'Discriminación u odio' },
  { valor: 'CONTENIDO_SEXUAL', etiqueta: 'Contenido sexual u obsceno' },
  { valor: 'VIOLENCIA',        etiqueta: 'Violencia o contenido perturbador' },
  { valor: 'SUPLANTACION',     etiqueta: 'Suplantación de identidad' },
  { valor: 'DERECHOS_AUTOR',   etiqueta: 'Uso de contenido sin permiso' },
  { valor: 'OTRO',             etiqueta: 'Otro motivo' },
];

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
      gradient={ROLE_GRADIENT[role ?? ''] ?? ROLE_GRADIENT.DEPORTISTA}
      size={size}
    />
  );
}

// ── PostCard ──────────────────────────────────────────────────────────────────
// Una sola tarjeta para Inicio, Club y Mi perfil. Estuvo duplicada mucho
// tiempo y cada arreglo habia que repetirlo en los dos lados; lo que se ve en
// la comunidad y lo que se ve en el club son ahora el mismo componente.

// ── PostCard ──────────────────────────────────────────────────────────────────

export function PostCard({
  post, currentUserId, canDelete, clubIdPropio, compacto = false, onLike, onDelete, onComment, onDeleteComment, onEditComment, onFetchLikes, onUpdatePost,
}: {
  post: Post; currentUserId: string; canDelete: boolean;
  /** La tarjeta vive en una columna angosta (Mi club, Mi perfil): se arma
   *  siempre con el diseño de movil, sin partirse en dos columnas. */
  compacto?: boolean;
  /** Club de quien mira. Se omite en los feeds que solo traen publicaciones
   *  del propio club (Mi club y Mi perfil); en el feed publico de Inicio hay
   *  publicaciones de otros clubes y ahi si hace falta. */
  clubIdPropio?: string | null;
  onLike: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdatePost: (id: string, cambios: { content?: string; scope?: 'PUBLIC' | 'PRIVATE' }) => Promise<void>;
  onComment: (postId: string, content: string, parentId?: string) => Promise<void>;
  onDeleteComment: (postId: string, commentId: string) => void;
  onEditComment: (postId: string, commentId: string, content: string) => Promise<void>;
  onFetchLikes: (postId: string) => Promise<LikeUser[]>;
}) {
  const router    = useRouter();
  const liked     = post.likes.some(l => l.userId === currentUserId);
  const likeCount = post.likes.length;
  // Una publicacion le pertenece a quien la hizo. El menu de editar, mover y
  // eliminar solo aparece para el autor, sin importar su rol: un administrador
  // no administra las publicaciones de los demas.
  const esAutor = !!post.authorClerkId && post.authorClerkId === currentUserId;
  // Los comentarios si los modera quien dirige el club, pero solo dentro de su
  // club. En el feed publico de Inicio aparecen publicaciones de otros clubes y
  // ahi el menu no debe salir: el servidor responde 404 a ese intento, asi que
  // mostrarlo solo prometia algo que no se puede hacer.
  // Moderar lo ajeno es un extra acotado del administrador y solo dentro de las
  // publicaciones internas del club. El feed publico es de todos los clubes:
  // ahi cada quien responde por lo suyo y nadie modera a nadie.
  const moderaComentarios = canDelete
    && post.scope === 'PRIVATE'
    && (!clubIdPropio || post.clubId === clubIdPropio);
  // Lo propio se edita y se borra siempre, sin importar el rol: nadie tiene
  // que pedirle permiso a nadie para corregir o retirar lo que escribio.
  const esMio = (c: PostComment) => !!c.authorClerkId && c.authorClerkId === currentUserId;
  const puedoTocar = (c: PostComment) => esMio(c) || moderaComentarios;
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
  // Solo para fotos: el video ya trae su reproductor y el adjunto se descarga.
  const [visorAbierto, setVisorAbierto] = useState(false);

  // ── Reportar ──────────────────────────────────────────────────────────────
  // La llamada se hace aca dentro y no por prop como el resto: reportar es un
  // trozo cerrado que no toca el estado del feed, y pasarlo por prop obligaba
  // a repetir el mismo codigo en las cuatro pantallas que montan la tarjeta.
  const { session: sesion } = useSession();
  // Guarda el comentario reportado, o 'post' si es la publicacion
  const [reportando, setReportando]   = useState<string | null>(null);
  const [motivo, setMotivo]           = useState('');
  const [detalle, setDetalle]         = useState('');
  const [enviandoRep, setEnviandoRep] = useState(false);
  const [reportado, setReportado]     = useState(false);

  function abrirReporte(objetivo: string) {
    setReportando(objetivo);
    setMotivo('');
    setDetalle('');
    setReportado(false);
  }

  async function enviarReporte() {
    if (!reportando || !motivo || enviandoRep) return;
    setEnviandoRep(true);
    try {
      const token = await sesion?.getToken();
      const ruta = reportando === 'post'
        ? `/posts/${post.id}/report`
        : `/posts/${post.id}/comments/${reportando}/report`;
      await apiFetch(ruta, {
        token, method: 'POST',
        body: JSON.stringify({ motivo, detalle: detalle.trim() || undefined }),
      });
      setReportado(true);
    } catch { /* el aviso de abajo no distingue: reportar no confirma nada */ }
    finally { setEnviandoRep(false); }
  }

  // Comentario al que se le esta respondiendo, si hay alguno
  const [respondiendoA, setRespondiendoA] = useState<{ id: string; nombre: string } | null>(null);
  // Hilos desplegados a mano, por id del comentario raiz
  const [hilosAbiertos, setHilosAbiertos] = useState<Set<string>>(new Set());

  function alternarHilo(raizId: string) {
    setHilosAbiertos(prev => {
      const siguiente = new Set(prev);
      if (siguiente.has(raizId)) siguiente.delete(raizId);
      else siguiente.add(raizId);
      return siguiente;
    });
  }

  function responderA(c: PostComment) {
    // Se manda el comentario que se toco, no la raiz del hilo. El backend ya
    // cuelga la respuesta de la raiz por su cuenta, y necesita saber a quien
    // se le contesta para avisarle: mandando la raiz, en un hilo propio el
    // aviso no le llegaba a nadie.
    setRespondiendoA({ id: c.id, nombre: c.authorName });
    setShowComments(true);
    // Al responder dentro de un hilo plegado, abrirlo: si no, la respuesta
    // recien escrita aterriza donde no se ve.
    setHilosAbiertos(prev => new Set(prev).add(c.parentId ?? c.id));
    setTimeout(() => commentInputRef.current?.focus(), 150);
  }

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

  // Menú ⋯ por comentario. La posicion se guarda aparte porque el menu se
  // dibuja en un portal: dentro de la lista quedaba recortado por el
  // overflow del scroll, y contra un recorte por overflow el z-index no puede.
  const [commentMenu, setCommentMenu]       = useState<string | null>(null); // commentId con menú abierto
  const [commentMenuPos, setCommentMenuPos] = useState<{ top: number; left: number } | null>(null);

  function abrirMenuComentario(id: string, boton: HTMLElement) {
    if (commentMenu === id) { setCommentMenu(null); return; }
    const r = boton.getBoundingClientRect();
    const ancho = 140;
    // Se ancla a la derecha del boton y se limita al viewport para que no
    // se salga por el borde cuando el comentario esta pegado al filo.
    const left = Math.min(Math.max(8, r.right - ancho), window.innerWidth - ancho - 8);
    setCommentMenuPos({ top: r.bottom + 6, left });
    setCommentMenu(id);
  }
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
      await onComment(post.id, text, respondiendoA?.id);
      setCommentText('');
      setRespondiendoA(null);
    } finally { setSendingComment(false); }
  }

  // Detectar si media es video por extensión o URL
  const isVideo = post.imageUrl && /\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(post.imageUrl);
  const isFile  = post.imageUrl && !isVideo && /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar)(\?|$)/i.test(post.imageUrl);
  // Solo foto y video parten la tarjeta en dos: un adjunto es una fila de
  // enlace y no llena una columna. Sin media, la tarjeta va a lo ancho.
  const parteEnDos = !!post.imageUrl && !isFile;
  // En Mi club y Mi perfil la publicacion vive en media pantalla, con la
  // columna de contacto al lado. Ese ancho no da para partir la tarjeta en
  // dos: la imagen y los comentarios quedarian en dos franjas ilegibles. Ahi
  // se arma siempre como en movil, aunque se este en escritorio.
  const dosColumnas = parteEnDos && !compacto;

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
  // Con el diseño compacto los comentarios arrancan cerrados, como en movil:
  // no hay columna derecha que llenar.
  const comentariosVisibles = showComments || (esEscritorio && !compacto);

  // Un comentario, ya sea raiz o respuesta. Se comparte entre los dos para que
  // editar, moderar y responder se comporten igual en ambos niveles.
  function renderComentario(c: PostComment, esRespuesta: boolean) {
    const tam = esRespuesta ? 22 : 28;
    return (
      <div key={c.id} className="flex items-start gap-2.5 md:gap-2">
        <button
          type="button"
          onClick={() => c.authorClerkId && router.push(`/dashboard/perfil/${c.authorClerkId}`)}
          className={c.authorClerkId ? 'cursor-pointer shrink-0' : 'cursor-default shrink-0'}
        >
          <Avatar src={c.authorAvatar} name={c.authorName} size={tam} role={c.authorRole} />
        </button>
      <div className="flex-1 min-w-0">
        {editingComment === c.id ? (
          /* ── Modo edición inline ── */
          <div className="rounded-2xl rounded-tl-sm px-3 py-2"
            style={{ background: '#fff', border: '1px solid rgba(56,29,160,0.18)' }}>
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
                style={{ background: '#381DA0' }}>
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
          /* Mismo comentario en todos los tamaños: sin burbuja,
             el nombre con la hora al lado y el texto debajo. */
          <div>
            <p className="text-[12px] md:text-[11px] font-semibold text-foreground mb-[3px]">
              {c.authorName}
              <span className="text-[10px] font-normal text-muted-foreground ml-2">{timeAgo(c.createdAt)}</span>
            </p>
            <p className="text-[13px] md:text-[12px] text-foreground leading-snug">{c.content}</p>
            {/* Responder va en violeta a proposito: es lo que queremos que la
                gente haga. No aparece sobre lo propio — "Respondiendo a ti
                mismo" no significa nada; para eso esta el campo de abajo. */}
            {!esMio(c) && (
              <button
                type="button"
                onClick={() => responderA(c)}
                className="mt-1.5 text-[10.5px] font-bold transition-opacity hover:opacity-70"
                style={{ color: '#381DA0' }}
              >
                Responder
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Botón ⋯ con dropdown ── */}
      {(puedoTocar(c) || !esMio(c)) && editingComment !== c.id && (
        <div className="mt-1 shrink-0">
          <button
            onClick={e => abrirMenuComentario(c.id, e.currentTarget)}
            className="w-6 h-6 rounded-full flex items-center justify-center transition-all"
            style={{ color: '#C4C2CF' }}
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
          {typeof document !== 'undefined' && createPortal(
            <AnimatePresence>
              {commentMenu === c.id && commentMenuPos && (
              <Fragment key={`menu-${c.id}`}>
                {/* Overlay para cerrar */}
                <div className="fixed inset-0 z-[9998]" onClick={() => setCommentMenu(null)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: -4 }}
                  transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
                  className="flex flex-col overflow-hidden"
                  style={{
                    position: 'fixed',
                    top: commentMenuPos.top,
                    left: commentMenuPos.left,
                    zIndex: 9999,
                    background: '#fff',
                    border: '1px solid rgba(56,29,160,0.12)',
                    borderRadius: 12,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                    minWidth: 140,
                  }}
                >
                  {!esMio(c) && (
                    <>
                      <button
                        onClick={() => { setCommentMenu(null); abrirReporte(c.id); }}
                        className="flex items-center gap-2 px-3.5 py-2.5 text-[12px] font-semibold text-foreground hover:bg-secondary/60 transition-colors text-left"
                      >
                        <Flag className="w-3.5 h-3.5 text-muted-foreground" /> Reportar
                      </button>
                      <div style={{ height: 1, background: 'rgba(56,29,160,0.07)' }} />
                    </>
                  )}
                  {puedoTocar(c) && (
                  <>
                  <button
                    onClick={() => { setCommentMenu(null); setEditingComment(c.id); setEditText(c.content); }}
                    className="flex items-center gap-2 px-3.5 py-2.5 text-[12px] font-semibold text-foreground hover:bg-secondary/60 transition-colors text-left"
                  >
                    <IconEditar className="w-3.5 h-3.5 text-muted-foreground" /> Editar
                  </button>
                  <div style={{ height: 1, background: 'rgba(56,29,160,0.07)' }} />
                  <button
                    onClick={() => { setCommentMenu(null); onDeleteComment(post.id, c.id); }}
                    className="flex items-center gap-2 px-3.5 py-2.5 text-[12px] font-semibold text-red-500 hover:bg-red-50 transition-colors text-left"
                  >
                    <IconEliminar className="w-3.5 h-3.5" /> Eliminar
                  </button>
                  <div style={{ height: 1, background: 'rgba(56,29,160,0.07)' }} />
                  </>
                  )}
                  <button
                    onClick={() => setCommentMenu(null)}
                    className="flex items-center gap-2 px-3.5 py-2.5 text-[12px] font-semibold text-muted-foreground hover:bg-secondary/60 transition-colors text-left"
                  >
                    <X className="w-3.5 h-3.5" /> Cancelar
                  </button>
                </motion.div>
              </Fragment>
              )}
            </AnimatePresence>,
            document.body
          )}
        </div>
      )}
      </div>
    );
  }


  // ── Hilos ───────────────────────────────────────────────────────────────
  // La API devuelve la conversacion plana; aca se arma en dos niveles. Una
  // respuesta cuyo padre no vino en el lote —el listado se corta en 100— se
  // trata como raiz: es preferible verla suelta a que desaparezca.
  const respuestasPorRaiz = new Map<string, PostComment[]>();
  const idsPresentes = new Set(post.comments.map(c => c.id));
  const comentariosRaiz: PostComment[] = [];
  for (const c of post.comments) {
    if (c.parentId && idsPresentes.has(c.parentId)) {
      const hilo = respuestasPorRaiz.get(c.parentId) ?? [];
      hilo.push(c);
      respuestasPorRaiz.set(c.parentId, hilo);
    } else {
      comentariosRaiz.push(c);
    }
  }

  // Cuantas respuestas se ven sin desplegar. En movil ninguna: un hilo abierto
  // empuja el resto de la conversacion fuera de la pantalla. Con la tarjeta
  // partida en dos los comentarios tienen columna propia y caben todas.
  const respuestasALaVista = dosColumnas ? Infinity : (esEscritorio ? 3 : 0);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 10 }}
      animate={{ opacity: 1, scale: 1,    y: 0 }}
      exit={{    opacity: 0, scale: 0.95, y: -8 }}
      transition={{ type: 'spring' as const, stiffness: 300, damping: 26 }}
      layout
      className={`bg-white border border-border rounded-2xl overflow-hidden${
        dosColumnas ? ' md:grid md:grid-cols-[22rem_1fr] md:grid-rows-[auto_1fr]' : ''}`}
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(0,0,0,0.06)' }}
    >
      {/* En escritorio la tarjeta es una rejilla de 2x2: la imagen ocupa la
          columna izquierda completa y el contenido se reparte en dos celdas a
          la derecha. Son dos y no cinco a proposito: con una celda por seccion,
          las filas se estiraban para igualar el alto de la imagen y el autor,
          el texto y los botones quedaban separados por huecos enormes. */}
      {/* Bloque de arriba: autor y texto. Va en una celda propia para que
          no se estire a lo alto igualando la imagen. */}
      <div className={dosColumnas ? 'md:col-start-2 md:row-start-1 md:min-w-0' : ''}>
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
                    background: (roleBadge[post.authorRole] ?? roleBadge.DEPORTISTA).fondo,
                    color:      (roleBadge[post.authorRole] ?? roleBadge.DEPORTISTA).texto,
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
                    <IconUbicacion className="inline w-3 h-3 -mt-0.5" style={{ color: '#8E87A8' }} />
                    {' '}{post.ubicacion}
                  </>
                )}
              </p>
            </div>
          </div>
          {/* El menu ya no es solo del autor: quien no lo es tambien lo abre,
              y adentro encuentra Reportar en lugar de editar y borrar. */}
          {(esAutor || !!post.authorClerkId) && (
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
                      minWidth: 178,
                    }}
                  >
                    {!esAutor && (
                      <button
                        onClick={() => { setPostMenuOpen(false); abrirReporte('post'); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold text-foreground hover:bg-secondary transition-colors cursor-pointer"
                      >
                        <Flag className="w-3.5 h-3.5" /> Reportar
                      </button>
                    )}
                    {esAutor && (
                    <button
                      onClick={() => { setPostMenuOpen(false); setEditandoPost(true); setTextoEdicion(post.content); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold text-foreground hover:bg-secondary transition-colors cursor-pointer"
                    >
                      <IconEditar className="w-3.5 h-3.5" /> Editar
                    </button>
                    )}
                    {/* Mover cambia la pestaña donde aparece la publicacion:
                        de Publico a Mi club y al reves. El texto dice a donde
                        va, no donde esta, para que no haya que adivinar. */}
                    {esAutor && (
                    <button
                      onClick={() => { setPostMenuOpen(false); handleMoverPost(); }}
                      disabled={moviendoPost}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold text-foreground hover:bg-secondary transition-colors cursor-pointer border-t border-border/50 disabled:opacity-50 whitespace-nowrap"
                    >
                      {post.scope === 'PUBLIC'
                        ? <><Lock className="w-3.5 h-3.5 shrink-0" /> Mover a Mi club</>
                        : <><Globe className="w-3.5 h-3.5 shrink-0" /> Mover a Público</>}
                    </button>
                    )}
                    {esAutor && (
                    <button
                      onClick={() => { setPostMenuOpen(false); setConfirmDel(true); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold text-red-500 hover:bg-red-50 transition-colors cursor-pointer border-t border-border/50"
                    >
                      <IconEliminar className="w-3.5 h-3.5" /> Eliminar
                    </button>
                    )}
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
        <div className={dosColumnas ? 'md:border-y md:border-border/60' : ''}>
        {editandoPost ? (
          <div className="px-4 py-3">
            <textarea
              value={textoEdicion}
              onChange={e => setTextoEdicion(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') setEditandoPost(false); }}
              rows={3}
              autoFocus
              className="w-full text-[14px] md:text-[13px] text-foreground leading-relaxed outline-none resize-none rounded-xl px-3 py-2"
              style={{ background: '#fff', border: '1px solid rgba(56,29,160,0.25)' }}
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
                style={{ background: '#381DA0' }}
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
          dosColumnas
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
            <button
              type="button"
              onClick={() => setVisorAbierto(true)}
              aria-label="Ver la foto en grande"
              className="w-full mx-auto block cursor-zoom-in"
              style={{ aspectRatio: '1 / 1', maxWidth: 560, background: '#f4f4f6' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.imageUrl} alt="Publicación" className="w-full h-full object-contain" />
            </button>
          )}
        </div>
      )}

      {/* Bloque de abajo: contadores, acciones y comentarios. Ocupa el alto
          restante para que los botones queden anclados al fondo. */}
      <div className={dosColumnas ? 'md:col-start-2 md:row-start-2 md:min-w-0 md:flex md:flex-col' : ''}>

        {/* Contadores clicables.
            El contenedor se pinta SIEMPRE, aunque no haya nada que contar: es
            suyo el `pb-3` que separa el texto de los botones y el `md:mt-auto`
            que ancla el bloque al fondo en escritorio. Cuando dependía de que
            hubiera interacciones, un post sin likes ni comentarios perdía las
            dos cosas de golpe — la fila de acciones subía a pegarse al texto y
            en dos columnas quedaba un hueco debajo. Los que cambian son los
            botones de adentro, no el espacio. */}
        <div className={`relative flex items-center gap-3 px-4 pt-0.5 pb-3${dosColumnas ? ' md:order-2 md:mt-auto' : ''}`}>
            {likeCount > 0 && (
              <button
                ref={likesButtonRef}
                onClick={handleShowLikes}
                className="text-[12px] md:text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                {likeCount} Me gusta
              </button>
            )}
            {post.comments.length > 0 && (
              <button
                onClick={() => { setShowComments(true); setTimeout(() => commentInputRef.current?.focus(), 150); }}
                className="text-[12px] md:text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                {post.comments.length} Comentario{post.comments.length !== 1 ? 's' : ''}
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
                      border: '1px solid rgba(56,29,160,0.12)',
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
                        <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#381DA0', borderTopColor: 'transparent' }} />
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

        {/* Acciones */}
        <div className={`flex items-center border-t border-border/60${dosColumnas ? ' md:order-3 md:gap-6 md:px-4 md:py-1' : ''}`}>
          {/* Me gusta */}
          <motion.button onClick={handleLike} whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring' as const, stiffness: 500, damping: 15 }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 transition-colors hover:bg-secondary/60${dosColumnas ? ' md:flex-none md:justify-start md:gap-1.5 md:hover:bg-transparent' : ''}`}>
            <motion.div animate={likeAnim ? { scale: [1, 1.4, 1] } : { scale: 1 }} transition={{ duration: 0.35, ease: 'easeInOut' }}>
              {/* Dos dibujos distintos y no el mismo relleno y sin rellenar: el
                  de sin marcar es un corazón a medias, que se lee como «falta
                  algo» aun en gris, y el marcado es el corazón entero en rojo.
                  El cambio de forma se nota también en la miniatura del móvil,
                  donde un relleno de 17 px casi no se distingue. */}
              {liked
                ? <IconMeGusta className="w-[17px] h-[17px] md:w-4 md:h-4" style={{ color: '#EF476F' }} />
                : <IconMeGustaVacio className="w-[17px] h-[17px] md:w-4 md:h-4" style={{ color: '#8E87A8' }} />}
            </motion.div>
            <span className="text-[13px] md:text-[12px] font-semibold" style={{ color: liked ? '#EF476F' : '#8E87A8' }}>Me gusta</span>
          </motion.button>

          <div className={`w-px h-7 bg-border/60${dosColumnas ? ' md:hidden' : ''}`} />

          {/* Comentar */}
          <motion.button
            onClick={() => { setShowComments(v => !v); setTimeout(() => commentInputRef.current?.focus(), 150); }}
            whileTap={{ scale: 0.95 }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 transition-colors hover:bg-secondary/60${dosColumnas ? ' md:flex-none md:justify-start md:hover:bg-transparent' : ''}`}>
            <IconChat className="w-[17px] h-[17px] md:w-4 md:h-4" style={{ color: showComments ? '#4361EE' : '#8E87A8' }} />
            <span className="text-[13px] md:text-[12px] font-semibold" style={{ color: showComments ? '#4361EE' : '#8E87A8' }}>Comentar</span>
          </motion.button>

          <div className={`w-px h-7 bg-border/60${dosColumnas ? ' md:hidden' : ''}`} />

          {/* Compartir */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 transition-colors hover:bg-secondary/60${dosColumnas ? ' md:flex-none md:justify-start md:hover:bg-transparent' : ''}`}
            onClick={() => { if (navigator.share) navigator.share({ text: post.content }); }}>
            <ChevronRight className="w-[17px] h-[17px] md:w-4 md:h-4 rotate-[-45deg]" style={{ color: '#8E87A8' }} />
            <span className="text-[13px] md:text-[12px] font-semibold text-muted-foreground">Compartir</span>
          </motion.button>
        </div>

        {/* Comentarios */}
        <AnimatePresence>
          {comentariosVisibles && post.comments.length > 0 && (
            <motion.div
                initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              style={{ overflow: 'hidden' }}
              /* En escritorio los comentarios van entre la descripcion y el
                 contador, por eso el order; en movil conservan su sitio abajo.
                 flex-1 + min-h-0: la lista es lo unico elastico de la columna,
                 se queda con el alto que sobra despues de cabecera, descripcion,
                 contador, acciones y campo de escribir. */
              className={dosColumnas ? 'md:order-1 md:flex-1 md:min-h-0 md:flex md:flex-col' : ''}
            >
              {/* En escritorio los comentarios se desplazan dentro de su columna:
                  sin tope, una publicacion con veinte comentarios estiraria la
                  tarjeta y dejaria la imagen flotando con un vacio al lado. */}
              <div className={`px-4 pb-2 border-t border-border/40 pt-3${dosColumnas ? ' md:border-t-0 md:bg-transparent md:flex-1 md:min-h-0 md:overflow-y-auto' : ''}`}
                style={{ background: 'rgba(56,29,160,0.02)' }}>

                {/* Lista de comentarios.
                    En escritorio el scroll lo hace el contenedor de arriba, que
                    mide el hueco real que deja la imagen; aqui no hay tope fijo
                    porque un tope en px sobra con imagenes altas y falta con
                    imagenes bajas. En movil la tarjeta no tiene alto limite, asi
                    que si hace falta un tope para que no crezca sin fin. */}
                {post.comments.length > 0 && (
                  <div className={`space-y-2.5 max-h-[300px] overflow-y-auto pr-1${dosColumnas ? ' md:max-h-none md:overflow-visible md:pr-0' : ''}`}
                    style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain' }}>
                    {comentariosRaiz.map(raiz => {
                      const hilo = respuestasPorRaiz.get(raiz.id) ?? [];
                      const abierto = hilosAbiertos.has(raiz.id);
                      const visibles = abierto ? hilo : hilo.slice(0, respuestasALaVista);
                      const ocultas  = hilo.length - visibles.length;
                      return (
                        <div key={raiz.id}>
                          {renderComentario(raiz, false)}
                          {hilo.length > 0 && (
                            /* La guia vertical es lo que deja ver de un vistazo
                               donde empieza y termina cada conversacion. */
                            <div className="mt-2 ml-[34px] md:ml-[30px] pl-3 flex flex-col gap-2.5"
                              style={{ borderLeft: '2px solid rgba(56,29,160,0.16)' }}>
                              {visibles.map(r => renderComentario(r, true))}
                            </div>
                          )}
                          {ocultas > 0 && (
                            <button
                              type="button"
                              onClick={() => alternarHilo(raiz.id)}
                              className="flex items-center gap-2 mt-2 ml-[34px] md:ml-[30px] text-[10.5px] font-bold transition-opacity hover:opacity-70"
                              style={{ color: '#381DA0' }}
                            >
                              <span className="block w-[18px] h-[2px] rounded-full" style={{ background: 'rgba(56,29,160,0.28)' }} />
                              Ver {ocultas} respuesta{ocultas !== 1 ? 's' : ''}
                            </button>
                          )}
                          {abierto && hilo.length > respuestasALaVista && (
                            <button
                              type="button"
                              onClick={() => alternarHilo(raiz.id)}
                              className="flex items-center gap-2 mt-2 ml-[34px] md:ml-[30px] text-[10.5px] font-bold transition-opacity hover:opacity-70"
                              style={{ color: '#8E87A8' }}
                            >
                              <span className="block w-[18px] h-[2px] rounded-full" style={{ background: 'rgba(142,135,168,0.35)' }} />
                              Ocultar respuestas
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Campo de escribir. Va aparte de la lista porque en escritorio queda
            al pie de la tarjeta, debajo de la fila de acciones, y asi no se
            desplaza junto con los comentarios: siempre esta a la vista.
            En movil queda justo despues de la lista, igual que antes. */}
        <AnimatePresence>
          {comentariosVisibles && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              style={{ overflow: 'hidden' }}
              className={dosColumnas ? 'md:order-4' : ''}
            >
              <div className={`px-4 pb-4 pt-1${dosColumnas ? ' md:pt-2.5 md:pb-2.5 md:border-t md:border-border/60' : ''}`}
                style={{ background: 'rgba(56,29,160,0.02)' }}>
                {/* Sin esta pastilla, en un hilo largo se pierde de vista a
                    quien le estas contestando. */}
                {respondiendoA && (
                  <div className="flex items-center gap-2 mb-2 rounded-full pl-3 pr-1 py-1 self-start w-fit"
                    style={{ background: 'rgba(56,29,160,0.09)' }}>
                    <span className="text-[10.5px] font-bold" style={{ color: '#381DA0' }}>
                      Respondiendo a {respondiendoA.nombre}
                    </span>
                    <button
                      type="button"
                      onClick={() => setRespondiendoA(null)}
                      aria-label="Cancelar la respuesta"
                      className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(56,29,160,0.18)', color: '#381DA0' }}
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 rounded-full px-3 py-2"
                    style={{ background: '#fff', border: '1px solid rgba(56,29,160,0.12)' }}>
                    <input
                      ref={commentInputRef}
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComment(); }
                        // Escape con el campo vacio suelta la respuesta y
                        // vuelve a comentar la publicacion.
                        if (e.key === 'Escape' && !commentText) setRespondiendoA(null);
                      }}
                      placeholder={respondiendoA ? `Respondiendo a ${respondiendoA.nombre}...` : 'Escribe un comentario...'}
                      className="flex-1 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none bg-transparent"
                    />
                  </div>
                  <motion.button
                    onClick={handleComment}
                    disabled={!commentText.trim() || sendingComment}
                    whileTap={{ scale: 0.9 }}
                    className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-40 transition-opacity"
                    style={{ background: '#381DA0' }}>
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

      {post.imageUrl && !isVideo && !isFile && (
        <VisorImagen
          url={post.imageUrl}
          alt={`Foto de la publicación de ${post.authorName}`}
          abierto={visorAbierto}
          onCerrar={() => setVisorAbierto(false)}
        />
      )}

      {/* ── Reportar ────────────────────────────────────────────────────────
          En portal porque la tarjeta recorta por overflow y en escritorio
          vive dentro de una columna con scroll propio. */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {reportando && (
            <motion.div
              key="reporte"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              onClick={() => setReportando(null)}
              className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-6"
              style={{ background: 'rgba(20,12,36,0.55)', zIndex: 80 }}
            >
              <motion.div
                initial={{ opacity: 0, y: 40, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 40, scale: 0.98 }}
                transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                onClick={e => e.stopPropagation()}
                className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden"
                style={{ maxHeight: '88dvh', display: 'flex', flexDirection: 'column' }}
              >
                {reportado ? (
                  <div className="px-6 py-8 flex flex-col items-center text-center gap-2">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-1"
                      style={{ background: '#381DA0' }}>
                      <Flag className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-[15px] font-semibold text-foreground">Gracias por avisar</p>
                    <p className="text-[13px] text-muted-foreground leading-relaxed max-w-[34ch]">
                      Vamos a revisarlo y a retirarlo si incumple los Términos. No le contamos
                      a nadie quién lo reportó.
                    </p>
                    <button
                      onClick={() => setReportando(null)}
                      className="mt-3 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white"
                      style={{ background: '#381DA0' }}
                    >
                      Listo
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
                      <p className="text-[15px] font-semibold text-foreground">
                        Reportar {reportando === 'post' ? 'publicación' : 'comentario'}
                      </p>
                      <button onClick={() => setReportando(null)} aria-label="Cerrar"
                        className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="px-5 py-4 overflow-y-auto flex flex-col gap-3">
                      <p className="text-[12px] text-muted-foreground leading-relaxed">
                        ¿Qué regla incumple? Reportar no lo oculta de inmediato: lo revisamos antes.
                      </p>
                      <div className="flex flex-col gap-1.5">
                        {MOTIVOS.map(m => (
                          <button
                            key={m.valor}
                            type="button"
                            onClick={() => setMotivo(m.valor)}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors"
                            style={motivo === m.valor
                              ? { background: 'rgba(56,29,160,0.08)', border: '1.5px solid rgba(56,29,160,0.35)' }
                              : { background: '#fff', border: '1.5px solid rgba(26,16,40,0.08)' }}
                          >
                            <span className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center"
                              style={{ border: `1.5px solid ${motivo === m.valor ? '#381DA0' : 'rgba(26,16,40,0.20)'}` }}>
                              {motivo === m.valor && (
                                <span className="w-2 h-2 rounded-full" style={{ background: '#381DA0' }} />
                              )}
                            </span>
                            <span className="text-[13px] font-medium text-foreground">{m.etiqueta}</span>
                          </button>
                        ))}
                      </div>

                      <textarea
                        value={detalle}
                        onChange={e => setDetalle(e.target.value)}
                        maxLength={500}
                        rows={3}
                        placeholder="Contanos algo más (opcional)"
                        className="w-full text-[13px] rounded-xl px-3 py-2.5 outline-none resize-none"
                        style={{ border: '1.5px solid rgba(26,16,40,0.08)', background: '#fff' }}
                      />
                    </div>

                    <div className="px-5 py-4 border-t border-border/60"
                      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
                      <button
                        onClick={enviarReporte}
                        disabled={!motivo || enviandoRep}
                        className="w-full py-3 rounded-xl text-[13px] font-semibold text-white disabled:opacity-40 transition-opacity"
                        style={{ background: '#381DA0' }}
                      >
                        {enviandoRep ? 'Enviando…' : 'Enviar reporte'}
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </motion.div>
  );
}
