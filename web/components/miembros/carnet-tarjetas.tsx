'use client';

import { useState } from 'react';
import { coloresDelCarnet } from '@/lib/color';
import {
  DatosCarnet, codigoDe, descargarImagen, descargarPdf,
  fechaCorta, iniciales, mesYAnio, rotuloVigencia,
} from '@/lib/carnet';

/**
 * Las dos caras del carnet y sus botones de descarga.
 *
 * Viven acá y no dentro del modal porque el carnet se abre en dos sitios: el
 * club lo ve en una ventana sobre la lista de miembros, y el deportista lo ve
 * como pantalla propia. Es el mismo carnet, así que es el mismo componente.
 *
 * En pantalla es HTML y no el canvas del que salen la imagen y el PDF, para que
 * el texto se lea con un lector de pantalla y se acomode al ancho de un
 * teléfono. Las dos pinturas salen de los mismos datos y de las mismas cuentas
 * de color, en `lib/color.ts`, que es lo que las mantiene iguales.
 *
 * El frente identifica. El reverso es el que importa: si un deportista se cae
 * en una competencia, lo que hace falta en tres segundos es el tipo de sangre,
 * la alergia, la EPS y el teléfono de quien responde por él.
 */

function Dato({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2"
      style={{ borderTop: '1px solid rgba(120,80,200,0.07)' }}>
      <span className="text-[11px] text-[#8E87A8]">{rotulo}</span>
      <span className="text-[12.5px] font-semibold text-right tabular-nums text-[#1A1028]">{valor}</span>
    </div>
  );
}

const SOMBRA = '0 1px 2px rgba(26,16,40,.04), 0 8px 28px -12px rgba(26,16,40,.18)';

function Frente({ d }: { d: DatosCarnet }) {
  const c = coloresDelCarnet(d.club.colorPrimario, d.club.colorSecundario);
  const m = d.miembro;
  const sello = rotuloVigencia(d.vigencia);
  const abajo = [m.deporte, d.club.ciudad].filter(Boolean).join(' · ');

  return (
    <article className="rounded-[22px] overflow-hidden bg-white flex flex-col" style={{ boxShadow: SOMBRA }}>
      <div className="relative px-[18px] pt-[18px] pb-[46px]" style={{ background: c.fondo, color: c.tinta }}>
        <span className="absolute top-[18px] right-[18px] text-[9px] font-bold uppercase tracking-[0.1em] rounded-full px-2.5 py-1"
          style={{ background: 'rgba(255,255,255,0.22)' }}>
          {sello.texto}
        </span>
        <div className="flex items-center gap-2.5">
          <span className="w-[34px] h-[34px] rounded-[9px] shrink-0 grid place-items-center overflow-hidden text-[12px] font-bold"
            style={{ background: 'rgba(255,255,255,0.92)', color: c.texto }}>
            {d.club.logo
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={d.club.logo} alt="" className="w-full h-full object-cover" />
              : iniciales(d.club.nombre)}
          </span>
          <div className="min-w-0">
            <p className="m-0 text-[13px] font-semibold leading-tight truncate">{d.club.nombre}</p>
            <p className="m-0 mt-px text-[10.5px] opacity-80 truncate">{abajo || 'VeloClub'}</p>
          </div>
        </div>
      </div>

      {/* La foto monta sobre la banda y sobre el cuerpo. Sin el z-index el
          cuerpo se pinta despues y le tapa la mitad de abajo. */}
      <div className="-mt-8 flex justify-center relative z-[2]">
        <span className="w-[74px] h-[74px] rounded-full grid place-items-center overflow-hidden text-[22px] font-semibold text-white"
          style={{
            border: '3.5px solid #fff',
            background: 'linear-gradient(135deg,#CFC8E8,#A99FD0)',
            boxShadow: '0 6px 18px -8px rgba(26,16,40,0.5)',
          }}>
          {m.foto
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={m.foto} alt="" className="w-full h-full object-cover" />
            : iniciales(m.nombre)}
        </span>
      </div>

      <div className="px-5 pt-3 pb-[18px] flex flex-col flex-1 relative z-[1]">
        <p className="m-0 text-center text-[19px] font-semibold tracking-tight leading-tight text-[#1A1028]">
          {m.nombre}
        </p>

        <div className="flex justify-center gap-1.5 mt-2.5 flex-wrap">
          {m.categoria && (
            <span className="text-[10.5px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: `${c.texto}1C`, color: c.texto }}>
              {m.categoria}
            </span>
          )}
          {m.tipo && (
            <span className="text-[10.5px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(26,16,40,0.05)', color: '#8E87A8' }}>
              {m.tipo}
            </span>
          )}
        </div>

        <div className="mt-4 [&>div:first-child]:border-t-0">
          <Dato rotulo="Documento" valor={[m.docTipo, m.docNumero].filter(Boolean).join(' ') || '—'} />
          <Dato rotulo="Nacimiento" valor={fechaCorta(m.nacimiento)} />
          <Dato rotulo="Sede" valor={m.sede ?? '—'} />
          <Dato rotulo="Vinculado desde" valor={mesYAnio(m.desde)} />
        </div>

        <div className="mt-auto pt-3.5 flex items-center justify-between gap-2.5">
          <span className="font-mono text-[11px] tracking-wider text-[#8E87A8]">{codigoDe(m.id)}</span>
          {d.vigencia.hasta ? (
            <span className="text-[10.5px] text-[#8E87A8] text-right">
              Vigente hasta
              <b className="block text-[12px] font-semibold"
                style={{ color: sello.alerta ? '#C62F50' : '#1A1028' }}>
                {fechaCorta(d.vigencia.hasta)}
              </b>
            </span>
          ) : (
            <span className="text-[10.5px] text-[#8E87A8] text-right">Sin mensualidad registrada</span>
          )}
        </div>
      </div>
    </article>
  );
}

function Reverso({ d }: { d: DatosCarnet }) {
  const c = coloresDelCarnet(d.club.colorPrimario, d.club.colorSecundario);
  const m = d.miembro;

  return (
    <article className="rounded-[22px] bg-white p-5 flex flex-col" style={{ boxShadow: SOMBRA }}>
      <p className="m-0 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide" style={{ color: '#C62F50' }}>
        <span className="w-[9px] h-[9px] rounded-full shrink-0" style={{ background: '#C62F50' }} />
        En caso de emergencia
      </p>

      <div className="mt-3.5 rounded-2xl px-4 py-4 flex items-center justify-between gap-3"
        style={{ background: 'rgba(198,47,80,0.07)' }}>
        <div>
          <span className="block text-[11px] text-[#8E87A8]">Tipo de sangre</span>
          <b className="text-[30px] font-bold leading-none tracking-tight" style={{ color: '#C62F50' }}>
            {m.rh ?? '—'}
          </b>
        </div>
        <div className="text-right max-w-[150px]">
          <span className="block text-[11px] text-[#8E87A8]">Alergias</span>
          <b className="block mt-0.5 text-[12.5px] font-semibold leading-snug text-[#1A1028]">
            {m.alergias ?? 'Ninguna registrada'}
          </b>
        </div>
      </div>

      <div className="mt-4">
        <h4 className="m-0 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#8E87A8]">Responsable</h4>
        <div className="rounded-[14px] px-3.5 py-3 flex flex-col gap-0.5"
          style={{ border: '1px solid rgba(120,80,200,0.12)' }}>
          <b className="text-[13.5px] font-semibold text-[#1A1028]">{m.acudiente ?? 'Sin registrar'}</b>
          {m.acudienteParentesco && (
            <span className="text-[11px] text-[#8E87A8]">{m.acudienteParentesco}</span>
          )}
          {/* El telefono es un enlace de llamada. Es el dato que se usa con una
              mano y el deportista en el piso. */}
          {m.acudienteTelefono && (
            <a href={`tel:${m.acudienteTelefono.replace(/\s/g, '')}`}
              className="mt-1 text-[16px] font-bold tracking-tight tabular-nums"
              style={{ color: c.texto }}>
              {m.acudienteTelefono}
            </a>
          )}
        </div>
      </div>

      <div className="mt-4">
        <h4 className="m-0 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#8E87A8]">Salud</h4>
        <div className="[&>div:first-child]:border-t-0">
          <Dato rotulo="EPS" valor={m.eps ?? '—'} />
          <Dato rotulo="Estado" valor={m.activo ? 'Activo en el club' : 'En pausa'} />
        </div>
      </div>

      <div className="mt-auto pt-4 flex items-center justify-between gap-2.5 text-[10px] text-[#8E87A8]"
        style={{ borderTop: '1px solid rgba(120,80,200,0.07)' }}>
        <span>Emitido por <b className="font-semibold text-[#1A1028]">VeloClub</b></span>
        <span>veloclubtech.com</span>
      </div>
    </article>
  );
}

/** Las dos caras, una al lado de la otra y apiladas cuando no caben. */
export function CarnetTarjetas({ datos }: { datos: DatosCarnet }) {
  return (
    <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(272px,1fr))' }}>
      <Frente d={datos} />
      <Reverso d={datos} />
    </div>
  );
}

/** Las dos salidas: la imagen para mandar y el PDF para plastificar. */
export function BotonesCarnet({ datos, onError }: { datos: DatosCarnet; onError: (m: string) => void }) {
  const [bajando, setBajando] = useState<'png' | 'pdf' | null>(null);

  async function bajar(formato: 'png' | 'pdf') {
    setBajando(formato);
    try {
      if (formato === 'png') await descargarImagen(datos);
      else await descargarPdf(datos);
    } catch {
      onError('No se pudo generar el archivo. Intenta de nuevo.');
    } finally {
      setBajando(null);
    }
  }

  return (
    <div className="flex gap-2.5 flex-wrap">
      <button
        onClick={() => bajar('png')}
        disabled={bajando !== null}
        className="flex-1 min-w-[140px] py-3 rounded-2xl font-semibold text-[13.5px] text-white disabled:opacity-60"
        style={{ background: '#381DA0' }}
      >
        {bajando === 'png' ? 'Generando…' : 'Descargar imagen'}
      </button>
      <button
        onClick={() => bajar('pdf')}
        disabled={bajando !== null}
        className="flex-1 min-w-[140px] py-3 rounded-2xl font-semibold text-[13.5px] disabled:opacity-60"
        style={{ border: '1px solid rgba(56,29,160,0.25)', color: '#381DA0', background: '#fff' }}
      >
        {bajando === 'pdf' ? 'Generando…' : 'PDF para imprimir'}
      </button>
    </div>
  );
}
