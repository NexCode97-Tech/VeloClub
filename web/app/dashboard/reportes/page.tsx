'use client';

import { BarChart2 } from 'lucide-react';

const stats = [
  { label: 'Tasa asistencia', value: '—', sub: 'Sin datos', color: '#4361EE' },
  { label: 'Ingresos mes',    value: '—', sub: 'Sin datos', color: '#06D6A0' },
  { label: 'Pagos al día',    value: '—', sub: 'Sin datos', color: '#FFB703' },
  { label: 'Logros totales',  value: '—', sub: 'Sin datos', color: '#7209B7' },
];

const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function ReportesPage() {
  return (
    <div className="min-h-full bg-background">
      {/* Encabezado */}
      <div className="px-5 py-3 bg-background border-b border-border">
        <h1 className="text-[17px] font-bold text-foreground" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
          Reportes
        </h1>
      </div>
      <div className="flex flex-col gap-4 px-4 py-4">

        {/* Estadísticas vacías */}
        <div className="grid grid-cols-2 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="bg-white border border-border rounded-xl px-4 py-3.5">
              <p className="text-2xl font-extrabold mb-0.5" style={{ fontFamily: 'var(--font-space-grotesk)', color: s.color }}>
                {s.value}
              </p>
              <p className="text-[12px] font-semibold text-foreground leading-tight">{s.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Gráfica asistencia vacía */}
        <div className="bg-white border border-border rounded-xl p-4">
          <p className="text-[14px] font-bold text-foreground mb-4" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            Asistencia mensual
          </p>
          <div className="flex items-end justify-between gap-1" style={{ height: 100 }}>
            {months.map((m) => (
              <div key={m} className="flex flex-col items-center gap-1 flex-1">
                <div
                  className="w-full rounded-t-md"
                  style={{ height: 4, border: '1px solid rgba(120,80,200,0.15)', borderRadius: '4px 4px 0 0' }}
                />
                <span className="text-[9px] text-muted-foreground">{m}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Estado pagos vacío */}
        <div className="bg-white border border-border rounded-xl p-4">
          <p className="text-[14px] font-bold text-foreground mb-4" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            Estado de pagos
          </p>
          <div className="flex flex-col items-center py-4 gap-2">
            <BarChart2 className="w-8 h-8 text-muted-foreground/30" />
            <p className="text-[12px] text-muted-foreground">Sin datos de pagos aún</p>
          </div>
        </div>

      </div>
    </div>
  );
}
