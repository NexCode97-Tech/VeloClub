'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Check, ChevronLeft, Info, User } from 'lucide-react';
import { Campo, Ayuda, Desplegable, entrada } from '@/components/miembros/campos';
import { PhoneInput } from '@/components/ui/phone-input';
import {
  DOC_TIPOS, PARENTESCOS, CATEGORIAS, NIVELES, GENEROS, RH_TIPOS,
  edadDe, esMenorDeEdad,
} from '@/lib/ficha-deportista';

/**
 * El formulario del deportista.
 *
 * Va en pasos y no todo a la vista, al revés que la ficha del club: acá lo llena
 * una sola vez alguien que no conoce la app, casi siempre desde el celular, y un
 * formulario de veinte campos de una sola pantalla se abandona a la mitad.
 *
 * Un envío es un deportista. No hay «agregar otro hijo»: cada uno necesita su
 * propio perfil, su propio correo y su propia cuenta.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? '';
// Los mismos cuatro de la ficha del club, cambiando solo lo que le corresponde
// al formulario publico: el paso 2 tambien crea la contrasena y el 4 termina con
// la autorizacion de datos.
const PASOS = ['Identidad', 'Acceso y contacto', 'Entrenamiento', 'Salud y permisos'];

interface Config {
  club: { nombre: string; logoUrl: string | null };
  sedes: { id: string; name: string }[];
}

interface Datos {
  fullName: string; birthDate: string; docType: string; docNumber: string; phone: string;
  email: string; password: string; password2: string;
  guardianName: string; guardianRelation: string; guardianDocNumber: string; guardianPhone: string;
  locationId: string; category: string; tipo: string;
  eps: string; gender: string; rh: string; allergies: string;
  aceptaTerminos: boolean;
}

const VACIO: Datos = {
  fullName: '', birthDate: '', docType: '', docNumber: '', phone: '',
  email: '', password: '', password2: '',
  guardianName: '', guardianRelation: '', guardianDocNumber: '', guardianPhone: '',
  locationId: '', category: '', tipo: '',
  eps: '', gender: '', rh: '', allergies: '',
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
  const [resultado, setResultado] = useState<'nuevo' | 'actualiza' | 'sin_cambios'>('nuevo');
  // Al salir del primer paso se pregunta si ese documento ya está en el club.
  // Si está, lo que sigue actualiza su ficha en vez de crear una nueva.
  const [modo, setModo] = useState<{
    tipo: 'nuevo' | 'actualiza'; nombre?: string; tieneCuenta?: boolean;
  }>({ tipo: 'nuevo' });

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
  const yaTieneCuenta = modo.tipo === 'actualiza' && modo.tieneCuenta === true;

  /** Lo que falta en el paso actual. Se revisa acá y de nuevo en el servidor. */
  const revisarPaso = useCallback((): Record<string, string> => {
    const e: Record<string, string> = {};
    if (paso === 0) {
      if (d.fullName.trim().length < 2) e.fullName = 'Escribe el nombre y los apellidos';
      if (!d.birthDate) e.birthDate = 'Falta la fecha de nacimiento';
      else if (new Date(d.birthDate) > new Date()) e.birthDate = 'Esa fecha todavía no llega';
      if (!d.docType) e.docType = 'Elige el tipo';
      if (!d.docNumber.trim()) e.docNumber = 'Falta el número de documento';
    }
    if (paso === 1) {
      // Quien ya tiene cuenta no vuelve a poner correo ni contraseña: su acceso
      // no se cambia desde acá.
      if (!yaTieneCuenta) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email.trim())) e.email = 'Ese correo no se ve bien escrito';
        if (d.password.length < 8) e.password = 'Mínimo 8 caracteres';
        if (d.password !== d.password2) e.password2 = 'Las dos contraseñas no coinciden';
      }
      if (!d.phone.trim()) e.phone = 'Falta un celular de contacto';
      if (menor && !d.guardianName.trim()) e.guardianName = 'Falta el nombre del acudiente';
    }
    if (paso === 2) {
      if (!d.locationId) e.locationId = 'Elige dónde va a entrenar';
    }
    if (paso === 3) {
      if (!d.aceptaTerminos) e.aceptaTerminos = 'Necesitamos tu autorización para continuar';
    }
    return e;
  }, [paso, d, menor, yaTieneCuenta]);

  async function siguiente() {
    const e = revisarPaso();
    setErrores(e);
    if (Object.keys(e).length > 0) return;

    // Al terminar identidad se pregunta de quién es ese documento. Sin esto, la
    // llenaría los cuatro pasos para enterarse al final de que ya estaba.
    if (paso === 0) {
      setEnviando(true);
      try {
        const r = await fetch(`${API}/inscripcion/${token}/reconocer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ docNumber: d.docNumber, birthDate: d.birthDate }),
        });
        const res = await r.json();
        if (!r.ok) { setErrores({ [res.campo ?? 'docNumber']: res.error }); return; }
        setModo(res.modo === 'actualiza'
          ? { tipo: 'actualiza', nombre: res.nombre, tieneCuenta: res.tieneCuenta }
          : { tipo: 'nuevo' });
      } catch {
        setErrores({ general: 'No se pudo conectar. Revisa tu internet e intenta de nuevo.' });
        return;
      } finally {
        setEnviando(false);
      }
    }

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
          docNumber: d.docNumber, phone: d.phone,
          ...(yaTieneCuenta ? {} : { email: d.email, password: d.password }),
          guardianName: d.guardianName || undefined,
          guardianRelation: d.guardianRelation || undefined,
          guardianDocNumber: d.guardianDocNumber || undefined,
          guardianPhone: d.guardianPhone || undefined,
          locationId: d.locationId,
          category: d.category || undefined,
          tipo: d.tipo || undefined,
          eps: d.eps || undefined,
          gender: d.gender || undefined,
          rh: d.rh || undefined,
          allergies: d.allergies || undefined,
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
            email: 1, password: 1, phone: 1,
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
      setResultado(res.modo === 'actualiza' ? 'actualiza' : res.modo === 'sin_cambios' ? 'sin_cambios' : 'nuevo');
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
          <h2 className="text-[16px] font-semibold text-foreground m-0 mb-1.5 tracking-tight">Esta inscripción no está disponible</h2>
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
          <h2 className="text-[17px] font-semibold text-foreground m-0 mb-1.5 tracking-tight">
            {resultado === 'nuevo'
              ? `Listo, ${listo.split(' ')[0]} quedó inscrito`
              : resultado === 'sin_cambios'
                ? 'No había nada que cambiar'
                : `Listo, enviamos los cambios de ${listo.split(' ')[0]}`}
          </h2>
          <p className="text-[13px] text-muted-foreground m-0">
            {resultado === 'nuevo'
              ? `Cuando ${config.club.nombre} le dé el visto bueno podrá entrar a la app con su correo y la contraseña que acabas de crear.`
              : resultado === 'sin_cambios'
                ? `Los datos que enviaste son los mismos que ${config.club.nombre} ya tiene, así que no hay nada pendiente.`
                : `${config.club.nombre} los revisa y los aplica a su ficha.`}
          </p>
          <button
            type="button"
            onClick={() => { setD(VACIO); setPaso(0); setListo(null); setModo({ tipo: 'nuevo' }); }}
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
        <p className="text-[11.5px] font-medium text-muted-foreground m-0 mb-0.5">
          Paso {paso + 1} de {PASOS.length}
        </p>
        <h2 className="text-[17px] font-semibold text-foreground m-0 mb-3.5 tracking-tight">{PASOS[paso]}</h2>

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
            <Campo etiqueta="Género">
              <div className="flex gap-1.5">
                {GENEROS.map(g => (
                  <button key={g} type="button"
                    onClick={() => set('gender', d.gender === g ? '' : g)}
                    className={`flex-1 text-[12.5px] font-semibold py-2.5 rounded-lg border transition-colors ${
                      d.gender === g
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'bg-background border-border text-muted-foreground'
                    }`}>
                    {g}
                  </button>
                ))}
              </div>
              <Ayuda>Es la rama con la que compite.</Ayuda>
            </Campo>
          </>
        )}

        {/* ── 2 · Cuenta y acudiente ─────────────────────────────────────── */}
        {paso === 1 && (
          <>
            {modo.tipo === 'actualiza' && (
              <p className="flex gap-2 items-start text-[12px] rounded-lg px-3 py-2.5 mb-3"
                style={{ background: 'rgba(42,82,190,0.08)', color: '#2A52BE' }}>
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  <b>{modo.nombre?.split(' ')[0]} ya está en {config.club.nombre}.</b>{' '}
                  Lo que llenes de aquí en adelante actualiza su ficha, y el club revisa
                  los cambios antes de aplicarlos.
                </span>
              </p>
            )}

            {yaTieneCuenta ? (
              <p className="text-[12px] text-muted-foreground rounded-lg px-3 py-2.5 mb-3 bg-secondary/60">
                Ya tiene una cuenta para entrar a la app, así que su correo y su
                contraseña no se cambian desde aquí.
              </p>
            ) : (
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
            </>
            )}

            <Campo etiqueta="Celular" obligatorio error={errores.phone}>
              <PhoneInput value={d.phone} onChange={v => set('phone', v)} className="h-[42px]" />
              <Ayuda>Del deportista o de quien responde por él.</Ayuda>
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
                  <PhoneInput value={d.guardianPhone} onChange={v => set('guardianPhone', v)} />
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
            <div className="grid grid-cols-2 gap-2.5">
              <Campo etiqueta="EPS">
                <input value={d.eps} onChange={e => set('eps', e.target.value)}
                  placeholder="Entidad de salud" className={entrada(false)} />
              </Campo>
              <Campo etiqueta="RH">
                <Desplegable valor={d.rh} opciones={[...RH_TIPOS]} vacio="Elegir"
                  onElegir={v => set('rh', v)} />
              </Campo>
            </div>

            <Campo etiqueta="Alergias o condiciones médicas">
              <textarea value={d.allergies} onChange={e => set('allergies', e.target.value)}
                rows={2} placeholder="Por ejemplo: alérgico a la penicilina, usa inhalador"
                className={`${entrada(false)} resize-none py-2.5 leading-snug`} />
              <Ayuda>Lo que un entrenador tendría que saber antes de que pase algo.</Ayuda>
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
              ? (paso === 0 ? 'Revisando...' : modo.tipo === 'actualiza' ? 'Enviando...' : 'Inscribiendo...')
              : paso < PASOS.length - 1
                ? 'Continuar'
                : modo.tipo === 'actualiza'
                  ? 'Enviar los cambios'
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
              <h1 className="text-[16px] font-semibold text-foreground m-0 leading-tight truncate tracking-tight">{club.nombre}</h1>
              <p className="text-[12px] text-muted-foreground m-0">Inscripción de deportistas</p>
            </div>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
