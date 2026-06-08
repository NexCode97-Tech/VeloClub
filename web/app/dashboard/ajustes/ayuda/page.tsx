'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronDown } from 'lucide-react';

const HELP_GUIDES = [
  {
    id: 'miembros', color: '#7C3AED', title: 'Miembros',
    subtitle: 'Registro y gestión de deportistas y staff.',
    steps: [
      { n: 1, t: 'Crear un miembro', d: 'Toca "+ Nuevo". Completa nombre, correo, teléfono y sede. El correo es el que usará para ingresar.' },
      { n: 2, t: 'Editar o ver info', d: 'Toca el ícono de ojo para ver el perfil completo, o el lápiz para editar datos.' },
      { n: 3, t: 'Importar desde Excel', d: 'Usa el botón "Importar", descarga la plantilla, llénala y súbela. No cambies los nombres de columnas.' },
    ],
  },
  {
    id: 'finanzas', color: '#FFB703', title: 'Finanzas',
    subtitle: 'Control de mensualidades y flujo de caja.',
    steps: [
      { n: 1, t: 'Configurar tarifa', d: 'En Mensualidades toca el ícono de ajustes de cada deportista. Ingresa la tarifa mensual y el día de cobro.' },
      { n: 2, t: 'Cobrar mensualidad', d: 'Toca "Cobrar" para generar el cobro como pendiente. Luego usa WhatsApp para notificar y toca "Pagado" cuando recibas el pago.' },
      { n: 3, t: 'Generar cobros del mes', d: 'El botón "Generar cobros" crea automáticamente los cobros pendientes para todos los deportistas configurados.' },
      { n: 4, t: 'Flujo de caja', d: 'En la pestaña Flujo de Caja registra ingresos y gastos manuales. Los pagos de mensualidades se agregan automáticamente.' },
    ],
  },
  {
    id: 'asistencia', color: '#06D6A0', title: 'Asistencia',
    subtitle: 'Registro diario por fecha y sede.',
    steps: [
      { n: 1, t: 'Seleccionar fecha y sede', d: 'Elige el día y la sede. La lista de deportistas se filtra automáticamente.' },
      { n: 2, t: 'Marcar estados', d: 'Para cada deportista toca: P (Presente), A (Ausente), E (Excusa médica) o T (Tarde).' },
      { n: 3, t: 'Guardar', d: 'Toca "Guardar asistencia". Puedes editar cualquier día anterior volviendo a esa fecha.' },
    ],
  },
  {
    id: 'ajustes-club', color: '#8E87A8', title: 'Ajustes del club',
    subtitle: 'Configuración general del club.',
    steps: [
      { n: 1, t: 'Editar información', d: 'Cambia el nombre, ciudad y departamento del club desde la pantalla de Ajustes.' },
      { n: 2, t: 'Logo del club', d: 'Toca el área del logo para subir o cambiar la imagen. Se recorta automáticamente en formato cuadrado.' },
      { n: 3, t: 'Días sin asistencia', d: 'Marca los días de la semana en que el club no entrena. Esos días no aparecerán en el módulo de Asistencia.' },
    ],
  },
];

function HelpCard({ guide }: { guide: typeof HELP_GUIDES[0] }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden"
      style={{ border: '1px solid rgba(120,80,200,0.10)' }}
    >
      <button
        className="w-full flex items-center gap-3 px-4 py-4 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${guide.color}18` }}
        >
          <span className="text-[13px] font-extrabold" style={{ color: guide.color }}>
            {guide.title[0]}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold" style={{ color: '#1A1523' }}>{guide.title}</p>
          <p className="text-[11px] mt-0.5" style={{ color: '#8E87A8' }}>{guide.subtitle}</p>
        </div>
        <ChevronDown
          className={`w-4 h-4 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          style={{ color: '#8E87A8' }}
        />
      </button>

      {open && (
        <div
          className="px-4 pb-5 pt-4 space-y-4"
          style={{ borderTop: '1px solid rgba(120,80,200,0.08)' }}
        >
          {guide.steps.map(s => (
            <div key={s.n} className="flex gap-3">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0 mt-0.5"
                style={{ background: guide.color }}
              >
                {s.n}
              </div>
              <div>
                <p className="text-[12px] font-bold" style={{ color: '#1A1523' }}>{s.t}</p>
                <p className="text-[11px] leading-relaxed mt-0.5" style={{ color: '#8E87A8' }}>{s.d}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AyudaPage() {
  const router = useRouter();

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div className="px-5 py-3 bg-background border-b border-border flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-secondary transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <h1
          className="text-[17px] font-bold text-foreground"
          style={{ fontFamily: "'Open Sans', sans-serif" }}
        >
          Centro de ayuda
        </h1>
      </div>

      {/* Content */}
      <div className="px-4 pt-5 pb-28 space-y-2 max-w-lg">
        <p className="text-[12px] px-1 mb-4" style={{ color: '#8E87A8' }}>
          Guía rápida para cada módulo de VeloClub. Toca cualquier sección para ver los pasos.
        </p>
        {HELP_GUIDES.map(g => (
          <HelpCard key={g.id} guide={g} />
        ))}
      </div>
    </div>
  );
}
