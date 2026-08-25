'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Check, ChevronLeft, Info, Lock, User } from 'lucide-react';
import { Campo, Ayuda, Desplegable, entrada } from '@/components/miembros/campos';
import { PhoneInput } from '@/components/ui/phone-input';
import { DatePicker } from '@/components/ui/date-picker';
import {
  DOC_TIPOS_CON_NOTA, PARENTESCOS, CATEGORIAS, NIVELES, GENEROS, RH_TIPOS,
  edadDe, esMenorDeEdad,
} from '@/lib/ficha-deportista';

/**
 * El formulario del deportista.
 *
 * Empieza por el documento y de esa respuesta depende todo lo demás: quien no
 * está en el club se inscribe de cero, y quien ya está entra a completar su
 * ficha con lo que el club ya tiene precargado.
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

/** Lo que el club ya tiene guardado de alguien que vuelve por el enlace. */
type Ficha = Partial<Omit<Datos, 'password' | 'password2' | 'aceptaTerminos'>>;

/** Los campos que se cuentan para decirle cuántos le faltan. */
const CONTADOS: (keyof Datos)[] = [
  'fullName', 'birthDate', 'docType', 'docNumber', 'gender',
  'email', 'phone', 'guardianName', 'guardianRelation', 'guardianDocNumber', 'guardianPhone',
  'locationId', 'category', 'tipo', 'eps', 'rh',
];

export default function FormularioInscripcion({ token }: { token: string }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [cargando, setCargando] = useState(true);
  const [cerrado, setCerrado] = useState(false);

  // El recorrido: primero el documento, después el saludo a quien ya está, y
  // por último los cuatro pasos. Quien es nuevo salta del documento a los pasos.
  const [fase, setFase] = useState<'documento' | 'bienvenida' | 'pasos'>('documento');
  const [paso, setPaso] = useState(0);
  const [d, setD] = useState<Datos>(VACIO);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState<string | null>(null);
  const [resultado, setResultado] = useState<'nuevo' | 'actualiza' | 'sin_cambios'>('nuevo');

  // Lo que el club ya tenía. Se guarda aparte de `d` para poder marcar qué
  // campos venían vacíos aunque la persona los acabe de llenar.
  const [modo, setModo] = useState<{ tipo: 'nuevo' | 'actualiza'; tieneCuenta?: boolean }>({ tipo: 'nuevo' });
  const [venia, setVenia] = useState<Ficha | null>(null);

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
  const actualizando = modo.tipo === 'actualiza';

  /** Un campo que el club no tenía. Se marca aunque ya lo hayan escrito. */
  const faltaba = useCallback(
    (k: keyof Datos) => actualizando && !((venia?.[k as keyof Ficha] ?? '') as string).trim(),
    [actualizando, venia],
  );
  /** Un campo que el club sí tenía, para el chulo de «esto ya estaba». */
  const traido = useCallback(
    (k: keyof Datos) => actualizando && !!((venia?.[k as keyof Ficha] ?? '') as string).trim(),
    [actualizando, venia],
  );

  /** Cuántos de los campos que se cuentan tenía el club, y de cuántos. */
  const avance = useMemo(() => {
    if (!venia) return null;
    const aplican = CONTADOS.filter(k => (k.startsWith('guardian') ? esMenorDeEdad(venia.birthDate ?? '') : true));
    const llenos = aplican.filter(k => ((venia[k as keyof Ficha] ?? '') as string).trim() !== '').length;
    return { llenos, total: aplican.length };
  }, [venia]);

  /** Lo que falta en el paso actual. Se revisa acá y de nuevo en el servidor. */
  const revisarPaso = useCallback((): Record<string, string> => {
    const e: Record<string, string> = {};
    if (paso === 0) {
      if (d.fullName.trim().length < 2) e.fullName = 'Escribe el nombre y los apellidos';
      if (!d.birthDate) e.birthDate = 'Falta la fecha de nacimiento';
      else if (new Date(d.birthDate) > new Date()) e.birthDate = 'Esa fecha todavía no llega';
    }
    if (paso === 1) {
      // Quien ya tiene cuenta no vuelve a poner contraseña: su acceso no se
      // cambia desde acá, pero el correo sí lo puede corregir.
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email.trim())) e.email = 'Ese correo no se ve bien escrito';
      if (!yaTieneCuenta) {
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

  /** El documento decide todo lo que sigue. */
  async function identificar() {
    const e: Record<string, string> = {};
    if (!d.docType) e.docType = 'Elige el tipo';
    if (d.docNumber.trim().length < 3) e.docNumber = 'Falta el número de documento';
    setErrores(e);
    if (Object.keys(e).length > 0) return;

    setEnviando(true);
    try {
      const r = await fetch(`${API}/inscripcion/${token}/reconocer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docNumber: d.docNumber.trim() }),
      });
      const res = await r.json();
      if (!r.ok) { setErrores({ [res.campo ?? 'docNumber']: res.error }); return; }

      if (res.modo === 'actualiza') {
        const f = res.ficha as Ficha;
        setVenia(f);
        setModo({ tipo: 'actualiza', tieneCuenta: res.tieneCuenta });
        // Lo que el club tiene se precarga tal cual. El tipo y el número que
        // acaba de escribir mandan sobre lo guardado: es lo que la identificó.
        setD(p => ({ ...VACIO, ...f, docType: p.docType, docNumber: p.docNumber } as Datos));
        setFase('bienvenida');
      } else {
        setModo({ tipo: 'nuevo' });
        setVenia(null);
        setFase('pasos');
      }
    } catch {
      setErrores({ general: 'No se pudo conectar. Revisa tu internet e intenta de nuevo.' });
    } finally {
      setEnviando(false);
    }
  }

  async function siguiente() {
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
          docNumber: d.docNumber, phone: d.phone,
          email: d.email,
          ...(yaTieneCuenta ? {} : { password: d.password }),
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
            fullName: 0, birthDate: 0,
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

  function empezarDeCero() {
    setD(VACIO);
    setVenia(null);
    setModo({ tipo: 'nuevo' });
    setPaso(0);
    setListo(null);
    setFase('documento');
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
                : `Listo, enviamos los datos de ${listo.split(' ')[0]}`}
          </h2>
          <p className="text-[13px] text-muted-foreground m-0">
            {resultado === 'nuevo'
              ? `Cuando ${config.club.nombre} le dé el visto bueno podrá entrar a la app con su correo y la contraseña que acabas de crear.`
              : resultado === 'sin_cambios'
                ? `Los datos que enviaste son los mismos que ${config.club.nombre} ya tiene, así que no hay nada pendiente.`
                : yaTieneCuenta
                  ? `${config.club.nombre} los revisa y los aplica a su ficha.`
                  : `Cuando ${config.club.nombre} los revise podrá entrar a la app con su correo y la contraseña que acabas de crear.`}
          </p>
          <button
            type="button"
            onClick={empezarDeCero}
            className="w-full mt-5 py-3 rounded-xl border border-primary/30 text-primary text-[13.5px] font-semibold"
          >
            Inscribir a otro deportista
          </button>
        </div>
      </Marco>
    );
  }

  // ── Primera pantalla: el documento y nada más ──────────────────────────────
  if (fase === 'documento') {
    return (
      <Marco club={config.club}>
        <div className="bg-white rounded-2xl border border-border p-4 sm:p-5">
          <div className="flex gap-1.5 mb-3.5">
            {PASOS.map((_, i) => (
              <span key={i} className="h-[3px] flex-1 rounded-full"
                style={{ background: i === 0 ? '#7C3AED' : '#E4E0EC' }} />
            ))}
          </div>
          <h2 className="text-[17px] font-semibold text-foreground m-0 mb-0.5 tracking-tight">
            Empecemos por tu documento
          </h2>
          <p className="text-[12px] text-muted-foreground m-0 mb-3.5">
            Con esto sabemos si ya estás en el club.
          </p>

          {errores.general && (
            <p className="text-[12px] rounded-lg px-3 py-2 mb-3" style={{ background: 'rgba(239,71,111,0.1)', color: '#A33A4E' }}>
              {errores.general}
            </p>
          )}

          <div className="grid grid-cols-3 gap-2">
            <Campo etiqueta="Tipo" obligatorio error={errores.docType}>
              <Desplegable valor={d.docType} opciones={DOC_TIPOS_CON_NOTA} vacio="Tipo"
                titulo="Tipo de documento"
                error={!!errores.docType} onElegir={v => set('docType', v)} />
            </Campo>
            <div className="col-span-2">
              <Campo etiqueta="Número de documento" obligatorio error={errores.docNumber}>
                <input value={d.docNumber} onChange={e => set('docNumber', e.target.value)}
                  inputMode="numeric" placeholder="Sin puntos"
                  onKeyDown={e => { if (e.key === 'Enter') identificar(); }}
                  className={entrada(!!errores.docNumber)} />
              </Campo>
            </div>
          </div>

          <button type="button" onClick={identificar} disabled={enviando}
            className="w-full mt-2 py-3 rounded-xl bg-primary text-white text-[13.5px] font-bold disabled:opacity-60">
            {enviando ? 'Buscando...' : 'Continuar'}
          </button>
          <p className="text-[11px] text-muted-foreground text-center mt-3 m-0">
            Tus datos los usa el club, nadie más.
          </p>
        </div>
      </Marco>
    );
  }

  // ── Quien ya está: el saludo y cuánto le falta ─────────────────────────────
  if (fase === 'bienvenida') {
    const nombre = (venia?.fullName ?? '').split(' ')[0];
    const faltan = avance ? avance.total - avance.llenos : 0;
    return (
      <Marco club={config.club}>
        <div className="bg-white rounded-2xl border border-border p-4 sm:p-5">
          <div className="rounded-xl p-4"
            style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.09), rgba(67,97,238,0.07))', border: '1px solid rgba(124,58,237,0.22)' }}>
            <h2 className="text-[17px] font-semibold text-foreground m-0 mb-1 tracking-tight">
              {nombre ? `Hola, ${nombre}` : 'Ya estás en el club'}
            </h2>
            <p className="text-[12.5px] m-0 leading-relaxed" style={{ color: '#574A72' }}>
              Ya estás en <b>{config.club.nombre}</b>. Revisa lo que el club tiene tuyo,
              corrige lo que esté mal y completa lo que falta.
            </p>

            {avance && (
              <div className="mt-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-[11.5px] text-muted-foreground">Tu ficha</span>
                  <b className="text-[12.5px] font-semibold text-foreground">
                    {avance.llenos} de {avance.total}
                  </b>
                </div>
                <div className="h-[5px] rounded-full mt-1 overflow-hidden" style={{ background: 'rgba(124,58,237,0.14)' }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.round((avance.llenos / avance.total) * 100)}%`, background: '#7C3AED' }} />
                </div>
                <p className="text-[11.5px] text-muted-foreground m-0 mt-1">
                  {faltan === 0
                    ? 'No te falta ningún dato, pero puedes corregir lo que quieras.'
                    : faltan === 1 ? 'Te falta 1 dato.' : `Te faltan ${faltan} datos.`}
                </p>
              </div>
            )}
          </div>

          <button type="button" onClick={() => setFase('pasos')}
            className="w-full mt-4 py-3 rounded-xl bg-primary text-white text-[13.5px] font-bold">
            Revisar mis datos
          </button>
          <button type="button" onClick={empezarDeCero}
            className="w-full mt-2 py-2 text-[12px] font-semibold text-muted-foreground">
            Ese no soy yo, usar otro documento
          </button>
          <p className="text-[11px] text-muted-foreground text-center mt-2 m-0">
            El club revisa los cambios antes de guardarlos.
          </p>
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
          {actualizando && venia?.fullName ? ` · ficha de ${venia.fullName.split(' ')[0]}` : ''}
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
            {actualizando && (
              <p className="flex gap-2 items-start text-[12px] rounded-lg px-3 py-2.5 mb-3"
                style={{ background: 'rgba(42,82,190,0.08)', color: '#2A52BE' }}>
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Lo que ves ya lo tiene el club. Cambia lo que esté mal y llena lo
                  que diga <b>Falta</b>.
                </span>
              </p>
            )}

            <Campo etiqueta="Nombre y apellidos" obligatorio error={errores.fullName}
              falta={faltaba('fullName')} listo={traido('fullName')}>
              <input value={d.fullName} onChange={e => set('fullName', e.target.value)}
                placeholder="Nombre completo del deportista"
                className={entrada(!!errores.fullName, faltaba('fullName'))} />
            </Campo>

            <Campo etiqueta="Fecha de nacimiento" obligatorio error={errores.birthDate}
              falta={faltaba('birthDate')} listo={traido('birthDate')}>
              <DatePicker value={d.birthDate} compacto abrirEn="years"
                maxDate={new Date()} placeholder="Elegir fecha"
                error={!!errores.birthDate} falta={faltaba('birthDate')}
                onChange={v => set('birthDate', v)} />
              {años !== null && años >= 0 && (
                <Ayuda>{años} {años === 1 ? 'año' : 'años'}{menor ? ' · te pediremos los datos del acudiente' : ''}</Ayuda>
              )}
            </Campo>

            {/* El documento no se edita acá: es con lo que se identificó. Si
                está mal escrito, lo corrige el club desde su ficha. */}
            <Campo etiqueta="Documento">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border bg-secondary/50 text-[13px] text-muted-foreground">
                <span className="flex-1">{d.docType} {d.docNumber}</span>
                <Lock className="w-3.5 h-3.5 shrink-0" />
              </div>
              <Ayuda>
                {actualizando
                  ? 'Con este documento te encontramos. Si está mal, avísale al club.'
                  : 'Si te equivocaste, vuelve atrás y escríbelo de nuevo.'}
              </Ayuda>
            </Campo>
            <button type="button" onClick={empezarDeCero}
              className="text-[11.5px] font-semibold text-primary mb-2.5">
              Cambiar el documento
            </button>

            <Campo etiqueta="Género" falta={faltaba('gender')} listo={traido('gender')}>
              <div className="flex gap-1.5">
                {GENEROS.map(g => (
                  <button key={g} type="button"
                    onClick={() => set('gender', d.gender === g ? '' : g)}
                    className={`flex-1 text-[12.5px] font-semibold py-2.5 rounded-lg border transition-colors ${
                      d.gender === g
                        ? 'bg-primary/10 border-primary text-primary'
                        : faltaba('gender')
                          ? 'bg-[#FDF7E8] border-[#D9A227] text-muted-foreground'
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
            <Campo etiqueta="Correo del deportista" obligatorio error={errores.email}
              falta={faltaba('email')} listo={traido('email')}>
              <input type="email" value={d.email} onChange={e => set('email', e.target.value)}
                placeholder="correo@ejemplo.com"
                className={entrada(!!errores.email, faltaba('email'))} />
              <Ayuda>
                {yaTieneCuenta
                  ? 'Con este entra a la app. Si lo cambias, el club lo revisa antes de aplicarlo.'
                  : 'Tiene que ser suyo: no se puede repetir el de otro deportista.'}
              </Ayuda>
            </Campo>

            {yaTieneCuenta ? (
              <p className="text-[12px] text-muted-foreground rounded-lg px-3 py-2.5 mb-3 bg-secondary/60">
                Ya tiene una cuenta para entrar a la app, así que su contraseña no se
                cambia desde aquí.
              </p>
            ) : (
              <>
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

            <Campo etiqueta="Celular" obligatorio error={errores.phone}
              falta={faltaba('phone')} listo={traido('phone')}>
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
                <Campo etiqueta="Nombre del acudiente" obligatorio error={errores.guardianName}
                  falta={faltaba('guardianName')} listo={traido('guardianName')}>
                  <input value={d.guardianName} onChange={e => set('guardianName', e.target.value)}
                    placeholder="Nombre completo"
                    className={entrada(!!errores.guardianName, faltaba('guardianName'))} />
                </Campo>
                <div className="grid grid-cols-2 gap-2">
                  <Campo etiqueta="Parentesco" falta={faltaba('guardianRelation')} listo={traido('guardianRelation')}>
                    <Desplegable valor={d.guardianRelation} opciones={[...PARENTESCOS]} vacio="Elegir"
                      falta={faltaba('guardianRelation')} onElegir={v => set('guardianRelation', v)} />
                  </Campo>
                  <Campo etiqueta="Cédula" falta={faltaba('guardianDocNumber')} listo={traido('guardianDocNumber')}>
                    <input value={d.guardianDocNumber} onChange={e => set('guardianDocNumber', e.target.value)}
                      inputMode="numeric" placeholder="Sin puntos"
                      className={entrada(false, faltaba('guardianDocNumber'))} />
                  </Campo>
                </div>
                <Campo etiqueta="Celular del acudiente" falta={faltaba('guardianPhone')} listo={traido('guardianPhone')}>
                  <PhoneInput value={d.guardianPhone} onChange={v => set('guardianPhone', v)} />
                </Campo>
              </>
            )}
          </>
        )}

        {/* ── 3 · Entrenamiento ──────────────────────────────────────────── */}
        {paso === 2 && (
          <>
            <Campo etiqueta="Sede donde entrena" obligatorio error={errores.locationId}
              falta={faltaba('locationId')} listo={traido('locationId')}>
              <Desplegable
                valor={d.locationId}
                opciones={sedes.map(s => ({ valor: s.id, texto: s.name }))}
                vacio="Elegir sede"
                error={!!errores.locationId}
                falta={faltaba('locationId')}
                onElegir={v => set('locationId', v)}
              />
              <Ayuda>Las sedes son las de este club.</Ayuda>
            </Campo>
            <Campo etiqueta="Categoría" falta={faltaba('category')} listo={traido('category')}>
              <Desplegable valor={d.category} opciones={[...CATEGORIAS]} vacio="Elegir categoría"
                falta={faltaba('category')} onElegir={v => set('category', v)} />
            </Campo>
            <Campo etiqueta="Nivel" falta={faltaba('tipo')} listo={traido('tipo')}>
              <Desplegable valor={d.tipo} opciones={[...NIVELES]} vacio="Elegir nivel"
                falta={faltaba('tipo')} onElegir={v => set('tipo', v)} />
            </Campo>
          </>
        )}

        {/* ── 4 · Salud y permisos ───────────────────────────────────────── */}
        {paso === 3 && (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <Campo etiqueta="EPS" falta={faltaba('eps')} listo={traido('eps')}>
                <input value={d.eps} onChange={e => set('eps', e.target.value)}
                  placeholder="Entidad de salud" className={entrada(false, faltaba('eps'))} />
              </Campo>
              <Campo etiqueta="RH" falta={faltaba('rh')} listo={traido('rh')}>
                <Desplegable valor={d.rh} opciones={[...RH_TIPOS]} vacio="Elegir"
                  falta={faltaba('rh')} onElegir={v => set('rh', v)} />
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
              ? (actualizando ? 'Enviando...' : 'Inscribiendo...')
              : paso < PASOS.length - 1
                ? 'Continuar'
                : actualizando
                  ? 'Enviar mis datos'
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
