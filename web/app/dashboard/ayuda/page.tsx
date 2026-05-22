'use client';

import { useSession } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import {
  LayoutDashboard, Users, CalendarCheck, CircleDollarSign,
  Trophy, CalendarDays, MapPin, BarChart2, Settings,
  CreditCard, HelpCircle, ChevronDown, ChevronUp,
  Camera, Lightbulb,
} from 'lucide-react';

type Role = 'ADMIN' | 'COACH' | 'STUDENT';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ImageSlot {
  id: string;
  /** Qué debe mostrar la captura de pantalla */
  capture: string;
  /** Qué se debe señalar/anotar en la imagen */
  annotate: string;
  /** URL real cuando el admin suba la imagen */
  src?: string;
}

interface Step {
  number: number;
  title: string;
  description: string;
  tip?: string;
  image?: ImageSlot;
}

interface ModuleGuide {
  id: string;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  color: string;
  roles: Role[];
  steps: Step[];
}

// ─── Contenido del manual ─────────────────────────────────────────────────────

const GUIDES: ModuleGuide[] = [

  // ── Primer acceso / Registro ──────────────────────────────────────────────
  {
    id: 'acceso',
    icon: HelpCircle,
    title: 'Primer acceso',
    subtitle: 'Cómo ingresar a la plataforma por primera vez.',
    color: '#7C3AED',
    roles: ['ADMIN', 'COACH', 'STUDENT'],
    steps: [
      {
        number: 1,
        title: 'Abrir la aplicación',
        description: 'Ingresa a veloclubtech.com desde el navegador de tu celular o computador. Puedes guardarla en tu pantalla de inicio para acceder más rápido.',
        image: {
          id: 'acceso-paso-1',
          capture: 'Pantalla de inicio de sesión de VeloClub (veloclubtech.com/sign-in)',
          annotate: 'Flecha apuntando al botón "Continuar con Google"',
        },
      },
      {
        number: 2,
        title: 'Iniciar sesión con Google',
        description: 'Toca el botón "Continuar con Google" e ingresa con la cuenta de correo que el administrador registró para ti. Si tu correo no está autorizado, contacta al administrador del club.',
        tip: 'Solo puedes ingresar con el correo exacto que el administrador registró en la plataforma.',
        image: {
          id: 'acceso-paso-2',
          capture: 'Ventana emergente de Google solicitando seleccionar cuenta',
          annotate: 'Flecha apuntando a la cuenta de Google correcta',
        },
      },
      {
        number: 3,
        title: 'Bienvenido al dashboard',
        description: 'Después de iniciar sesión llegarás automáticamente al panel principal. Desde aquí puedes navegar a todos los módulos disponibles según tu rol.',
        image: {
          id: 'acceso-paso-3',
          capture: 'Pantalla principal del dashboard después de iniciar sesión (rol ADMIN)',
          annotate: 'Señalar la barra de navegación lateral (escritorio) o el menú inferior (móvil)',
        },
      },
    ],
  },

  // ── Dashboard ─────────────────────────────────────────────────────────────
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    title: 'Dashboard',
    subtitle: 'Vista general del estado del club en tiempo real.',
    color: '#4361EE',
    roles: ['ADMIN', 'COACH'],
    steps: [
      {
        number: 1,
        title: 'Indicadores principales (KPIs)',
        description: 'Al ingresar verás tarjetas con los datos clave del mes: total de miembros, ingresos recaudados y asistencia. Estos números se actualizan automáticamente en tiempo real.',
        image: {
          id: 'dashboard-kpis',
          capture: 'Sección superior del dashboard mostrando las tarjetas de KPIs',
          annotate: 'Numerar cada tarjeta: 1) Miembros, 2) Ingresos, 3) Asistencia',
        },
      },
      {
        number: 2,
        title: 'Gráfica de asistencia',
        description: 'La gráfica de barras muestra el total de asistencias de los últimos 6 meses. Úsala para identificar tendencias y meses con baja participación.',
        image: {
          id: 'dashboard-grafica',
          capture: 'Gráfica de barras de asistencia mensual en el dashboard',
          annotate: 'Flecha señalando el mes con mayor asistencia como ejemplo',
        },
      },
      {
        number: 3,
        title: 'Accesos rápidos',
        description: 'En la parte inferior del dashboard encontrarás accesos directos a los módulos más usados. Toca cualquiera para ir directamente a ese módulo.',
        image: {
          id: 'dashboard-accesos',
          capture: 'Sección de accesos rápidos o cards en la parte inferior del dashboard',
          annotate: 'Flechas señalando 2 o 3 de los accesos rápidos disponibles',
        },
      },
    ],
  },

  // ── Miembros ──────────────────────────────────────────────────────────────
  {
    id: 'miembros',
    icon: Users,
    title: 'Miembros',
    subtitle: 'Registro y gestión de deportistas y staff del club.',
    color: '#7C3AED',
    roles: ['ADMIN', 'COACH'],
    steps: [
      {
        number: 1,
        title: 'Ir al módulo de Miembros',
        description: 'En el menú lateral (escritorio) o en la barra inferior (móvil), toca "Miembros". Verás el listado de todos los integrantes del club con su foto, nombre y rol.',
        image: {
          id: 'miembros-lista',
          capture: 'Pantalla principal del módulo Miembros mostrando el listado',
          annotate: 'Flecha al botón "Nuevo miembro" en la esquina superior derecha',
        },
      },
      {
        number: 2,
        title: 'Crear un nuevo miembro',
        description: 'Toca el botón "+ Nuevo miembro". Se abrirá un formulario donde debes ingresar el nombre completo, correo electrónico, teléfono y demás datos del deportista.',
        tip: 'El correo es importante — es el que el miembro usará para ingresar a la app.',
        image: {
          id: 'miembros-formulario',
          capture: 'Modal/formulario de creación de nuevo miembro abierto',
          annotate: 'Señalar el campo "Correo electrónico" y el campo "Nombre completo" con flechas numeradas',
        },
      },
      {
        number: 3,
        title: 'Asignar sede y rol',
        description: 'En el mismo formulario, selecciona la sede a la que pertenece el miembro y su rol (Deportista, Entrenador o Administrador). Luego toca "Guardar".',
        image: {
          id: 'miembros-sede-rol',
          capture: 'Parte inferior del formulario de miembro mostrando los selectores de sede y rol',
          annotate: 'Flechas a los campos "Sede" y "Rol" y al botón "Guardar"',
        },
      },
      {
        number: 4,
        title: 'Editar o eliminar un miembro',
        description: 'Toca el nombre de cualquier miembro en la lista para ver su perfil completo. Desde ahí puedes editar sus datos con el botón "Editar" o eliminarlo con el botón "Eliminar".',
        image: {
          id: 'miembros-editar',
          capture: 'Perfil de un miembro abierto mostrando los botones de acción',
          annotate: 'Flechas al botón "Editar" y al botón "Eliminar"',
        },
      },
      {
        number: 5,
        title: 'Importar miembros desde Excel',
        description: 'Si tienes muchos miembros, puedes importarlos todos de una vez. Toca el botón "Importar Excel", descarga la plantilla, llénala con los datos y súbela.',
        tip: 'Usa exactamente la plantilla que descarga la app. No cambies los nombres de las columnas.',
        image: {
          id: 'miembros-importar',
          capture: 'Pantalla de Miembros mostrando el botón "Importar Excel"',
          annotate: 'Flecha al botón "Importar Excel"',
        },
      },
    ],
  },

  // ── Asistencia ────────────────────────────────────────────────────────────
  {
    id: 'asistencia',
    icon: CalendarCheck,
    title: 'Asistencia',
    subtitle: 'Registro diario de asistencia por fecha y sede.',
    color: '#06D6A0',
    roles: ['ADMIN', 'COACH'],
    steps: [
      {
        number: 1,
        title: 'Seleccionar fecha y sede',
        description: 'Ve al módulo "Asistencia". Usa el selector de fecha para escoger el día que quieres registrar y selecciona la sede correspondiente.',
        image: {
          id: 'asistencia-filtros',
          capture: 'Módulo de Asistencia mostrando el selector de fecha y sede en la parte superior',
          annotate: 'Flecha al selector de fecha y flecha al selector de sede',
        },
      },
      {
        number: 2,
        title: 'Marcar el estado de cada miembro',
        description: 'Para cada miembro aparecen botones de estado: Presente, Ausente, Excusa médica y Tarde. Toca el estado correspondiente para cada deportista.',
        image: {
          id: 'asistencia-estados',
          capture: 'Lista de miembros con los botones de estado de asistencia visibles',
          annotate: 'Señalar los 4 estados posibles para un miembro de ejemplo: P (Presente), A (Ausente), E (Excusa), T (Tarde)',
        },
      },
      {
        number: 3,
        title: 'Guardar la asistencia',
        description: 'Una vez marcados todos los miembros, toca el botón "Guardar asistencia". El registro queda almacenado y los reportes se actualizan automáticamente.',
        tip: 'Puedes volver a editar la asistencia de cualquier día anterior ingresando esa fecha en el selector.',
        image: {
          id: 'asistencia-guardar',
          capture: 'Parte inferior de la pantalla de asistencia con el botón "Guardar asistencia"',
          annotate: 'Flecha al botón "Guardar asistencia"',
        },
      },
    ],
  },

  // ── Finanzas ──────────────────────────────────────────────────────────────
  {
    id: 'finanzas',
    icon: CircleDollarSign,
    title: 'Finanzas',
    subtitle: 'Control de mensualidades y flujo de caja.',
    color: '#FFB703',
    roles: ['ADMIN'],
    steps: [
      {
        number: 1,
        title: 'Ver el estado de pagos del mes',
        description: 'Ve a "Finanzas". Verás la lista de mensualidades del mes actual con el estado de cada miembro (Pagado, Pendiente o Vencido). Usa los filtros de mes y año para consultar periodos anteriores.',
        image: {
          id: 'finanzas-lista',
          capture: 'Módulo de Finanzas mostrando la lista de pagos del mes con sus estados',
          annotate: 'Señalar los tres estados con colores: verde (Pagado), amarillo (Pendiente), rojo (Vencido)',
        },
      },
      {
        number: 2,
        title: 'Registrar una nueva mensualidad',
        description: 'Toca "+ Nueva mensualidad". Selecciona el miembro, el mes, el año y el monto. Si el pago ya fue recibido, cambia el estado a "Pagado" antes de guardar.',
        tip: 'El mes que aparece por defecto es el mes del filtro activo. Si estás viendo febrero, el modal abre en febrero.',
        image: {
          id: 'finanzas-nueva',
          capture: 'Modal de "Nueva mensualidad" abierto con los campos visibles',
          annotate: 'Numerar los campos: 1) Miembro, 2) Mes, 3) Año, 4) Monto, 5) Estado',
        },
      },
      {
        number: 3,
        title: 'Marcar un pago como pagado',
        description: 'Si un pago ya existe pero está Pendiente, toca el botón de editar (ícono de lápiz) en ese pago, cambia el estado a "Pagado" y guarda. El sistema genera automáticamente una entrada en el flujo de caja.',
        image: {
          id: 'finanzas-editar-estado',
          capture: 'Modal de edición de pago con el selector de estado desplegado',
          annotate: 'Flecha al selector de estado y al estado "Pagado"',
        },
      },
      {
        number: 4,
        title: 'Descargar factura PDF',
        description: 'En cada pago con estado "Pagado" aparece un ícono de descarga. Tócalo para generar y descargar automáticamente la factura en PDF lista para compartir.',
        image: {
          id: 'finanzas-pdf',
          capture: 'Lista de pagos con el ícono de descarga PDF visible en un pago pagado',
          annotate: 'Flecha al ícono de descarga PDF',
        },
      },
      {
        number: 5,
        title: 'Flujo de caja: ingresos y gastos',
        description: 'En la pestaña "Flujo de caja" puedes registrar ingresos y gastos manuales del club (ej: compra de implementos, patrocinios). Los pagos de mensualidades se registran automáticamente.',
        image: {
          id: 'finanzas-flujo',
          capture: 'Pestaña o sección de Flujo de Caja mostrando el listado de entradas',
          annotate: 'Señalar la diferencia entre entradas de tipo INCOME (verde) y EXPENSE (rojo)',
        },
      },
    ],
  },

  // ── Resultados ────────────────────────────────────────────────────────────
  {
    id: 'resultados',
    icon: Trophy,
    title: 'Resultados',
    subtitle: 'Registro de logros en competencias y entrenamientos.',
    color: '#EF476F',
    roles: ['ADMIN', 'COACH'],
    steps: [
      {
        number: 1,
        title: 'Crear una competencia',
        description: 'Ve a "Resultados" y toca "+ Nueva competencia". Ingresa el nombre del evento, el lugar y la fecha. Luego toca "Guardar".',
        image: {
          id: 'resultados-nueva-competencia',
          capture: 'Módulo de Resultados con el modal de nueva competencia abierto',
          annotate: 'Numerar los campos: 1) Nombre, 2) Lugar, 3) Fecha, 4) Botón Guardar',
        },
      },
      {
        number: 2,
        title: 'Añadir pruebas a la competencia',
        description: 'Abre la competencia creada. Dentro, toca "+ Añadir prueba" para agregar cada modalidad o distancia del evento (ej: "500m", "1000m", "Persecución").',
        image: {
          id: 'resultados-pruebas',
          capture: 'Pantalla interior de una competencia con las pruebas listadas',
          annotate: 'Flecha al botón "+ Añadir prueba"',
        },
      },
      {
        number: 3,
        title: 'Registrar resultados por prueba',
        description: 'Toca una prueba para abrirla. Selecciona un miembro, ingresa su posición y categoría. Repite para cada deportista que participó en esa prueba.',
        image: {
          id: 'resultados-registrar',
          capture: 'Pantalla de resultados de una prueba con el formulario de registro abierto',
          annotate: 'Señalar: 1) Selector de miembro, 2) Campo de posición, 3) Campo de categoría',
        },
      },
      {
        number: 4,
        title: 'Crear una sesión de entrenamiento',
        description: 'En el módulo Resultados, busca la pestaña o sección "Entrenamientos". Toca "+ Nueva sesión", ingresa el título, fecha y sede. Luego guarda.',
        image: {
          id: 'resultados-sesion',
          capture: 'Formulario de nueva sesión de entrenamiento abierto',
          annotate: 'Numerar: 1) Título, 2) Fecha, 3) Sede',
        },
      },
      {
        number: 5,
        title: 'Registrar marcas de entrenamiento',
        description: 'Abre la sesión creada y toca "+ Agregar resultado". Selecciona el miembro e ingresa tiempo, distancia o vueltas según corresponda.',
        tip: 'No es obligatorio llenar todos los campos — registra solo los datos que apliquen a ese entrenamiento.',
        image: {
          id: 'resultados-marcas',
          capture: 'Formulario de resultado de entrenamiento con los campos de tiempo, distancia y vueltas',
          annotate: 'Señalar los campos: Tiempo, Distancia, Vueltas, Observaciones',
        },
      },
    ],
  },

  // ── Calendario ────────────────────────────────────────────────────────────
  {
    id: 'calendario',
    icon: CalendarDays,
    title: 'Calendario',
    subtitle: 'Eventos y actividades del club.',
    color: '#4361EE',
    roles: ['ADMIN', 'COACH', 'STUDENT'],
    steps: [
      {
        number: 1,
        title: 'Navegar el calendario',
        description: 'Ve al módulo "Calendario". Verás el mes actual con puntos de colores en los días que tienen eventos. Toca un día para ver los eventos de esa fecha en el panel lateral.',
        image: {
          id: 'calendario-vista',
          capture: 'Vista del módulo Calendario mostrando el mes con algunos días marcados',
          annotate: 'Señalar los puntos de colores en los días con eventos y el panel de eventos del día seleccionado',
        },
      },
      {
        number: 2,
        title: 'Crear un evento (solo Admin/Coach)',
        description: 'Toca el botón "+ Nuevo evento". Selecciona el tipo (Entrenamiento, Competencia o Reunión), el título, la fecha y la sede. Luego guarda.',
        image: {
          id: 'calendario-nuevo-evento',
          capture: 'Modal de creación de nuevo evento del calendario abierto',
          annotate: 'Numerar: 1) Tipo de evento, 2) Título, 3) Fecha, 4) Sede',
        },
      },
      {
        number: 3,
        title: 'Ver todos los eventos del mes',
        description: 'En la parte inferior del calendario hay una lista de todos los eventos del mes en orden cronológico. Cada uno muestra el tipo, fecha y sede.',
        image: {
          id: 'calendario-lista-mes',
          capture: 'Sección "Todo el mes" del calendario con varios eventos listados',
          annotate: 'Señalar la leyenda de colores (Competencia en rojo, Entrenamiento en azul)',
        },
      },
    ],
  },

  // ── Sedes ─────────────────────────────────────────────────────────────────
  {
    id: 'sedes',
    icon: MapPin,
    title: 'Sedes',
    subtitle: 'Ubicaciones y puntos de entrenamiento del club.',
    color: '#06D6A0',
    roles: ['ADMIN', 'COACH'],
    steps: [
      {
        number: 1,
        title: 'Ver las sedes del club',
        description: 'Ve al módulo "Sedes". Verás la lista de todas las ubicaciones registradas con su nombre y dirección.',
        image: {
          id: 'sedes-lista',
          capture: 'Módulo de Sedes mostrando la lista de sedes',
          annotate: 'Flecha al botón "+ Nueva sede"',
        },
      },
      {
        number: 2,
        title: 'Crear una sede (solo Admin)',
        description: 'Toca "+ Nueva sede". Ingresa el nombre de la ubicación y la dirección. Luego guarda. Las sedes estarán disponibles en Asistencia, Miembros y Calendario.',
        image: {
          id: 'sedes-nueva',
          capture: 'Modal de creación de nueva sede con los campos nombre y dirección',
          annotate: 'Señalar campo de Nombre y campo de Dirección',
        },
      },
    ],
  },

  // ── Reportes ──────────────────────────────────────────────────────────────
  {
    id: 'reportes',
    icon: BarChart2,
    title: 'Reportes',
    subtitle: 'Estadísticas e indicadores consolidados del club.',
    color: '#7C3AED',
    roles: ['ADMIN'],
    steps: [
      {
        number: 1,
        title: 'KPIs del club',
        description: 'Ve al módulo "Reportes". En la parte superior verás tarjetas con los indicadores clave: total de miembros, asistencia del mes, ingresos y porcentaje de pagos al día.',
        image: {
          id: 'reportes-kpis',
          capture: 'Sección de KPIs del módulo Reportes',
          annotate: 'Numerar las 4 tarjetas de KPI principales',
        },
      },
      {
        number: 2,
        title: 'Gráfica de asistencia histórica',
        description: 'La gráfica de barras muestra los asistentes de los últimos 6 meses. Úsala para detectar meses con baja asistencia y tomar acciones.',
        image: {
          id: 'reportes-grafica-asistencia',
          capture: 'Gráfica de barras de asistencia en el módulo Reportes',
          annotate: 'Señalar el eje Y (cantidad) y el eje X (meses)',
        },
      },
      {
        number: 3,
        title: 'Distribución de pagos',
        description: 'La gráfica circular muestra qué porcentaje de miembros está al día, pendiente o vencido en sus pagos del mes actual.',
        image: {
          id: 'reportes-pagos-pie',
          capture: 'Gráfica circular de distribución de pagos en Reportes',
          annotate: 'Señalar cada segmento: verde (Pagado), amarillo (Pendiente), rojo (Vencido)',
        },
      },
    ],
  },

  // ── Ajustes ───────────────────────────────────────────────────────────────
  {
    id: 'ajustes',
    icon: Settings,
    title: 'Ajustes',
    subtitle: 'Configuración general del club.',
    color: '#8E87A8',
    roles: ['ADMIN'],
    steps: [
      {
        number: 1,
        title: 'Editar la información del club',
        description: 'Ve a "Ajustes" (en el menú inferior en móvil, o en la sección Más en escritorio). Puedes cambiar el nombre, ciudad y departamento del club.',
        image: {
          id: 'ajustes-info',
          capture: 'Módulo de Ajustes mostrando los campos de nombre y ciudad del club',
          annotate: 'Señalar los campos editables de nombre, ciudad y departamento',
        },
      },
      {
        number: 2,
        title: 'Subir o cambiar el logo',
        description: 'Toca la imagen del logo actual (o el espacio vacío si no hay logo). Se abrirá un selector de imagen. Elige la foto, ajusta el recorte y guarda.',
        image: {
          id: 'ajustes-logo',
          capture: 'Sección del logo en Ajustes con el área de carga visible',
          annotate: 'Flecha al área de carga del logo',
        },
      },
      {
        number: 3,
        title: 'Configurar días sin asistencia',
        description: 'En la sección "Días sin asistencia" puedes marcar los días de la semana en que el club no entrena (ej: domingos). Esos días no aparecerán en el módulo de Asistencia.',
        image: {
          id: 'ajustes-dias',
          capture: 'Sección de días sin asistencia en Ajustes con los selectores de días de la semana',
          annotate: 'Señalar los selectores de días y uno marcado como ejemplo',
        },
      },
    ],
  },

  // ── Mis Pagos (STUDENT) ───────────────────────────────────────────────────
  {
    id: 'mis-pagos',
    icon: CreditCard,
    title: 'Mis Pagos',
    subtitle: 'Consulta el estado de tus mensualidades.',
    color: '#06D6A0',
    roles: ['STUDENT'],
    steps: [
      {
        number: 1,
        title: 'Ver el estado de tus pagos',
        description: 'Ve a "Mis Pagos" en el menú. Verás el historial de tus mensualidades con el estado de cada una: Pagado (verde), Pendiente (amarillo) o Vencido (rojo).',
        image: {
          id: 'pagos-lista',
          capture: 'Módulo "Mis Pagos" mostrando el listado de mensualidades del deportista',
          annotate: 'Señalar los tres estados posibles con sus colores correspondientes',
        },
      },
      {
        number: 2,
        title: 'Filtrar por año',
        description: 'Usa el selector de año en la parte superior para ver los pagos de años anteriores y llevar un historial completo.',
        image: {
          id: 'pagos-filtro',
          capture: 'Parte superior del módulo Mis Pagos con el filtro de año visible',
          annotate: 'Flecha al selector de año',
        },
      },
    ],
  },

  // ── Resultados (STUDENT) ──────────────────────────────────────────────────
  {
    id: 'resultados-student',
    icon: Trophy,
    title: 'Mis Resultados',
    subtitle: 'Consulta tus logros en competencias y entrenamientos.',
    color: '#EF476F',
    roles: ['STUDENT'],
    steps: [
      {
        number: 1,
        title: 'Ver tus competencias',
        description: 'En "Resultados" verás las competencias en las que participaste con tu posición y categoría en cada prueba.',
        image: {
          id: 'resultados-student-comp',
          capture: 'Módulo Resultados desde la vista de un deportista (STUDENT)',
          annotate: 'Señalar la tarjeta de competencia y los campos de posición y categoría',
        },
      },
      {
        number: 2,
        title: 'Ver tus marcas de entrenamiento',
        description: 'En la sección de entrenamientos verás tus tiempos, distancias y vueltas registradas en cada sesión por tu entrenador.',
        image: {
          id: 'resultados-student-entreno',
          capture: 'Sección de entrenamientos en la vista del deportista',
          annotate: 'Señalar los campos de tiempo, distancia y vueltas',
        },
      },
    ],
  },
];

// ─── Utilidades ───────────────────────────────────────────────────────────────

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

// ─── Componente: slot de imagen ───────────────────────────────────────────────

function ImageSlotView({ slot }: { slot: ImageSlot }) {
  if (slot.src) {
    return (
      <div className="mt-3 rounded-xl overflow-hidden border border-border">
        <img src={slot.src} alt={slot.capture} className="w-full object-cover" />
      </div>
    );
  }

  // Placeholder mientras no hay imagen
  return (
    <div
      className="mt-3 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 py-6 px-4 text-center"
      style={{ borderColor: 'rgba(120,80,200,0.25)', background: 'rgba(120,80,200,0.04)' }}
    >
      <Camera className="w-7 h-7" style={{ color: 'rgba(120,80,200,0.4)' }} />
      <div>
        <p className="text-[11px] font-bold" style={{ color: 'rgba(120,80,200,0.6)' }}>
          CAPTURA PENDIENTE · {slot.id}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          📷 <span className="font-semibold">Mostrar:</span> {slot.capture}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          🎯 <span className="font-semibold">Señalar:</span> {slot.annotate}
        </p>
      </div>
    </div>
  );
}

// ─── Componente: tarjeta de módulo expandible ─────────────────────────────────

function ModuleCard({ guide, accent }: { guide: ModuleGuide; accent: string }) {
  const [open, setOpen] = useState(false);
  const Icon = guide.icon;

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden"
      style={{ border: '1px solid rgba(120,80,200,0.10)' }}
    >
      {/* Cabecera — siempre visible */}
      <button
        className="w-full flex items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50"
        onClick={() => setOpen(o => !o)}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${guide.color}18`, color: guide.color }}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="text-[14px] font-bold text-foreground"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            {guide.title}
          </p>
          <p className="text-[11px] text-muted-foreground">{guide.subtitle}</p>
        </div>
        <div className="shrink-0 text-muted-foreground">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Contenido expandido */}
      {open && (
        <div className="px-4 pb-5 border-t border-border">
          <div className="space-y-6 pt-4">
            {guide.steps.map((step) => (
              <div key={step.number} className="flex gap-3">
                {/* Número de paso */}
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[12px] font-bold shrink-0 mt-0.5"
                  style={{ background: guide.color }}
                >
                  {step.number}
                </div>

                {/* Contenido del paso */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[13px] font-bold text-foreground mb-1"
                    style={{ fontFamily: 'var(--font-space-grotesk)' }}
                  >
                    {step.title}
                  </p>
                  <p className="text-[12px] text-foreground/80 leading-relaxed">
                    {step.description}
                  </p>

                  {/* Tip */}
                  {step.tip && (
                    <div
                      className="flex items-start gap-2 mt-2 px-3 py-2 rounded-lg"
                      style={{ background: `${accent}0D` }}
                    >
                      <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: accent }} />
                      <p className="text-[11px] leading-relaxed" style={{ color: accent }}>
                        {step.tip}
                      </p>
                    </div>
                  )}

                  {/* Slot de imagen */}
                  {step.image && <ImageSlotView slot={step.image} />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

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

  const accent   = role ? ROLE_ACCENT[role] : '#4361EE';
  const guides   = role ? GUIDES.filter(g => g.roles.includes(role)) : [];
  const totalImg = guides.reduce((n, g) => n + g.steps.filter(s => s.image).length, 0);
  const pending  = guides.reduce((n, g) => n + g.steps.filter(s => s.image && !s.image.src).length, 0);

  return (
    <div className="min-h-full bg-background px-4 py-5 pb-10">

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
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <p className="text-[12px] text-muted-foreground">Guía paso a paso de cada módulo</p>
          {role && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: `${accent}18`, color: accent }}
            >
              {ROLE_LABEL[role]}
            </span>
          )}
          {pending > 0 && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
              {pending}/{totalImg} imágenes pendientes
            </span>
          )}
        </div>
      </div>

      {/* Módulos */}
      {guides.length === 0 ? (
        <div className="flex justify-center py-12">
          <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: accent, borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <div className="space-y-3">
          {guides.map(guide => (
            <ModuleCard key={guide.id} guide={guide} accent={accent} />
          ))}
        </div>
      )}
    </div>
  );
}
