'use client';

import { Trophy } from 'lucide-react';

export default function LogrosPage() {
  return (
    <div className="min-h-full bg-background">
      {/* Encabezado */}
      <div className="px-5 py-3 bg-background border-b border-border flex items-center justify-between">
        <h1 className="text-[17px] font-bold text-foreground" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
          Logros
        </h1>
      </div>
      <div className="flex flex-col gap-4 px-4 py-4">

        {/* Podio vacío */}
        <div className="bg-white border border-border rounded-2xl p-6 text-center">
          <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase mb-4">
            Top Deportistas
          </p>
          <div className="flex items-end justify-center gap-3 mb-4" style={{ height: 100 }}>
            {[2, 1, 3].map((pos) => {
              const heights: Record<number, number> = { 1: 80, 2: 60, 3: 50 };
              const colors: Record<number, string> = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' };
              return (
                <div key={pos} className="flex flex-col items-center gap-1.5">
                  <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
                    <span className="text-[11px] font-bold text-muted-foreground">—</span>
                  </div>
                  <div
                    className="w-16 rounded-t-lg flex items-center justify-center"
                    style={{ height: heights[pos], background: `${colors[pos]}40` }}
                  >
                    <span className="font-black text-lg" style={{ color: colors[pos], fontFamily: 'var(--font-space-grotesk)' }}>{pos}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[12px] text-muted-foreground">Sin logros registrados aún</p>
        </div>

        {/* Historial vacío */}
        <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase px-1">
          Historial
        </p>
        <div className="bg-white border border-border rounded-xl px-4 py-10 text-center">
          <Trophy className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-[13px] font-semibold text-muted-foreground">Sin logros registrados</p>
          <p className="text-[11px] text-muted-foreground mt-1">Los logros aparecerán aquí una vez se registren</p>
        </div>

      </div>
    </div>
  );
}
