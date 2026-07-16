'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '@/lib/api-client';
import { IconClub } from '@/components/ui/custom-icons';
import {
  ArrowLeft, BadgeCheck, MapPin, CalendarDays, UserPlus, UserCheck,
  Phone, Mail, Building2, Lock,
} from 'lucide-react';

interface PublicClub {
  id: string; name: string; city?: string | null; department?: string | null;
  deporte?: string | null; logoUrl?: string | null; coverUrl?: string | null;
  verified?: boolean; description?: string | null; createdAt?: string | null;
  phone?: string | null; email?: string | null;
  _count: { members: number };
}
interface MainLocation { id: string; name: string; address?: string | null; }
interface Payload {
  club: PublicClub; followersCount: number; postsCount: number; mainLocation: MainLocation | null;
}

const TABS = ['Publicaciones', 'Contacto'] as const;
type Tab = typeof TABS[number];

export default function PublicClubPage() {
  const params = useParams();
  const router = useRouter();
  const { getToken } = useAuth();
  const id = String(params.id);

  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [toggling, setToggling] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('Publicaciones');

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const me = await apiFetch<{ user?: { clubId?: string | null } }>('/me', { token }).catch(() => null);
        if (me?.user?.clubId && me.user.clubId === id) {
          router.replace('/dashboard/club');
          return;
        }
        const res = await apiFetch<Payload>(`/clubs/${id}/public`, { token });
        setData(res);
        setFollowers(res.followersCount);
        apiFetch<{ isFollowing: boolean }>(`/follows/stats/club:${id}`, { token })
          .then(r => setFollowing(r.isFollowing))
          .catch(() => {});
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, getToken, router]);

  async function toggleFollow() {
    if (!data || toggling) return;
    setToggling(true);
    try {
      const token = await getToken();
      const res = await apiFetch<{ following: boolean }>(`/follows/toggle/club:${data.club.id}`, { token, method: 'POST' });
      setFollowing(res.following);
      setFollowers(prev => prev + (res.following ? 1 : -1));
    } catch {
      /* ignorar */
    } finally {
      setToggling(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-[14px] font-semibold text-foreground">Club no encontrado</p>
        <button onClick={() => router.back()} className="mt-4 text-[13px] font-semibold text-primary">Volver</button>
      </div>
    );
  }

  const { club, postsCount, mainLocation } = data;

  return (
    <div className="min-h-full bg-background">
      {/* ── Header del club ─────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-border" style={{ boxShadow: '0 1px 12px rgba(0,0,0,0.06)' }}>
        {/* Banner portada */}
        <div className="relative h-36 sm:h-48"
          style={{ background: club.coverUrl ? undefined : 'linear-gradient(135deg, #4361EE 0%, #7C3AED 60%, #06D6A0 100%)' }}>
          {club.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={club.coverUrl} alt="Portada" className="absolute inset-0 w-full h-full object-cover" />
          )}
          {!club.coverUrl && (
            <div className="absolute inset-0 opacity-10"
              style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          )}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.22) 100%)' }} />
          <button
            onClick={() => router.back()}
            className="absolute top-3 left-3 w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.9)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
          >
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </button>
        </div>

        {/* Info del club */}
        <div className="px-5 pb-5 max-w-5xl mx-auto w-full">
          <div className="flex items-end justify-between" style={{ marginTop: -75 }}>
            <div className="relative z-10">
              <div
                className="rounded-full border-4 border-white overflow-hidden sm:w-[170px] sm:h-[170px]"
                style={{
                  width: 150, height: 150,
                  boxShadow: '0 4px 16px rgba(67,97,238,0.22)',
                  background: club.logoUrl ? undefined : 'linear-gradient(135deg,#4361EE,#7C3AED)',
                }}>
                {club.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={club.logoUrl} alt={club.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white">
                    <IconClub className="w-16 h-16" />
                  </div>
                )}
              </div>
              {club.verified && (
                <div className="absolute bottom-0.5 right-0.5 rounded-full border-2 border-white flex items-center justify-center"
                  style={{ width: 28, height: 28, background: '#4361EE' }}>
                  <BadgeCheck className="w-4 h-4 text-white" />
                </div>
              )}
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={toggleFollow}
              disabled={toggling}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold transition-all cursor-pointer disabled:opacity-60"
              style={following
                ? { background: 'rgba(67,97,238,0.10)', color: '#4361EE', border: '1.5px solid rgba(67,97,238,0.25)' }
                : { background: 'linear-gradient(135deg,#4361EE,#7C3AED)', color: '#fff', border: 'none' }
              }
            >
              {following
                ? <><UserCheck className="w-4 h-4" /> Siguiendo</>
                : <><UserPlus className="w-4 h-4" /> Seguir</>
              }
            </motion.button>
          </div>

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <h1 className="text-[22px] font-bold text-foreground leading-tight">{club.name}</h1>
            {club.deporte && (
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full tracking-widest"
                style={{ background: 'rgba(67,97,238,0.10)', color: '#4361EE' }}>
                {club.deporte}
              </span>
            )}
          </div>

          {club.description && (
            <p className="mt-2 max-w-lg text-[13px] text-foreground/75 leading-relaxed">{club.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3">
            {(club.city || club.department) && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: '#8E87A8' }} />
                <span className="text-[12px] text-muted-foreground">
                  {[club.city, club.department].filter(Boolean).join(', ')}
                </span>
              </div>
            )}
            {club.createdAt && (
              <div className="flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 shrink-0" style={{ color: '#8E87A8' }} />
                <span className="text-[12px] text-muted-foreground">
                  Fundado en {new Date(club.createdAt).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-6 mt-4">
            {[
              { n: postsCount, label: 'Publicaciones' },
              { n: followers, label: 'Seguidores' },
              { n: club._count.members, label: 'Miembros' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="text-[18px] font-bold text-foreground leading-none">{s.n}</p>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#8E87A8', marginTop: 2 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tabs (Contacto solo como tab en móvil) ────────────────────────────── */}
      <div className="bg-white border-b border-border sticky top-0 z-10">
        <div className="sm:flex max-w-5xl mx-auto">
          <div className="flex sm:w-1/2">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3.5 relative transition-colors${tab === 'Contacto' ? ' sm:hidden' : ''}`}
                style={{ fontSize: 12, fontWeight: 700, color: activeTab === tab ? '#4361EE' : '#8E87A8' }}
              >
                {tab}
                {activeTab === tab && (
                  <motion.div layoutId="public-club-tab"
                    className="absolute bottom-0 left-4 right-4 h-[2.5px] rounded-full"
                    style={{ background: '#4361EE' }} />
                )}
              </button>
            ))}
          </div>
          <div className="hidden sm:flex sm:w-1/2 items-center justify-center">
            <span className="py-3.5" style={{ fontSize: 12, fontWeight: 700, color: '#8E87A8' }}>Contacto</span>
          </div>
        </div>
      </div>

      {/* ── Contenido: 2 columnas en desktop ──────────────────────────────────── */}
      <div className="sm:flex sm:gap-6 max-w-5xl mx-auto pb-6">
        {/* Columna izquierda — Publicaciones (o Contacto en móvil) */}
        <div className="sm:w-1/2">
          <AnimatePresence mode="wait">
            {activeTab === 'Publicaciones' && (
              <motion.div key="pub"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}
                className="px-4 sm:px-6 py-4">
                <div className="rounded-2xl px-6 py-12 text-center"
                  style={{ background: 'linear-gradient(135deg,rgba(67,97,238,0.04),rgba(124,58,237,0.03))', border: '1px solid rgba(67,97,238,0.10)' }}>
                  <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg,#4361EE,#7C3AED)' }}>
                    <Lock className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-[14px] font-bold text-foreground mb-1">Publicaciones privadas</p>
                  <p className="text-[12px] text-muted-foreground">Las publicaciones de este club son solo para sus miembros.</p>
                </div>
              </motion.div>
            )}
            {activeTab === 'Contacto' && (
              <motion.div key="con-mobile"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}
                className="px-4 py-4 sm:hidden">
                <ContactCard club={club} mainLocation={mainLocation} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Columna derecha — Contacto (solo desktop) */}
        <div className="hidden sm:block sm:pr-6 pb-6 sm:w-1/2 sm:py-4 sm:sticky sm:top-4 sm:self-start">
          <ContactCard club={club} mainLocation={mainLocation} />
        </div>
      </div>
    </div>
  );
}

// ── Tarjeta de contacto (solo lectura) ────────────────────────────────────────
function ContactCard({ club, mainLocation }: { club: PublicClub; mainLocation: MainLocation | null }) {
  const mapsQuery = encodeURIComponent(
    [mainLocation?.name, mainLocation?.address, club.city, club.department].filter(Boolean).join(', ')
    || club.name
  );
  const hasLocation = !!(mainLocation || club.city || club.department);

  return (
    <div className="px-4 sm:px-0">
      <div className="rounded-2xl overflow-hidden"
        style={{ background: 'white', border: '1px solid rgba(67,97,238,0.10)', boxShadow: '0 1px 12px rgba(0,0,0,0.06)' }}>
        <div className="px-5 py-4 border-b border-border/50">
          <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#8E87A8' }}>Información de contacto</p>
        </div>
        <div className="divide-y divide-border/40">
          <ContactRow icon={<Phone className="w-4 h-4" style={{ color: '#4361EE' }} />} label="Teléfono" value={club.phone} />
          <ContactRow icon={<Mail className="w-4 h-4" style={{ color: '#4361EE' }} />} label="Correo electrónico" value={club.email} />
          <ContactRow
            icon={<Building2 className="w-4 h-4" style={{ color: '#4361EE' }} />}
            label="Sede principal"
            value={mainLocation ? `${mainLocation.name}${mainLocation.address ? ` · ${mainLocation.address}` : ''}` : null}
          />
          {(club.city || club.department) && (
            <ContactRow
              icon={<MapPin className="w-4 h-4" style={{ color: '#4361EE' }} />}
              label="Ubicación"
              value={[club.city, club.department].filter(Boolean).join(', ')}
            />
          )}
        </div>
      </div>

      {/* Mapa + Abrir en Maps */}
      {hasLocation && (
        <div className="relative mt-4 rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(67,97,238,0.10)', height: 180 }}>
          <iframe
            title={`Mapa ${club.name}`}
            width="100%" height="180" loading="lazy" style={{ border: 0, display: 'block' }}
            src={`https://maps.google.com/maps?q=${mapsQuery}&z=13&output=embed`}
          />
        </div>
      )}
    </div>
  );
}

function ContactRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-3 px-5 py-4">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'rgba(67,97,238,0.08)' }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#8E87A8' }}>{label}</p>
        <p className="text-[13px] font-medium text-foreground">
          {value || <span className="text-muted-foreground/50 italic text-[12px]">Sin registrar</span>}
        </p>
      </div>
    </div>
  );
}
