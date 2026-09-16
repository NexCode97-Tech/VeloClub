'use client';

import { useRef, useState } from 'react';
import { SelectorColorLibre } from '@/components/ui/selector-color-libre';
import { Interruptor } from '@/components/ui/interruptor';
import { coloresDelCarnet, contraste, paraTexto, COLOR_NEUTRO } from '@/lib/color';

/**
 * Los colores del club, en Ajustes.
 *
 * Uno solo deja la banda del carnet plana; dos hacen el degradado. El segundo
 * es opcional y se puede quitar, el primero no: un club sin color no es un caso
 * distinto, es un carnet a medio hacer, y para eso está el gris neutro.
 *
 * El color es libre, del gusto del club. Lo que no se pregunta es el color del
 * texto encima, que se calcula, porque con color libre es fácil terminar con
 * blanco sobre amarillo sin darse cuenta.
 */

interface Props {
  primario: string | null;
  secundario: string | null;
  marcaAgua: boolean;
  /** El logo del club, para la vista previa. */
  logo?: string | null;
  onChange: (primario: string | null, secundario: string | null) => void;
  onMarcaAgua: (v: boolean) => void;
}

export function ColoresClub({ primario, secundario, marcaAgua, logo, onChange, onMarcaAgua }: Props) {
  const [abierto, setAbierto] = useState<0 | 1 | null>(null);
  const [anclaje, setAnclaje] = useState<{ top: number; left: number } | null>(null);
  const slots = useRef<(HTMLButtonElement | null)[]>([]);

  const a = primario ?? COLOR_NEUTRO;
  const colores = coloresDelCarnet(primario, secundario);
  const casiIguales = !!secundario && contraste(a, secundario) < 1.12;

  function abrir(indice: 0 | 1, boton: HTMLButtonElement | null) {
    if (!boton) return;
    const r = boton.getBoundingClientRect();
    // El panel mide 236 de ancho. Se corre hacia adentro cuando el botón está
    // tan a la derecha que se saldría de la pantalla.
    const left = Math.max(8, Math.min(r.left, window.innerWidth - 244));
    setAnclaje({ top: r.bottom + 10, left });
    setAbierto(indice);
  }

  return (
    <div className="space-y-3 border-t border-border pt-5">
      <div>
        <h3 className="text-[13px] font-semibold text-foreground m-0">Colores del club</h3>
        <p className="text-[11px] text-muted-foreground">Se usan en el carnet digital de cada miembro</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            data-slot-color
            ref={el => { slots.current[0] = el; }}
            onClick={() => (abierto === 0 ? setAbierto(null) : abrir(0, slots.current[0]))}
            aria-expanded={abierto === 0}
            aria-label={`Color principal, ${a}`}
            className="w-11 h-11 rounded-[14px] cursor-pointer transition-transform hover:-translate-y-0.5"
            style={{
              background: a,
              boxShadow: abierto === 0
                ? 'inset 0 0 0 1px rgba(26,16,40,0.12), 0 0 0 2.5px #fff, 0 0 0 5px #381DA0'
                : 'inset 0 0 0 1px rgba(26,16,40,0.12)',
            }}
          />

          {secundario ? (
            <span className="relative">
              <button
                type="button"
                data-slot-color
                ref={el => { slots.current[1] = el; }}
                onClick={() => (abierto === 1 ? setAbierto(null) : abrir(1, slots.current[1]))}
                aria-expanded={abierto === 1}
                aria-label={`Segundo color, ${secundario}`}
                className="w-11 h-11 rounded-[14px] cursor-pointer transition-transform hover:-translate-y-0.5"
                style={{
                  background: secundario,
                  boxShadow: abierto === 1
                    ? 'inset 0 0 0 1px rgba(26,16,40,0.12), 0 0 0 2.5px #fff, 0 0 0 5px #381DA0'
                    : 'inset 0 0 0 1px rgba(26,16,40,0.12)',
                }}
              />
              <button
                type="button"
                aria-label="Quitar el segundo color"
                onClick={() => { setAbierto(null); onChange(primario, null); }}
                className="absolute -top-1.5 -right-1.5 w-[18px] h-[18px] rounded-full grid place-items-center text-white text-[10px] leading-none cursor-pointer"
                style={{ background: '#1A1028', border: '1.5px solid #fff' }}
              >
                ×
              </button>
            </span>
          ) : (
            <button
              type="button"
              aria-label="Agregar un segundo color"
              onClick={() => onChange(primario ?? COLOR_NEUTRO, paraTexto(a))}
              className="w-11 h-11 rounded-[14px] grid place-items-center text-[20px] leading-none cursor-pointer bg-card transition-transform hover:-translate-y-0.5"
              style={{ boxShadow: 'inset 0 0 0 1.5px rgba(120,80,200,0.28)', color: '#381DA0' }}
            >
              +
            </button>
          )}
        </div>

        <p className="text-[11.5px] text-muted-foreground m-0 leading-snug">
          <b className="text-foreground font-semibold">{secundario ? 'Degradado.' : 'Color plano.'}</b>{' '}
          {secundario ? 'Quita el segundo para dejarlo plano.' : 'Agrega un segundo color para el degradado.'}
        </p>
      </div>

      {casiIguales && (
        <p className="text-[11.5px] leading-snug rounded-xl px-3 py-2 m-0"
          style={{ background: 'rgba(222,150,0,0.1)', color: '#8A5A00' }}>
          Los dos colores son casi el mismo. El degradado no se va a notar, así que mejor deja uno solo.
        </p>
      )}

      {/* La vista previa es la banda real del carnet, no una muestra aparte: el
          punto es ver el color donde de verdad va a salir. */}
      <div className="flex items-center gap-3 rounded-[14px] px-3.5 py-3"
        style={{ background: colores.fondo, color: colores.tinta }}>
        <span className="w-[34px] h-[34px] rounded-full shrink-0 grid place-items-center overflow-hidden text-[11px] font-bold"
          style={{ background: '#fff', color: colores.texto }}>
          {logo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={logo} alt="" className="w-[88%] h-[88%] object-contain" />
            : 'CD'}
        </span>
        <div className="min-w-0">
          <b className="block text-[13px] font-semibold">Así se ve la banda del carnet</b>
          <span className="text-[10.5px] opacity-85">
            {primario ? 'El texto encima lo elige la plataforma para que se lea' : 'Sin color elegido va este gris neutro'}
          </span>
        </div>
      </div>

      {/* La marca de agua. Va prendida porque es lo que distingue un carnet
          institucional de una tarjeta cualquiera, pero se puede apagar: un logo
          con letras blancas o con mucho detalle se desvanece feo, y cuál
          aguanta no se sabe de antemano desde acá. */}
      <div className="flex items-start justify-between gap-4 pt-1">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-foreground m-0">Logo de fondo en el carnet</p>
          <p className="text-[11px] text-muted-foreground m-0 mt-0.5 max-w-md leading-relaxed">
            {logo
              ? 'El logo va desvanecido detrás de los datos. Si el tuyo no se ve bien así, apágalo.'
              : 'Necesita que primero subas el logo del club.'}
          </p>
        </div>
        <Interruptor
          etiqueta="Logo de fondo en el carnet"
          checked={marcaAgua}
          disabled={!logo}
          onChange={onMarcaAgua}
        />
      </div>

      {abierto !== null && (
        <SelectorColorLibre
          valor={abierto === 0 ? a : (secundario ?? a)}
          anclaje={anclaje}
          onCerrar={() => setAbierto(null)}
          onChange={hex => {
            if (abierto === 0) onChange(hex, secundario);
            else onChange(primario ?? COLOR_NEUTRO, hex);
          }}
        />
      )}
    </div>
  );
}
