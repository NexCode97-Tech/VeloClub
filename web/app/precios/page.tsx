'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Star } from 'lucide-react';
import LandingNav from '@/components/ui/landing-nav';
import { TRAMOS, precioPlan, mesesDelPlan, enPesos, type TipoPlan } from '@/lib/precios';

const COMUNES = [
  'Gestión de miembros y asistencia digital',
  'Pagos y finanzas del club',
  'Resultados y competencias',
  'Analíticas',
  'Gestión de sedes',
];

interface Ventaja {
  texto: string;
  fuerte?: string;
}

interface Plan {
  tipo: TipoPlan;
  nombre: string;
  ciclo: string;
  unidad: string;
  ahorro?: string;
  destacado?: boolean;
  propias: Ventaja[];
}

const PLANES: Plan[] = [
  {
    tipo: 'MENSUAL',
    nombre: 'Mensual',
    ciclo: 'Se cobra cada mes',
    unidad: '/mes',
    propias: [
      { texto: 'Sin permanencia' },
      { texto: 'Se cancela cuando quieras' },
    ],
  },
  {
    tipo: 'TRIMESTRAL',
    nombre: 'Trimestral',
    ciclo: 'Se cobra cada 3 meses',
    unidad: '/trimestre',
    ahorro: '10% menos',
    destacado: true,
    propias: [
      { fuerte: '10% de descuento', texto: ' sobre el mensual' },
      { texto: 'Un solo cobro cada trimestre' },
    ],
  },
  {
    tipo: 'ANUAL',
    nombre: 'Anual',
    ciclo: 'Se cobra una vez al año',
    unidad: '/año',
    ahorro: '20% menos',
    propias: [
      { fuerte: '20% de descuento', texto: ', el mayor' },
      { texto: 'Te olvidas del cobro por un año' },
    ],
  },
];

export default function PreciosPage() {
  const [tramo, setTramo] = useState(0);

  return (
    <main className="min-h-dvh bg-[#FDFCFC] [overflow-x:clip]">
      <LandingNav />

      <section className="pt-[120px] pb-16 sm:pt-[136px] sm:pb-20">
        <div className="max-w-[1200px] mx-auto px-[22px]">

          {/* El «desde» del título es el cobro mensual más bajo que existe. El
              anual dividido en doce da menos, pero nadie paga eso al mes: paga
              el año de una vez. Anunciar como mensual algo que no se cobra
              mensual es la clase de letra chica que después genera reclamos,
              así que esa división va dentro de la tarjeta y dice «equivale a». */}
          <h1
            className="text-[1.9rem] sm:text-[2.3rem] lg:text-[2.7rem] font-semibold text-[#1A1028] text-center mx-auto leading-[1.1] max-w-[22ch] text-balance"
            style={{ letterSpacing: '-0.032em' }}
          >
            Todo incluido, desde {enPesos(TRAMOS[0].mensual)} al mes
          </h1>
          <p className="text-[15px] text-[#8E87A8] text-center mx-auto mt-3 max-w-[52ch] leading-relaxed">
            Sin módulos aparte ni funciones bloqueadas. Lo único que mueve el
            precio es cuántos deportistas tenga tu club.
          </p>

          <div className="flex justify-center mt-8 mb-9">
            <div
              className="flex gap-[3px] rounded-full p-1 border"
              role="group"
              aria-label="Cuántos deportistas"
              style={{ background: '#F7F7FB', borderColor: 'rgba(26,16,40,0.08)' }}
            >
              {TRAMOS.map((t, i) => (
                <button
                  key={t.etiqueta}
                  aria-pressed={i === tramo}
                  onClick={() => setTramo(i)}
                  className="text-[13px] font-semibold px-4 py-2 rounded-full whitespace-nowrap transition-all cursor-pointer"
                  style={i === tramo
                    ? { background: '#FDFCFC', color: '#1A1028', boxShadow: '0 1px 4px rgba(26,16,40,.10)' }
                    : { background: 'transparent', color: '#8E87A8' }}
                >
                  {t.etiqueta}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 grid-cols-1 min-[800px]:grid-cols-3 items-start">
            {PLANES.map(plan => {
              const total = precioPlan(tramo, plan.tipo);
              const meses = mesesDelPlan(plan.tipo);
              const ventajas: Ventaja[] = [...plan.propias, ...COMUNES.map(texto => ({ texto }))];
              return (
                <div
                  key={plan.tipo}
                  className={`relative flex flex-col gap-[3px] rounded-[18px] bg-[#F4F3F8] p-6 ${plan.destacado ? 'pt-[30px]' : ''}`}
                  style={{ border: plan.destacado ? '1.5px solid #381DA0' : '1px solid rgba(26,16,40,0.08)' }}
                >
                  {plan.destacado && (
                    <span
                      className="absolute -top-[11px] left-1/2 -translate-x-1/2 inline-flex items-center gap-[5px] rounded-full px-3 py-1 text-[11px] font-bold text-white whitespace-nowrap"
                      style={{ background: '#381DA0' }}
                    >
                      {/* La estrella va rellena y no de contorno: a 11px un
                          trazo se empasta. */}
                      <Star className="w-[11px] h-[11px] shrink-0" style={{ fill: '#FFB703', stroke: 'none' }} />
                      El que más eligen
                    </span>
                  )}

                  <span className="text-[14.5px] font-semibold text-[#1A1028]">{plan.nombre}</span>
                  <span className="text-[12.5px] text-[#8E87A8] mb-3.5">{plan.ciclo}</span>

                  <span className="flex items-baseline gap-[5px]">
                    <b
                      className="text-[34px] font-bold text-[#1A1028] tabular-nums leading-none"
                      style={{ letterSpacing: '-0.035em' }}
                    >
                      {enPesos(total)}
                    </b>
                    <span className="text-[13.5px] text-[#8E87A8]">{plan.unidad}</span>
                  </span>

                  {/* El renglón se reserva aunque esté vacío: si no, la tarjeta
                      mensual sube y las tres dejan de alinear por el botón. */}
                  <span className="text-[12.5px] text-[#8E87A8] mt-[7px] min-h-[19px]">
                    {meses > 1 ? 'equivale a ' + enPesos(Math.round(total / meses)) + ' al mes' : ''}
                  </span>

                  {plan.ahorro && (
                    <span
                      className="inline-block self-start text-[11.5px] font-bold rounded-full px-[9px] py-0.5 mt-[9px]"
                      style={{ background: '#EAFBF0', color: '#15803D' }}
                    >
                      {plan.ahorro}
                    </span>
                  )}

                  <Link
                    href="/crear-club"
                    className={`mt-[19px] w-full inline-flex items-center justify-center rounded-full px-[22px] py-[11px] text-sm font-semibold transition-all active:scale-[0.98] ${
                      plan.destacado ? 'text-white hover:brightness-110' : 'text-[#1A1028] border hover:bg-[#F7F7FB]'
                    }`}
                    style={plan.destacado
                      ? { background: '#381DA0', boxShadow: '0 1px 2px rgba(56,29,160,.20), 0 3px 8px -2px rgba(56,29,160,.28)' }
                      : { background: '#FDFCFC', borderColor: 'rgba(26,16,40,0.08)' }}
                  >
                    Empezar gratis
                  </Link>

                  <ul
                    className="list-none m-0 mt-[19px] pt-[17px] flex flex-col gap-[9px] border-t"
                    style={{ borderColor: 'rgba(26,16,40,0.08)' }}
                  >
                    {ventajas.map((v, i) => (
                      <li key={i} className="text-[13px] text-[#8E87A8] flex items-start gap-2 leading-relaxed">
                        <Check className="w-3.5 h-3.5 shrink-0 mt-[3px] text-[#381DA0]" strokeWidth={2.6} />
                        <span>
                          {v.fuerte && <b className="text-[#1A1028] font-semibold">{v.fuerte}</b>}
                          {v.texto}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          <p className="text-[12.5px] text-[#8E87A8] text-center mx-auto mt-7 max-w-[62ch] leading-relaxed">
            Activa la renovación automática y se descuenta un 5% más en cada
            cobro. Los dos meses gratis van antes de todo esto: el primer cobro
            llega cuando se acaban, y puedes irte antes sin pagar nada.
          </p>

        </div>
      </section>
    </main>
  );
}
