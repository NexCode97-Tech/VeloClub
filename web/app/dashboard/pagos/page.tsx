'use client';

import { CreditCard } from 'lucide-react';

const fmt = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const tabs = ['Todos', 'Pagados', 'Pendientes', 'Vencidos'];

export default function PagosPage() {
  return (
    <div className="min-h-full bg-background">
      {/* Encabezado */}
      <div className="px-5 py-3 bg-background border-b border-border flex items-center justify-between">
        <h1 className="text-[17px] font-bold text-foreground" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
          Pagos
        </h1>
      </div>

      <div className="px-4 pt-4 flex flex-col gap-4">

        {/* Tarjeta resumen */}
        <div
          className="rounded-2xl p-4 text-white"
          style={{ background: 'linear-gradient(135deg,#4361EE,#7209B7)' }}
        >
          <p className="text-[10px] font-semibold tracking-widest opacity-80 uppercase mb-1">
            Cobrado este mes
          </p>
          <p
            className="text-4xl font-extrabold mb-3"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            {fmt.format(0)}
          </p>
          <div className="flex gap-6">
            <div>
              <p className="text-[10px] opacity-70 uppercase tracking-wide">Total</p>
              <p className="text-base font-bold" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                {fmt.format(0)}
              </p>
            </div>
            <div>
              <p className="text-[10px] opacity-70 uppercase tracking-wide">Pendiente</p>
              <p className="text-base font-bold" style={{ fontFamily: 'var(--font-space-grotesk)', color: '#FFB703' }}>
                {fmt.format(0)}
              </p>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab}
              className="shrink-0 px-4 py-1.5 rounded-full text-[12px] font-semibold border"
              style={{ background: tab === 'Todos' ? '#4361EE' : '#fff', color: tab === 'Todos' ? '#fff' : '#1A1028', borderColor: tab === 'Todos' ? '#4361EE' : 'rgba(120,80,200,0.10)' }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Estado vacío */}
        <div className="bg-white border border-border rounded-xl px-4 py-10 text-center">
          <CreditCard className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-[13px] font-semibold text-muted-foreground">Sin pagos registrados</p>
          <p className="text-[11px] text-muted-foreground mt-1">Los pagos aparecerán aquí una vez se registren</p>
        </div>

      </div>
    </div>
  );
}
