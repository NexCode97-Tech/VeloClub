'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@clerk/nextjs';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Check, ChevronRight, UserPlus, X } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';

/**
 * Lo que espera el visto bueno del club.
 *
 * Desde el 1 de septiembre de 2026 una inscripcion nueva **ya no cae aca**:
 * entra aprobada y la persona puede usar la app de una. El enlace es la
 * autorizacion, y pedirle al club que apruebe uno por uno a los que el mismo
 * invito era pedirle dos veces lo mismo.
 *
 * La bandeja se queda por dos razones, y las dos son reales: los cambios de
 * datos de quien ya estaba SI se revisan —ahi alguien esta editando una ficha
 * que el club ya dio por buena— y los que quedaron pendientes antes del cambio
 * siguen esperando a que alguien los acepte.
 *
 * Sale arriba de la lista de miembros y solo cuando hay alguien: es trabajo que
 * caduca, porque del otro lado hay alguien que ya entregó sus datos y no puede
 * entrar hasta que el club apruebe.
 *
 * Va en lista y no en tarjetas apiladas: cuando un club abre el enlace le
 * pueden llegar cuarenta de un día para otro, y con la ficha entera de cada uno
 * a la vista no se alcanza a ver ni la tercera. El detalle se abre al tocar.
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
  rh: string | null;
  gender: string | null;
  allergies: string | null;
  emergencyContact: string | null;
  emergencyPhone: string | null;
  guardianRelation: string | null;
  createdAt: string;
  /** Ese documento ya está en otra ficha del club. */
  duplicado: boolean;
  locations: { location: { id: string; name: string } }[];
}

interface Actualizacion {
  id: string;
  fullName: string;
  pictureUrl: string | null;
  birthDate: string | null;
  docType: string | null;
  docNumber: string | null;
  enviadoEn: string;
  /** Trae una cuenta recién creada: aprobar es darle el acceso. */
  estrenaCuenta: boolean;
  locations: { location: { id: string; name: string } }[];
  cambios: { campo: string; etiqueta: string; antes: unknown; despues: unknown }[];
}

/** Una fila de la bandeja, venga de donde venga. */
type Fila =
  | { clase: 'nueva'; id: string; cuando: string; datos: Pendiente }
  | { clase: 'actualiza'; id: string; cuando: string; datos: Actualizacion };

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
  const [detalle, setDetalle] = useState<Fila | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
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
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Escape cierra primero el detalle: si cerrara todo, quien solo quería
      // volver a la lista tendría que abrir la bandeja de nuevo.
      if (detalle) setDetalle(null);
      else setAbierto(false);
    };
    window.addEventListener('keydown', alTeclear);
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', alTeclear);
      document.body.style.overflow = previo;
    };
  }, [abierto, detalle]);

  // Las actualizaciones van primero: son las que se resuelven en un vistazo.
  const filas: Fila[] = useMemo(() => [
    ...actualizaciones.map(a => ({ clase: 'actualiza' as const, id: a.id, cuando: a.enviadoEn, datos: a })),
    ...pendientes.map(p => ({ clase: 'nueva' as const, id: p.id, cuando: p.createdAt, datos: p })),
  ], [actualizaciones, pendientes]);

  function alternar(id: string) {
    setMarcados(s => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function quitarDeLaLista(fila: Fila) {
    if (fila.clase === 'nueva') setPendientes(p => p.filter(x => x.id !== fila.id));
    else setActualizaciones(p => p.filter(x => x.id !== fila.id));
    setMarcados(s => { const n = new Set(s); n.delete(fila.id); return n; });
  }

  /** Le da el visto bueno a una fila, sea inscripción nueva o actualización. */
  async function aceptar(fila: Fila) {
    setTrabajando(fila.id);
    setError(null);
    try {
      const token = await getToken();
      const ruta = fila.clase === 'nueva'
        ? `/inscripcion/club/${fila.id}/aprobar`
        : `/inscripcion/club/${fila.id}/aplicar`;
      await apiFetch(ruta, { method: 'POST', token });
      quitarDeLaLista(fila);
      setDetalle(null);
      onCambio();
    } catch {
      setError(fila.clase === 'nueva'
        ? 'No se pudo aceptar. Intenta de nuevo.'
        : 'No se pudieron aplicar los cambios. Intenta de nuevo.');
    } finally {
      setTrabajando(null);
    }
  }

  async function rechazar(fila: Fila) {
    const aviso = fila.clase === 'nueva'
      ? `¿Rechazar la inscripción de ${fila.datos.fullName}?\n\n` +
        '• Se borra el registro y su cuenta de acceso.\n' +
        '• Ese correo y ese documento quedan libres para volver a usarse.\n\n' +
        'Esto no se puede deshacer.'
      : `¿Descartar los datos que envió ${fila.datos.fullName}?\n\n` +
        (fila.datos.estrenaCuenta
          ? '• Su ficha se queda como está y la cuenta que creó se borra.\n'
          : '• Su ficha se queda como está.\n');
    if (!confirm(aviso)) return;

    setTrabajando(fila.id);
    setError(null);
    try {
      const token = await getToken();
      const ruta = fila.clase === 'nueva'
        ? `/inscripcion/club/${fila.id}`
        : `/inscripcion/club/${fila.id}/cambios`;
      await apiFetch(ruta, { method: 'DELETE', token });
      quitarDeLaLista(fila);
      setDetalle(null);
      onCambio();
    } catch {
      setError('No se pudo descartar. Intenta de nuevo.');
    } finally {
      setTrabajando(null);
    }
  }

  /**
   * Lo marcado, de un solo golpe.
   *
   * Una por una y no en paralelo: veinte peticiones simultáneas chocan con el
   * límite de la API y algunas se caerían sin que nadie se entere.
   */
  async function aceptarMarcados() {
    const lote = filas.filter(f => marcados.has(f.id));
    if (lote.length === 0) return;
    if (!confirm(`¿Aceptar ${lote.length === 1 ? 'el que marcaste' : `los ${lote.length} que marcaste`}?`)) return;

    setTrabajando('lote');
    setError(null);
    let fallaron = 0;
    try {
      const token = await getToken();
      for (const fila of lote) {
        try {
          const ruta = fila.clase === 'nueva'
            ? `/inscripcion/club/${fila.id}/aprobar`
            : `/inscripcion/club/${fila.id}/aplicar`;
          await apiFetch(ruta, { method: 'POST', token });
          quitarDeLaLista(fila);
        } catch { fallaron++; }
      }
      if (fallaron > 0) {
        setError(`Quedaron ${fallaron} sin aceptar. Vuelve a intentarlo con esos.`);
      }
      onCambio();
    } finally {
      setTrabajando(null);
    }
  }

  const total = filas.length;
  if (total === 0) return null;

  const enLote = trabajando === 'lote';

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
                : 'Enviaron sus datos por el enlace.'}
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
              {/* El centrado va por flex y no por `translate(-50%,-50%)`:
                  framer-motion escribe `transform` para animar y pisaría ese
                  translate, dejando la esquina del panel en el centro. */}
              <div className="fixed inset-0 flex items-center justify-center px-4"
                style={{ zIndex: 121, pointerEvents: 'none' }}>
                <motion.div
                  key="hoja"
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
                  className="w-full max-w-[620px] bg-white rounded-2xl border border-border flex flex-col overflow-hidden"
                  style={{ pointerEvents: 'auto', maxHeight: '88dvh' }}
                >
                  <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-border shrink-0">
                    <div className="min-w-0">
                      <h2 className="text-[17px] font-semibold text-foreground m-0 tracking-tight">Esperando visto bueno</h2>
                      <p className="text-[12px] text-muted-foreground m-0 mt-0.5">
                        Toca a alguien para ver sus datos antes de decidir.
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

                  {puedeAprobar && (
                    <div className="flex items-center gap-2.5 px-5 py-2.5 border-b border-border bg-secondary/40 shrink-0">
                      <Casilla
                        marcada={marcados.size === filas.length && filas.length > 0}
                        onClick={() => setMarcados(s => (s.size === filas.length ? new Set() : new Set(filas.map(f => f.id))))}
                      />
                      <span className="text-[12px] text-muted-foreground">
                        {marcados.size === 0
                          ? `${filas.length} en la lista`
                          : <><b className="text-foreground">{marcados.size}</b> {marcados.size === 1 ? 'marcado' : 'marcados'} de {filas.length}</>}
                      </span>
                      {marcados.size > 0 && (
                        <button onClick={aceptarMarcados} disabled={trabajando !== null}
                          className="ml-auto shrink-0 text-[11.5px] font-semibold px-3 py-1.5 rounded-lg text-white bg-[#0E7C57] disabled:opacity-50">
                          {enLote ? 'Aceptando...' : `Aceptar ${marcados.size === 1 ? 'el marcado' : `los ${marcados.size}`}`}
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto">
                    {filas.map(fila => (
                      <FilaBandeja
                        key={fila.id}
                        fila={fila}
                        marcada={marcados.has(fila.id)}
                        puedeAprobar={puedeAprobar}
                        ocupada={trabajando === fila.id || enLote}
                        onMarcar={() => alternar(fila.id)}
                        onAbrir={() => setDetalle(fila)}
                      />
                    ))}
                  </div>
                </motion.div>
              </div>

              {/* El detalle, encima de la lista */}
              {detalle && (
                <>
                  <motion.div
                    key="fondo-detalle"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => setDetalle(null)}
                    className="fixed inset-0"
                    style={{ background: 'rgba(15,10,30,0.42)', zIndex: 130 }}
                  />
                  <div className="fixed inset-0 flex items-center justify-center px-4"
                    style={{ zIndex: 131, pointerEvents: 'none' }}>
                    <motion.div
                      key="detalle"
                      initial={{ opacity: 0, y: 16, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 16, scale: 0.98 }}
                      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                      className="w-full max-w-[480px] bg-white rounded-2xl border border-border flex flex-col overflow-hidden"
                      style={{ pointerEvents: 'auto', maxHeight: '86dvh' }}
                    >
                      <Detalle
                        fila={detalle}
                        puedeAprobar={puedeAprobar}
                        ocupada={trabajando === detalle.id}
                        onCerrar={() => setDetalle(null)}
                        onAceptar={() => aceptar(detalle)}
                        onRechazar={() => rechazar(detalle)}
                      />
                    </motion.div>
                  </div>
                </>
              )}
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

/** La casilla de marcar. Es un botón y no un input para poder pintarla igual. */
function Casilla({ marcada, onClick }: { marcada: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onClick(); }}
      role="checkbox"
      aria-checked={marcada}
      aria-label={marcada ? 'Quitar la marca' : 'Marcar'}
      className="w-[17px] h-[17px] rounded-[5px] border-[1.5px] flex items-center justify-center shrink-0 transition-colors"
      style={
        marcada
          ? { background: '#4361EE', borderColor: '#4361EE' }
          : { background: '#fff', borderColor: 'rgba(120,80,200,0.28)' }
      }
    >
      {marcada && <Check className="w-2.5 h-2.5 text-white" strokeWidth={4} />}
    </button>
  );
}

/** Una fila: quién es, qué trae, y cuándo llegó. */
function FilaBandeja({ fila, marcada, puedeAprobar, ocupada, onMarcar, onAbrir }: {
  fila: Fila;
  marcada: boolean;
  puedeAprobar: boolean;
  ocupada: boolean;
  onMarcar: () => void;
  onAbrir: () => void;
}) {
  const nombre = fila.datos.fullName;
  const doc = fila.datos.docNumber
    ? `${fila.datos.docType ?? 'Doc'} ${fila.datos.docNumber}`
    : 'Sin documento';

  const resumen = fila.clase === 'actualiza'
    ? fila.datos.cambios.slice(0, 2).map(c => c.etiqueta).join(', ') +
      (fila.datos.cambios.length > 2 ? ` +${fila.datos.cambios.length - 2}` : '')
    : [fila.datos.locations[0]?.location.name, fila.datos.category].filter(Boolean).join(' · ') || 'Sin sede';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onAbrir}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(); } }}
      className={`w-full text-left px-5 py-2.5 border-b border-border/70 last:border-b-0 flex items-center gap-3 cursor-pointer transition-colors hover:bg-secondary/40 focus:outline-none focus-visible:bg-secondary/60 ${
        ocupada ? 'opacity-50' : ''
      }`}
    >
      {puedeAprobar && <Casilla marcada={marcada} onClick={onMarcar} />}

      <span className="w-8 h-8 rounded-full bg-primary/10 text-primary text-[10.5px] font-bold flex items-center justify-center shrink-0">
        {iniciales(nombre)}
      </span>

      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[13px] font-semibold text-foreground truncate">{nombre}</span>
          {fila.clase === 'nueva' && fila.datos.duplicado && (
            <Pastilla tono="duda">Revisar</Pastilla>
          )}
        </span>
        <span className="block text-[11px] text-muted-foreground truncate">{doc}</span>
        {/* En pantalla angosta el resumen baja a su propio renglón, para que el
            nombre nunca se recorte por darle campo. */}
        <span className="block sm:hidden text-[11px] text-muted-foreground truncate">{resumen}</span>
      </span>

      <span className="hidden sm:block shrink-0">
        {fila.clase === 'actualiza'
          ? <Pastilla tono="azul">Actualiza {fila.datos.cambios.length}</Pastilla>
          : <Pastilla tono="violeta">Nueva</Pastilla>}
      </span>

      <span className="hidden sm:block flex-1 min-w-0 text-[11.5px] text-muted-foreground truncate">
        {resumen}
      </span>

      <span className="hidden sm:block shrink-0 text-[11px] text-muted-foreground text-right w-[68px]">
        {haceCuanto(fila.cuando)}
      </span>

      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
    </div>
  );
}

function Pastilla({ tono, children }: { tono: 'azul' | 'violeta' | 'duda'; children: React.ReactNode }) {
  const estilo = {
    azul:    { background: 'rgba(67,97,238,0.11)', color: '#2A52BE' },
    violeta: { background: 'rgba(56,29,160,0.11)', color: '#6D28D9' },
    duda:    { background: '#F7E9C4', color: '#8A6216' },
  }[tono];
  return (
    <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap" style={estilo}>
      {children}
    </span>
  );
}

/** Lo que se mira antes de decidir. */
function Detalle({ fila, puedeAprobar, ocupada, onCerrar, onAceptar, onRechazar }: {
  fila: Fila;
  puedeAprobar: boolean;
  ocupada: boolean;
  onCerrar: () => void;
  onAceptar: () => void;
  onRechazar: () => void;
}) {
  const nombre = fila.datos.fullName;
  const años = añosDe(fila.datos.birthDate);

  return (
    <>
      <div className="flex items-start gap-3 px-5 pt-4 pb-3 border-b border-border shrink-0">
        <span className="w-9 h-9 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center shrink-0">
          {iniciales(nombre)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[15px] font-semibold text-foreground m-0 tracking-tight truncate">{nombre}</h3>
            {fila.clase === 'actualiza'
              ? <Pastilla tono="azul">Actualiza {fila.datos.cambios.length}</Pastilla>
              : <Pastilla tono="violeta">Nueva</Pastilla>}
          </div>
          <p className="text-[11.5px] text-muted-foreground m-0">
            {fila.clase === 'actualiza'
              ? ['Ya está en el club', fila.datos.estrenaCuenta ? 'sin cuenta' : null, haceCuanto(fila.cuando)]
                  .filter(Boolean).join(' · ')
              : [años !== null ? `${años} años` : null, haceCuanto(fila.cuando)].filter(Boolean).join(' · ')}
          </p>
        </div>
        <button onClick={onCerrar} className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0">
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3">
        {fila.clase === 'nueva' && fila.datos.duplicado && (
          <div className="flex gap-2 items-start rounded-xl px-3 py-2.5 mb-3"
            style={{ background: '#FDF7E8', border: '1px solid rgba(217,162,39,0.35)' }}>
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: '#B8862A' }} />
            <span className="text-[11.5px] leading-relaxed" style={{ color: '#8A6216' }}>
              <b>Ese documento ya está en otra ficha del club.</b> Puede ser la misma
              persona registrada dos veces, o un número que quedó repetido por error.
              Si ya está, rechaza esta y corrige la ficha que existe.
            </span>
          </div>
        )}

        {fila.clase === 'actualiza' ? (
          <>
            {fila.datos.estrenaCuenta && (
              <p className="text-[11.5px] rounded-xl px-3 py-2.5 mb-3 leading-relaxed"
                style={{ background: 'rgba(42,82,190,0.08)', color: '#2A52BE' }}>
                No tenía cuenta y creó una con este correo. Al aceptar queda
                enlazada y ya puede entrar a la app.
              </p>
            )}
            {/* Solo lo que se mueve: la ficha entera obligaría a comparar veinte
                campos para hallar los tres nuevos. */}
            {fila.datos.cambios.map(c => (
              <div key={c.campo} className="grid grid-cols-[96px_1fr] gap-2.5 py-2 border-b border-border/50 last:border-b-0">
                <span className="text-[11.5px] text-muted-foreground pt-0.5">{c.etiqueta}</span>
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
          </>
        ) : (
          <Ficha p={fila.datos} años={años} />
        )}
      </div>

      {puedeAprobar && (
        <div className="flex items-center gap-2 px-5 py-3 border-t border-border bg-secondary/40 shrink-0"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}>
          <button onClick={onRechazar} disabled={ocupada}
            className="text-[12px] font-semibold px-3 py-2 rounded-lg text-[#A33A4E] bg-[#EF476F]/8 disabled:opacity-50">
            {fila.clase === 'nueva' ? 'Rechazar' : 'Descartar'}
          </button>
          <button onClick={onAceptar} disabled={ocupada}
            className="ml-auto flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-lg text-white bg-[#0E7C57] disabled:opacity-50">
            <Check className="w-3.5 h-3.5" />
            {ocupada
              ? 'Guardando...'
              : fila.clase === 'nueva'
                ? 'Aceptar y darle acceso'
                : fila.datos.estrenaCuenta
                  ? 'Aplicar y darle acceso'
                  : `Aplicar ${fila.datos.cambios.length === 1 ? 'el cambio' : `los ${fila.datos.cambios.length} cambios`}`}
          </button>
        </div>
      )}
    </>
  );
}

/** La ficha de quien se acaba de inscribir. Acá no hay antes y después. */
function Ficha({ p, años }: { p: Pendiente; años: number | null }) {
  const lineas: [string, string | null][] = [
    ['Documento', p.docNumber ? `${p.docType ?? 'Doc'} ${p.docNumber}` : null],
    ['Nacimiento', p.birthDate ? `${p.birthDate.slice(0, 10)}${años !== null ? ` · ${años} años` : ''}` : null],
    ['Género', p.gender],
    ['Correo', p.email],
    ['Celular', p.phone],
    ['Sede', p.locations.map(l => l.location.name).join(', ') || null],
    ['Categoría', p.category],
    ['Nivel', p.tipo],
    ['EPS', p.eps],
    ['RH', p.rh],
    ['Alergias', p.allergies],
    ['Acudiente', p.emergencyContact
      ? `${p.emergencyContact}${p.guardianRelation ? ` (${p.guardianRelation})` : ''}`
      : null],
    ['Celular del acudiente', p.emergencyPhone],
  ];

  return (
    <>
      {lineas.map(([etiqueta, valor]) => (
        <div key={etiqueta} className="grid grid-cols-[110px_1fr] gap-2.5 py-1.5 border-b border-border/50 last:border-b-0">
          <span className="text-[11.5px] text-muted-foreground">{etiqueta}</span>
          <span className={`text-[12px] break-words ${valor ? 'text-foreground' : 'text-muted-foreground italic'}`}>
            {valor ?? 'sin dato'}
          </span>
        </div>
      ))}
    </>
  );
}
