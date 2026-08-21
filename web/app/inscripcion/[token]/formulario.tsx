'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Check, ChevronLeft, User } from 'lucide-react';
import { Campo, Ayuda, Desplegable, entrada } from '@/components/miembros/campos';
import {
  DOC_TIPOS, PARENTESCOS, CATEGORIAS, NIVELES,
  edadDe, esMenorDeEdad,
} from '@/lib/ficha-deportista';

/**
 * El formulario que llena la familia.
 *
 * Va en pasos y no todo a la vista, al revés que la ficha del club: acá lo llena
 * una sola vez alguien que no conoce la app, casi siempre desde el celular, y un
 * formulario de veinte campos de una sola pantalla se abandona a la mitad.
 *
 * Un envío es un deportista. No hay «agregar otro hijo»: cada uno necesita su
 * propio perfil, su propio correo y su propia cuenta.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? '';
const PASOS = ['Datos del deportista', 'Acceso a la app', 'Entrenamiento', 'Salud y permisos'];

interface Config {
  club: { nombre: string; logoUrl: string | null };
  sedes: { id: string; name: string }[];
}

interface Datos {
  fullName: string; birthDate: string; docType: string; docNumber: string; phone: string;
  email: string; password: string; password2: string;
  guardianName: string; guardianRelation: string; guardianDocNumber: string; guardianPhone: string;
  locationId: string; category: string; tipo: string; eps: string;
  aceptaTerminos: boolean;
}

const VACIO: Datos = {
  fullName: '', birthDate: '', docType: '', docNumber: '', phone: '',
  email: '', password: '', password2: '',
  guardianName: '', guardianRelation: '', guardianDocNumber: '', guardianPhone: '',
  locationId: '', category: '', tipo: '', eps: '',
  aceptaTerminos: false,
};

export default function FormularioInscripcion({ token }: { token: string }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [cargando, setCargando] = useState(true);
  const [cerrado, setCerrado] = useState(false);

  const [paso, setPaso] = useState(0);
  const [d, setD] = useState<Datos>(VACIO);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState<string | null>(null);

  const set = <K extends keyof Datos>(k: K, v: Datos[K]) => {
    setD(p => ({ ...p, [k]: v }));
    setErrores(e => (e[k] ? { ...e, [k]: '' } : e));
  };

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/inscripcion/${token}`);
        if (!r.ok) { setCerrado(true); return; }
        setConfig(await r.json());
      } catch { setCerrado(true); }
      finally { setCargando(false); }
    })();
  }, [token]);

  const menor = esMenorDeEdad(d.birthDate);
  const años = edadDe(d.birthDate);

  /** Lo que falta en el paso actual. Se revisa acá y de nuevo en el servidor. */
  const revisarPaso = useCallback((): Record<string, string> => {
    const e: Record<string, string> = {};
    if (paso === 0) {
      if (d.fullName.trim().length < 2) e.fullName = 'Escribe el nombre y los apellidos';
      if (!d.birthDate) e.birthDate = 'Falta la fecha de nacimiento';
      else if (new Date(d.birthDate) > new Date()) e.birthDate = 'Esa fecha todavía no llega';
      if (!d.docType) e.docType = 'Elige el tipo';
      if (!d.docNumber.trim()) e.docNumber = 'Falta el número de documento';
      if (!d.phone.trim()) e.phone = 'Falta un celular de contacto';
    }
    if (paso === 1) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email.trim())) e.email = 'Ese correo no se ve bien escrito';
      if (d.password.length < 8) e.password = 'Mínimo 8 caracteres';
      if (d.password !== d.password2) e.password2 = 'Las dos contraseñas no coinciden';
      if (menor && !d.guardianName.trim()) e.guardianName = 'Falta el nombre del acudiente';
    }
    if (paso === 2) {
      if (!d.locationId) e.locationId = 'Elige dónde va a entrenar';
    }
    if (paso === 3) {
      if (!d.aceptaTerminos) e.aceptaTerminos = 'Necesitamos tu autorización para continuar';
    }
    return e;
  }, [paso, d, menor]);

  function siguiente() {
    const e = revisarPaso();
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    if (paso < PASOS.length - 1) { setPaso(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    else enviar();
  }

  async function enviar() {
    setEnviando(true);
    setErrores({});
    try {
      const r = await fetch(`${API}/inscripcion/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: d.fullName, birthDate: d.birthDate, docType: d.docType,
          docNumber: d.docNumber, phone: d.phone, email: d.email, password: d.password,
          guardianName: d.guardianName || undefined,
          guardianRelation: d.guardianRelation || undefined,
          guardianDocNumber: d.guardianDocNumber || undefined,
          guardianPhone: d.guardianPhone || undefined,
          locationId: d.locationId,
          category: d.category || undefined,
          tipo: d.tipo || undefined,
          eps: d.eps || undefined,
          aceptaTerminos: true,
        }),
      });
      const res = await r.json();

      if (!r.ok) {
        // El servidor dice qué campo choca, así que el aviso se pinta donde
        // está el problema y se vuelve a ese paso, en vez de un error suelto.
        if (res.campo) {
          setErrores({ [res.campo]: res.error });
          const pasoDelCampo: Record<string, number> = {
            docNumber: 0, fullName: 0, birthDate: 0,
            email: 1, password: 1,
            locationId: 2,
          };
          const destino = pasoDelCampo[res.campo];
          if (destino !== undefined) setPaso(destino);
        } else {
          setErrores({ general: res.error ?? 'No se pudo completar la inscripción.' });
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      setListo(res.nombre ?? d.fullName);
    } catch {
      setErrores({ general: 'No se pudo conectar. Revisa tu internet e intenta de nuevo.' });
    } finally {
      setEnviando(false);
    }
  }

  const sedes = useMemo(() => config?.sedes ?? [], [config]);

  if (cargando) {
    return (
      <Marco>
        <div className="h-40 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </Marco>
    );
  }

  if (cerrado || !config) {
    return (
      <Marco>
        <div className="bg-white rounded-2xl border border-border p-6 text-center">
          <p className="text-[15px] font-semibold text-foreground m-0 mb-1.5">Esta inscripción no está disponible</p>
          <p className="text-[13px] text-muted-foreground m-0">
            Puede que el club haya cerrado las inscripciones o que el enlace ya no sirva.
            Escríbele al club para que te pase el enlace nuevo.
          </p>
        </div>
      </Marco>
    );
  }

  if (listo) {
    return (
      <Marco club={config.club}>
        <div className="bg-white rounded-2xl border border-border p-6">
          <div className="w-11 h-11 rounded-full bg-[#0E7C57]/10 flex items-center justify-center mb-3">
            <Check className="w-5 h-5 text-[#0E7C57]" />
          </div>
          <p className="text-[16px] font-bold text-foreground m-0 mb-1.5">
            Listo, {listo.split(' ')[0]} quedó inscrito
          </p>
          <p className="text-[13px] text-muted-foreground m-0">
            Cuando {config.club.nombre} le dé el visto bueno podrá entrar a la app con su
            correo y la contraseña que acabas de crear.
          </p>
          <button
            type="button"
            onClick={() => { setD(VACIO); setPaso(0); setListo(null); }}
            className="w-full mt-5 py-3 rounded-xl border border-primary/30 text-primary text-[13.5px] font-semibold"
          >
            Inscribir a otro deportista
          </button>
        </div>
      </Marco>
    );
  }

  return (
    <Marco club={config.club}>
      <div className="bg-white rounded-2xl border border-border p-4 sm:p-5">
        <div className="flex gap-1.5 mb-3.5">
          {PASOS.map((_, i) => (
            <span
              key={i}
              className="h-[3px] flex-1 rounded-full transition-colors"
              style={{ background: i <= paso ? '#7C3AED' : '#E4E0EC' }}
            />
          ))}
        </div>
        <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-muted-foreground m-0 mb-0.5">
          Paso {paso + 1} de {PASOS.length}
        </p>
        <p className="text-[16px] font-bold text-foreground m-0 mb-3.5 tracking-tight">{PASOS[paso]}</p>

        {errores.general && (
          <p className="text-[12px] rounded-lg px-3 py-2 mb-3" style={{ background: 'rgba(239,71,111,0.1)', color: '#A33A4E' }}>
            {errores.general}
          </p>
        )}

        {/* ── 1 · Quién se inscribe ──────────────────────────────────────── */}
        {paso === 0 && (
          <>
            <Campo etiqueta="Nombre y apellidos" obligatorio error={errores.fullName}>
              <input value={d.fullName} onChange={e => set('fullName', e.target.value)}
                placeholder="Nombre completo del deportista" className={entrada(!!errores.fullName)} />
            </Campo>
            <Campo etiqueta="Fecha de nacimiento" obligatorio error={errores.birthDate}>
              <input type="date" value={d.birthDate} onChange={e => set('birthDate', e.target.value)}
                style={{ appearance: 'none', WebkitAppearance: 'none' }}
                className={entrada(!!errores.birthDate)} />
              {años !== null && años >= 0 && (
                <Ayuda>{años} {años === 1 ? 'año' : 'años'}{menor ? ' · te pediremos los datos del acudiente' : ''}</Ayuda>
              )}
            </Campo>
            <div className="grid grid-cols-3 gap-2">
              <Campo etiqueta="Tipo" obligatorio error={errores.docType}>
                <Desplegable valor={d.docType} opciones={[...DOC_TIPOS]} vacio="Tipo"
                  onElegir={v => set('docType', v)} />
              </Campo>
              <div className="col-span-2">
                <Campo etiqueta="Número de documento" obligatorio error={errores.docNumber}>
                  <input value={d.docNumber} onChange={e => set('docNumber', e.target.value)}
                    inputMode="numeric" placeholder="Sin puntos" className={entrada(!!errores.docNumber)} />
                </Campo>
              </div>
            </div>
            <Campo etiqueta="Celular" obligatorio error={errores.phone}>
              <input value={d.phone} onChange={e => set('phone', e.target.value)}
                inputMode="tel" placeholder="300 000 0000" className={entrada(!!errores.phone)} />
              <Ayuda>Del deportista o de quien responde por él.</Ayuda>
            </Campo>
          </>
        )}

        {/* ── 2 · Cuenta y acudiente ─────────────────────────────────────── */}
        {paso === 1 && (
          <>
            <Campo etiqueta="Correo del deportista" obligatorio error={errores.email}>
              <input type="email" value={d.email} onChange={e => set('email', e.target.value)}
                placeholder="correo@ejemplo.com" className={entrada(!!errores.email)} />
              <Ayuda>Tiene que ser suyo: no se puede repetir el de otro deportista.</Ayuda>
            </Campo>
            <Campo etiqueta="Contraseña" obligatorio error={errores.password}>
              <input type="password" value={d.password} onChange={e => set('password', e.target.value)}
                placeholder="Mínimo 8 caracteres" className={entrada(!!errores.password)} />
              <Ayuda>Con esta entra a la app, sin esperar ningún correo.</Ayuda>
            </Campo>
            <Campo etiqueta="Repite la contraseña" obligatorio error={errores.password2}>
              <input type="password" value={d.password2} onChange={e => set('password2', e.target.value)}
                placeholder="La misma de arriba" className={entrada(!!errores.password2)} />
            </Campo>

            {menor && (
              <>
                <p className="flex gap-2 items-start text-[11.5px] rounded-lg px-3 py-2 mb-2.5 mt-3.5"
                  style={{ background: 'rgba(124,58,237,0.08)', color: '#5B3AA6' }}>
                  <User className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    {d.fullName.split(' ')[0] || 'El deportista'} tiene {años} años, así que
                    necesitamos los datos de quien responde por él.
                  </span>
                </p>
                <Campo etiqueta="Nombre del acudiente" obligatorio error={errores.guardianName}>
                  <input value={d.guardianName} onChange={e => set('guardianName', e.target.value)}
                    placeholder="Nombre completo" className={entrada(!!errores.guardianName)} />
                </Campo>
                <div className="grid grid-cols-2 gap-2">
                  <Campo etiqueta="Parentesco">
                    <Desplegable valor={d.guardianRelation} opciones={[...PARENTESCOS]} vacio="Elegir"
                      onElegir={v => set('guardianRelation', v)} />
                  </Campo>
                  <Campo etiqueta="Cédula">
                    <input value={d.guardianDocNumber} onChange={e => set('guardianDocNumber', e.target.value)}
                      inputMode="numeric" placeholder="Sin puntos" className={entrada(false)} />
                  </Campo>
                </div>
                <Campo etiqueta="Celular del acudiente">
                  <input value={d.guardianPhone} onChange={e => set('guardianPhone', e.target.value)}
                    inputMode="tel" placeholder="300 000 0000" className={entrada(false)} />
                </Campo>
              </>
            )}
          </>
        )}

        {/* ── 3 · Entrenamiento ──────────────────────────────────────────── */}
        {paso === 2 && (
          <>
            <Campo etiqueta="Sede donde entrena" obligatorio error={errores.locationId}>
              <Desplegable
                valor={d.locationId}
                opciones={sedes.map(s => ({ valor: s.id, texto: s.name }))}
                vacio="Elegir sede"
                error={!!errores.locationId}
                onElegir={v => set('locationId', v)}
              />
              <Ayuda>Las sedes son las de este club.</Ayuda>
            </Campo>
            <Campo etiqueta="Categoría">
              <Desplegable valor={d.category} opciones={[...CATEGORIAS]} vacio="Elegir categoría"
                onElegir={v => set('category', v)} />
            </Campo>
            <Campo etiqueta="Nivel">
              <Desplegable valor={d.tipo} opciones={[...NIVELES]} vacio="Elegir nivel"
                onElegir={v => set('tipo', v)} />
            </Campo>
          </>
        )}

        {/* ── 4 · Salud y permisos ───────────────────────────────────────── */}
        {paso === 3 && (
          <>
            <Campo etiqueta="EPS">
              <input value={d.eps} onChange={e => set('eps', e.target.value)}
                placeholder="Entidad de salud" className={entrada(false)} />
            </Campo>

            <label className="flex gap-2.5 items-start cursor-pointer mt-4">
              <input type="checkbox" checked={d.aceptaTerminos}
                onChange={e => set('aceptaTerminos', e.target.checked)}
                className="mt-0.5 shrink-0 w-4 h-4 accent-[#7C3AED]" />
              <span className="text-[11.5px] text-muted-foreground leading-relaxed">
                Autorizo a VeloClub el tratamiento de estos datos según la{' '}
                <a href="/legal/politica-datos" target="_blank" className="text-primary underline">política de datos</a>
                {' '}y acepto los{' '}
                <a href="/legal/terminos" target="_blank" className="text-primary underline">términos</a>.
                {menor && ' Como acudiente, autorizo el registro del menor.'}
              </span>
            </label>
            {errores.aceptaTerminos && (
              <p className="text-[11px] text-[#EF476F] mt-1.5 m-0">{errores.aceptaTerminos}</p>
            )}
          </>
        )}

        <div className="flex gap-2 mt-5">
          {paso > 0 && (
            <button type="button" onClick={() => setPaso(p => p - 1)} disabled={enviando}
              className="flex items-center justify-center gap-1 px-4 py-3 rounded-xl border border-border text-[13px] font-semibold text-muted-foreground disabled:opacity-50">
              <ChevronLeft className="w-4 h-4" /> Atrás
            </button>
          )}
          <button type="button" onClick={siguiente} disabled={enviando}
            className="flex-1 py-3 rounded-xl bg-primary text-white text-[13.5px] font-bold disabled:opacity-60">
            {enviando
              ? 'Inscribiendo...'
              : paso < PASOS.length - 1
                ? 'Continuar'
                : `Inscribir a ${d.fullName.split(' ')[0] || 'este deportista'}`}
          </button>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground text-center mt-4">
        Un formulario por deportista. Si tienes más de uno, al terminar puedes inscribir al siguiente.
      </p>
    </Marco>
  );
}

/** El marco de la página: el club arriba, y el contenido centrado y angosto. */
function Marco({ club, children }: {
  club?: { nombre: string; logoUrl: string | null };
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-svh bg-[#F7F7FB] py-8 px-4">
      <div className="max-w-[520px] mx-auto">
        {club && (
          <div className="flex items-center gap-3 mb-4">
            {club.logoUrl
              ? (
                <div className="w-11 h-11 rounded-xl overflow-hidden bg-white border border-border shrink-0">
                  <Image src={club.logoUrl} alt={club.nombre} width={44} height={44}
                    className="w-full h-full object-cover" unoptimized />
                </div>
              )
              : <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#4361EE] shrink-0" />}
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-foreground m-0 leading-tight truncate">{club.nombre}</p>
              <p className="text-[12px] text-muted-foreground m-0">Inscripción de deportistas</p>
            </div>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
