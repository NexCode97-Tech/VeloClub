'use client';

import { useAuth } from '@clerk/nextjs';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiFetch } from '@/lib/api-client';
import { QK } from '@/hooks/useVeloQuery';
import { horaLegible } from '@/components/ajustes/horario-clases';
import { DIA_CORTO_3 } from '@/lib/dias';
import { Users, MapPin, CheckCircle2, Search, Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react';
const EASE_OUT: [number,number,number,number] = [0.23, 1, 0.32, 1];
import { MemberAvatar } from '@/components/ui/member-avatar';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { stagger, cardVariant } from '@/lib/page-animations';
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select';
import { Desplegable } from '@/components/ui/desplegable';
import { BotonFiltros, ChipsFiltros, type GrupoFiltro } from '@/components/ui/filtros';
import ModuleLoader, { useCargaMinima } from '@/components/ui/module-loader';
import ModuleReveal from '@/components/ui/module-reveal';
import { ContenidoGuardado } from '@/components/ui/save-button-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { useClubSettings } from '@/hooks/useVeloQuery';
import {
  descargarAsistenciaPDF, descargarAsistenciaExcel,
  type ReporteAsistencia,
} from '@/lib/attendance-report';

interface Member {
  id: string;
  fullName: string;
  category?: string;
  tipo?: string;
  role: string;
  active?: boolean;
  pictureUrl?: string | null;
  locations: { location: { id: string; name: string } }[];
}
interface ClaseDia {
  id: string;
  nombre: string;
  hora: string;
  categoria: string | null;
  locationId: string;
  location: { id: string; name: string };
  diaSemana: number;
  // Solo viene en /clases/dia; el horario completo no la trae.
  guardada?: boolean;
}

interface Location { id: string; name: string }
interface AttRecord { memberId: string; status: Status }

type Status = 'PRESENT' | 'LATE' | 'ABSENT' | 'MEDICAL_EXCUSE';
const CYCLE: Status[] = ['PRESENT', 'LATE', 'ABSENT', 'MEDICAL_EXCUSE'];
// Orden del ciclo al tocar un deportista. Todos arrancan en Ausente, así que
// el primer toque los marca Presente (el flujo más común al pasar lista).
const TOGGLE_CYCLE: Status[] = ['ABSENT', 'PRESENT', 'LATE', 'MEDICAL_EXCUSE'];
const STATUS_LABEL: Record<Status, string> = { PRESENT: 'P', LATE: 'T', ABSENT: 'A', MEDICAL_EXCUSE: 'M' };
const STATUS_COLOR: Record<Status, string> = { PRESENT: '#06D6A0', LATE: '#FFB703', ABSENT: '#EF476F', MEDICAL_EXCUSE: '#8B8FA8' };
const STATUS_NAME: Record<Status, string>  = { PRESENT: 'Presente', LATE: 'Tarde', ABSENT: 'Ausente', MEDICAL_EXCUSE: 'Excusa médica' };
const ROLE_BG: Record<string, string> = {
  ENTRENADOR: 'linear-gradient(135deg,#06D6A0,#0CB68D)',
  ADMIN: 'linear-gradient(135deg,#FFB703,#FB8500)',
};

const DAY_NAMES   = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const DAY_LABELS  = DIA_CORTO_3;

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function avatarBg(role: string) { return ROLE_BG[role] ?? '#381DA0'; }

/** ISO strings para cada día de la semana actual (Dom→Sáb) */
function getWeekDates(): string[] {
  const today = new Date();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });
}

// ── WeekStrip ──────────────────────────────────────────────────────────────────
function WeekStrip({
  weekSaved,
  todayStr,
  selectedDate,
  onSelect,
  animatingToday,
}: {
  weekSaved: Set<string>;
  todayStr: string;
  selectedDate: string;
  onSelect: (date: string) => void;
  animatingToday: boolean;
}) {
  const weekDates = getWeekDates();
  const todayIdx  = weekDates.indexOf(todayStr);

  return (
    <div className="flex justify-between items-end px-1">
      {weekDates.map((date, i) => {
        const isToday    = date === todayStr;
        const isFuture   = i > todayIdx;
        const isSaved    = weekSaved.has(date);
        const isSelected = date === selectedDate;
        const isAnimating = isToday && animatingToday;
        // Seleccionables: desde el inicio de la semana hasta hoy (los futuros no)
        const selectable = !isFuture;

        // Visual state
        // Saved (past or today): filled dark circle with check
        // Today unsaved: ring accent (purple)
        // Past unsaved: ring light gray
        // Future: very light, no check

        let bgColor    = 'transparent';
        let ringColor  = 'rgba(0,0,0,0.10)';
        let checkColor = 'transparent';
        let opacity    = 1;

        if (isSaved) {
          bgColor    = '#06D6A0';
          ringColor  = '#06D6A0';
          checkColor = '#ffffff';
        } else if (isToday) {
          bgColor    = 'transparent';
          ringColor  = '#381DA0';
          checkColor = 'transparent';
        } else if (isFuture) {
          bgColor    = 'transparent';
          ringColor  = 'rgba(0,0,0,0.08)';
          opacity    = 0.4;
        }

        return (
          <button
            key={date}
            type="button"
            onClick={selectable ? () => onSelect(date) : undefined}
            disabled={!selectable}
            className={`flex flex-col items-center gap-1.5 ${selectable ? 'cursor-pointer' : 'cursor-default'}`}
            style={{ opacity }}
          >
            <motion.div
              animate={isAnimating ? {
                scale: [1, 0.82, 1.12, 1],
                backgroundColor: ['transparent', '#06D6A0', '#06D6A0', '#06D6A0'],
              } : {
                scale: isSelected ? 1.08 : 1,
                backgroundColor: bgColor,
              }}
              transition={isAnimating
                ? { duration: 0.55, times: [0, 0.25, 0.65, 1], ease: 'easeInOut' }
                : { duration: 0.3 }
              }
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{
                border: `2px solid ${ringColor}`,
                backgroundColor: bgColor,
                boxShadow: isSelected ? '0 0 0 3px rgba(56,29,160,0.25)' : 'none',
              }}
            >
              <AnimatePresence>
                {isSaved && (
                  <motion.svg
                    key="check"
                    width="18" height="18" viewBox="0 0 18 18" fill="none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <motion.path
                      d="M4 9.5L7.5 13L14 6"
                      stroke={checkColor}
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.35, ease: 'easeOut', delay: isAnimating ? 0.28 : 0 }}
                    />
                  </motion.svg>
                )}
                {isToday && !isSaved && (
                  <motion.div
                    key="dot"
                    className="w-2 h-2 rounded-full"
                    style={{ background: '#381DA0' }}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  />
                )}
              </AnimatePresence>
            </motion.div>
            <span
              className="text-[10px] font-semibold"
              style={{ color: (isToday || isSelected) ? '#381DA0' : '#8E87A8' }}
            >
              {DAY_LABELS[i]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function AsistenciaPage() {
  const { getToken } = useAuth();
  const reducedMotion = useReducedMotion();
  const [selectedLoc, setSelectedLoc] = useState<string>('');
  const [att, setAtt]                 = useState<Record<string, Status>>({});
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [role, setRole]               = useState('');
  const [noAttDays, setNoAttDays]     = useState<number[]>([]);
  // Clase del horario sobre la que se esta pasando lista. `null` = el club no
  // armo horario, o el dia no tiene clases: se marca por dia, como siempre.
  const [claseSel, setClaseSel]       = useState<string | null>(null);
  // Hoja con las clases del dia. Se abre desde el selector que ocupa el lugar
  // de la fila de sede: la clase ya trae su sede, asi que esa fila sobraba.
  const [hojaClases, setHojaClases]   = useState(false);

  // Week streak state
  const [animatingToday, setAnimating]  = useState(false);

  const todayStr = todayISO();
  // Día seleccionado en la tira semanal (por defecto hoy). Permite revisar/corregir
  // la asistencia de días anteriores de la semana actual.
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const selectedDay = new Date(`${selectedDate}T00:00:00`).getDay();
  const isBlocked = noAttDays.includes(selectedDay);
  // Filtro por estado al tocar las tarjetas de resumen (Presentes/Tarde/Ausentes/Excusa)
  const [statusFilter, setStatusFilter] = useState<Status | null>(null);
  const queryClient = useQueryClient();

  // ── Week strip con caché ─────────────────────────────────────────────────────
  const weekDates = getWeekDates();
  const { data: weekSavedData } = useQuery({
    queryKey: ['weekSaved', weekDates[0]],
    queryFn: async () => {
      // Una sola petición para toda la semana. Antes eran siete (una por día)
      // solo para saber cuáles tienen registro, y Sentry lo marcaba como N+1.
      const token = await getToken();
      const res = await apiFetch<{ days: string[] }>(
        `/attendance/saved-days?from=${weekDates[0]}&to=${weekDates[weekDates.length - 1]}`,
        { token },
      );
      return new Set(res.days);
    },
    staleTime: 5 * 60 * 1000,
  });
  const weekSaved = weekSavedData ?? new Set<string>();

  // ── Datos con caché ──────────────────────────────────────────────────────────
  const { data: locsData, isLoading: loadingLocs } = useQuery({
    queryKey: QK.locations(),
    queryFn: async () => { const token = await getToken(); return apiFetch<{ locations: Location[] }>('/locations', { token }); },
  });
  const { data: membersData, isLoading: loadingMembers } = useQuery({
    queryKey: QK.members(),
    queryFn: async () => { const token = await getToken(); return apiFetch<{ members: Member[] }>('/members', { token }); },
  });
  // Las clases que toca ese dia. Salen del horario del club: no se le pregunta
  // nada al entrenador, la app ya sabe que hay hoy.
  const { data: clasesData, isLoading: loadingClases } = useQuery({
    queryKey: ['clasesDia', selectedDate],
    queryFn: async () => {
      const token = await getToken();
      return apiFetch<{ clases: ClaseDia[]; diaSinEntrenamiento: boolean }>(
        `/clases/dia?fecha=${selectedDate}`, { token },
      );
    },
    staleTime: 60 * 1000,
  });
  // useMemo y no una expresion suelta: el arreglo entra como dependencia del
  // efecto que elige la clase, y recrearlo en cada render lo hacia correr de
  // nuevo cada vez sin que hubiera cambiado nada.
  const clasesHoy = useMemo(() => clasesData?.clases ?? [], [clasesData]);

  // El horario completo alimenta el desplegable del reporte: ahi no interesa
  // el dia seleccionado sino todas las clases que dicta el club.
  const { data: horarioData } = useQuery({
    queryKey: ['horarioClases'],
    queryFn: async () => {
      const token = await getToken();
      return apiFetch<{ clases: ClaseDia[] }>('/clases', { token });
    },
    staleTime: 5 * 60 * 1000,
  });
  const horario = useMemo(() => horarioData?.clases ?? [], [horarioData]);
  const claseActiva = clasesHoy.find(c => c.id === claseSel) ?? null;
  const sinPasar    = clasesHoy.filter(c => !c.guardada).length;

  const { data: attData, isLoading: loadingAtt } = useQuery({
    queryKey: QK.attendance(selectedDate, claseSel),
    queryFn: async () => {
      const token = await getToken();
      // `claseId=null` pide justo las filas sin clase. Omitirlo traeria las de
      // todas las clases mezcladas, que es el bug que estamos cerrando.
      const q = claseSel ? `&claseId=${claseSel}` : '&claseId=null';
      return apiFetch<{ records: AttRecord[] }>(`/attendance?date=${selectedDate}${q}`, { token });
    },
    staleTime: 0,
    // No se consulta hasta saber que clase toca. claseSel arranca en null, y sin
    // esta condicion la pantalla pedia la planilla sin clase, despues el efecto
    // elegia una, cambiaba la clave y volvia a pedir. Encadenado con la sede y
    // el horario salian siete peticiones de medio segundo cada una en la carga
    // (VELOCLUB-WEB-R), casi cuatro segundos en un movil con datos, y seis de
    // esas respuestas se tiraban a la basura.
    enabled: !loadingClases && (clasesHoy.length === 0 || claseSel !== null),
  });

  const locations = useMemo(() => locsData?.locations ?? [], [locsData]);
  const loading   = loadingLocs || loadingMembers || loadingAtt;
  // Sostiene el indicador un minimo de tiempo para que no parpadee
  const mostrarCarga = useCargaMinima(loading);

  useEffect(() => {
    if (locations.length > 0 && !selectedLoc) setSelectedLoc(locations[0].id);
  }, [locations, selectedLoc]);

  // Al cambiar de dia se propone la primera clase sin pasar; si ya estan todas
  // guardadas, la primera. Asi el entrenador entra y marca sin elegir nada.
  useEffect(() => {
    if (clasesHoy.length === 0) { setClaseSel(null); return; }
    if (claseSel && clasesHoy.some(c => c.id === claseSel)) return;
    setClaseSel((clasesHoy.find(c => !c.guardada) ?? clasesHoy[0]).id);
  }, [clasesHoy, claseSel]);

  // La sede la manda la clase: no tiene sentido pasar lista de la clase de El
  // Bosque con la planilla de La Flora.
  useEffect(() => {
    if (claseActiva) setSelectedLoc(claseActiva.locationId);
  }, [claseActiva]);

  useEffect(() => {
    getToken().then(async token => {
      const [meRes, clubRes] = await Promise.all([
        apiFetch<{ status: string; user?: { role: string } }>('/me', { token }),
        apiFetch<{ club: { noAttendanceDays: number[] } }>('/clubs/settings', { token }).catch(() => null),
      ]);
      setRole(meRes.user?.role ?? '');
      setNoAttDays(clubRes?.club.noAttendanceDays ?? []);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Quien entra a la planilla. La sede sale de la clase (o del selector, si el
  // club no tiene horario) y la categoria solo filtra cuando la clase la
  // declara: sin eso, una clase sin categoria dejaria la planilla vacia.
  //
  // Un deportista en pausa nunca entra: quedaria ausente todos los dias de sus
  // vacaciones y le arruinaria el porcentaje del ano.
  // Depende de la categoria y no de `claseActiva`: el objeto de la clase se
  // reemplaza en cada refresco de la consulta aunque no haya cambiado nada, y
  // eso arrastraba al efecto de abajo.
  const categoriaClase = claseActiva?.categoria ?? null;
  const perteneceALaClase = useCallback((m: Member) => {
    if (m.active === false) return false;
    if (!m.locations.some(l => l.location.id === selectedLoc)) return false;
    if (categoriaClase && m.category !== categoriaClase) return false;
    return true;
  }, [selectedLoc, categoriaClase]);

  // Identidad de la planilla: dia + clase + sede. Mientras no cambie, lo que el
  // entrenador marco manda sobre lo que diga el servidor.
  const planillaKey = `${selectedDate}|${claseSel ?? ''}|${selectedLoc}`;
  const planillaSembrada = useRef('');

  useEffect(() => {
    if (!selectedLoc || !membersData || !attData) return;
    // Solo al abrir una planilla distinta. Antes se volvia a sembrar en cada
    // refresco de las consultas —y basta con volver a la pestaña, o con el
    // refetch que dispara guardar— y eso pisaba las marcas recien tocadas con
    // las del servidor: la tarjeta parecia no responder.
    if (planillaSembrada.current === planillaKey) return;
    planillaSembrada.current = planillaKey;

    const forLoc = membersData.members.filter(perteneceALaClase);
    // Todos arrancan Ausentes: el entrenador marca Presente a quienes asistieron
    const base = Object.fromEntries(forLoc.map(m => [m.id, 'ABSENT' as Status]));
    const existing: Record<string, Status> = {};
    for (const r of attData.records) existing[r.memberId] = r.status as Status;
    setAtt({ ...base, ...existing });
  }, [planillaKey, selectedLoc, membersData, attData, perteneceALaClase]);

  const members = (membersData?.members ?? []).filter(perteneceALaClase);

  function toggle(id: string) {
    setAtt(prev => {
      const cur = prev[id] ?? 'ABSENT';
      return { ...prev, [id]: TOGGLE_CYCLE[(TOGGLE_CYCLE.indexOf(cur) + 1) % TOGGLE_CYCLE.length] };
    });
  }

  async function handleSave() {
    if (!selectedLoc) return;
    setSaving(true); setSaved(false);
    try {
      const token = await getToken();
      await apiFetch('/attendance/bulk', {
        method: 'POST', token,
        body: JSON.stringify({
          date:       selectedDate,
          locationId: selectedLoc,
          // Sin clase el backend guarda una fila por dia, como siempre.
          claseId:    claseSel ?? undefined,
          records:    Object.entries(att).map(([memberId, status]) => ({ memberId, status })),
        }),
      });
      setSaved(true);
      // Marcar el día guardado + lanzar animación (solo si es hoy)
      queryClient.setQueryData(['weekSaved', weekDates[0]], (old: Set<string> | undefined) => new Set([...(old ?? []), selectedDate]));
      // Para que el selector marque la clase como pasada sin recargar
      queryClient.invalidateQueries({ queryKey: ['clasesDia', selectedDate] });
      if (selectedDate === todayStr) {
        setAnimating(true);
        setTimeout(() => setAnimating(false), 800);
      }
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  const counts = CYCLE.map(s => ({ s, n: Object.values(att).filter(v => v === s).length }));
  const canManage = role === 'ADMIN' || role === 'ENTRENADOR';

  // ── Descarga del consolidado ───────────────────────────────────────────────
  const { data: clubSettings } = useClubSettings();
  const [descargaAbierta, setDescargaAbierta] = useState(false);
  const [desde, setDesde]     = useState('');
  const [hasta, setHasta]     = useState('');
  const [sedeRep, setSedeRep] = useState('TODAS');
  // Clase del reporte. 'TODAS' = el consolidado por dia de siempre.
  const [claseRep, setClaseRep] = useState('TODAS');
  const [descargando, setDescargando] = useState<'pdf' | 'excel' | null>(null);
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null);

  // Por defecto, el mes en curso: es el rango que se pide el 90% de las veces
  function abrirDescarga() {
    const hoy = new Date();
    const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setDesde(iso(primero));
    setHasta(iso(hoy));
    setSedeRep(selectedLoc || 'TODAS');
    setErrorDescarga(null);
    setDescargaAbierta(true);
  }

  async function descargar(formato: 'pdf' | 'excel') {
    if (!desde || !hasta) return;
    setDescargando(formato);
    setErrorDescarga(null);
    try {
      const token = await getToken();
      // La clase manda sobre la sede: ya la trae, y mandar las dos podria
      // pedir una combinacion que no existe.
      const sedeQuery = claseRep !== 'TODAS'
        ? `&claseId=${claseRep}`
        : sedeRep !== 'TODAS' ? `&locationId=${sedeRep}` : '';
      const rep = await apiFetch<ReporteAsistencia>(
        `/attendance/report?from=${desde}&to=${hasta}${sedeQuery}`, { token },
      );
      const opts = {
        clubName: clubSettings?.club?.name ?? 'Club',
        sedeName: claseRep !== 'TODAS'
          ? (() => {
              const c = horario.find(h => h.id === claseRep);
              return c ? `${c.nombre} · ${horaLegible(c.hora)} · ${c.location.name}` : 'Clase';
            })()
          : sedeRep === 'TODAS'
            ? 'Todas las sedes'
            : (locations.find(l => l.id === sedeRep)?.name ?? 'Sede'),
        desde, hasta,
      };
      if (formato === 'pdf') descargarAsistenciaPDF(rep, opts);
      else                   descargarAsistenciaExcel(rep, opts);
      setDescargaAbierta(false);
    } catch (e) {
      setErrorDescarga(e instanceof Error ? e.message : 'No se pudo generar el reporte');
    } finally {
      setDescargando(null);
    }
  }

  const rangoInvalido = !!desde && !!hasta && hasta < desde;

  const [search, setSearch]       = useState('');
  const [catFilter, setCatFilter] = useState<string>('TODOS');
  const categories = useMemo(
    () => ['TODOS', ...Array.from(new Set(members.map(m => m.category).filter(Boolean) as string[])).sort()],
    [members],
  );
  const visibleMembers = members
    .filter(m => catFilter === 'TODOS' || m.category === catFilter)
    .filter(m => !statusFilter || (att[m.id] ?? 'ABSENT') === statusFilter)
    .filter(m => !search.trim() || m.fullName.toLowerCase().includes(search.toLowerCase().trim()));

  // "MAYORES" → "Mayores"
  function toLabel(cat: string) {
    if (cat === 'TODOS') return 'Todos';
    return cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
  }

  /**
   * Los filtros de la planilla, en un control.
   *
   * La clase y la sede no entran acá a propósito: no filtran lo que se ve, sino
   * que deciden de quién se está pasando lista. Metidas en un panel que hay que
   * abrir, se pierde el dato más importante de la pantalla.
   */
  const gruposFiltro: GrupoFiltro[] = useMemo(() => {
    const porBusqueda = (m: Member) =>
      !search.trim() || m.fullName.toLowerCase().includes(search.toLowerCase().trim());
    const porCat    = (m: Member) => catFilter === 'TODOS' || m.category === catFilter;
    const porEstado = (m: Member) => !statusFilter || (att[m.id] ?? 'ABSENT') === statusFilter;

    const paraCat    = members.filter(m => porBusqueda(m) && porEstado(m));
    const paraEstado = members.filter(m => porBusqueda(m) && porCat(m));

    const grupos: GrupoFiltro[] = [];

    if (categories.length > 1) {
      grupos.push({
        id: 'categoria',
        titulo: 'Categoría',
        valor: catFilter,
        neutro: 'TODOS',
        tono: 'violeta',
        onElegir: setCatFilter,
        opciones: categories.map(c => ({
          valor: c,
          texto: toLabel(c),
          n: c === 'TODOS' ? paraCat.length : paraCat.filter(m => m.category === c).length,
        })),
      });
    }

    // Sirve para repasar solo a los ausentes antes de guardar, que es el
    // momento en que se cometen los errores.
    grupos.push({
      id: 'estado',
      titulo: 'Cómo están marcados',
      valor: statusFilter ?? 'TODOS',
      neutro: 'TODOS',
      tono: 'azul',
      onElegir: v => setStatusFilter(v === 'TODOS' ? null : (v as Status)),
      opciones: [
        { valor: 'TODOS', texto: 'Todos', n: paraEstado.length },
        ...(['PRESENT', 'LATE', 'ABSENT', 'MEDICAL_EXCUSE'] as Status[]).map(s => ({
          valor: s,
          texto: { PRESENT: 'Presentes', LATE: 'Tarde', ABSENT: 'Ausentes', MEDICAL_EXCUSE: 'Excusa médica' }[s],
          n: paraEstado.filter(m => (att[m.id] ?? 'ABSENT') === s).length,
        })),
      ],
    });

    return grupos;
  }, [members, categories, catFilter, statusFilter, search, att]);

  return (
    <div className="min-h-full bg-background">
      {/* Header — borde inferior alineado con la fila del logo en el sidebar */}
      <div className="px-5 py-3 bg-background flex items-center justify-between lg:border-b" style={{ minHeight: 58, borderColor: 'rgba(0,0,0,0.07)' }}>
        <div>
          <h1 className="text-[22px] font-semibold text-foreground" style={{ fontFamily: 'inherit', lineHeight: 1.1 }}>
            Asistencia
          </h1>
        </div>
        <div className="flex items-center gap-2">
        {canManage && (
          <motion.button
            onClick={abrirDescarga}
            whileTap={{ scale: 0.93 }}
            aria-label="Descargar consolidado de asistencia"
            className="flex items-center gap-1.5 h-[34px] px-3 rounded-xl text-sm font-semibold cursor-pointer transition-colors hover:bg-secondary"
            style={{ background: 'rgba(56,29,160,0.08)', color: '#381DA0' }}
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Descargar</span>
          </motion.button>
        )}
        {canManage && !isBlocked && members.length > 0 && (
          <motion.button
            onClick={handleSave}
            disabled={saving}
            whileTap={{ scale: 0.93 }}
            className="flex items-center gap-1.5 h-[34px] px-3 rounded-xl text-sm font-semibold text-white cursor-pointer transition-colors"
            style={{ background: saved ? '#06D6A0' : '#381DA0' }}
          >
            {!saving && !saved && <CheckCircle2 className="w-4 h-4" />}
            <ContenidoGuardado
              estado={saving ? 'guardando' : saved ? 'guardado' : 'idle'}
              textoIdle="Guardar"
              textoGuardando="Guardando"
              textoGuardado="Guardado"
              color="#fff"
            />
          </motion.button>
        )}
        </div>
      </div>

      {/* ── Hoja de clases del día ─────────────────────────────────────────
          En portal a document.body: dentro de la página queda atrapada en el
          contexto de apilamiento de <main> y el menú flotante se le monta
          encima por más z-index que se le ponga. */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {hojaClases && (
            <motion.div
              key="hoja-clases"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              onClick={() => setHojaClases(false)}
              className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-6"
              style={{ background: 'rgba(20,12,36,0.55)', zIndex: 80 }}
            >
              <motion.div
                initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
                transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                onClick={e => e.stopPropagation()}
                className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl flex flex-col"
                style={{ maxHeight: '80dvh' }}
              >
                <div className="px-5 pt-4 pb-2">
                  <p className="text-[15px] font-semibold text-foreground">Clases de este día</p>
                  <p className="text-[11px] text-muted-foreground">Toca una para pasar su lista.</p>
                </div>
                <div className="px-5 pb-5 overflow-y-auto flex flex-col gap-1.5"
                  style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
                  {clasesHoy.map(c => {
                    const activa = c.id === claseSel;
                    return (
                      <button
                        key={c.id}
                        onClick={() => { setClaseSel(c.id); setHojaClases(false); }}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors"
                        style={activa
                          ? { background: 'rgba(56,29,160,0.05)', border: '1.5px solid #381DA0' }
                          : { background: '#fff', border: '1.5px solid rgba(120,80,200,0.14)' }}
                      >
                        <span className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center"
                          style={{ border: `1.5px solid ${activa ? '#381DA0' : 'rgba(26,16,40,0.20)'}` }}>
                          {activa && <span className="w-2 h-2 rounded-full" style={{ background: '#381DA0' }} />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[12.5px] font-bold text-foreground leading-tight"
                            style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {horaLegible(c.hora)} · {c.nombre}
                          </span>
                          <span className="block text-[10px] truncate" style={{ color: '#8E87A8' }}>
                            {c.location.name}
                          </span>
                        </span>
                        <span className="text-[8.5px] font-bold px-2 py-0.5 rounded-full shrink-0"
                          style={c.guardada
                            ? { background: 'rgba(6,214,160,0.16)', color: '#057A5C' }
                            : { background: 'rgba(255,183,3,0.18)', color: '#854F0B' }}>
                          {c.guardada ? '✓ Guardada' : 'Sin pasar'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ── Modal de descarga ─────────────────────────────────────────────── */}
      <Dialog open={descargaAbierta} onOpenChange={setDescargaAbierta}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(56,29,160,0.10)' }}>
                <Download className="w-4 h-4" style={{ color: '#381DA0' }} />
              </span>
              Descargar asistencia
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Desde</Label>
                <DatePicker value={desde} onChange={setDesde} />
              </div>
              <div className="space-y-2">
                <Label>Hasta</Label>
                <DatePicker value={hasta} onChange={setHasta} />
              </div>
            </div>

            {locations.length > 0 && (
              <div className="space-y-2">
                <Label>Sede</Label>
                <Select value={sedeRep} onValueChange={v => { if (v) setSedeRep(v); }}>
                  <SelectTrigger className="w-full h-12 rounded-xl">
                    <span className="text-sm">
                      {sedeRep === 'TODAS'
                        ? 'Todas las sedes'
                        : (locations.find(l => l.id === sedeRep)?.name ?? 'Seleccionar sede')}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODAS">Todas las sedes</SelectItem>
                    {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {horario.length > 0 && (
              <div className="space-y-2">
                <Label>Clase</Label>
                <Select value={claseRep} onValueChange={v => { if (v) setClaseRep(v); }}>
                  <SelectTrigger className="w-full h-12 rounded-xl">
                    <span className="text-sm">
                      {claseRep === 'TODAS'
                        ? 'Todas las clases'
                        : (() => {
                            const c = horario.find(h => h.id === claseRep);
                            return c ? `${DIA_CORTO_3[c.diaSemana]} ${horaLegible(c.hora)} · ${c.nombre}` : 'Seleccionar clase';
                          })()}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODAS">Todas las clases</SelectItem>
                    {horario.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {DIA_CORTO_3[c.diaSemana]} {horaLegible(c.hora)} · {c.nombre} · {c.location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10.5px] text-muted-foreground">
                  Al elegir una clase el reporte se limita a sus días y a su sede.
                </p>
              </div>
            )}

            {rangoInvalido && (
              <p className="text-[12px] text-red-600">La fecha final no puede ser anterior a la inicial.</p>
            )}
            {errorDescarga && <p className="text-[12px] text-red-600">{errorDescarga}</p>}

            <div className="space-y-2">
              <Label>Formato</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => descargar('excel')}
                  disabled={!desde || !hasta || rangoInvalido || descargando !== null}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-white px-3 py-4 transition-colors hover:border-primary/40 hover:bg-secondary/40 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FileSpreadsheet className="w-6 h-6" style={{ color: '#06D6A0' }} />
                  <span className="text-[13px] font-semibold text-foreground">
                    {descargando === 'excel' ? 'Generando...' : 'Excel'}
                  </span>
                  <span className="text-[10px] text-muted-foreground text-center leading-tight">
                    Detalle día por día
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => descargar('pdf')}
                  disabled={!desde || !hasta || rangoInvalido || descargando !== null}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-white px-3 py-4 transition-colors hover:border-primary/40 hover:bg-secondary/40 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FileText className="w-6 h-6" style={{ color: '#EF476F' }} />
                  <span className="text-[13px] font-semibold text-foreground">
                    {descargando === 'pdf' ? 'Generando...' : 'PDF'}
                  </span>
                  <span className="text-[10px] text-muted-foreground text-center leading-tight">
                    Listo para imprimir
                  </span>
                </button>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              El porcentaje cuenta las tardanzas como asistencia y descuenta las excusas médicas del total, para no castigar a un deportista lesionado.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <motion.div variants={stagger} initial="hidden" animate="show" className="px-4 pt-4 lg:pt-6 flex flex-col gap-3">
        {mostrarCarga ? (
          <ModuleLoader />
        ) : (
          <ModuleReveal>
            {/* ── Week streak strip (siempre visible para poder cambiar de día) ── */}
            <motion.div
              variants={cardVariant}
              className="bg-white border border-border rounded-2xl px-4 py-4"
              style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}
            >
              <WeekStrip
                weekSaved={weekSaved}
                todayStr={todayStr}
                selectedDate={selectedDate}
                onSelect={setSelectedDate}
                animatingToday={animatingToday}
              />
            </motion.div>

            {isBlocked ? (
              <div className="bg-white border border-border rounded-xl px-4 py-12 text-center">
                <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(239,71,111,0.08)' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#EF476F" strokeWidth="2"/><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke="#EF476F" strokeWidth="2" strokeLinecap="round"/></svg>
                </div>
                <p className="text-[15px] font-semibold text-foreground">No hay entrenamiento este día</p>
                <p className="text-[12px] text-muted-foreground mt-1 capitalize">
                  Los {DAY_NAMES[selectedDay]}s no se registra asistencia
                </p>
              </div>
            ) : members.length === 0 ? (
              <div className="bg-white border border-border rounded-xl px-4 py-10 text-center">
                <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-[13px] font-semibold text-muted-foreground">Sin deportistas en esta sede</p>
                <p className="text-[11px] text-muted-foreground mt-1">Asigna miembros a esta sede desde Miembros</p>
              </div>
            ) : (
              <>
                {/* Resumen — tarjetas filtrables (tocar filtra la lista por ese estado) */}
                <motion.div variants={cardVariant} className="grid grid-cols-4 gap-2 md:gap-3">
                  {counts.map(({ s, n }) => {
                    const active = statusFilter === s;
                    return (
                      <button
                        key={s}
                        onClick={() => setStatusFilter(active ? null : s)}
                        className="bg-white border rounded-xl text-center flex flex-col items-center justify-center py-3 md:py-5 md:rounded-2xl transition-all cursor-pointer"
                        style={{
                          boxShadow: active ? `0 4px 14px ${STATUS_COLOR[s]}33` : '0 1px 6px rgba(0,0,0,0.04)',
                          borderColor: active ? STATUS_COLOR[s] : 'var(--border)',
                          borderWidth: active ? 2 : 1,
                        }}
                      >
                        <div
                          className="text-xl md:text-[36px] font-semibold leading-none mb-1"
                          style={{ color: STATUS_COLOR[s], fontFamily: 'inherit' }}
                        >
                          {n}
                        </div>
                        <div className="text-[10px] md:text-[13px] font-semibold text-muted-foreground md:mt-0.5">
                          {s === 'PRESENT' ? 'Presentes'
                            : s === 'LATE' ? 'Tarde'
                            : s === 'ABSENT' ? 'Ausentes'
                            : 'Excusa médica'}
                        </div>
                      </button>
                    );
                  })}
                </motion.div>

                {/* Búsqueda + filtros + sede — misma fila en desktop */}
                <motion.div variants={cardVariant} className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                  {/* Buscar y filtrar van juntos también en el celular: cada uno
                      en su renglón gastaba dos franjas antes de la planilla. En
                      escritorio el `contents` los devuelve a la fila de arriba,
                      para que la búsqueda siga estirándose. */}
                  <div className="flex items-center gap-2 md:contents">
                    <div className="relative flex-1 min-w-0 md:flex-1">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#8E87A8' }} />
                      <input
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl text-[13px] outline-none transition-all"
                        style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.12)', color: '#1A1028' }}
                        placeholder="Buscar por nombre..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                      />
                    </div>

                    {/* La sede, cuadrada y solo en el celular. Se queda en la
                        fila porque decide de quien se pasa lista, pero sin su
                        nombre no cabria la busqueda: el nombre baja a la linea
                        de contexto, que pesa 18px en vez de un renglon. */}
                    {!claseActiva && locations.length > 1 && (
                      <Desplegable
                        compacto
                        className="md:hidden"
                        tono="#4361EE"
                        icono={<MapPin className="w-4 h-4" />}
                        valor={selectedLoc}
                        opciones={locations.map(l => ({ valor: l.id, texto: l.name }))}
                        vacio="Sede"
                        titulo="Dónde estás pasando lista"
                        onElegir={v => setSelectedLoc(v)}
                      />
                    )}

                    {/* Todos los filtros en un control. Las pastillas sueltas se
                        salian de la pantalla en cuanto el club tenia cinco
                        categorias. */}
                    <BotonFiltros
                      grupos={gruposFiltro}
                      resultados={{ mostrados: visibleMembers.length, total: members.length, sustantivo: 'deportistas' }}
                      alto={42}
                      soloIcono="movil"
                    />
                  </div>

                  {/* Clase o sede — al final.
                      Cuando hay horario manda la clase y la fila de sede
                      desaparece: la clase trae su sede y repetirla gastaba un
                      renglon entero de la pantalla. El alto de este selector no
                      cambia con la cantidad de clases, que es justo lo que se
                      les iba de las manos a las tarjetas. */}
                  <div className="hidden md:block w-px h-6 bg-border shrink-0" />
                  {claseActiva ? (
                    <button
                      onClick={() => clasesHoy.length > 1 && setHojaClases(true)}
                      disabled={clasesHoy.length <= 1}
                      className="flex items-center gap-2.5 px-3 py-2 bg-white rounded-xl md:w-72 md:shrink-0 text-left disabled:cursor-default"
                      style={{ border: `1.5px solid ${clasesHoy.length > 1 ? '#381DA0' : 'rgba(120,80,200,0.14)'}` }}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="block text-[12.5px] font-bold text-foreground leading-tight"
                          style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {horaLegible(claseActiva.hora)} · {claseActiva.nombre}
                        </span>
                        <span className="block text-[9.5px] truncate" style={{ color: '#8E87A8' }}>
                          {claseActiva.location.name} · {claseActiva.guardada ? 'guardada' : 'sin pasar'}
                        </span>
                      </div>
                      {sinPasar > 0 && (
                        <span className="text-[8.5px] font-bold px-2 py-0.5 rounded-full shrink-0"
                          style={{ background: 'rgba(255,183,3,0.18)', color: '#854F0B' }}>
                          {sinPasar} sin pasar
                        </span>
                      )}
                      {clasesHoy.length > 1 && <ChevronDown className="w-4 h-4 shrink-0" style={{ color: '#8E87A8' }} />}
                    </button>
                  ) : locations.length > 1 ? (
                    <div className="hidden md:flex items-center gap-2 md:w-52 md:shrink-0">
                      <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                      <Select value={selectedLoc} onValueChange={v => setSelectedLoc(v ?? selectedLoc)}>
                        <SelectTrigger className="bg-white flex-1">
                          <span className="text-sm font-semibold">
                            {locations.find(l => l.id === selectedLoc)?.name ?? 'Seleccionar sede'}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {locations.map(l => (
                            <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : locations.length === 1 ? (
                    <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-white border border-border rounded-xl md:shrink-0">
                      <MapPin className="w-4 h-4 shrink-0" style={{ color: '#4361EE' }} />
                      <span className="text-[13px] font-semibold text-foreground">{locations[0].name}</span>
                    </div>
                  ) : null}
                </motion.div>

                {/* Donde se esta pasando lista, en texto plano. Sin esto, el
                    boton en puro icono deja al entrenador sin saber en que sede
                    esta marcando, que es el error que se paga caro. */}
                {!claseActiva && locations.length > 0 && (
                  <p className="md:hidden flex items-center gap-1 text-[11px] m-0" style={{ color: '#8E87A8' }}>
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate">
                      {locations.find(l => l.id === selectedLoc)?.name ?? locations[0].name}
                    </span>
                    <span className="shrink-0">· {visibleMembers.length} de {members.length}</span>
                  </p>
                )}

                {/* Lo que está puesto, fuera del panel: si solo se viera al
                    abrirlo, la planilla podría estar recortada sin que nada en
                    pantalla lo diga, y se guardaría creyendo que están todos. */}
                <ChipsFiltros grupos={gruposFiltro} />

                {/* Grid de tarjetas compactas */}
                <div className="grid grid-cols-3 gap-2 pb-24 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 sm:gap-3">
                  {visibleMembers.map(m => {
                    const s = att[m.id] ?? 'ABSENT';
                    const color = STATUS_COLOR[s];
                    const statusName = STATUS_NAME[s];
                    return (
                      // Toca la tarjeta entera, no solo la franja de abajo. Esa
                      // franja mide 28px de alto, muy por debajo de los 44
                      // recomendados para un objetivo tactil, y la tarjeta ya
                      // mostraba `cursor-pointer` en todo el borde: prometia algo
                      // que no cumplia. Marcar asistencia se hace rapido y de
                      // pie, y errarle era lo normal.
                      <motion.div
                        variants={cardVariant}
                        key={m.id}
                        onClick={canManage ? () => toggle(m.id) : undefined}
                        onKeyDown={canManage ? (e => {
                          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(m.id); }
                        }) : undefined}
                        role={canManage ? 'button' : undefined}
                        tabIndex={canManage ? 0 : undefined}
                        aria-label={canManage ? `${m.fullName}: ${statusName}. Tocar para cambiar` : undefined}
                        whileHover={reducedMotion ? {} : { y: -3, boxShadow: `0 12px 32px ${color}28`, transition: { duration: 0.22, ease: EASE_OUT } }}
                        whileTap={reducedMotion ? {} : { scale: 0.97, transition: { duration: 0.1 } }}
                        className={`bg-white rounded-2xl overflow-hidden flex flex-col${canManage ? ' cursor-pointer' : ''}`}
                        style={{
                          border: `1.5px solid ${color}30`,
                          boxShadow: `0 2px 10px ${color}18`,
                        }}
                      >
                        <div className="flex flex-col items-center pt-4 pb-2 px-2">
                          <MemberAvatar
                            name={m.fullName}
                            photoUrl={m.pictureUrl}
                            gradient={avatarBg(m.role)}
                          />
                          <p className="text-[11px] font-semibold text-center mt-2 leading-tight line-clamp-2 w-full px-1"
                            style={{ color: '#1A1028' }}>
                            {m.fullName}
                          </p>
                          {(m.category || m.tipo) && (
                            <p className="text-[9px] font-semibold text-center mt-0.5 truncate w-full px-1"
                              style={{ color: '#8E87A8' }}>
                              {m.category ?? m.tipo}
                            </p>
                          )}
                        </div>

                        {/* La franja se queda como indicador de estado, pero deja
                            de ser un boton: anidar uno dentro de algo clicable
                            dispara el toque dos veces y adelanta el ciclo de a
                            dos estados. */}
                        <div
                          className="mt-auto w-full py-2 text-[11px] font-semibold tracking-wide flex items-center justify-center gap-1"
                          style={{
                            background: `${color}18`,
                            color,
                            borderTop: `1.5px solid ${color}30`,
                          }}
                        >
                          <span className="text-[11px]">{statusName}</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </>
            )}
          </ModuleReveal>
        )}
      </motion.div>
    </div>
  );
}
