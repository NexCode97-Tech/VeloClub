'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';

const fmt = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const payments = [
  { member: 'Valentina Rios',   amount: 120000, status: 'PAID',    date: '2026-04-01', concept: 'Mensualidad Abril' },
  { member: 'Santiago Mora',    amount: 120000, status: 'PENDING', date: '2026-04-05', concept: 'Mensualidad Abril' },
  { member: 'Isabella Castro',  amount: 120000, status: 'PAID',    date: '2026-04-02', concept: 'Mensualidad Abril' },
  { member: 'Mateo Gonzalez',   amount: 120000, status: 'OVERDUE', date: '2026-03-20', concept: 'Mensualidad Marzo' },
  { member: 'Sofia Herrera',    amount:  80000, status: 'PAID',    date: '2026-04-03', concept: 'Matricula' },
  { member: 'David Ramirez',    amount: 200000, status: 'PENDING', date: '2026-04-10', concept: 'Honorario Entrenador' },
];

const statusConfig: Record<string, { color: string; label: string; gradient: string }> = {
  PAID:    { color: '#06D6A0', label: 'Pagado',    gradient: 'linear-gradient(135deg,#06D6A0,#059669)' },
  PENDING: { color: '#FFB703', label: 'Pendiente', gradient: 'linear-gradient(135deg,#FFB703,#F59E0B)' },
  OVERDUE: { color: '#EF476F', label: 'Vencido',   gradient: 'linear-gradient(135deg,#EF476F,#DC2626)' },
};

const tabs = ['Todos', 'Pagados', 'Pendientes', 'Vencidos'];
const tabFilter: Record<string, string | null> = {
  Todos: null, Pagados: 'PAID', Pendientes: 'PENDING', Vencidos: 'OVERDUE',
};

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('');
}

export default function PagosPage() {
  const [activeTab, setActiveTab] = useState('Todos');

  const filtered = payments.filter((p) => {
    const f = tabFilter[activeTab];
    return f === null || p.status === f;
  });

  return (
    <div className="flex flex-col gap-4 px-4 py-5 max-w-lg mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1
          className="text-2xl font-bold text-foreground"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          Pagos
        </h1>
        <button
          className="flex items-center justify-center w-9 h-9 rounded-xl shadow-sm"
          style={{ background: '#4361EE' }}
          aria-label="Agregar pago"
        >
          <Plus size={18} color="#fff" strokeWidth={2.5} />
        </button>
      </div>

      {/* Gradient balance card */}
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
          {fmt.format(480000)}
        </p>
        <div className="flex gap-6">
          <div>
            <p className="text-[10px] opacity-70 uppercase tracking-wide">Total</p>
            <p className="text-base font-bold" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
              {fmt.format(1020000)}
            </p>
          </div>
          <div>
            <p className="text-[10px] opacity-70 uppercase tracking-wide">Pendiente</p>
            <p
              className="text-base font-bold"
              style={{ fontFamily: 'var(--font-space-grotesk)', color: '#FFB703' }}
            >
              {fmt.format(540000)}
            </p>
          </div>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="shrink-0 px-4 py-1.5 rounded-full text-[12px] font-semibold border transition-colors"
            style={
              activeTab === tab
                ? { background: '#4361EE', color: '#fff', borderColor: '#4361EE' }
                : { background: '#fff', color: '#1A1028', borderColor: 'rgba(120,80,200,0.10)' }
            }
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Payment list */}
      <div className="flex flex-col gap-2">
        {filtered.map((p, i) => {
          const sc = statusConfig[p.status];
          return (
            <div
              key={i}
              className="flex items-center gap-3 bg-card border border-border rounded-xl px-3 py-2.5"
            >
              {/* Avatar */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{ background: sc.gradient }}
              >
                <span className="text-[11px] font-bold text-white">{getInitials(p.member)}</span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-foreground truncate">{p.member}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {p.concept} · {p.date}
                </p>
              </div>

              {/* Amount + badge */}
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span
                  className="text-[14px] font-bold"
                  style={{ fontFamily: 'var(--font-space-grotesk)', color: '#1A1028' }}
                >
                  {fmt.format(p.amount)}
                </span>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: sc.color + '22', color: sc.color }}
                >
                  {sc.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
