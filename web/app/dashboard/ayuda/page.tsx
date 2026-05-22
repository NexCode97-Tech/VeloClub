'use client';

import { useSession } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import {
  LayoutDashboard, Users, CalendarCheck, CircleDollarSign,
  Trophy, CalendarDays, MapPin, BarChart2, Settings,
  CreditCard, HelpCircle,
} from 'lucide-react';

type Role = 'ADMIN' | 'COACH' | 'STUDENT';

interface ModuleInfo {
  icon: React.ElementType;
  title: string;
  description: string;
  actions: string[];
  color: string;
}

const MODULES: Record<Role, ModuleInfo[]> = {
  ADMIN: [
    {
      icon: LayoutDashboard,
      title: 'Dashboard',
      description: 'Vista general del estado del club en tiempo real.',
      color: '#4361EE',
      actions: [
        'Ver KPIs del mes: miembros activos, ingresos y asistencia.',
        'Consultar gráfica de asistencia de los últimos 6 meses.',
        'Ver distribución de pagos (al día, pendientes, vencidos).',
        'Acceso rápido a todos los módulos del club.',
      ],
    },
    {
      icon: Users,
      title: 'Miembros',
      description: 'Gestión completa de deportistas y staff del club.',
      color: '#7C3AED',
      actions: [
        'Crear, editar y eliminar miembros.',
        'Importar miembros masivamente desde un archivo Excel.',
        'Subir foto de perfil, documento de identidad y seguro.',
        'Asignar miembros a sedes específicas.',
        'Configurar día de corte de pago por miembro.',
      ],
    },
    {
      icon: CalendarCheck,
      title: 'Asistencia',
      description: 'Registro diario de asistencia por sede y fecha.',
      color: '#06D6A0',
      actions: [
        'Seleccionar fecha y sede para registrar asistencia.',
        'Marcar cada miembro como: Presente, Ausente, Excusa médica o Tarde.',
        'Filtrar la lista por sede.',
        'Los días sin asistencia configurados en Ajustes se ocultan automáticamente.',
      ],
    },
    {
      icon: CircleDollarSign,
      title: 'Finanzas',
      description: 'Control de mensualidades y flujo de caja del club.',
      color: '#FFB703',
      actions: [
        'Crear mensualidades por miembro (mes, año y monto).',
        'Cambiar el estado de un pago: Pendiente, Pagado, Vencido.',
        'Descargar factura PDF de cada pago registrado.',
        'Registrar ingresos y gastos manuales en el flujo de caja.',
        'Filtrar pagos por mes y ver totales consolidados.',
      ],
    },
    {
      icon: Trophy,
      title: 'Resultados',
      description: 'Registro de logros en competencias y entrenamientos.',
      color: '#EF476F',
      actions: [
        'Crear competencias con nombre, lugar y fecha.',
        'Añadir pruebas (eventos) dentro de cada competencia.',
        'Registrar posición y categoría de cada deportista por prueba.',
        'Crear sesiones de entrenamiento con fecha y sede.',
        'Registrar tiempo, distancia y vueltas por deportista en cada sesión.',
      ],
    },
    {
      icon: CalendarDays,
      title: 'Calendario',
      description: 'Eventos y actividades programadas del club.',
      color: '#4361EE',
      actions: [
        'Ver todos los eventos del mes en formato calendario.',
        'Crear eventos de tipo: Entrenamiento, Competencia o Reunión.',
        'Asignar eventos a una sede específica.',
        'Ver los eventos del día seleccionado en el panel lateral.',
      ],
    },
    {
      icon: MapPin,
      title: 'Sedes',
      description: 'Ubicaciones y puntos de entrenamiento del club.',
      color: '#06D6A0',
      actions: [
        'Crear, editar y eliminar sedes.',
        'Registrar nombre y dirección de cada sede.',
        'Las sedes se usan en asistencia, calendario y miembros.',
      ],
    },
    {
      icon: BarChart2,
      title: 'Reportes',
      description: 'Estadísticas e indicadores consolidados del club.',
      color: '#7C3AED',
      actions: [
        'Ver KPIs de miembros, asistencia, ingresos y logros.',
        'Consultar gráfica de asistencia mensual (6 meses).',
        'Revisar distribución de pagos del mes actual.',
        'Datos actualizados en tiempo real.',
      ],
    },
    {
      icon: Settings,
      title: 'Ajustes',
      description: 'Configuración general del club.',
      color: '#8E87A8',
      actions: [
        'Editar nombre, ciudad y departamento del club.',
        'Subir o cambiar el logo del club.',
        'Configurar los días de la semana sin asistencia (ej: domingos).',
      ],
    },
  ],

  COACH: [
    {
      icon: LayoutDashboard,
      title: 'Dashboard',
      description: 'Vista general del estado del club.',
      color: '#06D6A0',
      actions: [
        'Ver KPIs del mes: miembros, asistencia e ingresos.',
        'Consultar gráfica de asistencia de los últimos 6 meses.',
        'Acceso rápido a los módulos disponibles.',
      ],
    },
    {
      icon: Users,
      title: 'Miembros',
      description: 'Consulta y edición de datos de los deportistas.',
      color: '#7C3AED',
      actions: [
        'Ver el listado completo de miembros del club.',
        'Editar información personal y de contacto.',
        'Ver foto, documentos y sede asignada de cada miembro.',
      ],
    },
    {
      icon: CalendarCheck,
      title: 'Asistencia',
      description: 'Registro diario de asistencia.',
      color: '#4361EE',
      actions: [
        'Seleccionar fecha y sede para registrar asistencia.',
        'Marcar cada miembro como: Presente, Ausente, Excusa médica o Tarde.',
        'Filtrar la lista por sede.',
      ],
    },
    {
      icon: Trophy,
      title: 'Resultados',
      description: 'Registro de competencias y entrenamientos.',
      color: '#EF476F',
      actions: [
        'Crear competencias y añadir pruebas.',
        'Registrar posición y categoría de cada deportista.',
        'Crear sesiones de entrenamiento y registrar marcas.',
      ],
    },
    {
      icon: CalendarDays,
      title: 'Calendario',
      description: 'Eventos programados del club.',
      color: '#FFB703',
      actions: [
        'Ver todos los eventos del mes.',
        'Consultar eventos del día seleccionado.',
        'Ver a qué sede está vinculado cada evento.',
      ],
    },
    {
      icon: MapPin,
      title: 'Sedes',
      description: 'Ubicaciones del club.',
      color: '#06D6A0',
      actions: [
        'Ver el listado de sedes disponibles.',
        'Consultar nombre y dirección de cada sede.',
      ],
    },
  ],

  STUDENT: [
    {
      icon: LayoutDashboard,
      title: 'Inicio',
      description: 'Resumen del club al que perteneces.',
      color: '#7C3AED',
      actions: [
        'Ver estadísticas generales del club.',
        'Consultar información de tu equipo.',
      ],
    },
    {
      icon: Trophy,
      title: 'Resultados',
      description: 'Tus logros en competencias y entrenamientos.',
      color: '#EF476F',
      actions: [
        'Ver tus posiciones en competencias registradas.',
        'Consultar tus marcas de entrenamiento: tiempo, distancia y vueltas.',
        'Filtrar por competencia o sesión.',
      ],
    },
    {
      icon: CalendarDays,
      title: 'Calendario',
      description: 'Eventos y actividades del club.',
      color: '#4361EE',
      actions: [
        'Ver el calendario mensual de eventos.',
        'Consultar detalles del evento del día seleccionado.',
        'Ver competencias, entrenamientos y reuniones programadas.',
      ],
    },
    {
      icon: CreditCard,
      title: 'Mis Pagos',
      description: 'Estado de tus mensualidades.',
      color: '#06D6A0',
      actions: [
        'Ver el estado de cada mensualidad: Pagado, Pendiente o Vencido.',
        'Consultar la fecha de pago y el monto de cada mensualidad.',
        'Revisar el historial de pagos por año.',
      ],
    },
  ],
};

const ROLE_LABEL: Record<Role, string> = {
  ADMIN:   'Administrador',
  COACH:   'Entrenador',
  STUDENT: 'Deportista',
};

const ROLE_ACCENT: Record<Role, string> = {
  ADMIN:   '#4361EE',
  COACH:   '#06D6A0',
  STUDENT: '#7C3AED',
};

export default function AyudaPage() {
  const { session } = useSession();
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await session?.getToken();
        const res = await apiFetch<{ user?: { role: string } }>('/me', { token });
        setRole((res.user?.role ?? 'ADMIN') as Role);
      } catch {
        setRole('ADMIN');
      }
    })();
  }, [session]);

  const modules = role ? MODULES[role] : [];
  const accent  = role ? ROLE_ACCENT[role] : '#4361EE';

  return (
    <div className="min-h-full bg-background px-4 py-5">

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <HelpCircle className="w-5 h-5" style={{ color: accent }} />
          <h1
            className="text-2xl font-bold text-foreground"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            Centro de Ayuda
          </h1>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-[12px] text-muted-foreground">Guía rápida de cada módulo</p>
          {role && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: `${accent}18`, color: accent }}
            >
              {ROLE_LABEL[role]}
            </span>
          )}
        </div>
      </div>

      {/* Grid de módulos */}
      {modules.length === 0 ? (
        <div className="flex justify-center py-12">
          <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: accent, borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <div
                key={mod.title}
                className="bg-white rounded-2xl p-4 flex flex-col gap-3"
                style={{ border: '1px solid rgba(120,80,200,0.10)' }}
              >
                {/* Icono + título */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${mod.color}18`, color: mod.color }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p
                      className="text-[14px] font-bold text-foreground leading-tight"
                      style={{ fontFamily: 'var(--font-space-grotesk)' }}
                    >
                      {mod.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                      {mod.description}
                    </p>
                  </div>
                </div>

                {/* Divisor */}
                <div className="border-t border-border" />

                {/* Acciones */}
                <ul className="space-y-1.5">
                  {mod.actions.map((action, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <div
                        className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                        style={{ background: mod.color }}
                      />
                      <span className="text-[12px] text-foreground/80 leading-snug">{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
