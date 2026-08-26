'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, User } from 'lucide-react';
import { Adjunto, Ayuda, Campo, Chips, Desplegable, entrada } from '@/components/miembros/campos';
import { PhoneInput } from '@/components/ui/phone-input';
import { DatePicker } from '@/components/ui/date-picker';
import {
  CATEGORIAS, NIVELES, DOC_TIPOS_CON_NOTA, PARENTESCOS, GENEROS, RH_TIPOS,
  type DatosFicha, type ErroresFicha,
  edadDe, esMenorDeEdad, validarFicha, faltantesDe,
} from '@/lib/ficha-deportista';

/**
 * La ficha de un deportista, en pasos.
 *
 * Tiene la misma forma que el formulario público de inscripción a propósito:
 * son los dos caminos que crean un deportista, piden los mismos datos y en el
 * mismo orden, así que quien llena uno reconoce el otro.
 *
 * Antes iba por secciones con un índice al lado. El índice contaba campos
 * llenos, que era útil, pero costaba 168 px de ancho y dejaba el formulario en
 * una columna donde los campos salían cortados.
 */

export interface Sede { id: string; name: string }

/**
 * Cada paso responde una pregunta distinta, y un campo va donde responde esa
 * pregunta: el teléfono es contacto, no identidad; la EPS es salud, no contacto.
 */
type Paso = 'identidad' | 'contacto' | 'entrenamiento' | 'salud';

const TITULO: Record<Paso, string> = {
  identidad:     'Identidad',
  contacto:      'Contacto',
  entrenamiento: 'Entrenamiento',
  salud:         'Salud y documentos',
};

interface Props {
  datos: DatosFicha;
  onCambio: (datos: DatosFicha) => void;
  sedes: Sede[];
  /** Al crear se exigen los obligatorios; al editar solo se avisan. */
  esNuevo: boolean;
  erroresServidor?: ErroresFicha;
  verificar?: (campo: 'email' | 'docNumber', valor: string) => Promise<boolean>;
  onArchivo?: (campo: 'doc' | 'insurance', archivo: File) => void;
  archivos?: { doc?: string; insurance?: string };
  /** Se llama cuando el último paso queda listo para guardar. */
  onGuardar: () => void;
  guardando?: boolean;
  botonGuardar: React.ReactNode;
  onCancelar: () => void;
}

const ROLES = [
  { valor: 'STUDENT' as const, texto: 'Deportista' },
  { valor: 'COACH'   as const, texto: 'Entrenador' },
  { valor: 'ADMIN'   as const, texto: 'Administrador' },
];

export function FichaDeportista({
  datos, onCambio, sedes, esNuevo,
  erroresServidor, verificar,
  onArchivo, archivos,
  onGuardar, guardando, botonGuardar, onCancelar,
}: Props) {
  const [indice, setIndice] = useState(0);
  const [tocados, setTocados] = useState<Record<string, boolean>>({});
  const [ocupado, setOcupado] = useState<{ email?: boolean; docNumber?: boolean }>({});

  const menor = esMenorDeEdad(datos.birthDate);
  const años = edadDe(datos.birthDate);
  const errores = useMemo(() => validarFicha(datos, esNuevo), [datos, esNuevo]);
  const faltan = useMemo(() => (esNuevo ? [] : faltantesDe(datos)), [datos, esNuevo]);

  // Un administrador no entrena ni tiene sede, así que su ficha es más corta.
  const pasos = useMemo<Paso[]>(() => {
    const p: Paso[] = ['identidad', 'contacto'];
    if (datos.role !== 'ADMIN') p.push('entrenamiento');
    p.push('salud');
    return p;
  }, [datos.role]);

  const paso = pasos[Math.min(indice, pasos.length - 1)];
  const esUltimo = indice >= pasos.length - 1;

  const set = <K extends keyof DatosFicha>(campo: K, valor: DatosFicha[K]) => {
    onCambio({ ...datos, [campo]: valor });
  };

  // El aviso de duplicado corre mientras se escribe, medio segundo después de
  // la última tecla. Sin esa espera sería una consulta por carácter.
  const temporizador = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  useEffect(() => {
    const pendientes = temporizador.current;
    return () => { Object.values(pendientes).forEach(clearTimeout); };
  }, []);

  function revisarDuplicado(campo: 'email' | 'docNumber', valor: string) {
    if (!verificar) return;
    clearTimeout(temporizador.current[campo]);
    if (!valor.trim()) { setOcupado(o => ({ ...o, [campo]: false })); return; }
    temporizador.current[campo] = setTimeout(async () => {
      const usado = await verificar(campo, valor.trim());
      setOcupado(o => ({ ...o, [campo]: usado }));
    }, 500);
  }

  function errorDe(campo: keyof ErroresFicha): string | null {
    if (erroresServidor?.[campo]) return erroresServidor[campo]!;
    if (campo === 'email' && ocupado.email) return 'Ese correo ya está registrado en este club';
    if (campo === 'docNumber' && ocupado.docNumber) return 'Ese documento ya está registrado en este club';
    if (tocados[campo] && errores[campo]) return errores[campo]!;
    return null;
  }

  const marcar = (campo: string) => () => setTocados(t => ({ ...t, [campo]: true }));

  /** Lo que falta en el paso actual, para no dejar avanzar en falso. */
  function faltaEnEstePaso(): boolean {
    if (paso === 'identidad') return !!(errores.fullName || errores.birthDate || errores.docNumber);
    if (paso === 'contacto') return !!errores.email || ocupado.email === true;
    return false;
  }

  function siguiente() {
    if (paso === 'identidad') setTocados(t => ({ ...t, fullName: true, birthDate: true, docNumber: true }));
    if (paso === 'contacto') setTocados(t => ({ ...t, email: true }));
    if (faltaEnEstePaso()) return;
    if (esUltimo) onGuardar();
    else setIndice(i => i + 1);
  }

  return (
    <div className="flex flex-col min-h-0">
      {/* Avance */}
      <div className="flex gap-1.5 px-6 pt-4 shrink-0">
        {pasos.map((p, i) => (
          <span key={p} className="h-[3px] flex-1 rounded-full transition-colors"
            style={{ background: i <= indice ? '#381DA0' : '#E4E0EC' }} />
        ))}
      </div>
      <div className="px-6 pt-3 pb-1 shrink-0">
        <p className="text-[12px] text-muted-foreground m-0">Paso {indice + 1} de {pasos.length}</p>
        <h3 className="text-[17px] font-semibold text-foreground m-0 tracking-tight">{TITULO[paso]}</h3>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pt-3">
        {!esNuevo && faltan.length > 0 && indice === 0 && (
          <p className="text-[11.5px] rounded-lg px-3 py-2 mb-3"
            style={{ background: 'rgba(240,180,41,0.12)', color: '#8A6216' }}>
            A esta ficha le falta {faltan.join(', ')}. Puedes guardar igual y completarla después.
          </p>
        )}

        {/* ── 1 · Quién es ───────────────────────────────────────────────── */}
        {paso === 'identidad' && (
          <>
            <Campo etiqueta="Rol">
              <div className="flex gap-1.5">
                {ROLES.map(r => (
                  <button key={r.valor} type="button" onClick={() => set('role', r.valor)}
                    className={`flex-1 text-[12px] font-semibold py-2.5 rounded-lg border transition-colors ${
                      datos.role === r.valor
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'bg-background border-border text-muted-foreground hover:bg-secondary'
                    }`}>
                    {r.texto}
                  </button>
                ))}
              </div>
            </Campo>

            <Campo etiqueta="Nombre y apellidos" obligatorio error={errorDe('fullName')}>
              <input value={datos.fullName} onChange={e => set('fullName', e.target.value)}
                onBlur={marcar('fullName')} placeholder="Nombre completo"
                className={entrada(!!errorDe('fullName'))} />
              <Ayuda>Se guarda en Mayúscula Inicial.</Ayuda>
            </Campo>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <Campo etiqueta="Nacimiento" obligatorio={esNuevo} error={errorDe('birthDate')}>
                <DatePicker value={datos.birthDate} compacto abrirEn="years"
                  maxDate={new Date()} placeholder="Elegir fecha"
                  error={!!errorDe('birthDate')}
                  onChange={v => { set('birthDate', v); marcar('birthDate')(); }} />
              </Campo>
              <Campo etiqueta="Documento" obligatorio={esNuevo}>
                <Desplegable valor={datos.docType} opciones={DOC_TIPOS_CON_NOTA} vacio="Tipo"
                  titulo="Tipo de documento"
                  onElegir={v => set('docType', v)} />
              </Campo>
              <Campo etiqueta="Número" obligatorio={esNuevo} error={errorDe('docNumber')}>
                <input value={datos.docNumber}
                  onChange={e => { set('docNumber', e.target.value); revisarDuplicado('docNumber', e.target.value); }}
                  onBlur={marcar('docNumber')} inputMode="numeric" placeholder="Sin puntos"
                  className={entrada(!!errorDe('docNumber'))} />
              </Campo>
            </div>

            <Campo etiqueta="Género">
              <div className="flex gap-1.5 max-w-[340px]">
                {GENEROS.map(g => (
                  <button key={g} type="button"
                    onClick={() => set('gender', datos.gender === g ? '' : g)}
                    className={`flex-1 text-[12px] font-semibold py-2.5 rounded-lg border transition-colors ${
                      datos.gender === g
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'bg-background border-border text-muted-foreground hover:bg-secondary'
                    }`}>
                    {g}
                  </button>
                ))}
              </div>
              <Ayuda>Es la rama con la que compite. Sin este dato no se pueden separar los resultados.</Ayuda>
            </Campo>
          </>
        )}

        {/* ── 2 · Cómo se le ubica ───────────────────────────────────────── */}
        {paso === 'contacto' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Campo etiqueta="Correo" obligatorio={esNuevo} error={errorDe('email')}>
                <input type="email" value={datos.email}
                  onChange={e => { set('email', e.target.value); revisarDuplicado('email', e.target.value); }}
                  onBlur={marcar('email')} placeholder="correo@ejemplo.com"
                  className={entrada(!!errorDe('email'))} />
                <Ayuda>Con este entra a la app. No se puede repetir el de otro deportista.</Ayuda>
              </Campo>
              <Campo etiqueta="Celular">
                <PhoneInput value={datos.phone} onChange={v => set('phone', v)} className="h-[42px]" />
              </Campo>
            </div>

            {datos.role !== 'ADMIN' && (
              <>
                {menor && (
                  <p className="flex gap-2 items-start text-[11.5px] rounded-lg px-3 py-2 mb-2.5 mt-1"
                    style={{ background: 'rgba(56,29,160,0.08)', color: '#5B3AA6' }}>
                    <User className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>
                      {años} años, así que los datos de contacto son de quien responde por él.
                    </span>
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <Campo etiqueta={menor ? 'Nombre del acudiente' : 'Contacto de emergencia'}>
                    <input value={datos.guardianName} onChange={e => set('guardianName', e.target.value)}
                      placeholder="Nombre completo" className={entrada(false)} />
                  </Campo>
                  <Campo etiqueta="Su celular">
                    <PhoneInput value={datos.guardianPhone} onChange={v => set('guardianPhone', v)} className="h-[42px]" />
                  </Campo>
                </div>
                {menor && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <Campo etiqueta="Parentesco">
                      <Desplegable valor={datos.guardianRelation} opciones={[...PARENTESCOS]} vacio="Elegir"
                        onElegir={v => set('guardianRelation', v)} />
                    </Campo>
                    <Campo etiqueta="Cédula">
                      <input value={datos.guardianDocNumber} onChange={e => set('guardianDocNumber', e.target.value)}
                        inputMode="numeric" placeholder="Sin puntos" className={entrada(false)} />
                    </Campo>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── 3 · Qué hace en el club ────────────────────────────────────── */}
        {paso === 'entrenamiento' && (
          <>
            {datos.role === 'STUDENT' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Campo etiqueta="Categoría">
                  <Desplegable valor={datos.category} opciones={[...CATEGORIAS]} vacio="Elegir categoría"
                    onElegir={v => set('category', v)} />
                  <Ayuda>Se elige de la lista: escribirla a mano deja la planilla vacía.</Ayuda>
                </Campo>
                <Campo etiqueta="Nivel">
                  <Desplegable valor={datos.tipo} opciones={[...NIVELES]} vacio="Elegir nivel"
                    onElegir={v => set('tipo', v)} />
                </Campo>
              </div>
            )}
            {sedes.length > 0 && (
              <Campo etiqueta="Sedes donde entrena">
                <Chips opciones={sedes} elegidas={datos.locationIds}
                  onCambio={ids => set('locationIds', ids)} />
                <Ayuda>Puede entrenar en más de una.</Ayuda>
              </Campo>
            )}
          </>
        )}

        {/* ── 4 · Qué hay que tener a mano ───────────────────────────────── */}
        {paso === 'salud' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Campo etiqueta="EPS">
                <input value={datos.eps} onChange={e => set('eps', e.target.value)}
                  placeholder="Entidad de salud" className={entrada(false)} />
              </Campo>
              <Campo etiqueta="RH">
                <Desplegable valor={datos.rh} opciones={[...RH_TIPOS]} vacio="Elegir"
                  onElegir={v => set('rh', v)} />
                <Ayuda>Si se golpea en un entrenamiento, es lo primero que preguntan.</Ayuda>
              </Campo>
            </div>

            <Campo etiqueta="Alergias o condiciones médicas">
              <textarea value={datos.allergies} onChange={e => set('allergies', e.target.value)}
                rows={2} placeholder="Por ejemplo: alérgico a la penicilina, usa inhalador"
                className={`${entrada(false)} resize-none py-2.5 leading-snug`} />
              <Ayuda>Lo que un entrenador tendría que saber antes de que pase algo.</Ayuda>
            </Campo>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Adjunto etiqueta="Documento de identidad" actual={archivos?.doc}
                onElegir={f => onArchivo?.('doc', f)} />
              <Adjunto etiqueta="Póliza o seguro" actual={archivos?.insurance}
                onElegir={f => onArchivo?.('insurance', f)} />
            </div>
          </>
        )}
      </div>

      {/* Pie */}
      <div className="flex items-center gap-2.5 px-6 py-4 border-t border-border shrink-0">
        <p className="flex-1 text-[11.5px] text-muted-foreground m-0">
          {paso === 'identidad' && años !== null && años >= 0
            ? `${años} ${años === 1 ? 'año' : 'años'}${menor ? ' · en el paso siguiente le pedimos su acudiente' : ''}`
            : esNuevo ? 'Nombre, nacimiento, documento y correo son obligatorios.' : ''}
        </p>

        {indice > 0 ? (
          <button type="button" onClick={() => setIndice(i => i - 1)} disabled={guardando}
            className="flex items-center gap-1 px-4 h-11 rounded-xl border border-border text-[13px] font-semibold text-muted-foreground shrink-0 disabled:opacity-50">
            <ChevronLeft className="w-4 h-4" /> Atrás
          </button>
        ) : (
          <button type="button" onClick={onCancelar} disabled={guardando}
            className="px-4 h-11 rounded-xl border border-border text-[13px] font-semibold text-muted-foreground shrink-0 disabled:opacity-50">
            Cancelar
          </button>
        )}

        <button type="button" onClick={siguiente} disabled={guardando}
          className="flex items-center justify-center gap-1.5 px-5 h-11 rounded-xl text-[13.5px] font-semibold text-white shrink-0 disabled:opacity-50"
          style={{ background: '#381DA0' }}>
          {esUltimo ? botonGuardar : <>Continuar <ChevronRight className="w-4 h-4" /></>}
        </button>
      </div>
    </div>
  );
}
