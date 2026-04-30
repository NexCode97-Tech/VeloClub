'use client';

import Link from 'next/link';
import { TrendingUp, Trophy, CalendarDays, MapPin, BarChart2, ChevronRight } from 'lucide-react';

const MAS_ITEMS = [
  { label: 'Flujo de Caja', icon: TrendingUp,  color: '#7209B7', href: '/dashboard/flujo-caja' },
  { label: 'Logros',        icon: Trophy,      color: '#FFB703', href: '/dashboard/logros' },
  { label: 'Calendario',    icon: CalendarDays, color: '#EF476F', href: '/dashboard/calendario' },
  { label: 'Sedes',         icon: MapPin,      color: '#06D6A0', href: '/dashboard/sedes' },
  { label: 'Reportes',      icon: BarChart2,   color: '#4361EE', href: '/dashboard/reportes' },
];

export default function MasPage() {
  return (
    <div className="min-h-full bg-background px-4 py-4">
      <h1 className="text-lg font-bold text-foreground mb-4" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
        Mas opciones
      </h1>
      <div className="space-y-2">
        {MAS_ITEMS.map(({ label, icon: Icon, color, href }) => (
          <Link
            key={href}
            href={href}
            className="w-full bg-white border border-border rounded-xl px-4 py-3.5 flex items-center gap-3 active:bg-secondary transition-colors"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${color}18`, color }}
            >
              <Icon className="w-5 h-5" />
            </div>
            <span className="flex-1 text-sm font-semibold text-foreground" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
              {label}
            </span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
}
