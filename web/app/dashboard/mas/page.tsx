'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { stagger, cardVariant } from '@/lib/page-animations';

import { useAuth } from '@clerk/nextjs';
import { UserButton, useUser } from '@clerk/nextjs';
import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import Link from 'next/link';
import { Trophy, CalendarDays, MapPin, BarChart2, HelpCircle, ChevronRight, Camera, Loader2, CheckCircle2 } from 'lucide-react';

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

const ITEMS_BY_ROLE: Record<string, { label: string; icon: React.ElementType; color: string; href: string }[]> = {
  ADMIN: [
    { label: 'Resultados', icon: Trophy,            color: '#F59E0B', href: '/dashboard/logros' },
    { label: 'Calendario', icon: CalendarDays,      color: '#EF476F', href: '/dashboard/calendario' },
    { label: 'Sedes',      icon: MapPin,            color: '#06D6A0', href: '/dashboard/sedes' },
    { label: 'Reportes',   icon: BarChart2,         color: '#4361EE', href: '/dashboard/reportes' },
    { label: 'Ayuda',      icon: HelpCircle,        color: '#8E87A8', href: '/dashboard/ajustes/ayuda' },
  ],
  COACH: [
    { label: 'Resultados', icon: Trophy,        color: '#F59E0B', href: '/dashboard/logros' },
    { label: 'Calendario', icon: CalendarDays,  color: '#EF476F', href: '/dashboard/calendario' },
    { label: 'Sedes',      icon: MapPin,        color: '#06D6A0', href: '/dashboard/sedes' },
    { label: 'Ayuda',      icon: HelpCircle,    color: '#8E87A8', href: '/dashboard/ajustes/ayuda' },
  ],
  STUDENT: [],
};

export default function MasPage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [role, setRole]           = useState<string | null>(null);
  const [memberPic, setMemberPic] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const res = await apiFetch<{ user?: { role: string } }>('/me', { token });
        setRole(res.user?.role ?? 'ADMIN');

        // Si es deportista, cargar su foto de perfil actual
        if (res.user?.role === 'STUDENT') {
          const me = await apiFetch<{ member?: { pictureUrl?: string | null } }>('/members/me', { token });
          setMemberPic(me.member?.pictureUrl ?? null);
        }
      } catch { setRole('ADMIN'); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { alert('La imagen no puede superar 4MB'); return; }

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async ev => {
      const base64 = ev.target?.result as string;
      try {
        const token = await getToken();
        const res = await apiFetch<{ pictureUrl: string }>('/members/me/picture', {
          method: 'POST', token,
          body: JSON.stringify({ base64 }),
        });
        setMemberPic(res.pictureUrl);
        setUploaded(true);
        setTimeout(() => setUploaded(false), 3000);
      } catch (err) {
        alert('Error al subir la foto: ' + (err instanceof Error ? err.message : 'intenta de nuevo'));
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
    // Reset input para permitir re-seleccionar la misma foto
    e.target.value = '';
  }

  const items = role ? (ITEMS_BY_ROLE[role] ?? []) : null;

  const roleLabel: Record<string, string> = {
    ADMIN: 'Administrador',
    COACH: 'Entrenador',
    STUDENT: 'Deportista',
  };

  // Foto a mostrar: primero la subida manualmente, luego la de Clerk
  const avatarSrc = memberPic ?? user?.imageUrl ?? null;
  const avatarInitial = (user?.firstName ?? user?.fullName ?? 'U')[0].toUpperCase();

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="min-h-full bg-background px-4 py-4">
      <h1 className="text-[22px] font-extrabold text-foreground mb-4" style={{ fontFamily: 'Open Sans, sans-serif', lineHeight: 1.1 }}>
        Más opciones
      </h1>

      {/* ── Tarjeta Mi cuenta (STUDENT) ─────────────────────────────────────── */}
      {items !== null && role === 'STUDENT' && (
        <motion.div variants={cardVariant} className="bg-white border border-border rounded-2xl px-4 py-4 mb-4">
          <div className="flex items-center gap-3">

            {/* Avatar con botón de cámara */}
            <div className="relative shrink-0">
              <div className="w-14 h-14 rounded-full bg-violet-100 flex items-center justify-center overflow-hidden"
                style={{ boxShadow: '0 2px 12px rgba(124,58,237,0.15)' }}>
                {avatarSrc
                  ? <img src={avatarSrc} alt="avatar" className="w-full h-full object-cover" />
                  : <span className="text-violet-500 font-bold text-xl">{avatarInitial}</span>
                }
                {/* Overlay de subida */}
                <AnimatePresence>
                  {uploading && (
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center rounded-full"
                      style={{ background: 'rgba(124,58,237,0.65)' }}
                    >
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Botón cámara */}
              <button
                onClick={() => !uploading && fileRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer disabled:opacity-50"
                style={{ background: uploaded ? '#06D6A0' : '#7C3AED', boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}
                aria-label="Cambiar foto de perfil"
              >
                <AnimatePresence mode="wait">
                  {uploaded
                    ? <motion.span key="ok" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ duration: 0.15 }}>
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                      </motion.span>
                    : <motion.span key="cam" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ duration: 0.15 }}>
                        <Camera className="w-3.5 h-3.5 text-white" />
                      </motion.span>
                  }
                </AnimatePresence>
              </button>

              {/* Input oculto */}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>

            {/* Nombre + email */}
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-foreground truncate" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                {user?.fullName ?? user?.firstName ?? 'Mi cuenta'}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {user?.primaryEmailAddress?.emailAddress ?? 'Deportista'}
              </p>
              <AnimatePresence>
                {uploaded && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: EASE_OUT }}
                    className="text-[10px] font-semibold mt-0.5"
                    style={{ color: '#06D6A0' }}
                  >
                    Foto actualizada
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* UserButton invisible para gestión de cuenta Clerk */}
            <div className="relative w-8 h-8 shrink-0">
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
              <div className="absolute inset-0 opacity-0 overflow-hidden">
                <UserButton appearance={{
                  elements: {
                    avatarBox: { width: 32, height: 32 },
                    userButtonTrigger: { width: 32, height: 32 },
                  },
                }} />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Tarjeta Mi cuenta — ADMIN / COACH (overlay invisible con UserButton) */}
      {items !== null && role !== 'STUDENT' && (
        <motion.div variants={cardVariant} className="relative bg-white border border-border rounded-2xl px-4 py-3.5 flex items-center gap-3 mb-4 overflow-hidden">
          <div className="w-12 h-12 rounded-full bg-violet-100 shrink-0 flex items-center justify-center overflow-hidden pointer-events-none">
            {user?.imageUrl
              ? <img src={user.imageUrl} alt="avatar" className="w-full h-full object-cover" />
              : <span className="text-violet-500 font-bold text-lg">{avatarInitial}</span>
            }
          </div>
          <div className="flex-1 min-w-0 pointer-events-none">
            <p className="text-[14px] font-bold text-foreground truncate" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              {user?.fullName ?? user?.firstName ?? 'Mi cuenta'}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {user?.primaryEmailAddress?.emailAddress ?? roleLabel[role ?? 'ADMIN']}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 pointer-events-none" />
          <div className="absolute inset-0 flex items-center justify-start px-4 opacity-0">
            <UserButton appearance={{
              elements: {
                avatarBox: { width: '100%', height: '100%', borderRadius: 0 },
                userButtonTrigger: { width: '100vw', height: '100%', position: 'absolute', inset: 0, borderRadius: 0 },
              },
            }} />
          </div>
        </motion.div>
      )}

      {/* ── Ítems según rol ── */}
      {items === null && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <motion.div variants={cardVariant} key={i} className="w-full bg-white border border-border rounded-xl px-4 py-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary animate-pulse shrink-0" />
              <div className="flex-1 h-4 rounded bg-secondary animate-pulse" />
            </motion.div>
          ))}
        </div>
      )}
      {items !== null && items.length > 0 && (
        <div className="space-y-2">
          {items.map(({ label, icon: Icon, color, href }) => (
            <motion.div variants={cardVariant} key={href}>
            <Link
              href={href}
              className="w-full bg-white border border-border rounded-xl px-4 py-3.5 flex items-center gap-3 active:bg-secondary transition-colors"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${color}18`, color }}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className="flex-1 text-sm font-semibold text-foreground" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                {label}
              </span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
