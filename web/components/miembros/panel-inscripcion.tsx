'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@clerk/nextjs';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Link2, RefreshCw, X } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { DatePicker } from '@/components/ui/date-picker';

/**
 * El enlace de inscripción del club.
 *
 * Va en portal a `document.body`: dentro de la página quedaría atrapado en el
 * contexto de apilamiento de `<main>` y el menú flotante se le montaría encima.
 */

interface Estado {
  abierta: boolean;
  esperados: number | null;
  /** aaaa-mm-dd, o null si el enlace no se cierra solo. */
  vence: string | null;
  vencido: boolean;
  url: string | null;
  pendientes: number;
  recibidos: number;
}

/** «30 de septiembre de 2026», leyendo la fecha como día calendario. */
function enPalabras(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

/** Cuántos días faltan para esa fecha, contando desde hoy. */
function diasHasta(iso: string): number {
  const [a, m, d] = iso.split('-').map(Number);
  const hoy = new Date();
  const cero = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round((new Date(a, m - 1, d).getTime() - cero.getTime()) / 86_400_000);
}

export function PanelInscripcion({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const { getToken } = useAuth();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const token = await getToken();
      setEstado(await apiFetch<Estado>('/inscripcion/club/estado', { token }));
    } catch {
      setError('No se pudo cargar el enlace. Intenta de nuevo.');
    }
  }, [getToken]);

  useEffect(() => { if (abierto) cargar(); }, [abierto, cargar]);

  // Escape cierra, y mientras está abierto la página de atrás no se mueve.
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', alTeclear);
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', alTeclear);
      document.body.style.overflow = previo;
    };
  }, [abierto, onCerrar]);

  async function cambiar(datos: { abierta?: boolean; esperados?: number | null; vence?: string | null }) {
    setGuardando(true);
    setError(null);
    try {
      const token = await getToken();
      await apiFetch('/inscripcion/club/estado', { method: 'PATCH', token, body: JSON.stringify(datos) });
      await cargar();
    } catch {
      setError('No se pudo guardar el cambio.');
    } finally {
      setGuardando(false);
    }
  }

  async function rotar() {
    if (!confirm('El enlace actual va a dejar de servir. Quien lo tenga guardado no va a poder inscribirse.\n\n¿Generar uno nuevo?')) return;
    setGuardando(true);
    try {
      const token = await getToken();
      await apiFetch('/inscripcion/club/rotar', { method: 'POST', token });
      await cargar();
    } catch {
      setError('No se pudo generar el enlace nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  function copiar() {
    if (!estado?.url) return;
    navigator.clipboard.writeText(estado.url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1800);
  }

  const porWhatsApp = estado?.url
    ? `https://wa.me/?text=${encodeURIComponent(
        `Hola, para inscribirte al club llena este formulario: ${estado.url}`
      )}`
    : '#';

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {abierto && (
        <>
          <motion.div
            key="fondo"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onCerrar}
            className="fixed inset-0"
            style={{ background: 'rgba(15,10,30,0.5)', backdropFilter: 'blur(3px)', zIndex: 120 }}
          />
          {/* El centrado va por flex y no por `translate(-50%,-50%)`: framer-motion
              escribe `transform` para animar y pisaba ese translate, asi que la
              esquina del panel quedaba en el centro en vez del panel. */}
          <div className="fixed inset-0 flex items-center justify-center px-4"
            style={{ zIndex: 121, pointerEvents: 'none' }}>
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className="w-full max-w-[440px] bg-white rounded-2xl border border-border flex flex-col"
            style={{
              pointerEvents: 'auto',
              // Sin tope de alto, un contenido largo se sale por debajo del
              // borde de la ventana y no hay forma de llegar al resto. En dvh
              // y no vh: en el celular, vh cuenta la barra de direcciones como
              // espacio disponible aunque esté tapando la pantalla.
              maxHeight: '88dvh',
            }}
          >
            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 shrink-0">
              <div className="min-w-0">
                <h2 className="text-[17px] font-semibold text-foreground m-0 tracking-tight">Inscripción por enlace</h2>
                <p className="text-[12px] text-muted-foreground m-0 mt-0.5">
                  Compártelo y cada deportista llena sus propios datos.
                </p>
              </div>
              <button onClick={onCerrar} className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>

            <div
              className="px-5 overflow-y-auto"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)' }}
            >
              {error && (
                <p className="text-[12px] rounded-lg px-3 py-2 mb-3" style={{ background: 'rgba(239,71,111,0.1)', color: '#A33A4E' }}>
                  {error}
                </p>
              )}

              {!estado ? (
                <div className="h-24 flex items-center justify-center">
                  <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-secondary/60">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-foreground m-0">Recibir inscripciones</p>
                      <p className="text-[11px] text-muted-foreground m-0">
                        {!estado.abierta
                          ? 'Nadie puede inscribirse ahora'
                          : estado.vencido
                            ? 'Se cerró en la fecha que pusiste'
                            : 'El enlace está activo'}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={guardando}
                      onClick={() => cambiar({ abierta: !estado.abierta })}
                      aria-label="Recibir inscripciones"
                      className="w-11 h-6 rounded-full relative shrink-0 transition-colors disabled:opacity-50"
                      style={{ background: estado.abierta ? '#381DA0' : '#D8D3E4' }}
                    >
                      <span
                        className="absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white transition-all"
                        style={{ left: estado.abierta ? 'calc(100% - 21px)' : '3px' }}
                      />
                    </button>
                  </div>

                  {estado.abierta && estado.url && (
                    <>
                      <div className="flex items-center gap-2 mt-3 p-2.5 rounded-xl bg-secondary/60 border border-border">
                        <Link2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <code className="flex-1 min-w-0 text-[11px] text-foreground truncate">{estado.url}</code>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <button onClick={copiar}
                          className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary text-white text-[12.5px] font-semibold">
                          {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiado ? 'Copiado' : 'Copiar'}
                        </button>
                        <a href={porWhatsApp} target="_blank" rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-border text-[12.5px] font-semibold text-foreground">
                          WhatsApp
                        </a>
                      </div>

                      <div className="mt-4">
                        <div className="flex items-baseline gap-2">
                          <b className="text-[22px] font-bold tracking-tight text-foreground leading-none">{estado.recibidos}</b>
                          <span className="text-[12px] text-muted-foreground">
                            {estado.esperados ? `de ${estado.esperados} esperados` : 'inscritos por el enlace'}
                          </span>
                        </div>
                        {estado.esperados ? (
                          <div className="h-1.5 rounded-full bg-secondary overflow-hidden mt-2">
                            <div className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, Math.round((estado.recibidos / estado.esperados) * 100))}%`,
                                background: '#381DA0',
                              }} />
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-3">
                        <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                          ¿Cuántos esperas? <span className="font-normal opacity-70">· opcional</span>
                        </label>
                        <input
                          type="number" min={0}
                          defaultValue={estado.esperados ?? ''}
                          onBlur={e => {
                            const v = e.target.value.trim();
                            cambiar({ esperados: v === '' ? null : Number(v) });
                          }}
                          placeholder="Por ejemplo, 42"
                          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-[13px] outline-none focus:border-primary"
                        />
                        <p className="text-[10.5px] text-muted-foreground mt-1 m-0">
                          Sirve para saber cuántos faltan por responder.
                        </p>
                      </div>

                      {/* Cierre automático. Apaga el enlace sin cambiarlo: al
                          correr la fecha vuelve a servir el mismo, y el club no
                          tiene que repartirlo otra vez. */}
                      <div className="mt-4 pt-3.5 border-t border-border">
                        <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                          Cerrar automáticamente <span className="font-normal opacity-70">· opcional</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <DatePicker
                            value={estado.vence ?? ''}
                            minDate={new Date()}
                            compacto
                            placeholder="Sin fecha"
                            className={`flex-1 min-w-0 ${guardando ? 'opacity-50 pointer-events-none' : ''}`}
                            onChange={v => cambiar({ vence: v || null })}
                          />
                          {estado.vence && (
                            <button onClick={() => cambiar({ vence: null })} disabled={guardando}
                              className="shrink-0 text-[11.5px] font-semibold px-2.5 py-2 rounded-lg text-[#A33A4E] disabled:opacity-50"
                              style={{ border: '1px solid rgba(163,58,78,0.28)' }}>
                              Quitar
                            </button>
                          )}
                        </div>
                        {estado.vence ? (
                          <div className="flex items-center gap-2 flex-wrap mt-1.5">
                            <span className="text-[10.5px] text-muted-foreground">
                              Cierra el {enPalabras(estado.vence)}
                            </span>
                            <span className="text-[10.5px] font-semibold px-1.5 py-px rounded"
                              style={
                                estado.vencido
                                  ? { background: 'rgba(239,71,111,0.1)', color: '#A33A4E' }
                                  : { background: '#FDF7E8', color: '#8A6216' }
                              }>
                              {estado.vencido
                                ? 'Ya venció'
                                : diasHasta(estado.vence) === 0
                                  ? 'Hoy es el último día'
                                  : `Faltan ${diasHasta(estado.vence)} días`}
                            </span>
                          </div>
                        ) : (
                          <p className="text-[10.5px] text-muted-foreground mt-1 m-0">
                            Sin fecha, el enlace queda abierto hasta que lo apagues.
                          </p>
                        )}
                      </div>

                      <button onClick={rotar} disabled={guardando}
                        className="flex items-center justify-center gap-1.5 w-full mt-4 py-2 text-[12px] font-semibold text-muted-foreground disabled:opacity-50">
                        <RefreshCw className="w-3.5 h-3.5" />
                        Generar un enlace nuevo
                      </button>
                      <p className="text-[10.5px] text-muted-foreground text-center m-0">
                        Úsalo si el enlace se filtró. El anterior deja de servir.
                      </p>
                    </>
                  )}
                </>
              )}
            </div>
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
