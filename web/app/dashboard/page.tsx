'use client';

import { useAuth, useSession } from '@clerk/nextjs';
import { useClubStream } from '@/hooks/useClubStream';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef, useLayoutEffect } from 'react';
import { apiFetch } from '@/lib/api-client';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, BellOff, X, Paperclip, FileText, Trophy, Users,
} from 'lucide-react';
import { CarruselCumpleanos, CarruselEventos } from '@/components/ui/widgets-carrusel';
import { SelectorDeporteMovil } from '@/lib/contexto-deporte';
import { Slideshow } from '@/components/ui/slideshow';
// La tarjeta de publicacion es la misma en Inicio, Club y Mi perfil.
import { PostCard } from '@/components/ui/post-card';
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
import {
  IconAlDia, IconAsistencias, IconCandado, IconEvento, IconFoto, IconPendiente, IconPublico,
  IconUbicacion, IconVideo,
} from '@/components/ui/custom-icons';

// ── Interfaces ────────────────────────────────────────────────────────────────

interface MeResponse {
  status: 'ok' | 'superadmin' | 'complete_profile' | 'no_access' | 'needs_onboarding' | 'inactive' | 'member_inactive' | 'trial_expired';
  user?: { name: string; role: string; picture?: string | null; clubId?: string | null; club?: { name: string; logoUrl?: string; verified?: boolean } };
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
  // Comentario raiz al que responde, si es una respuesta
  parentId?: string | null;
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

const roleColors: Record<string, { text: string; bg: string }> = {
  SUPERADMIN: { text: '#EF476F', bg: 'rgba(239,71,111,0.12)' },
  ADMIN:      { text: '#FFB703', bg: 'rgba(255,183,3,0.12)' },
  ENTRENADOR:      { text: '#06D6A0', bg: 'rgba(6,214,160,0.12)' },
  DEPORTISTA:    { text: '#381DA0', bg: 'rgba(56,29,160,0.10)' },
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

// ── Ads (placeholder — reemplazar con datos reales desde API) ────────────────

// El orden importa: los dos anunciantes que pagan van primero, y el tercer
// lugar lo ocupa el espacio disponible, que es el que vende el cupo.
//
// El sufijo -2 del archivo no es decorativo: el service worker guarda las
// imagenes con StaleWhileRevalidate, asi que al reemplazar una pieza
// conservando el nombre el dispositivo sigue mostrando la vieja hasta la
// segunda visita. Cambiar el nombre la convierte en un recurso nuevo y entra
// al instante. Al actualizar una pieza hay que subir ese numero.
const ADS = [
  {
    image: '/natural-3.webp',
    label: 'Publicidad',
    title: 'Natural Ropa Deportiva, lycras para patinaje',
    description: 'Lycras y uniformes para patinaje, hechos para competir y entrenar. Confección a la medida del deportista y diseños personalizados para tu club.',
    url: 'https://wa.me/573138296551',
    color: '#4361EE',
  },
  {
    image: '/cafe-orquidea-3.webp',
    label: 'Publicidad',
    title: 'Café Orquídea de la Meseta',
    description: 'Café colombiano de la meseta santandereana en presentación de 450 gramos: energía para todo un mes.',
    // Número que aparece en la pieza del anunciante
    url: 'https://wa.me/573153171225',
    color: '#06D6A0',
  },
  {
    image: '/nexcode97-2.webp',
    label: 'Publicidad',
    title: 'NexCode97, desarrollo de software a la medida',
    description: 'Plataformas web y aplicaciones hechas a la medida de tu negocio. Quienes construyen VeloClub.',
    url: 'https://wa.me/573006359008',
    color: '#381DA0',
  },
  // Los cupos libres cierran el carrusel. Van tres a proposito: mostrar varios
  // seguidos comunica que el espacio esta abierto, que es justo lo que se
  // quiere vender. Comparten el mismo dibujo, que no lleva fondo propio, y se
  // distinguen por el color de la tarjeta para que no parezca un anuncio
  // repetido tres veces.
  {
    image: '/publicidad-disponible.svg',
    label: 'Espacio disponible',
    title: 'Tu publicidad aquí',
    description: 'Promociona tu marca o tu evento ante los clubes deportivos.',
    // Pendiente: el numero de contacto de VeloClub para reservar el cupo. Sin
    // url el boton no se muestra, que es mejor que mandar al numero de otro.
    url: '#',
    cta: 'Reservar espacio',
    bg: '#381DA0',
  },
  {
    image: '/publicidad-disponible.svg',
    label: 'Espacio disponible',
    title: 'Tu publicidad aquí',
    description: 'Promociona tu marca o tu evento ante los clubes deportivos.',
    url: '#',
    cta: 'Reservar espacio',
    bg: 'linear-gradient(135deg,#4361EE 0%,#2D7FF0 55%,#06B6D4 100%)',
  },
  {
    image: '/publicidad-disponible.svg',
    label: 'Espacio disponible',
    title: 'Tu publicidad aquí',
    description: 'Promociona tu marca o tu evento ante los clubes deportivos.',
    url: '#',
    cta: 'Reservar espacio',
    bg: 'linear-gradient(135deg,#9333EA 0%,#A736D9 55%,#C026D3 100%)',
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
  ENTRENADOR:      'linear-gradient(135deg,#06D6A0,#0CB68D)',
  DEPORTISTA:    '#381DA0',
};

// ── Avatar wrapper que usa MemberAvatar con gradiente por rol ─────────────────
function Avatar({ src, name, size = 36, role }: { src?: string | null; name: string; size?: number; role?: string }) {
  return (
    <MemberAvatar
      name={name}
      photoUrl={src}
      gradient={ROLE_GRADIENT[role ?? ''] ?? ROLE_GRADIENT.DEPORTISTA}
      size={size}
    />
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
            <IconFoto className="w-[17px] h-[17px]" style={{ color: '#381DA0' }} />
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
          <IconUbicacion className="w-4 h-4 shrink-0" style={{ color: '#8E87A8' }} />
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
            { icon: IconFoto,  label: 'Foto',  accept: 'image/*' },
            { icon: IconVideo, label: 'Video', accept: 'video/*' },
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
          style={{ background: '#381DA0' }}>
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

  async function handleComment(postId: string, content: string, parentId?: string) {
    const token = await session?.getToken();
    const res = await apiFetch<{ comment: PostComment }>(`/posts/${postId}/comments`, {
      token, method: 'POST',
      body: JSON.stringify({ content, parentId }),
    });
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, comments: [...p.comments, res.comment] } : p
    ));
  }

  function handleDeleteComment(postId: string, commentId: string) {
    session?.getToken().then(token => {
      apiFetch(`/posts/${postId}/comments/${commentId}`, { token, method: 'DELETE' }).catch(() => {});
    });
    // Optimista, como estaba: aca las respuestas se quitan en el cliente
    // porque no se espera la respuesta del servidor.
    setPosts(prev => prev.map(p =>
      p.id === postId
        ? { ...p, comments: p.comments.filter(c => c.id !== commentId && c.parentId !== commentId) }
        : p
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
  // La comunidad es de todos: publica y comenta cualquiera, sin importar el
  // rol. Lo que cada quien publica es suyo y solo el lo edita o lo borra.
  // Moderar comentarios ajenos es un extra del administrador y solo dentro de
  // las publicaciones internas del club; PostCard aplica esa segunda mitad.
  const puedeModerar = role === 'ADMIN';

  return (
    <div className="min-h-full bg-background">
      <ModuleReveal>


      <InicioHeaderMovil
        clubName={me?.user?.club?.name ?? null}
        clubLogoUrl={me?.user?.club?.logoUrl ?? null}
        userName={me?.user?.name ?? null}
        userPicture={me?.user?.picture ?? null}
        verified={me?.user?.club?.verified}
      />

      {/* ── Prueba y fichas ─────────────────────────────────────────────────
          La tarjeta de prueba se encogio a proposito: la version de escritorio
          ocupa un bloque entero con un boton grande, y en un celular eso empuja
          el contenido real fuera de la pantalla. Aqui informa igual, con la
          fecha exacta de fin en vez de solo los dias, sin gritar.

          No se monta sobre el degradado: el encabezado va fijo, asi que al
          hacer scroll la tarjeta terminaria metiendose debajo de el.

          En escritorio reemplaza al aviso ancho de color ambar que habia antes:
          la misma informacion, con la fecha exacta de fin, sin ocupar una franja
          entera de la pantalla. */}
      <div className="px-4 sm:px-6 pt-3 sm:pt-4 space-y-3">
        {/* El selector de deporte, en movil. Va aca y no arriba del todo: aca
            queda debajo del encabezado morado y pegado a las fichas de
            resumen, que es lo que esta mirando. Encima del encabezado se veia
            como una pieza suelta que no pertenece a la pantalla.
            En escritorio no aparece — alli vive en el sidebar. */}
        <SelectorDeporteMovil />

        {trial !== null && role === 'ADMIN' && (
          <div
            className="rounded-2xl px-3.5 py-3 flex items-center gap-3 bg-white"
            style={{ boxShadow: '0 4px 18px rgba(80,50,160,0.12)' }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: trial.daysLeft <= 3 ? 'rgba(239,71,111,0.10)' : 'rgba(255,183,3,0.14)' }}
            >
              <IconPendiente className="w-[18px] h-[18px]" style={{ color: trial.daysLeft <= 3 ? '#EF476F' : '#854F0B' }} />
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
              style={{ background: trial.daysLeft <= 3 ? '#EF476F' : '#381DA0' }}
            >
              Activar
            </Link>
          </div>
        )}

        {/* Fichas — el dato ya existia, pero obligaba a entrar a cada módulo */}
        {resumen && (
          <div className="flex gap-2">
            {/* 11 y no 13 como sus vecinas: este ícono no lleva el margen de dos
                unidades que ellas tienen en el lienzo, así que a 13 su dibujo
                saldría un sexto más grande. Con 11 los tres miden lo mismo. */}
            <FichaInicio
              icono={<IconAsistencias className="w-[11px] h-[11px]" style={{ color: '#1D9E75' }} />}
              etiqueta="Hoy"
              valor={String(resumen.asistenciaHoy)}
              sufijo={`/${resumen.deportistas}`}
            />
            {/* Solo se oculta si el rol no ve finanzas. Si el mes aun no tiene
                cobros, se muestra con guion: una ficha que desaparece se lee
                como un error, no como "todavia no hay nada" */}
            {resumen.pagosAlDia !== undefined && (
            <FichaInicio
              icono={<IconAlDia className="w-[13px] h-[13px]" style={{ color: '#BA7517' }} />}
              etiqueta="Al día"
              valor={resumen.pagosAlDia === null ? '—' : String(resumen.pagosAlDia)}
              sufijo={resumen.pagosAlDia === null ? undefined : '%'}
            />
            )}
            <FichaInicio
              icono={<IconEvento className="w-[13px] h-[13px]" style={{ color: '#D4537E' }} />}
              etiqueta="Eventos"
              valor={String(upcomingEvents.length)}
            />
          </div>
        )}
      </div>

      {/* ── Eventos y cumpleaños ───────────────────────────────────────────
          Suben por encima de la publicidad: Inicio abre mejor con informacion
          del club que con un anuncio.

          En carrusel horizontal y no en lista. Con seis cumpleaños la tarjeta
          medía más de 600 px y arrastraba a la de eventos, que se estiraba
          vacía para igualarla: media pantalla de Inicio se iba en dos listas
          que casi nadie recorre entera.

          Es el mismo componente en las tres medidas. Antes había una versión de
          móvil y otra de escritorio con el mismo contenido escrito dos veces, y
          cualquier arreglo había que acordarse de hacerlo en las dos. */}
      <motion.div
        variants={cardVariant}
        className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 px-4 sm:px-6 pt-4 sm:pt-3"
      >
        <CarruselEventos eventos={upcomingEvents} cargando={widgetsLoading} />
        <CarruselCumpleanos cumples={birthdays} cargando={widgetsLoading} />
      </motion.div>

      {/* ── Slideshow publicitario — ancho completo ─────────────────────────── */}
      <div className="w-full px-6 pt-4">
        <Slideshow
          slides={ADS.map(ad => ({ img: ad.image, label: ad.label, title: ad.title, description: ad.description, url: ad.url, cta: 'cta' in ad ? ad.cta : undefined, bg: 'bg' in ad ? ad.bg : undefined }))}
        />
      </div>

      {/* ── Contenido principal — desktop: 50% izquierdo, 50% derecho reservado ── */}
      <div className="w-full px-6 py-4">
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
              { key: 'public'  as FeedScope, label: 'Público',  icon: IconPublico, desc: 'Todos los clubes' },
              { key: 'private' as FeedScope, label: 'Mi club',   icon: IconCandado, desc: 'Solo interno' },
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
                      style={{ background: '#381DA0', boxShadow: '0 4px 20px rgba(56,29,160,0.40)' }}
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

        <PostComposer
          userName={user?.name ?? ''}
          userRole={role}
          userAvatar={user?.picture ?? null}
          onSubmit={handleCreatePost}
          loading={postsLoading}
        />

        {/* Feed */}
        {postsLoading && posts.length === 0 ? (
          <motion.div variants={cardVariant} className="flex flex-col items-center py-10 gap-3">
            <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: '#381DA0', borderTopColor: 'transparent' }} />
            <p className="text-[12px] text-muted-foreground">Cargando publicaciones...</p>
          </motion.div>
        ) : posts.length === 0 ? (
          <motion.div variants={cardVariant}>
            <div
              className="rounded-2xl px-6 py-10 flex flex-col items-center text-center"
              style={{ background: 'rgba(56,29,160,0.04)', border: '1px solid rgba(56,29,160,0.10)' }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: '#381DA0' }}
              >
                {feedScope === 'public' ? <IconPublico className="w-6 h-6 text-white" /> : <IconCandado className="w-6 h-6 text-white" />}
              </div>
              <p className="text-[14px] font-semibold text-foreground mb-1">
                {feedScope === 'public' ? 'El feed público está vacío' : 'No hay publicaciones internas aún'}
              </p>
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                {feedScope === 'public'
                  ? 'Sé el primero en publicar algo visible para todos los clubes.'
                  : 'Comparte noticias o novedades exclusivas para tu club.'}
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
                canDelete={puedeModerar}
                clubIdPropio={me?.user?.clubId ?? null}
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
