'use client';

import { useAuth, useClerk, useUser } from '@clerk/nextjs';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, User, Lock } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { QK } from '@/hooks/useVeloQuery';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhoneInput } from '@/components/ui/phone-input';
import ModuleReveal from '@/components/ui/module-reveal';
import { IconAjustesCuenta, IconAyuda, IconCheck, IconPerfil, IconSalir } from '@/components/ui/custom-icons';

/**
 * Ajustes del superadmin.
 *
 * Es la misma pantalla que ve el admin de un club cuando entra a los ajustes de
 * su perfil (`(panel)/ajustes`), con lo que aplica a quien administra la
 * plataforma: el retrato, Mi perfil, Gestionar cuenta, el Centro de ayuda y
 * Cerrar sesión. Se llega tocando la foto, arriba en el celular y abajo en el
 * menú lateral.
 *
 * Dos cosas del club no están a propósito:
 * - Mi club y Mi suscripción: el superadmin no tiene club.
 * - La Zona de peligro: borrar la cuenta del superadmin dejaría la plataforma
 *   sin nadie que la administre.
 *
 * El teléfono se guarda en el usuario y no en una ficha de miembro, porque el
 * superadmin no tiene ficha.
 */

interface Cuenta {
  name: string;
  email: string;
  phone: string | null;
  picture: string | null;
  createdAt: string;
}

function desde(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const mes = d.toLocaleDateString('es-CO', { month: 'long' });
  return `Miembro desde ${mes} de ${d.getFullYear()}`;
}

/** Una fila de ajustes, la misma del club: ícono, título, detalle y flecha. */
function FilaAjuste({ icono: Icono, titulo, detalle, onClick, disabled, tono, sufijo }: {
  icono: React.ElementType;
  titulo: string;
  detalle?: string;
  onClick: () => void;
  disabled?: boolean;
  tono?: 'rojo';
  sufijo?: React.ReactNode;
}) {
  const rojo = tono === 'rojo';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-4 md:px-5 py-3.5 text-left transition-colors disabled:opacity-55 disabled:cursor-default ${rojo ? 'hover:bg-red-50 active:bg-red-100' : 'hover:bg-secondary/40 active:bg-secondary/60'}`}
    >
      <Icono className="w-4 h-4 shrink-0" style={{ color: rojo ? '#EF476F' : '#8E87A8' }} />
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] font-semibold" style={{ color: rojo ? '#EF476F' : '#1A1028' }}>{titulo}</span>
        {detalle && <span className="block text-[11px] text-muted-foreground mt-0.5">{detalle}</span>}
      </span>
      {sufijo ?? (!rojo && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />)}
    </button>
  );
}

export default function AjustesSuperadmin() {
  return <Suspense fallback={null}><Contenido /></Suspense>;
}

function Contenido() {
  const router = useRouter();
  const params = useSearchParams();
  const enMenu = params.get('tab') !== 'perfil';
  const clerk = useClerk();
  const { user } = useUser();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['superadmin', 'cuenta'],
    queryFn: async () => apiFetch<{ cuenta: Cuenta }>('/me/cuenta', { token: await getToken() }),
    enabled: isLoaded && isSignedIn,
  });
  // La misma consulta de la lista de clubes: si ya se abrió, sale del caché.
  const { data: clubesData } = useQuery({
    queryKey: QK.superadmin.clubs(),
    queryFn: async () => apiFetch<{ clubs: unknown[] }>('/superadmin/clubs', { token: await getToken() }),
    enabled: isLoaded && isSignedIn,
  });

  const cuenta = data?.cuenta;
  const googlePhoto = user?.externalAccounts?.find(a => a.provider === 'google')?.imageUrl;
  const foto = cuenta?.picture || googlePhoto || null;
  const nombre = cuenta?.name || user?.fullName || 'Superadmin';
  const correo = cuenta?.email || user?.emailAddresses?.[0]?.emailAddress || '';

  const [nombreBorrador, setNombreBorrador] = useState<string | null>(null);
  const [telBorrador, setTelBorrador] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [saliendo, setSaliendo] = useState(false);

  const nombreCampo = nombreBorrador ?? nombre;
  const telCampo = telBorrador ?? cuenta?.phone ?? '';

  async function guardar() {
    setGuardando(true);
    try {
      const token = await getToken();
      await apiFetch('/me/telefono', { method: 'PATCH', token, body: JSON.stringify({ phone: telCampo || null }) });
      const limpio = nombreCampo.trim();
      if (limpio.length >= 2 && limpio !== nombre) {
        await apiFetch('/me/name', { method: 'PATCH', token, body: JSON.stringify({ name: limpio }) });
      }
      await qc.invalidateQueries({ queryKey: ['superadmin', 'cuenta'] });
      setNombreBorrador(null);
      setTelBorrador(null);
      // El menú lateral y la cabecera leen el nombre: que se enteren ya.
      window.dispatchEvent(new Event('vc:me-updated'));
      setGuardado(true);
      setTimeout(() => setGuardado(false), 3000);
    } catch (err) {
      alert('Error al guardar: ' + (err instanceof Error ? err.message : 'intenta de nuevo'));
    } finally {
      setGuardando(false);
    }
  }

  async function salir() {
    setSaliendo(true);
    await clerk.signOut();
    router.push('/sign-in');
  }

  const avatar = (px: string, icono: string) => (
    <div className={`${px} rounded-full overflow-hidden bg-secondary border border-border shrink-0 flex items-center justify-center`}>
      {foto
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={foto} alt={nombre} className="w-full h-full object-cover" />
        : <User className={`${icono} text-muted-foreground/40`} />}
    </div>
  );

  const rol = (
    <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide"
      style={{ background: '#EF476F1A', color: '#EF476F' }}>
      Super admin
    </span>
  );

  const gestionar = (
    <FilaAjuste
      icono={IconAjustesCuenta}
      titulo="Gestionar cuenta"
      detalle={clerk.loaded ? 'Nombre, contraseña y datos de acceso' : 'Preparando tu cuenta…'}
      disabled={!clerk.loaded}
      onClick={() => clerk.openUserProfile()}
      sufijo={clerk.loaded ? undefined : (
        <span aria-hidden className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground/40 border-t-transparent animate-spin shrink-0" />
      )}
    />
  );
  const ayuda = (
    <FilaAjuste icono={IconAyuda} titulo="Centro de ayuda" detalle="Tutoriales y soporte técnico"
      onClick={() => router.push('/superadmin/ayuda')} />
  );
  const cerrar = (
    <FilaAjuste icono={IconSalir} tono="rojo" titulo={saliendo ? 'Cerrando sesión...' : 'Cerrar sesión'}
      disabled={saliendo} onClick={salir} />
  );

  const campos = (dosColumnas: boolean) => (
    <div className="space-y-3">
      <div className={dosColumnas ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : 'space-y-3'}>
        <div className="space-y-1.5">
          <Label className="text-[12px]">Nombre de usuario</Label>
          <Input value={nombreCampo} onChange={e => { setNombreBorrador(e.target.value); setGuardado(false); }}
            placeholder="Tu nombre completo" className="text-sm h-12" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[12px]">Teléfono</Label>
          <PhoneInput value={telCampo} onChange={v => { setTelBorrador(v); setGuardado(false); }} placeholder="Número de contacto" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-[12px]">Correo electrónico</Label>
        <div className="relative">
          <Input value={correo} readOnly className="text-muted-foreground bg-muted/30 cursor-not-allowed pr-10 text-sm h-12" />
          <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
        </div>
      </div>
      <Button onClick={guardar} disabled={guardando} className="w-full transition-all" style={guardado ? { background: '#06D6A0' } : {}}>
        {guardado ? <><IconCheck className="w-4 h-4 mr-2" />Guardado</> : guardando ? 'Guardando...' : 'Guardar cambios'}
      </Button>
    </div>
  );

  return (
    <div className="min-h-full bg-background">
      {/* ══ Móvil: el menú y, al entrar, la sección ══ */}
      <div className="md:hidden">
        <AnimatePresence mode="wait">
          {enMenu ? (
            <motion.div key="menu"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.26, ease: [0.23, 1, 0.32, 1] }}
              className="px-4 pt-4 pb-28 space-y-4">

              <div className="bg-white border border-border rounded-2xl px-5 pt-6 pb-5 flex flex-col items-center text-center">
                {avatar('w-[88px] h-[88px]', 'w-10 h-10')}
                <p className="text-[17px] font-semibold text-foreground mt-3 mb-0">{nombre}</p>
                <div className="mt-2">{rol}</div>
                {cuenta?.createdAt && <p className="text-[11px] text-muted-foreground mt-2 mb-0">{desde(cuenta.createdAt)}</p>}
                <div className="w-full flex mt-4 pt-4 border-t border-border">
                  <div className="flex-1 min-w-0 px-2">
                    <p className="text-[11px] font-bold text-muted-foreground m-0">Plataforma</p>
                    <p className="text-[11.5px] font-semibold text-foreground mt-1 mb-0">VeloClub</p>
                  </div>
                  <div className="flex-1 min-w-0 px-2 border-l border-border">
                    <p className="text-[11px] font-bold text-muted-foreground m-0">Clubes</p>
                    <p className="text-[11.5px] font-semibold text-foreground mt-1 mb-0">{clubesData?.clubs.length ?? '—'}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-border rounded-2xl overflow-hidden">
                <FilaAjuste icono={IconPerfil} titulo="Mi perfil" detalle="Tu nombre, teléfono y correo"
                  onClick={() => router.push('/superadmin/configuracion?tab=perfil')} />
              </div>

              <div className="bg-white border border-border rounded-2xl overflow-hidden divide-y divide-border">
                {gestionar}
                {ayuda}
                {cerrar}
              </div>
            </motion.div>
          ) : (
            <motion.div key="perfil"
              initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
              className="pb-28">
              <div className="flex items-center gap-2 px-4 pt-4 pb-3">
                <button type="button" onClick={() => router.push('/superadmin/configuracion')} aria-label="Volver a Ajustes"
                  className="w-9 h-9 -ml-1.5 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors shrink-0">
                  <ChevronRight className="w-5 h-5 rotate-180" />
                </button>
                <h1 className="text-[19px] font-semibold text-foreground m-0 tracking-tight truncate">Mi perfil</h1>
              </div>
              <div className="px-4">
                <div className="bg-white border border-border rounded-2xl px-4 py-4">{campos(false)}</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ══ Tablet y escritorio: la tarjeta completa, como en el club ══ */}
      <div className="hidden md:block px-6 pt-6 pb-8">
        <div className="max-w-5xl mx-auto">
          <ModuleReveal>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#381DA0' }}>
                <IconPerfil className="w-3.5 h-3.5 text-white" />
              </div>
              <h2 className="text-[15px] font-semibold text-foreground">Mi perfil</h2>
            </div>
            <div className="bg-white border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <div className="flex items-center gap-4">
                  {avatar('w-16 h-16', 'w-7 h-7')}
                  <div className="min-w-0">
                    <p className="text-[16px] font-semibold text-foreground truncate">{nombre}</p>
                    <div className="mt-1">{rol}</div>
                    {cuenta?.createdAt && <p className="text-[11px] text-muted-foreground mt-1">{desde(cuenta.createdAt)}</p>}
                  </div>
                </div>
              </div>
              <div className="px-5 py-4 border-b border-border">{campos(true)}</div>
              <div className="divide-y divide-border">
                {gestionar}
                {ayuda}
                {cerrar}
              </div>
            </div>
          </ModuleReveal>
        </div>
      </div>
    </div>
  );
}
