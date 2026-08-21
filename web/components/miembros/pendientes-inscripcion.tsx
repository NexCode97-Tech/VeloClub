'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@clerk/nextjs';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, UserPlus, X } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';

/**
 * Los que se inscribieron por el enlace y esperan el visto bueno del club.
 *
 * Sale arriba de la lista de miembros y solo cuando hay alguien: es trabajo que
 * caduca, porque del otro lado hay alguien que ya entregó sus datos y no puede
 * entrar hasta que el club apruebe.
 */

interface Pendiente {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  docType: string | null;
  docNumber: string | null;
  category: string | null;
  tipo: string | null;
  eps: string | null;
  emergencyContact: string | null;
  emergencyPhone: string | null;
  guardianRelation: string | null;
  createdAt: string;
  locations: { location: { id: string; name: string } }[];
}

function añosDe(iso: string | null): number | null {
  if (!iso) return null;
  const nace = new Date(iso);
  const hoy = new Date();
  let a = hoy.getFullYear() - nace.getFullYear();
  const m = hoy.getMonth() - nace.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nace.getDate())) a--;
  return a;
}

function haceCuanto(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 60) return `hace ${Math.max(1, min)} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}

function iniciales(nombre: string): string {
  return nombre.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

interface Actualizacion {
  id: string;
  fullName: string;
  pictureUrl: string | null;
  birthDate: string | null;
  enviadoEn: string;
  locations: { location: { id: string; name: string } }[];
  cambios: { campo: string; etiqueta: string; antes: unknown; despues: unknown }[];
}

/** Un valor vacío se muestra como «sin dato», no como una comilla suelta. */
function valorDe(v: unknown): string {
  if (v === null || v === undefined || v === '') return 'sin dato';
  return String(v);
}

export function PendientesInscripcion({ puedeAprobar, onCambio }: {
  puedeAprobar: boolean;
  onCambio: () => void;
}) {
  const { getToken } = useAuth();
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [actualizaciones, setActualizaciones] = useState<Actualizacion[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const token = await getToken();
      const r = await apiFetch<{ pendientes: Pendiente[]; actualizaciones: Actualizacion[] }>(
        '/inscripcion/club/pendientes', { token }
      );
      setPendientes(r.pendientes);
      setActualizaciones(r.actualizaciones ?? []);
    } catch { /* la lista de miembros no puede caerse por esto */ }
  }, [getToken]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    window.addEventListener('keydown', alTeclear);
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', alTeclear);
      document.body.style.overflow = previo;
    };
  }, [abierto]);

  async function aprobar(id: string) {
    setTrabajando(id);
    setError(null);
    try {
      const token = await getToken();
      await apiFetch(`/inscripcion/club/${id}/aprobar`, { method: 'POST', token });
      setPendientes(p => p.filter(x => x.id !== id));
      onCambio();
    } catch {
      setError('No se pudo aprobar. Intenta de nuevo.');
    } finally {
      setTrabajando(null);
    }
  }

  async function rechazar(p: Pendiente) {
    const aviso =
      `¿Rechazar la inscripción de ${p.fullName}?\n\n` +
      '• Se borra el registro y su cuenta de acceso.\n' +
      '• Ese correo y ese documento quedan libres para volver a usarse.\n\n' +
      'Esto no se puede deshacer.';
    if (!confirm(aviso)) return;

    setTrabajando(p.id);
    setError(null);
    try {
      const token = await getToken();
      await apiFetch(`/inscripcion/club/${p.id}`, { method: 'DELETE', token });
      setPendientes(x => x.filter(y => y.id !== p.id));
      onCambio();
    } catch {
      setError('No se pudo rechazar. Intenta de nuevo.');
    } finally {
      setTrabajando(null);
    }
  }

  async function aplicar(a: Actualizacion) {
    setTrabajando(a.id);
    setError(null);
    try {
      const token = await getToken();
      await apiFetch(`/inscripcion/club/${a.id}/aplicar`, { method: 'POST', token });
      setActualizaciones(x => x.filter(y => y.id !== a.id));
      onCambio();
    } catch {
      setError('No se pudieron aplicar los cambios. Intenta de nuevo.');
    } finally {
      setTrabajando(null);
    }
  }

  async function descartar(a: Actualizacion) {
    if (!confirm(`¿Descartar los cambios que envió ${a.fullName}?\n\nSu ficha se queda como está.`)) return;
    setTrabajando(a.id);
    try {
      const token = await getToken();
      await apiFetch(`/inscripcion/club/${a.id}/cambios`, { method: 'DELETE', token });
      setActualizaciones(x => x.filter(y => y.id !== a.id));
    } catch {
      setError('No se pudieron descartar. Intenta de nuevo.');
    } finally {
      setTrabajando(null);
    }
  }

  async function aprobarTodos() {
    if (!confirm(`¿Aceptar a los ${pendientes.length} que están esperando?`)) return;
    setTrabajando('todos');
    try {
      const token = await getToken();
      await apiFetch('/inscripcion/club/aprobar-todos', { method: 'POST', token });
      setPendientes([]);
      setAbierto(false);
      onCambio();
    } catch {
      setError('No se pudieron aprobar. Intenta de nuevo.');
    } finally {
      setTrabajando(null);
    }
  }

  const total = pendientes.length + actualizaciones.length;
  if (total === 0) return null;

  return (
    <>
      {/* El aviso, arriba de la lista */}
      <div
        className="flex items-center gap-3 flex-wrap rounded-2xl px-4 py-3 mb-3"
        style={{ background: 'rgba(240,180,41,0.10)', border: '1px solid rgba(217,162,43,0.3)' }}
      >
        <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
          style={{ background: 'rgba(217,162,43,0.16)' }}>
          <UserPlus className="w-4 h-4" style={{ color: '#B8862A' }} />
        </div>
        <div className="flex-1 min-w-[170px]">
          <p className="text-[13px] font-semibold m-0" style={{ color: '#8A6216' }}>
            {total === 1 ? '1 cosa esperando tu visto bueno' : `${total} cosas esperando tu visto bueno`}
          </p>
          <p className="text-[11.5px] m-0" style={{ color: '#B8862A' }}>
            {pendientes.length > 0 && actualizaciones.length > 0
              ? `${pendientes.length} inscripción(es) nueva(s) y ${actualizaciones.length} actualización(es) de datos.`
              : pendientes.length > 0
                ? 'Se inscribieron por el enlace y no entran hasta que las aceptes.'
                : 'Enviaron cambios en su ficha por el enlace.'}
          </p>
        </div>
        <button onClick={() => setAbierto(true)}
          className="shrink-0 text-[12px] font-semibold px-3.5 py-2 rounded-lg text-white"
          style={{ background: '#8A6216' }}>
          Revisar
        </button>
      </div>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {abierto && (
            <>
              <motion.div
                key="fondo"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                onClick={() => setAbierto(false)}
                className="fixed inset-0"
                style={{ background: 'rgba(15,10,30,0.5)', backdropFilter: 'blur(3px)', zIndex: 120 }}
              />
              <div className="fixed inset-0 flex items-center justify-center px-4"
                style={{ zIndex: 121, pointerEvents: 'none' }}>
              <motion.div
                key="hoja"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
                className="w-full max-w-[560px] bg-white rounded-2xl border border-border flex flex-col"
                style={{ pointerEvents: 'auto', maxHeight: '88dvh' }}
              >
                <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-border">
                  <div className="min-w-0">
                    <h2 className="text-[17px] font-semibold text-foreground m-0 tracking-tight">Esperando visto bueno</h2>
                    <p className="text-[12px] text-muted-foreground m-0 mt-0.5">
                      Revisa los datos antes de darles acceso.
                    </p>
                  </div>
                  <button onClick={() => setAbierto(false)} className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>

                {error && (
                  <p className="text-[12px] mx-5 mt-3 rounded-lg px-3 py-2" style={{ background: 'rgba(239,71,111,0.1)', color: '#A33A4E' }}>
                    {error}
                  </p>
                )}

                <div className="flex-1 overflow-y-auto px-5 py-2">
                  {actualizaciones.map(a => {
                    const ocupado = trabajando === a.id;
                    return (
                      <div key={a.id} className="py-3 border-b border-border/60 last:border-b-0">
                        <div className="flex items-start gap-3">
                          <span className="w-9 h-9 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center shrink-0">
                            {iniciales(a.fullName)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-[13.5px] font-semibold text-foreground m-0 truncate">{a.fullName}</p>
                              <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full shrink-0"
                                style={{ background: 'rgba(42,82,190,0.1)', color: '#2A52BE' }}>
                                actualiza {a.cambios.length}
                              </span>
                            </div>
                            <p className="text-[11.5px] text-muted-foreground m-0">
                              Ya está en el club · {haceCuanto(a.enviadoEn)}
                            </p>
                          </div>
                        </div>

                        {/* Solo lo que se mueve: la ficha entera obligaría a
                            comparar veinte campos para hallar los tres nuevos. */}
                        <div className="mt-2 pl-12">
                          {a.cambios.map(c => (
                            <div key={c.campo} className="grid grid-cols-[92px_1fr] gap-2.5 py-1.5 border-b border-border/40 last:border-b-0">
                              <span className="text-[11px] text-muted-foreground pt-0.5">{c.etiqueta}</span>
                              <span className="min-w-0">
                                <span className={`block text-[11.5px] ${
                                  valorDe(c.antes) === 'sin dato'
                                    ? 'text-muted-foreground italic'
                                    : 'text-[#A33A4E] line-through decoration-[#A33A4E]/40'
                                }`}>
                                  {valorDe(c.antes)}
                                </span>
                                <span className="block text-[12.5px] font-semibold text-[#0E7C57] break-words">
                                  {valorDe(c.despues)}
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>

                        {puedeAprobar && (
                          <div className="flex gap-2 mt-2.5 pl-12">
                            <button onClick={() => descartar(a)} disabled={ocupado}
                              className="text-[11.5px] font-semibold px-3 py-1.5 rounded-lg text-[#A33A4E] bg-[#EF476F]/8 disabled:opacity-50">
                              Descartar
                            </button>
                            <button onClick={() => aplicar(a)} disabled={ocupado}
                              className="flex items-center gap-1.5 text-[11.5px] font-semibold px-3 py-1.5 rounded-lg text-white bg-[#0E7C57] disabled:opacity-50">
                              <Check className="w-3 h-3" />
                              {ocupado ? 'Aplicando...' : `Aplicar ${a.cambios.length === 1 ? 'el cambio' : `los ${a.cambios.length} cambios`}`}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {pendientes.map(p => {
                    const años = añosDe(p.birthDate);
                    const sede = p.locations[0]?.location.name;
                    const ocupado = trabajando === p.id;
                    return (
                      <div key={p.id} className="py-3 border-b border-border/60 last:border-b-0">
                        <div className="flex items-start gap-3">
                          <span className="w-9 h-9 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center shrink-0">
                            {iniciales(p.fullName)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-[13.5px] font-semibold text-foreground m-0 truncate">{p.fullName}</p>
                              <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full shrink-0 bg-primary/10 text-primary">
                                nueva
                              </span>
                            </div>
                            <p className="text-[11.5px] text-muted-foreground m-0">
                              {[
                                años !== null ? `${años} años` : null,
                                sede,
                                haceCuanto(p.createdAt),
                              ].filter(Boolean).join(' · ')}
                            </p>
                            <p className="text-[11px] text-muted-foreground m-0 mt-1 break-all">
                              {[p.email, p.docNumber ? `${p.docType ?? 'Doc'} ${p.docNumber}` : null]
                                .filter(Boolean).join(' · ')}
                            </p>
                            {p.emergencyContact && (
                              <p className="text-[11px] text-muted-foreground m-0">
                                {p.guardianRelation ? `${p.guardianRelation}: ` : 'Contacto: '}
                                {p.emergencyContact}
                                {p.emergencyPhone ? ` · ${p.emergencyPhone}` : ''}
                              </p>
                            )}
                          </div>
                        </div>
                        {puedeAprobar && (
                          <div className="flex gap-2 mt-2.5 pl-12">
                            <button onClick={() => rechazar(p)} disabled={ocupado}
                              className="text-[11.5px] font-semibold px-3 py-1.5 rounded-lg text-[#A33A4E] bg-[#EF476F]/8 disabled:opacity-50">
                              Rechazar
                            </button>
                            <button onClick={() => aprobar(p.id)} disabled={ocupado}
                              className="flex items-center gap-1.5 text-[11.5px] font-semibold px-3 py-1.5 rounded-lg text-white bg-[#0E7C57] disabled:opacity-50">
                              <Check className="w-3 h-3" />
                              {ocupado ? 'Aceptando...' : 'Aceptar'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {puedeAprobar && pendientes.length > 1 && (
                  <div className="px-5 py-3 border-t border-border">
                    <button onClick={aprobarTodos} disabled={trabajando !== null}
                      className="w-full py-2.5 rounded-xl border border-primary/30 text-primary text-[13px] font-semibold disabled:opacity-50">
                      Aceptar a los {pendientes.length}
                    </button>
                  </div>
                )}
              </motion.div>
              </div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
