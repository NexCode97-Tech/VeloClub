'use client';

import { Plus, TrendingUp, TrendingDown } from 'lucide-react';

const fmt = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const transactions = [
  { type: 'INCOME',  category: 'Mensualidades', amount: 840000, date: '2026-04-01', desc: 'Pagos Abril' },
  { type: 'EXPENSE', category: 'Arriendo',      amount: 450000, date: '2026-04-02', desc: 'Sede Norte' },
  { type: 'INCOME',  category: 'Matriculas',    amount: 160000, date: '2026-04-03', desc: '2 nuevos alumnos' },
  { type: 'EXPENSE', category: 'Materiales',    amount:  85000, date: '2026-04-05', desc: 'Patines, cascos' },
  { type: 'INCOME',  category: 'Patrocinios',   amount: 300000, date: '2026-04-08', desc: 'Sponsor MarcaX' },
  { type: 'EXPENSE', category: 'Honorarios',    amount: 400000, date: '2026-04-10', desc: 'Entrenadores' },
];

const totalIncome  = transactions.filter((t) => t.type === 'INCOME').reduce((a, t) => a + t.amount, 0);
const totalExpense = transactions.filter((t) => t.type === 'EXPENSE').reduce((a, t) => a + t.amount, 0);
const balance      = totalIncome - totalExpense;
const balancePct   = Math.round((balance / totalIncome) * 100);

export default function FlujoCajaPage() {
  return (
    <div className="min-h-full bg-background">
      {/* Header */}
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

      {/* Saldo card */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase mb-1">
          Saldo actual
        </p>
        <p
          className="text-3xl font-extrabold mb-4"
          style={{ fontFamily: 'var(--font-space-grotesk)', color: '#06D6A0' }}
        >
          {fmt.format(balance)}
        </p>
        <div className="grid grid-cols-2 gap-3">
          {/* Ingresos */}
          <div
            className="rounded-xl p-3 flex items-center gap-2"
            style={{ background: 'rgba(6,214,160,0.10)' }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: '#06D6A0' }}
            >
              <TrendingUp size={14} color="#fff" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">
                Ingresos
              </p>
              <p
                className="text-[13px] font-bold"
                style={{ fontFamily: 'var(--font-space-grotesk)', color: '#06D6A0' }}
              >
                {fmt.format(totalIncome)}
              </p>
            </div>
          </div>

          {/* Egresos */}
          <div
            className="rounded-xl p-3 flex items-center gap-2"
            style={{ background: 'rgba(239,71,111,0.10)' }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: '#EF476F' }}
            >
              <TrendingDown size={14} color="#fff" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">
                Egresos
              </p>
              <p
                className="text-[13px] font-bold"
                style={{ fontFamily: 'var(--font-space-grotesk)', color: '#EF476F' }}
              >
                {fmt.format(totalExpense)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar card */}
      <div className="bg-card border border-border rounded-xl p-3">
        <p className="text-[12px] font-semibold text-foreground mb-2">Balance del mes</p>
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${balancePct}%`,
              background: 'linear-gradient(90deg,#06D6A0,#4361EE)',
            }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] text-muted-foreground">
            {fmt.format(balance)} disponible
          </span>
          <span className="text-[10px] font-semibold" style={{ color: '#06D6A0' }}>
            {balancePct}%
          </span>
        </div>
      </div>

      {/* Transactions section */}
      <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase px-1">
        Transacciones
      </p>

      <div className="flex flex-col gap-2">
        {transactions.map((t, i) => {
          const isIncome = t.type === 'INCOME';
          return (
            <div
              key={i}
              className="flex items-center gap-3 bg-card border border-border rounded-xl px-3 py-2.5"
            >
              {/* Icon */}
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: isIncome ? 'rgba(6,214,160,0.15)' : 'rgba(239,71,111,0.15)' }}
              >
                {isIncome ? (
                  <TrendingUp size={16} color="#06D6A0" strokeWidth={2.5} />
                ) : (
                  <TrendingDown size={16} color="#EF476F" strokeWidth={2.5} />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-foreground truncate">{t.desc}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {t.category} · {t.date}
                </p>
              </div>

              {/* Amount */}
              <span
                className="text-[14px] font-bold shrink-0"
                style={{
                  fontFamily: 'var(--font-space-grotesk)',
                  color: isIncome ? '#06D6A0' : '#EF476F',
                }}
              >
                {isIncome ? '+' : '-'}{fmt.format(t.amount)}
              </span>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
