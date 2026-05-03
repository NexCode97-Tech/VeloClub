'use client';

import { Plus, TrendingUp, TrendingDown } from 'lucide-react';

const fmt = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

export default function FlujoCajaPage() {
  return (
    <div className="min-h-full bg-background">
      {/* Encabezado */}
      <div className="px-5 py-3 bg-background border-b border-border flex items-center justify-between">
        <h1 className="text-[17px] font-bold text-foreground" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
          Flujo de Caja
        </h1>
        <button
          className="w-[34px] h-[34px] rounded-xl flex items-center justify-center"
          style={{ background: '#4361EE' }}
          aria-label="Agregar transacción"
        >
          <Plus size={18} color="#fff" strokeWidth={2.5} />
        </button>
      </div>
      <div className="flex flex-col gap-4 px-4 py-4">

        {/* Saldo */}
        <div className="bg-white border border-border rounded-2xl p-4">
          <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase mb-1">
            Saldo actual
          </p>
          <p
            className="text-3xl font-extrabold mb-4"
            style={{ fontFamily: 'var(--font-space-grotesk)', color: '#06D6A0' }}
          >
            {fmt.format(0)}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: 'rgba(6,214,160,0.10)' }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#06D6A0' }}>
                <TrendingUp size={14} color="#fff" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">Ingresos</p>
                <p className="text-[13px] font-bold" style={{ fontFamily: 'var(--font-space-grotesk)', color: '#06D6A0' }}>{fmt.format(0)}</p>
              </div>
            </div>
            <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: 'rgba(239,71,111,0.10)' }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#EF476F' }}>
                <TrendingDown size={14} color="#fff" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">Egresos</p>
                <p className="text-[13px] font-bold" style={{ fontFamily: 'var(--font-space-grotesk)', color: '#EF476F' }}>{fmt.format(0)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Transacciones vacías */}
        <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase px-1">
          Transacciones
        </p>
        <div className="bg-white border border-border rounded-xl px-4 py-10 text-center">
          <TrendingUp className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-[13px] font-semibold text-muted-foreground">Sin transacciones registradas</p>
          <p className="text-[11px] text-muted-foreground mt-1">Usa el botón + para agregar ingresos o egresos</p>
        </div>

      </div>
    </div>
  );
}
