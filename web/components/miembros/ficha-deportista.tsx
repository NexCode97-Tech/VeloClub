'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { User } from 'lucide-react';
import { Adjunto, Ayuda, Campo, Chips, Desplegable, entrada } from '@/components/miembros/campos';
import {
  CATEGORIAS, NIVELES, DOC_TIPOS, PARENTESCOS,
  type DatosFicha, type ErroresFicha, type Seccion,
  TITULO_SECCION, edadDe, esMenorDeEdad, llenosDe, seccionesDe, validarFicha, faltantesDe,
} from '@/lib/ficha-deportista';

/**
 * La ficha de un deportista, en secciones.
 *
 * Reemplaza al panel de cinco pasos encadenados. Con pasos, corregir algo de la
 * primera pantalla obligaba a recorrer todo de nuevo, y no había forma de ver
 * cuánto faltaba. Acá está todo a la vista y el índice dice qué queda a medias.
 *
 * Lo usan los dos caminos que crean deportistas —el club desde el dashboard y
 * la familia desde el enlace público— para que pidan exactamente lo mismo.
 */

export interface Sede { id: string; name: string }

interface Props {
  datos: DatosFicha;
  onCambio: (datos: DatosFicha) => void;
  sedes: Sede[];
  /** Al crear se exigen los obligatorios; al editar solo se avisan. */
  esNuevo: boolean;
  /** Errores que vienen del servidor, por campo. */
  erroresServidor?: ErroresFicha;
  /** Pregunta si el correo o el documento ya están usados. */
  verificar?: (campo: 'email' | 'docNumber', valor: string) => Promise<boolean>;
  /** El selector de rol solo tiene sentido del lado del club. */
  mostrarRol?: boolean;
  /** Los adjuntos no se piden al crear desde el enlace público. */
  mostrarDocumentos?: boolean;
  onArchivo?: (campo: 'doc' | 'insurance', archivo: File) => void;
  archivos?: { doc?: string; insurance?: string };
}

const ROLES = [
  { valor: 'STUDENT' as const, texto: 'Deportista' },
  { valor: 'COACH'   as const, texto: 'Entrenador' },
  { valor: 'ADMIN'   as const, texto: 'Administrador' },
];

export function FichaDeportista({
  datos, onCambio, sedes, esNuevo,
  erroresServidor, verificar,
  mostrarRol = true, mostrarDocumentos = true,
  onArchivo, archivos,
}: Props) {
  const [tocados, setTocados] = useState<Record<string, boolean>>({});
  const [ocupado, setOcupado] = useState<{ email?: boolean; docNumber?: boolean }>({});
  const [seccionActiva, setSeccionActiva] = useState<Seccion>('identidad');

  const secciones = useMemo(() => seccionesDe(datos, sedes.length > 0), [datos, sedes.length]);
  const errores = useMemo(() => validarFicha(datos, esNuevo), [datos, esNuevo]);
  const faltan = useMemo(() => (esNuevo ? [] : faltantesDe(datos)), [datos, esNuevo]);
  const menor = esMenorDeEdad(datos.birthDate);
  const años = edadDe(datos.birthDate);

  const set = <K extends keyof DatosFicha>(campo: K, valor: DatosFicha[K]) => {
    onCambio({ ...datos, [campo]: valor });
  };

  // El aviso de duplicado corre mientras se escribe, medio segundo después de
  // la última tecla. Sin esa espera sería una consulta por carácter.
  const temporizador = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  useEffect(() => {
    if (!verificar) return;
    const pendientes = temporizador.current;
    return () => { Object.values(pendientes).forEach(clearTimeout); };
  }, [verificar]);

  function revisarDuplicado(campo: 'email' | 'docNumber', valor: string) {
    if (!verificar) return;
    clearTimeout(temporizador.current[campo]);
    if (!valor.trim()) { setOcupado(o => ({ ...o, [campo]: false })); return; }
    temporizador.current[campo] = setTimeout(async () => {
      const usado = await verificar(campo, valor.trim());
      setOcupado(o => ({ ...o, [campo]: usado }));
    }, 500);
  }

  /** El mensaje del campo: primero lo del servidor, luego el duplicado, luego el formato. */
  function errorDe(campo: keyof ErroresFicha): string | null {
    if (erroresServidor?.[campo]) return erroresServidor[campo]!;
    if (campo === 'email' && ocupado.email) return 'Ese correo ya está registrado en este club';
    if (campo === 'docNumber' && ocupado.docNumber) return 'Ese documento ya está registrado en este club';
    if (tocados[campo] && errores[campo]) return errores[campo]!;
    return null;
  }

  const marcar = (campo: string) => () => setTocados(t => ({ ...t, [campo]: true }));

  return (
    <div className="flex gap-5">
      {/* Índice. Solo desde escritorio: en pantallas angostas la lista de
          secciones ocuparía más que el propio formulario. */}
      <nav className="hidden lg:block w-[168px] shrink-0">
        <ul className="sticky top-0 flex flex-col gap-0.5 list-none m-0 p-0">
          {secciones.map(s => {
            const { llenos, total } = llenosDe(s, datos);
            const activa = seccionActiva === s;
            return (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => {
                    setSeccionActiva(s);
                    document.getElementById(`ficha-${s}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] transition-colors ${
                    activa ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  <span
                    className="w-[7px] h-[7px] rounded-full shrink-0"
                    style={{ background: llenos > 0 ? '#0E7C57' : activa ? '#7C3AED' : '#D8D3E4' }}
                  />
                  <span className="flex-1 text-left">{TITULO_SECCION[s]}</span>
                  <span className="text-[9.5px] tabular-nums opacity-60">{llenos}/{total}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex-1 min-w-0 space-y-1">
        {mostrarRol && (
          <Campo etiqueta="Rol">
            <div className="flex gap-1.5">
              {ROLES.map(r => (
                <button
                  key={r.valor}
                  type="button"
                  onClick={() => set('role', r.valor)}
                  className={`flex-1 text-[11.5px] font-semibold py-2 rounded-lg border transition-colors ${
                    datos.role === r.valor
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-background border-border text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  {r.texto}
                </button>
              ))}
            </div>
          </Campo>
        )}

        {!esNuevo && faltan.length > 0 && (
          <p className="text-[11.5px] rounded-lg px-3 py-2 my-2"
            style={{ background: 'rgba(240,180,41,0.12)', color: '#8A6216' }}>
            A esta ficha le falta {faltan.join(', ')}. Puedes guardar igual y completarla después.
          </p>
        )}

        {/* ── Identidad ─────────────────────────────────────────────────── */}
        <Seccion id="identidad" titulo="Identidad" n={1} onVer={setSeccionActiva}>
          <Campo etiqueta="Nombre y apellidos" obligatorio error={errorDe('fullName')}>
            <input
              value={datos.fullName}
              onChange={e => set('fullName', e.target.value)}
              onBlur={marcar('fullName')}
              placeholder="Nombre completo"
              className={entrada(!!errorDe('fullName'))}
            />
          </Campo>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Campo etiqueta="Nacimiento" obligatorio={esNuevo} error={errorDe('birthDate')}>
              <input
                type="date"
                value={datos.birthDate}
                onChange={e => set('birthDate', e.target.value)}
                onBlur={marcar('birthDate')}
                // Las fechas en iOS se dimensionan por su contenido e ignoran el
                // ancho; sin appearance:none el campo se sale de la columna.
                style={{ appearance: 'none', WebkitAppearance: 'none' }}
                className={entrada(!!errorDe('birthDate'))}
              />
            </Campo>
            <Campo etiqueta="Documento" obligatorio={esNuevo}>
              <Desplegable
                valor={datos.docType}
                opciones={[...DOC_TIPOS]}
                vacio="Tipo"
                onElegir={v => set('docType', v)}
              />
            </Campo>
            <Campo etiqueta="Número" obligatorio={esNuevo} error={errorDe('docNumber')}>
              <input
                value={datos.docNumber}
                onChange={e => { set('docNumber', e.target.value); revisarDuplicado('docNumber', e.target.value); }}
                onBlur={marcar('docNumber')}
                inputMode="numeric"
                placeholder="Sin puntos"
                className={entrada(!!errorDe('docNumber'))}
              />
            </Campo>
          </div>

          {años !== null && años >= 0 && (
            <p className="text-[11px] text-muted-foreground mt-1">
              {años} {años === 1 ? 'año' : 'años'}
              {menor ? ' · le pedimos los datos de su acudiente' : ''}
            </p>
          )}
        </Seccion>

        {/* ── Contacto ──────────────────────────────────────────────────── */}
        <Seccion id="contacto" titulo="Contacto" n={2} onVer={setSeccionActiva}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Campo etiqueta="Correo" obligatorio={esNuevo} error={errorDe('email')}>
              <input
                type="email"
                value={datos.email}
                onChange={e => { set('email', e.target.value); revisarDuplicado('email', e.target.value); }}
                onBlur={marcar('email')}
                placeholder="correo@ejemplo.com"
                className={entrada(!!errorDe('email'))}
              />
              <Ayuda>Con este correo entra a la app. No se puede repetir el de otro deportista.</Ayuda>
            </Campo>
            <Campo etiqueta="Celular">
              <input
                value={datos.phone}
                onChange={e => set('phone', e.target.value)}
                inputMode="tel"
                placeholder="300 000 0000"
                className={entrada(false)}
              />
            </Campo>
          </div>
          <Campo etiqueta="EPS">
            <input
              value={datos.eps}
              onChange={e => set('eps', e.target.value)}
              placeholder="Entidad de salud"
              className={entrada(false)}
            />
          </Campo>
        </Seccion>

        {/* ── Acudiente ─────────────────────────────────────────────────── */}
        {secciones.includes('acudiente') && (
          <Seccion
            id="acudiente"
            titulo={menor ? 'Acudiente' : 'Contacto de emergencia'}
            n={3}
            onVer={setSeccionActiva}
          >
            {menor && (
              <p className="flex gap-2 items-start text-[11.5px] rounded-lg px-3 py-2 mb-2"
                style={{ background: 'rgba(124,58,237,0.08)', color: '#5B3AA6' }}>
                <User className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>Es menor de edad, así que necesitamos los datos de quien responde por él.</span>
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Campo etiqueta="Nombre">
                <input
                  value={datos.guardianName}
                  onChange={e => set('guardianName', e.target.value)}
                  placeholder="Nombre completo"
                  className={entrada(false)}
                />
              </Campo>
              <Campo etiqueta="Celular">
                <input
                  value={datos.guardianPhone}
                  onChange={e => set('guardianPhone', e.target.value)}
                  inputMode="tel"
                  placeholder="300 000 0000"
                  className={entrada(false)}
                />
              </Campo>
            </div>
            {menor && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Campo etiqueta="Parentesco">
                  <Desplegable
                    valor={datos.guardianRelation}
                    opciones={[...PARENTESCOS]}
                    vacio="Elegir"
                    onElegir={v => set('guardianRelation', v)}
                  />
                </Campo>
                <Campo etiqueta="Cédula">
                  <input
                    value={datos.guardianDocNumber}
                    onChange={e => set('guardianDocNumber', e.target.value)}
                    inputMode="numeric"
                    placeholder="Sin puntos"
                    className={entrada(false)}
                  />
                </Campo>
              </div>
            )}
          </Seccion>
        )}

        {/* ── Deportiva ─────────────────────────────────────────────────── */}
        {secciones.includes('deportiva') && (
          <Seccion id="deportiva" titulo="Deportiva" n={4} onVer={setSeccionActiva}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Campo etiqueta="Categoría">
                <Desplegable
                  valor={datos.category}
                  opciones={[...CATEGORIAS]}
                  vacio="Elegir categoría"
                  onElegir={v => set('category', v)}
                />
                <Ayuda>Se elige de la lista: escribirla a mano deja la planilla de la clase vacía.</Ayuda>
              </Campo>
              <Campo etiqueta="Nivel">
                <Desplegable
                  valor={datos.tipo}
                  opciones={[...NIVELES]}
                  vacio="Elegir nivel"
                  onElegir={v => set('tipo', v)}
                />
              </Campo>
            </div>
          </Seccion>
        )}

        {/* ── Sedes ─────────────────────────────────────────────────────── */}
        {secciones.includes('sedes') && (
          <Seccion id="sedes" titulo="Sedes" n={5} onVer={setSeccionActiva}>
            <Chips
              opciones={sedes}
              elegidas={datos.locationIds}
              onCambio={ids => set('locationIds', ids)}
            />
            <Ayuda>Puede entrenar en más de una.</Ayuda>
          </Seccion>
        )}

        {/* ── Documentos ────────────────────────────────────────────────── */}
        {mostrarDocumentos && (
          <Seccion id="documentos" titulo="Documentos" n={6} onVer={setSeccionActiva}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Adjunto
                etiqueta="Documento de identidad"
                actual={archivos?.doc}
                onElegir={f => onArchivo?.('doc', f)}
              />
              <Adjunto
                etiqueta="Póliza o seguro"
                actual={archivos?.insurance}
                onElegir={f => onArchivo?.('insurance', f)}
              />
            </div>
          </Seccion>
        )}
      </div>
    </div>
  );
}

/* ── Piezas propias de esta ficha ────────────────────────────────────── */

function Seccion({ id, titulo, n, onVer, children }: {
  id: Seccion; titulo: string; n: number;
  onVer: (s: Seccion) => void; children: React.ReactNode;
}) {
  return (
    <section
      id={`ficha-${id}`}
      onFocusCapture={() => onVer(id)}
      className="pt-4 mt-3 border-t border-border/60 first:border-t-0 first:pt-0 first:mt-0 scroll-mt-4"
    >
      <p className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.11em] text-muted-foreground mb-2.5 m-0">
        <span className="w-[17px] h-[17px] rounded-[5px] bg-primary/10 text-primary text-[9px] flex items-center justify-center shrink-0">
          {n}
        </span>
        {titulo}
      </p>
      {children}
    </section>
  );
}
