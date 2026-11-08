'use client';

// El recibo que sale de la impresora al pagar la suscripción. Es el diseño
// aprobado en la maqueta del 8 de noviembre: una impresora térmica que saca el
// tiquete línea por línea, con el sello de «Pagado» al final.
//
// Con movimiento reducido no hay vibración ni impresión: el papel aparece de
// una vez, completo.

import { useReducedMotion } from 'framer-motion';

const pesos = (n: number) =>
  n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

const MEDIO: Record<string, string> = {
  card: 'Tarjeta',
  apple_pay: 'Apple Pay',
  google_pay: 'Google Pay',
  pse: 'PSE',
  nequi: 'Nequi',
  bancolombia: 'Bancolombia',
  bre_b: 'Bre-B',
  efecty: 'Efecty',
  crypto: 'Cripto',
};

export interface DatosRecibo {
  pagoId: string;
  monto: number;
  plan: string;
  deportistas: number;
  medio: string | null;
  vigenteHasta: string;
  renovacion: boolean;
}

const SEPARADOR = <div className="my-3 border-t-[1.5px] border-dashed" style={{ borderColor: '#D3CEDC' }} />;

export function ReciboPago({ datos, onCerrar }: { datos: DatosRecibo; onCerrar: () => void }) {
  const reduce = useReducedMotion();
  const animar = !reduce;
  const numero = 'VC-' + new Date().getFullYear() + '-' + datos.pagoId.replace(/^pay_/, '').slice(-6).toUpperCase();
  const fecha = new Date().toLocaleString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

  return (
    <div className="flex flex-col items-center py-2">
      <style>{`
        @keyframes vc-recibo-imprime { from { transform: translateY(-101%) } to { transform: translateY(0) } }
        @keyframes vc-recibo-vibra { 50% { transform: translateY(0.7px) } }
        @keyframes vc-recibo-led { 0% { background: #FFB703; box-shadow: 0 0 10px #FFB703 } 50% { background: #3E3549; box-shadow: none } }
        @keyframes vc-recibo-led-fin { to { background: #06D6A0; box-shadow: 0 0 10px #06D6A0 } }
        @keyframes vc-recibo-sella { from { opacity: 0; transform: rotate(-12deg) scale(1.7) } to { opacity: .92; transform: rotate(-12deg) scale(1) } }
        @keyframes vc-recibo-sube { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
        .vc-papel {
          -webkit-mask: linear-gradient(#000 0 0) top/100% calc(100% - 7px) no-repeat, conic-gradient(from 135deg at top, #000 90deg, #0000 0) bottom/14px 7px repeat-x;
          mask: linear-gradient(#000 0 0) top/100% calc(100% - 7px) no-repeat, conic-gradient(from 135deg at top, #000 90deg, #0000 0) bottom/14px 7px repeat-x;
        }
      `}</style>

      {/* La impresora */}
      <div
        className="relative z-[2] w-full max-w-[390px] h-[60px] rounded-t-[18px] rounded-b-[12px]"
        style={{
          background: 'linear-gradient(180deg,#332B40 0%,#1D1826 55%,#141019 100%)',
          boxShadow: '0 16px 30px rgba(26,16,40,.22), inset 0 1px 0 rgba(255,255,255,.14), inset 0 -2px 0 rgba(0,0,0,.4)',
          animation: animar ? 'vc-recibo-vibra 90ms linear 300ms 20' : undefined,
        }}
      >
        <span className="absolute left-5 top-3.5 text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,.45)' }}>VeloClub</span>
        <span
          className="absolute right-5 top-[17px] w-[7px] h-[7px] rounded-full"
          style={{
            background: animar ? '#3E3549' : '#06D6A0',
            animation: animar ? 'vc-recibo-led 240ms steps(1) 300ms 8, vc-recibo-led-fin 1ms linear 2200ms forwards' : undefined,
          }}
        />
        <span
          className="absolute left-3.5 right-3.5 bottom-[11px] h-[7px] rounded-full"
          style={{ background: '#050308', boxShadow: 'inset 0 2px 3px rgba(0,0,0,.9), 0 1px 0 rgba(255,255,255,.08)' }}
        />
      </div>

      {/* El papel */}
      <div
        className="relative z-[1] w-[calc(100%-40px)] max-w-[350px] -mt-[15px] overflow-hidden pb-4"
        style={{ filter: 'drop-shadow(0 10px 14px rgba(26,16,40,.13))' }}
      >
        <div
          className="vc-papel relative px-5 pt-[26px] pb-[30px] font-mono text-[11.5px] leading-[1.5]"
          style={{
            background: 'linear-gradient(180deg,#ECE9E3 0,#FFFEFB 24px,#FFFEFB 100%)',
            color: '#2A2433',
            transform: animar ? 'translateY(-101%)' : undefined,
            animation: animar ? 'vc-recibo-imprime 1900ms steps(26,end) 300ms forwards' : undefined,
          }}
        >
          <div className="flex flex-col items-center gap-[3px] text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-vc.png" alt="VeloClub" width={34} height={34} className="rounded-full mb-1" />
            <b className="text-[13px] font-bold" style={{ color: '#1A1028' }}>Recibo de pago</b>
            <span className="text-[10.5px]" style={{ color: '#8E87A8' }}>N.º {numero} · {fecha}</span>
          </div>
          {SEPARADOR}
          <Linea izq={'Plan ' + datos.plan} der={pesos(datos.monto)} />
          <Linea izq={datos.deportistas + ' deportistas'} sub />
          {SEPARADOR}
          <div className="relative flex justify-between items-baseline py-0.5">
            <span className="font-bold" style={{ color: '#1A1028' }}>Total pagado</span>
            <b className="text-[19px] font-bold tracking-tight" style={{ color: '#1A1028' }}>{pesos(datos.monto)}</b>
            <span
              className="absolute left-[40%] -top-1.5 rounded-lg px-2.5 py-0.5 text-[13px] font-bold font-sans"
              style={{
                border: '2px solid #04A97E', color: '#04A97E', background: 'rgba(255,254,251,.65)',
                transform: 'rotate(-12deg)', opacity: animar ? 0 : 0.92,
                animation: animar ? 'vc-recibo-sella 380ms cubic-bezier(.2,.9,.3,1.25) 2300ms forwards' : undefined,
              }}
            >
              Pagado
            </span>
          </div>
          {SEPARADOR}
          <Linea izq="Medio" der={datos.medio ? (MEDIO[datos.medio] ?? datos.medio) : 'Whop'} />
          <div className="flex justify-between items-center gap-2.5 py-0.5">
            <span>Procesado por</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/marcas/whop.svg" alt="Whop" className="h-3 w-auto" />
          </div>
          <Linea izq="Vigente hasta" der={datos.vigenteHasta} />
          <Linea izq="Renovación" der={datos.renovacion ? 'Automática' : 'Manual'} />
          {SEPARADOR}
          <p className="text-center text-[10.5px] m-0" style={{ color: '#8E87A8' }}>Gracias por entrenar con VeloClub</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onCerrar}
        className="w-full max-w-[390px] mt-2 py-3 rounded-xl bg-primary text-white text-[13px] font-semibold cursor-pointer"
        style={{ animation: animar ? 'vc-recibo-sube 260ms cubic-bezier(.23,1,.32,1) 2450ms both' : undefined }}
      >
        Listo
      </button>
    </div>
  );
}

function Linea({ izq, der, sub }: { izq: string; der?: string; sub?: boolean }) {
  return (
    <div className="flex justify-between items-center gap-2.5 py-0.5" style={sub ? { color: '#8E87A8', fontSize: '10.5px' } : undefined}>
      <span>{izq}</span>
      {der && <b className="font-medium text-right whitespace-nowrap" style={{ color: '#1A1028' }}>{der}</b>}
    </div>
  );
}
