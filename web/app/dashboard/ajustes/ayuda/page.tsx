'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';

type Role = 'ADMIN' | 'COACH' | 'STUDENT';

const HELP_GUIDES = [
  {
    id: 'inicio', color: '#4361EE', title: 'Inicio', roles: ['ADMIN', 'COACH', 'STUDENT'] as Role[],
    subtitle: 'Resumen general del club.',
    steps: [
      { n: 1, t: 'Ver el resumen', d: 'Revisa indicadores rápidos, próximos eventos y cumpleaños del mes en un solo vistazo.' },
      { n: 2, t: 'Ir a un módulo', d: 'Usa los accesos rápidos o el menú lateral/inferior para saltar a Miembros, Finanzas, Asistencia, etc.' },
    ],
  },
  {
    id: 'miembros', color: '#7C3AED', title: 'Miembros', roles: ['ADMIN', 'COACH'] as Role[],
    subtitle: 'Registro y gestión de deportistas y staff.',
    steps: [
      { n: 1, t: 'Crear un miembro', d: 'Toca "+ Nuevo". Completa nombre, correo, teléfono y sede. El correo es el que usará para ingresar.' },
      { n: 2, t: 'Editar o ver info', d: 'Toca el ícono de ojo para ver el perfil completo, o el lápiz para editar datos.' },
      { n: 3, t: 'Importar desde Excel', d: 'Usa el botón "Importar", descarga la plantilla, llénala y súbela. No cambies los nombres de columnas.' },
    ],
  },
  {
    id: 'sedes', color: '#06D6A0', title: 'Sedes', roles: ['ADMIN', 'COACH', 'STUDENT'] as Role[],
    subtitle: 'Lugares de entrenamiento del club.',
    steps: [
      { n: 1, t: 'Crear una sede', d: 'Toca "Nueva sede". Completa el nombre (ej. "Sede Norte") y busca el municipio.' },
      { n: 2, t: 'Ubicación en el mapa', d: 'Usa "Seleccionar en el mapa" para guardar la ubicación GPS exacta.' },
      { n: 3, t: 'Editar o eliminar', d: 'Usa los íconos de lápiz y papelera junto a cada sede para modificarla o eliminarla.' },
    ],
  },
  {
    id: 'asistencia', color: '#06D6A0', title: 'Asistencia', roles: ['ADMIN', 'COACH'] as Role[],
    subtitle: 'Registro diario por fecha y sede.',
    steps: [
      { n: 1, t: 'Seleccionar fecha y sede', d: 'Elige el día y la sede. La lista de deportistas se filtra automáticamente.' },
      { n: 2, t: 'Marcar estados', d: 'Para cada deportista toca: P (Presente), A (Ausente), E (Excusa médica) o T (Tarde).' },
      { n: 3, t: 'Guardar', d: 'Toca "Guardar asistencia". Puedes editar cualquier día anterior volviendo a esa fecha.' },
    ],
  },
  {
    id: 'finanzas', color: '#FFB703', title: 'Finanzas', roles: ['ADMIN'] as Role[],
    subtitle: 'Control de mensualidades y flujo de caja.',
    steps: [
      { n: 1, t: 'Configurar tarifa', d: 'En Mensualidades toca el ícono de ajustes de cada deportista. Ingresa la tarifa mensual y el día de cobro.' },
      { n: 2, t: 'Cobrar mensualidad', d: 'Toca "Cobrar" para generar el cobro como pendiente. Luego usa WhatsApp para notificar y toca "Pagado" cuando recibas el pago.' },
      { n: 3, t: 'Generar cobros del mes', d: 'El botón "Generar cobros" crea automáticamente los cobros pendientes para todos los deportistas configurados.' },
      { n: 4, t: 'Flujo de caja', d: 'En la pestaña Flujo de Caja registra ingresos y gastos manuales. Los pagos de mensualidades se agregan automáticamente.' },
    ],
  },
  {
    id: 'pagos', color: '#FFB703', title: 'Mis pagos', roles: ['STUDENT'] as Role[],
    subtitle: 'Historial de tus mensualidades.',
    steps: [
      { n: 1, t: 'Revisar tu estado', d: 'Consulta "Por pagar" y "Total pagado" en la parte superior de la pantalla.' },
      { n: 2, t: 'Ver historial', d: 'Desplázate por el historial completo de pagos registrados por tu club.' },
    ],
  },
  {
    id: 'rendimiento', color: '#F59E0B', title: 'Rendimiento', roles: ['ADMIN', 'COACH', 'STUDENT'] as Role[],
    subtitle: 'Competencias y entrenamientos.',
    steps: [
      { n: 1, t: 'Cambiar de pestaña', d: 'Alterna entre "Competencias" y "Entrenamientos" en la parte superior.' },
      { n: 2, t: 'Crear un registro', d: 'Toca "Nueva competencia" o "Nuevo entrenamiento" y completa nombre, fecha y sede/ubicación.' },
      { n: 3, t: 'Eliminar', d: 'Elimina un registro con el ícono de papelera; se te pedirá confirmación antes de borrar sus resultados.' },
    ],
  },
  {
    id: 'calendario', color: '#EF476F', title: 'Calendario', roles: ['ADMIN', 'COACH', 'STUDENT'] as Role[],
    subtitle: 'Próximos entrenamientos y competencias.',
    steps: [
      { n: 1, t: 'Navegar por mes', d: 'Usa las flechas junto al nombre del mes para moverte entre meses.' },
      { n: 2, t: 'Ver eventos de un día', d: 'Toca un día del calendario para ver los eventos programados en esa fecha.' },
      { n: 3, t: 'Ver el mes completo', d: 'Revisa el listado con todos los eventos del mes debajo del calendario.' },
    ],
  },
  {
    id: 'analiticas', color: '#4361EE', title: 'Analíticas', roles: ['ADMIN'] as Role[],
    subtitle: 'Métricas de asistencia y finanzas.',
    steps: [
      { n: 1, t: 'Indicadores clave', d: 'Revisa las tarjetas de "Asistencia hoy", "Ingresos mes", "Pagos al día" y "Asistencia mes".' },
      { n: 2, t: 'Tendencia de asistencia', d: 'Consulta el gráfico de asistencia de los últimos 6 meses.' },
    ],
  },
  {
    id: 'club', color: '#7C3AED', title: 'Club', roles: ['ADMIN', 'COACH', 'STUDENT'] as Role[],
    subtitle: 'Perfil público de tu club.',
    steps: [
      { n: 1, t: 'Cambiar de pestaña', d: 'Alterna entre "Publicaciones" y "Contacto" para ver la actividad o los datos del club.' },
      { n: 2, t: 'Editar el perfil', d: 'Si eres administrador, toca "Editar" para actualizar datos o "Cambiar foto" para el logo.' },
      { n: 3, t: 'Estadísticas', d: 'Consulta el número de publicaciones, seguidores y miembros del club.' },
    ],
  },
  {
    id: 'mi-perfil', color: '#7C3AED', title: 'Mi perfil', roles: ['ADMIN', 'COACH', 'STUDENT'] as Role[],
    subtitle: 'Tu información personal.',
    steps: [
      { n: 1, t: 'Publicar y ver fotos', d: 'Alterna entre "Publicaciones" y "Fotos" para compartir novedades o revisar tu galería.' },
      { n: 2, t: 'Editar contacto', d: 'Toca el ícono de edición junto a "Información de contacto" para actualizar tu teléfono y correo.' },
    ],
  },
  {
    id: 'ajustes-club', color: '#8E87A8', title: 'Ajustes del club', roles: ['ADMIN'] as Role[],
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
      className="bg-white rounded-2xl overflow-hidden h-fit"
      style={{ border: '1px solid rgba(120,80,200,0.10)' }}
    >
      <button
        className="w-full flex items-center gap-3 px-4 py-4 lg:px-5 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div
          className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${guide.color}18` }}
        >
          <span className="text-[13px] lg:text-[14px] font-extrabold" style={{ color: guide.color }}>
            {guide.title[0]}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] lg:text-[14px] font-bold" style={{ color: '#1A1523' }}>{guide.title}</p>
          <p className="text-[11px] mt-0.5" style={{ color: '#8E87A8' }}>{guide.subtitle}</p>
        </div>
        <ChevronDown
          className={`w-4 h-4 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          style={{ color: '#8E87A8' }}
        />
      </button>

      {open && (
        <div
          className="px-4 pb-5 pt-4 lg:px-5 space-y-4"
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
  const { getToken } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      const me = await apiFetch<{ user?: { role: Role } }>('/me', { token });
      setRole(me.user?.role ?? null);
      setLoading(false);
    })();
  }, []);

  const guides = role ? HELP_GUIDES.filter(g => g.roles.includes(role)) : HELP_GUIDES;

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div className="px-5 pt-3 lg:px-8 lg:pt-5 bg-background flex items-center gap-3 max-w-4xl mx-auto">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-secondary transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <h1
          className="text-[17px] lg:text-[20px] font-bold text-foreground"
          style={{ fontFamily: 'inherit' }}
        >
          Centro de ayuda
        </h1>
      </div>

      {/* Content */}
      <div className="px-4 pt-2 pb-28 lg:px-8 lg:pt-3 lg:pb-10 max-w-4xl mx-auto">
        <p className="text-[12px] px-1 mb-4 lg:text-[13px] lg:mb-6" style={{ color: '#8E87A8' }}>
          Guía rápida para cada módulo de VeloClub. Toca cualquier sección para ver los pasos.
        </p>
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : (
          <div className="space-y-2 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
            {guides.map(g => (
              <HelpCard key={g.id} guide={g} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
