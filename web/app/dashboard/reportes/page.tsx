'use client';

const fmt = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
  notation: 'compact',
  compactDisplay: 'short',
} as Intl.NumberFormatOptions);

const stats = [
  { label: 'Tasa asistencia', value: '75%',  sub: 'Ultimos 30 dias', color: '#4361EE' },
  { label: 'Ingresos mes',    value: '$1.3M', sub: 'Abril 2026',      color: '#06D6A0' },
  { label: 'Pagos al dia',    value: '66%',  sub: '4 de 6',          color: '#FFB703' },
  { label: 'Logros totales',  value: '5',    sub: 'Este ano',         color: '#7209B7' },
];

const attendanceData = [
  { month: 'Ene', value: 65 },
  { month: 'Feb', value: 72 },
  { month: 'Mar', value: 58 },
  { month: 'Abr', value: 75 },
  { month: 'May', value: 0  },
  { month: 'Jun', value: 0  },
];

const maxAttendance = Math.max(...attendanceData.map((d) => d.value));
const BAR_HEIGHT    = 80;

const paymentStatus = [
  { label: 'Pagados',    count: 4, color: '#06D6A0' },
  { label: 'Pendientes', count: 1, color: '#FFB703' },
  { label: 'Vencidos',   count: 1, color: '#EF476F' },
];
const totalPayments = 6;

export default function ReportesPage() {
  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div className="px-5 py-3 bg-background border-b border-border">
        <h1 className="text-[17px] font-bold text-foreground" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
          Reportes
        </h1>
      </div>
      <div className="flex flex-col gap-4 px-4 py-4">

      {/* 2x2 stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-card border border-border rounded-xl px-4 py-3.5"
          >
            <p
              className="text-2xl font-extrabold mb-0.5"
              style={{ fontFamily: 'var(--font-space-grotesk)', color: s.color }}
            >
              {s.value}
            </p>
            <p className="text-[12px] font-semibold text-foreground leading-tight">{s.label}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Attendance bar chart */}
      <div className="bg-card border border-border rounded-xl p-4">
        <p
          className="text-[14px] font-bold text-foreground mb-4"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          Asistencia mensual
        </p>
        <div className="flex items-end justify-between gap-1" style={{ height: `${BAR_HEIGHT + 20}px` }}>
          {attendanceData.map((d) => {
            const isCurrentMonth = d.month === 'Abr';
            const isEmpty        = d.value === 0;
            const barH           = isEmpty ? 4 : Math.max(6, (d.value / maxAttendance) * BAR_HEIGHT);

            return (
              <div key={d.month} className="flex flex-col items-center gap-1 flex-1">
                <div
                  className="w-full rounded-t-md"
                  style={{
                    height: `${barH}px`,
                    background: isEmpty
                      ? 'transparent'
                      : isCurrentMonth
                      ? 'linear-gradient(180deg,#4361EE,#7209B7)'
                      : 'rgba(67,97,238,0.4)',
                    border: isEmpty ? '1px solid rgba(120,80,200,0.15)' : 'none',
                    borderRadius: '4px 4px 0 0',
                  }}
                />
                <span className="text-[9px] text-muted-foreground">{d.month}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Payment status breakdown */}
      <div className="bg-card border border-border rounded-xl p-4">
        <p
          className="text-[14px] font-bold text-foreground mb-4"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          Estado de pagos
        </p>
        <div className="flex flex-col gap-3">
          {paymentStatus.map((ps) => {
            const pct = Math.round((ps.count / totalPayments) * 100);
            return (
              <div key={ps.label} className="flex items-center gap-3">
                {/* Colored dot */}
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: ps.color }}
                />
                {/* Label */}
                <span className="text-[12px] text-foreground flex-1">{ps.label}</span>
                {/* Count */}
                <span
                  className="text-[13px] font-bold w-5 text-right shrink-0"
                  style={{ fontFamily: 'var(--font-space-grotesk)', color: ps.color }}
                >
                  {ps.count}
                </span>
                {/* Mini progress bar */}
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ width: '80px', background: 'rgba(120,80,200,0.10)' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: ps.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </div>
    </div>
  );
}
