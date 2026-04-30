'use client';

const logros = [
  { member: 'Valentina Rios',  event: 'Copa Regional',      position: 1, category: 'Juvenil A',  date: '2026-03-15' },
  { member: 'Mateo Gonzalez',  event: 'Campeonato Dpto.',   position: 2, category: 'Mayores',    date: '2026-03-15' },
  { member: 'Isabella Castro', event: 'Copa Regional',      position: 3, category: 'Juvenil A',  date: '2026-03-15' },
  { member: 'Santiago Mora',   event: 'Torneo Infantil',    position: 1, category: 'Infantil B', date: '2026-02-20' },
  { member: 'Sofia Herrera',   event: 'Torneo Infantil',    position: 2, category: 'Infantil A', date: '2026-02-20' },
];

const positionConfig: Record<number, { color: string; gradient: string; medal: string }> = {
  1: { color: '#FFB703', gradient: 'linear-gradient(180deg,#FFD700,#FFB703)', medal: '🥇' },
  2: { color: '#C0C0C0', gradient: 'linear-gradient(180deg,#D8D8D8,#C0C0C0)', medal: '🥈' },
  3: { color: '#CD7F32', gradient: 'linear-gradient(180deg,#D4956A,#CD7F32)', medal: '🥉' },
};

const podiumOrder = [2, 1, 3]; // left=2nd, center=1st, right=3rd
const podiumHeights: Record<number, number> = { 1: 80, 2: 60, 3: 50 };

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('');
}

const top3 = logros.filter((l) => l.position <= 3 && l.event === 'Copa Regional');
// Ensure we have one entry per position from full list for podium
const podiumData: Record<number, typeof logros[0]> = {};
for (const l of logros) {
  if (l.position <= 3 && !podiumData[l.position]) {
    podiumData[l.position] = l;
  }
}

export default function LogrosPage() {
  return (
    <div className="flex flex-col gap-4 px-4 py-5 max-w-lg mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1
          className="text-2xl font-bold text-foreground"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          Logros
        </h1>
      </div>

      {/* Podium card */}
      <div className="bg-card border border-border rounded-2xl p-4 text-center">
        <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase mb-4">
          Top Deportistas
        </p>

        <div className="flex items-end justify-center gap-3">
          {podiumOrder.map((pos) => {
            const entry = podiumData[pos];
            const cfg = positionConfig[pos];
            const height = podiumHeights[pos];
            if (!entry) return null;
            return (
              <div key={pos} className="flex flex-col items-center gap-1.5">
                {/* Avatar */}
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg,#7C3AED,#4361EE)' }}
                >
                  <span className="text-[11px] font-bold text-white">{getInitials(entry.member)}</span>
                </div>
                {/* First name */}
                <p className="text-[11px] font-semibold text-foreground">
                  {entry.member.split(' ')[0]}
                </p>
                {/* Bar */}
                <div
                  className="w-16 rounded-t-lg flex items-center justify-center"
                  style={{ height: `${height}px`, background: cfg.gradient }}
                >
                  <span className="text-white font-black text-lg" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                    {pos}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Historial section */}
      <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase px-1">
        Historial
      </p>

      <div className="flex flex-col gap-2">
        {logros.map((l, i) => {
          const cfg = positionConfig[l.position] ?? { color: '#8E87A8', medal: '🏅' };
          return (
            <div
              key={i}
              className="flex items-center gap-3 bg-card border border-border rounded-xl px-3 py-3"
            >
              {/* Medal */}
              <span className="text-2xl shrink-0">{cfg.medal}</span>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-foreground truncate">{l.member}</p>
                <p className="text-[11px] text-muted-foreground truncate">{l.event}</p>
                <span
                  className="text-[10px] font-semibold"
                  style={{ color: '#4361EE' }}
                >
                  {l.category}
                </span>
              </div>

              {/* Date + position */}
              <div className="flex flex-col items-end gap-0.5 shrink-0">
                <p className="text-[10px] text-muted-foreground">{l.date}</p>
                <p
                  className="text-xl font-black"
                  style={{ fontFamily: 'var(--font-space-grotesk)', color: cfg.color }}
                >
                  #{l.position}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
