'use client';

import { CATEGORIAS, NIVELES } from '@/lib/categorias';
import { useAuth, useUser } from '@clerk/nextjs';
import { useClubStream } from '@/hooks/useClubStream';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { stagger as pageStagger, cardVariant as pageCard } from '@/lib/page-animations';
import { apiFetch } from '@/lib/api-client';
import { parseLocalDate } from '@/lib/utils';
import { QK } from '@/hooks/useVeloQuery';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Plus, Pencil, Users, FileSpreadsheet, X, PlayCircle, MoreVertical,
} from 'lucide-react';
import { MemberAvatar } from '@/components/ui/member-avatar';
import { PhoneInput, parsePhoneDisplay, FlagImg } from '@/components/ui/phone-input';
import { downloadMembersPDF } from '@/lib/pdf';
import { FichaDeportista } from '@/components/miembros/ficha-deportista';
import { FICHA_VACIA, validarFicha, type DatosFicha, type ErroresFicha } from '@/lib/ficha-deportista';
import { MenuImportar } from '@/components/miembros/menu-importar';
import { PanelInscripcion } from '@/components/miembros/panel-inscripcion';
import { BotonFiltros, ChipsFiltros, type GrupoFiltro } from '@/components/ui/filtros';
import { PendientesInscripcion } from '@/components/miembros/pendientes-inscripcion';
import { downloadMembersTemplate, parseMembersExcel } from '@/lib/excel';
import ModuleLoader, { useCargaMinima } from '@/components/ui/module-loader';
import ModuleReveal from '@/components/ui/module-reveal';
import { ContenidoGuardado, MS_GUARDADO, type EstadoGuardado } from '@/components/ui/save-button-state';
import {
  IconDescargar, IconEliminar, IconUbicacion, IconBuscar, IconVer, IconImportar,
  IconTelefono, IconMail, IconIdentificacion, IconFechaNacimiento, IconEps,
  IconAcudiente, IconDesactivar,
} from '@/components/ui/custom-icons';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Location { id: string; name: string }
interface Member {
  id: string; fullName: string; email?: string; phone?: string;
  birthDate?: string; category?: string; tipo?: string;
  emergencyContact?: string; emergencyPhone?: string; eps?: string;
  paymentDueDay?: number | null; monthlyFee?: number | null;
  pictureUrl?: string | null; docType?: string | null; docNumber?: string | null;
  docFileUrl?: string | null; insuranceFileUrl?: string | null;
  guardianRelation?: string | null; guardianDocNumber?: string | null;
  gender?: string | null; rh?: string | null; allergies?: string | null;
  createdAt?: string;
  role: string;
  active?: boolean;
  desactivadoAt?: string | null;
  locations: { location: Location }[];
}

// ── Design tokens ──────────────────────────────────────────────────────────────
const ROLES: Record<string, string> = { ADMIN: 'Admin', ENTRENADOR: 'Entrenador', DEPORTISTA: 'Deportista' };
const ROLE_COLORS: Record<string, { text: string; bg: string }> = {
  ADMIN:   { text: '#B45309', bg: 'rgba(245,158,11,0.12)' },
  ENTRENADOR:   { text: '#047857', bg: 'rgba(6,214,160,0.12)' },
  DEPORTISTA: { text: '#6D28D9', bg: 'rgba(56,29,160,0.12)' },
};
const ROLE_GRADIENT: Record<string, string> = {
  ADMIN:   'linear-gradient(135deg,#FFB703,#FB8500)',
  ENTRENADOR:   'linear-gradient(135deg,#06D6A0,#0CB68D)',
  DEPORTISTA: '#381DA0',
};

// ── Empty form ─────────────────────────────────────────────────────────────────

// La forma de la ficha vive en lib/ficha-deportista: la comparten el formulario
// del club y el publico, para que los dos pidan exactamente lo mismo.
const emptyForm: DatosFicha = FICHA_VACIA;

// ── Animations ─────────────────────────────────────────────────────────────────
const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];
const EASE_IOS: [number, number, number, number] = [0.32, 0.72, 0, 1];

export default function MiembrosPage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const reducedMotion = useReducedMotion();
  const qc = useQueryClient();

  const [search, setSearch]         = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL'|'DEPORTISTA'|'ENTRENADOR'|'ADMIN'>('ALL');
  const [estadoFilter, setEstadoFilter] = useState<'ACTIVOS'|'PAUSADOS'|'TODOS'>('ACTIVOS');
  const [cambiandoEstado, setCambiandoEstado] = useState<string | null>(null);
  const [sortOrder, setSortOrder]     = useState<'az'|'za'|'recent'|'oldest'>('recent');
  const [catFilter, setCatFilter]     = useState<string>('ALL');
  const [locFilter, setLocFilter]     = useState<string>('ALL');
  const [clubName, setClubName] = useState('VeloClub');

  // View detail state
  const [viewMember, setViewMember] = useState<Member | null>(null);

  // Panel state
  const [open, setOpen]         = useState(false);
  const [editing, setEditing]   = useState<Member | null>(null);
  const [form, setForm]         = useState<DatosFicha>(emptyForm);
  // Importar abre un menu con las dos formas de traer una lista completa. El
  // anclaje guarda donde se apreto, para colgarle el menu al boton.
  const [menuImportar, setMenuImportar] = useState<{ top: number; right: number } | null>(null);
  const [inscripcionAbierta, setInscripcionAbierta] = useState(false);
  // Lo que responde el servidor por campo, y los archivos que esperan para
  // subirse: al crear todavia no existe el deportista al que colgarselos.
  const [erroresCampo, setErroresCampo] = useState<ErroresFicha>({});
  const [archivos, setArchivos] = useState<{ doc?: File; insurance?: File }>({});
  const [saving, setSaving]     = useState(false);
  const [estadoGuardado, setEstadoGuardado] = useState<EstadoGuardado>('idle');
  const [error, setError]       = useState<string | null>(null);
  // El error de arriba solo se ve dentro del panel de edición. Lo que falla desde
  // la lista (eliminar, activar o desactivar) necesita su propio aviso, o el
  // intento se pierde en silencio.
  const [errorLista, setErrorLista] = useState<string | null>(null);
  // Miembro cuya hoja de acciones esta abierta en movil. En escritorio la
  // tarjeta muestra sus botones directamente y esto no se usa.
  const [accionesMember, setAccionesMember] = useState<Member | null>(null);

  // Solo el administrador gestiona miembros; el resto ve la lista sin editarla
  const [canManage, setCanManage] = useState(false);

  // Import state
  const [importOpen, setImportOpen]     = useState(false);
  const [importing, setImporting]       = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);

  // ── Data con caché TanStack Query ───────────────────────────────────────────
  const { data: membersData, isLoading: loadingMembers } = useQuery({
    queryKey: QK.members(),
    queryFn: async () => {
      const token = await getToken();
      return apiFetch<{ members: Member[] }>('/members', { token });
    },
  });
  const { data: locsData, isLoading: loadingLocs } = useQuery({
    queryKey: QK.locations(),
    queryFn: async () => {
      const token = await getToken();
      return apiFetch<{ locations: Location[] }>('/locations', { token });
    },
  });

  // Memorizados porque el `??` crea un arreglo nuevo en cada render, y de estos
  // dos cuelgan los filtros y sus conteos: sin esto se recalculan siempre.
  const members   = useMemo(() => membersData?.members ?? [], [membersData]);
  const locations = useMemo(() => locsData?.locations  ?? [], [locsData]);

  useEffect(() => {
    getToken().then(async token => {
      const me = await apiFetch<{ status: string; user?: { role: string } }>('/me', { token });
      setCanManage(me.user?.role === 'ADMIN');
    }).catch(() => setCanManage(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Steps definition (después de declarar locations)
  // Al crear se exigen los obligatorios; al editar a alguien que ya existe sin
  // ellos se avisa pero se deja guardar, o no se le podria corregir ni el
  // telefono.
  const puedeGuardar = Object.keys(validarFicha(form, !editing)).length === 0;

  const loading   = loadingMembers || loadingLocs;
  // Sostiene el indicador un mínimo de tiempo para que no parpadee
  const mostrarCarga = useCargaMinima(loading);

  // Cargar nombre del club (sin bloquear)
  useEffect(() => {
    getToken().then(token =>
      apiFetch<{ club: { name: string } }>('/clubs/settings', { token }).then(r => setClubName(r.club.name)).catch(() => {})
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SSE invalida la caché → TanStack Query refetch en bg, sin spinner
  useClubStream(ev => {
    if (ev === 'members') qc.invalidateQueries({ queryKey: QK.members() });
  });

  // ── Panel actions ───────────────────────────────────────────────────────────
  function openNew() {
    setEditing(null); setForm(emptyForm); setError(null);
    setErroresCampo({}); setArchivos({}); setOpen(true);
  }

  function openEdit(m: Member) {
    setEditing(m);
    setForm({
      fullName: m.fullName, email: m.email ?? '', phone: m.phone ?? '',
      birthDate: m.birthDate ? m.birthDate.split('T')[0] : '',
      docType: m.docType ?? '',
      docNumber: m.docNumber ?? '',
      category: m.category ?? '', tipo: m.tipo ?? '',
      guardianName: m.emergencyContact ?? '',
      guardianPhone: m.emergencyPhone ?? '',
      guardianRelation: m.guardianRelation ?? '',
      guardianDocNumber: m.guardianDocNumber ?? '',
      eps: m.eps ?? '',
      gender: m.gender ?? '', rh: m.rh ?? '', allergies: m.allergies ?? '',
      role: (m.role as DatosFicha['role']),
      locationIds: m.locations.map(l => l.location.id),
    });
    setError(null); setErroresCampo({}); setArchivos({}); setOpen(true);
  }

  /**
   * Pregunta si el correo o el documento ya estan usados en el club.
   *
   * Es el aviso que sale mientras alguien escribe. Nunca reemplaza la revision
   * del guardado: dos pestanas abiertas pueden pasar las dos por aca.
   */
  async function verificarDuplicado(campo: 'email' | 'docNumber', valor: string): Promise<boolean> {
    try {
      const token = await getToken();
      const params = new URLSearchParams({ [campo]: valor });
      if (editing) params.set('excepto', editing.id);
      const r = await apiFetch<{ correo: boolean; documento: boolean }>(
        `/members/verificar?${params.toString()}`, { token }
      );
      return campo === 'email' ? r.correo : r.documento;
    } catch {
      // Si la consulta falla no se inventa un aviso: el guardado revisa igual.
      return false;
    }
  }


  /**
   * Sube un adjunto a Cloudinary y lo cuelga del deportista.
   *
   * Se llama despues de guardar y no antes: al crear todavia no existe el
   * miembro al que colgarselo, asi que el archivo espera en memoria.
   */
  async function subirAdjunto(memberId: string, campo: 'doc' | 'insurance', archivo: File) {
    const token = await getToken();
    const base64 = await new Promise<string>((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = () => resolve(String(lector.result));
      lector.onerror = () => reject(new Error('No se pudo leer el archivo'));
      lector.readAsDataURL(archivo);
    });
    await apiFetch(`/members/${memberId}/archivo`, {
      method: 'POST', token,
      body: JSON.stringify({ campo, base64 }),
    });
  }

  async function handleSave() {
    if (!puedeGuardar) return;
    setSaving(true); setEstadoGuardado('guardando'); setError(null); setErroresCampo({});
    try {
      const token = await getToken();
      const body = JSON.stringify({
        fullName: form.fullName,
        email: form.email || undefined,
        phone: form.phone || undefined,
        birthDate: form.birthDate || undefined,
        docType: form.docType || undefined,
        docNumber: form.docNumber || undefined,
        category: form.category || undefined,
        tipo: form.tipo || undefined,
        emergencyContact: form.guardianName || undefined,
        emergencyPhone: form.guardianPhone || undefined,
        guardianRelation: form.guardianRelation || undefined,
        guardianDocNumber: form.guardianDocNumber || undefined,
        eps: form.eps || undefined,
        gender: form.gender || undefined,
        rh: form.rh || undefined,
        allergies: form.allergies || undefined,
        role: form.role,
        locationIds: form.locationIds,
      });

      let memberId = editing?.id ?? null;

      if (editing) {
        const roleChanged = editing.role !== form.role;
        const isSelf = editing.email && user?.primaryEmailAddress?.emailAddress
          ? editing.email === user.primaryEmailAddress.emailAddress : false;
        await apiFetch(`/members/${editing.id}`, { method: 'PUT', token, body });
        if (roleChanged && isSelf) { window.location.href = '/dashboard'; return; }
      } else {
        const creado = await apiFetch<{ member: { id: string } }>('/members', { method: 'POST', token, body });
        memberId = creado.member.id;
      }

      // Los adjuntos van despues, y un fallo aca no puede perder el deportista
      // que ya quedo creado: se avisa y se deja seguir.
      if (memberId) {
        try {
          if (archivos.doc) await subirAdjunto(memberId, 'doc', archivos.doc);
          if (archivos.insurance) await subirAdjunto(memberId, 'insurance', archivos.insurance);
        } catch {
          setError('El deportista quedó guardado, pero no se pudo subir algún archivo. Vuelve a intentarlo desde su ficha.');
        }
      }

      // Confirma antes de cerrar: si el panel se cierra de una, la persona no
      // alcanza a ver que el cambio quedo guardado.
      setEstadoGuardado('guardado');
      qc.invalidateQueries({ queryKey: QK.members() });
      await new Promise(r => setTimeout(r, MS_GUARDADO));
      setOpen(false);
      setEstadoGuardado('idle');
      setArchivos({});
    } catch (e) {
      // El servidor dice que campo choca, asi que el aviso se pinta ahi mismo
      // en vez de quedar como un error suelto al pie del formulario.
      const err = e as { campo?: keyof ErroresFicha; message?: string };
      if (err.campo) setErroresCampo({ [err.campo]: err.message ?? 'Ese dato ya está usado' });
      else setError(e instanceof Error ? e.message : 'Error al guardar');
      setEstadoGuardado('idle');
    } finally {
      setSaving(false);
    }
  }

  // Sin manejo de error, un borrado fallido no mostraba nada: la fila seguía en
  // pantalla y el intento se perdía como promesa rechazada. Quien administraba
  // volvía a pulsar sobre la misma fila una y otra vez sin entender por qué no
  // pasaba nada. Si el miembro ya no existe, la lista está vieja: se refresca y
  // la fila desaparece, que es lo que la persona quería lograr.
  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este miembro?')) return;
    try {
      const token = await getToken();
      await apiFetch(`/members/${id}`, { method: 'DELETE', token });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo eliminar el miembro';
      if (!msg.includes('no encontrado')) setErrorLista(msg);
    } finally {
      qc.invalidateQueries({ queryKey: QK.members() });
    }
  }

  // Pausa temporal, no borrado: el deportista que se va de vacaciones conserva
  // su historial y vuelve a entrar cuando lo reactiven.
  async function handleToggleEstado(m: Member) {
    const desactivar = m.active !== false;
    if (desactivar && !confirm(
      `¿Desactivar a ${m.fullName}?\n\nDeja de generarle cuota mensual, no aparece en asistencia ni en resultados y no puede entrar a la app. Su historial se conserva y puedes reactivarlo cuando vuelva.`
    )) return;

    setCambiandoEstado(m.id);
    try {
      const token = await getToken();
      await apiFetch(`/members/${m.id}/estado`, {
        method: 'PATCH', token,
        body: JSON.stringify({ active: desactivar ? false : true }),
      });
      qc.invalidateQueries({ queryKey: QK.members() });
    } catch (e) {
      setErrorLista(e instanceof Error ? e.message : 'No se pudo cambiar el estado');
    } finally {
      setCambiandoEstado(null);
    }
  }

  // Nadie puede eliminarse a si mismo: borrarse revoca el propio acceso y banea
  // la cuenta. La API lo rechaza, pero la opcion tampoco deberia ofrecerse.
  // Se compara por correo, que es la identidad que trae la ficha del miembro.
  function esUnoMismo(m: Member): boolean {
    const propio = user?.primaryEmailAddress?.emailAddress;
    if (!propio || !m.email) return false;
    return m.email.trim().toLowerCase() === propio.trim().toLowerCase();
  }


  async function handleImport(file: File) {
    setImporting(true); setImportErrors([]); setImportWarnings([]);
    const { rows, errors, warnings } = await parseMembersExcel(file);
    if (errors.length > 0) { setImportErrors(errors); setImporting(false); return; }
    // Los avisos no detienen la importación: son datos sueltos que no se pudieron
    // interpretar, no filas inválidas.
    setImportWarnings(warnings);
    const token = await getToken();
    const failed: string[] = [];
    for (const row of rows) {
      try {
        const { locationName, ...rest } = row;
        let locationIds: string[] | undefined;
        if (locationName) {
          const found = locations.find(l => l.name.toLowerCase().trim() === locationName.toLowerCase().trim());
          if (!found) { failed.push(`${row.fullName}: la sede "${locationName}" no existe`); continue; }
          locationIds = [found.id];
        }
        // Buscar si el miembro ya existe por docNumber o email para evitar duplicados
        const existing = members.find(m =>
          (rest.docNumber && m.docNumber && m.docNumber.trim() === rest.docNumber.trim()) ||
          (rest.email && m.email && m.email.toLowerCase().trim() === rest.email.toLowerCase().trim())
        );
        if (existing) {
          await apiFetch(`/members/${existing.id}`, { method: 'PUT', token, body: JSON.stringify({ ...rest, locationIds }) });
        } else {
          await apiFetch('/members', { method: 'POST', token, body: JSON.stringify({ ...rest, locationIds }) });
        }
      } catch (e) { failed.push(`${row.fullName}: ${e instanceof Error ? e.message : 'Error'}`); }
    }
    setImporting(false);
    // Con avisos pendientes el modal se queda abierto, para que alcancen a leerse
    if (failed.length > 0) setImportErrors(failed);
    else if (warnings.length === 0) setImportOpen(false);
    qc.invalidateQueries({ queryKey: QK.members() });
  }

  // ── Filtered + sorted list ───────────────────────────────────────────────────
  const allCategories = useMemo(() =>
    Array.from(new Set(members.map(m => m.category).filter(Boolean) as string[])).sort()
  , [members]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = members.filter(m => {
      const matchSearch = !q || m.fullName.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q);
      const matchRole   = roleFilter === 'ALL' || m.role === roleFilter;
      const matchCat    = catFilter  === 'ALL' || m.category === catFilter;
      const matchLoc = locFilter === 'ALL'
        || (locFilter === 'SIN_SEDE' ? m.locations.length === 0 : m.locations.some(l => l.location.id === locFilter));
      // Los desactivados se esconden por defecto: si no, el club que pausa 25
      // deportistas en noviembre sigue viendo la misma lista de siempre.
      const matchEstado = estadoFilter === 'TODOS'
        || (estadoFilter === 'ACTIVOS' ? m.active !== false : m.active === false);
      return matchSearch && matchRole && matchCat && matchLoc && matchEstado;
    });
    list = [...list].sort((a, b) => {
      if (sortOrder === 'az')     return a.fullName.localeCompare(b.fullName);
      if (sortOrder === 'za')     return b.fullName.localeCompare(a.fullName);
      if (sortOrder === 'recent') return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
      if (sortOrder === 'oldest') return new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
      return 0;
    });
    return list;
  }, [members, search, roleFilter, catFilter, locFilter, sortOrder, estadoFilter]);

  const totalPausados = useMemo(() => members.filter(m => m.active === false).length, [members]);

  /**
   * Los filtros de la pantalla, con el conteo de cada opción.
   *
   * Cada grupo cuenta sobre los que pasan todos los demás filtros menos el
   * suyo. Contar sobre la lista ya filtrada mostraría cero en todo lo que no
   * está elegido, y contar sobre el total prometería resultados que no salen.
   */
  const gruposFiltro: GrupoFiltro[] = useMemo(() => {
    const q = search.toLowerCase().trim();
    const porBusqueda = (m: Member) => !q || m.fullName.toLowerCase().includes(q) || !!m.email?.toLowerCase().includes(q);
    const porRol      = (m: Member) => roleFilter === 'ALL' || m.role === roleFilter;
    const porCat      = (m: Member) => catFilter === 'ALL' || m.category === catFilter;
    const porSede     = (m: Member) => locFilter === 'ALL'
      || (locFilter === 'SIN_SEDE' ? m.locations.length === 0 : m.locations.some(l => l.location.id === locFilter));
    const porEstado   = (m: Member) => estadoFilter === 'TODOS'
      || (estadoFilter === 'ACTIVOS' ? m.active !== false : m.active === false);

    const salvo = (...reglas: ((m: Member) => boolean)[]) =>
      members.filter(m => reglas.every(r => r(m)));

    const paraCat    = salvo(porBusqueda, porRol, porSede, porEstado);
    const paraSede   = salvo(porBusqueda, porRol, porCat, porEstado);
    const paraEstado = salvo(porBusqueda, porRol, porCat, porSede);

    const grupos: GrupoFiltro[] = [
      {
        id: 'orden',
        titulo: 'Ordenar por',
        valor: sortOrder,
        neutro: 'recent',
        segmentado: true,
        noCuenta: true,
        onElegir: v => setSortOrder(v as typeof sortOrder),
        opciones: [
          { valor: 'recent', texto: 'Reciente' },
          { valor: 'oldest', texto: 'Más antiguo' },
          { valor: 'az',     texto: 'A–Z' },
          { valor: 'za',     texto: 'Z–A' },
        ],
      },
    ];

    if (allCategories.length > 0) {
      grupos.push({
        id: 'categoria',
        titulo: 'Categoría',
        valor: catFilter,
        neutro: 'ALL',
        tono: 'violeta',
        onElegir: setCatFilter,
        opciones: [
          { valor: 'ALL', texto: 'Todas', n: paraCat.length },
          ...allCategories.map(c => ({
            valor: c,
            texto: c.charAt(0).toUpperCase() + c.slice(1).toLowerCase(),
            n: paraCat.filter(m => m.category === c).length,
          })),
        ],
      });
    }

    grupos.push({
      id: 'sede',
      titulo: 'Sede',
      valor: locFilter,
      neutro: 'ALL',
      tono: 'azul',
      onElegir: setLocFilter,
      opciones: [
        { valor: 'ALL', texto: 'Todas', n: paraSede.length },
        ...locations.map(l => ({
          valor: l.id,
          texto: l.name,
          n: paraSede.filter(m => m.locations.some(x => x.location.id === l.id)).length,
        })),
        { valor: 'SIN_SEDE', texto: 'Sin sede', n: paraSede.filter(m => m.locations.length === 0).length },
      ],
    });

    // El estado solo aparece cuando el club ya pausó a alguien, para no agregar
    // un filtro más a quienes nunca lo van a usar.
    if (totalPausados > 0 || estadoFilter !== 'ACTIVOS') {
      grupos.push({
        id: 'estado',
        titulo: 'Estado',
        valor: estadoFilter,
        neutro: 'ACTIVOS',
        tono: 'gris',
        onElegir: v => setEstadoFilter(v as typeof estadoFilter),
        opciones: [
          { valor: 'ACTIVOS',  texto: 'Activos',  n: paraEstado.filter(m => m.active !== false).length },
          { valor: 'PAUSADOS', texto: 'En pausa', n: paraEstado.filter(m => m.active === false).length },
          { valor: 'TODOS',    texto: 'Todos',    n: paraEstado.length },
        ],
      });
    }

    return grupos;
  }, [members, search, roleFilter, catFilter, locFilter, estadoFilter, sortOrder, allCategories, locations, totalPausados]);

  // ── Initials ─────────────────────────────────────────────────────────────────
  function initials(name: string) {
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  // ── Step content renderer ────────────────────────────────────────────────────

  // ── Stats desktop (también actúan como filtros) ──────────────────────────────
  const statsDesktop: { label: string; value: number; color: string; bg: string; filter: 'ALL'|'DEPORTISTA'|'ENTRENADOR'|'ADMIN' }[] = [
    { label: 'Total',       value: members.length,                                    color: '#381DA0', bg: 'rgba(56,29,160,0.08)', filter: 'ALL'     },
    { label: 'Deportistas', value: members.filter(m => m.role === 'DEPORTISTA').length,  color: '#4361EE', bg: 'rgba(67,97,238,0.08)',  filter: 'DEPORTISTA' },
    { label: 'Entrenadores',value: members.filter(m => m.role === 'ENTRENADOR').length,    color: '#06D6A0', bg: 'rgba(6,214,160,0.10)',  filter: 'ENTRENADOR'   },
    { label: 'Admins',      value: members.filter(m => m.role === 'ADMIN').length,    color: '#FFB703', bg: 'rgba(255,183,3,0.10)',  filter: 'ADMIN'   },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-full" style={{ background: '#F7F7FB' }}>

      {/* Avisos de acciones hechas desde la lista, no desde el panel de edición */}
      <AnimatePresence>
        {errorLista && (
          <motion.div
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="mx-5 mt-3 px-4 py-3 rounded-xl flex items-start gap-3"
            style={{ background: 'rgba(239,71,111,0.10)' }}
          >
            <p className="flex-1 text-[12px] font-semibold m-0" style={{ color: '#EF476F' }}>{errorLista}</p>
            <button
              onClick={() => setErrorLista(null)}
              className="shrink-0 text-[12px] font-semibold underline"
              style={{ color: '#EF476F' }}
            >
              Cerrar
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════
          HEADER MOBILE
      ══════════════════════════════════════════════════════════════════ */}
      <div className="md:hidden px-5 py-3 flex items-center justify-between" style={{ background: '#F7F7FB' }}>
        <div>
          <h1 className="text-[22px] font-semibold text-foreground" style={{ fontFamily: 'inherit', lineHeight: 1.1 }}>Miembros</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => downloadMembersPDF(members, clubName)} disabled={members.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-border text-muted-foreground hover:bg-secondary active:scale-95 transition-all disabled:opacity-40">
            <IconDescargar className="w-4 h-4" /><span className="hidden sm:inline">PDF</span>
          </button>
          {canManage && (<>
          <button onClick={e => {
              const r = e.currentTarget.getBoundingClientRect();
              setMenuImportar({ top: r.bottom + 6, right: window.innerWidth - r.right });
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-border text-muted-foreground hover:bg-secondary active:scale-95 transition-all">
            <IconImportar className="w-4 h-4" /><span className="hidden sm:inline">Importar</span>
          </button>
          <button onClick={() => downloadMembersTemplate(locations)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-border text-muted-foreground hover:bg-secondary active:scale-95 transition-all">
            <FileSpreadsheet className="w-4 h-4" /><span className="hidden sm:inline">Plantilla</span>
          </button>
          <motion.button onClick={openNew} whileTap={reducedMotion ? {} : { scale: 0.97 }}
            transition={{ duration: 0.12, ease: EASE_OUT }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: '#381DA0' }}>
            <Plus className="w-4 h-4" /><span className="hidden sm:inline">Nuevo</span>
          </motion.button>
          </>)}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          DESKTOP LAYOUT
      ══════════════════════════════════════════════════════════════════ */}
      <div className="hidden md:flex flex-col h-full">

        {/* ── Desktop Header — full-bleed, alineado con la fila del logo en el sidebar ── */}
        <div
          className="px-5 py-3 bg-background flex items-center lg:border-b"
          style={{ minHeight: 58, borderColor: 'rgba(0,0,0,0.07)' }}
        >
          <h1 className="text-[22px] font-semibold" style={{ color: '#1A1028', fontFamily: 'inherit', lineHeight: 1.1 }}>
            Miembros
          </h1>
        </div>

        {mostrarCarga ? <ModuleLoader /> : (
        <ModuleReveal>
        <div className="px-5 pt-6">
          <PendientesInscripcion
            puedeAprobar={canManage}
            onCambio={() => qc.invalidateQueries({ queryKey: QK.members() })}
          />
          {/* ── Stats strip ── */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {statsDesktop.map(s => {
              const active = roleFilter === s.filter;
              return (
                <motion.button
                  key={s.label}
                  whileTap={reducedMotion ? {} : { scale: 0.97 }}
                  onClick={() => setRoleFilter(s.filter)}
                  className="rounded-xl md:rounded-2xl py-3 md:py-5 flex flex-col items-center justify-center w-full cursor-pointer transition-all text-center"
                  style={{
                    background: active ? s.bg : '#fff',
                    border: active ? `1.5px solid ${s.color}40` : '1px solid rgba(120,80,200,0.08)',
                    boxShadow: active ? `0 4px 16px ${s.color}20` : '0 1px 6px rgba(0,0,0,0.04)',
                  }}
                >
                  <p className="text-xl md:text-[36px] font-semibold leading-none mb-1" style={{ color: active ? s.color : '#1A1028', fontFamily: 'inherit' }}>{s.value}</p>
                  <p className="text-[10px] md:text-[13px] font-semibold md:mt-0.5" style={{ color: active ? s.color : '#8E87A8' }}>{s.label}</p>
                </motion.button>
              );
            })}
          </div>

          {/* ── Search + Filtros ── */}
          <div
            className="flex items-center gap-2 mb-4 flex-wrap"
          >
            {/* Barra de búsqueda. Sin tope de ancho: se estira hasta topar con
                los botones, para que no quede un hueco en la mitad de la fila. */}
            <div className="relative flex-1 min-w-[180px]">
              <IconBuscar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#8E87A8' }} />
              <input
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-[13px] outline-none transition-all"
                style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.12)', color: '#1A1028' }}
                placeholder="Buscar por nombre o email..."
                value={search} onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Todos los filtros en un control. Sueltos se comian la fila
                entera y empujaban los botones a un segundo renglon. */}
            <BotonFiltros
              grupos={gruposFiltro}
              resultados={{ mostrados: filtered.length, total: members.length, sustantivo: 'miembros' }}
            />

            <div className="flex items-center gap-2">
              {canManage && (
              <button onClick={e => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setMenuImportar({ top: r.bottom + 6, right: window.innerWidth - r.right });
                }}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-[13px] font-semibold transition-all hover:bg-white cursor-pointer"
                style={{ color: '#8E87A8', border: '1px solid rgba(120,80,200,0.12)' }}>
                <IconImportar className="w-4 h-4" /> Importar
              </button>
              )}
              <button onClick={() => downloadMembersPDF(members, clubName)} disabled={members.length === 0}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-[13px] font-semibold transition-all hover:bg-white cursor-pointer disabled:opacity-40"
                style={{ color: '#8E87A8', border: '1px solid rgba(120,80,200,0.12)' }}>
                <IconDescargar className="w-4 h-4" /> PDF
              </button>
              {canManage && (
              <motion.button onClick={openNew}
                whileHover={reducedMotion ? {} : { scale: 1.02 }}
                whileTap={reducedMotion ? {} : { scale: 0.97 }}
                transition={{ duration: 0.14, ease: EASE_OUT }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white cursor-pointer"
                style={{ background: '#381DA0', boxShadow: '0 4px 16px rgba(56,29,160,0.30)' }}>
                <Plus className="w-4 h-4" /> Nuevo miembro
              </motion.button>
              )}
            </div>
          </div>

          {/* Lo que está puesto, fuera del panel: si solo se viera al abrirlo,
              la lista podría estar recortada sin que nada lo diga. */}
          <ChipsFiltros grupos={gruposFiltro} />
        </div>

        {/* ── Grid de tarjetas ── */}
        <div className="px-8 pb-8">
          {filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.22, ease: EASE_OUT }}
              className="flex flex-col items-center justify-center py-32 bg-white rounded-2xl"
              style={{ border: '1px solid rgba(120,80,200,0.08)' }}
            >
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(56,29,160,0.08)' }}>
                <Users className="w-8 h-8" style={{ color: '#381DA0' }} />
              </div>
              <p className="text-[17px] font-semibold mb-1.5" style={{ color: '#1A1028', fontFamily: 'inherit' }}>
                {search ? 'Sin resultados' : 'Sin miembros aún'}
              </p>
              <p className="text-[13px] mb-6" style={{ color: '#8E87A8' }}>
                {search
                  ? `Sin coincidencias para "${search}"`
                  : canManage ? 'Agrega el primer miembro del club' : 'El club aún no tiene miembros registrados'}
              </p>
              {!search && canManage && (
                <motion.button onClick={openNew}
                  whileTap={reducedMotion ? {} : { scale: 0.97 }} transition={{ duration: 0.12 }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white cursor-pointer"
                  style={{ background: '#381DA0' }}>
                  <Plus className="w-4 h-4" /> Agregar miembro
                </motion.button>
              )}
            </motion.div>
          ) : (
            <motion.div
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } } }}
              initial="hidden" animate="show"
              className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            >
              {filtered.map((m) => {
                const rc = ROLE_COLORS[m.role] ?? ROLE_COLORS.DEPORTISTA;
                return (
                  <motion.div
                    key={m.id}
                    variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: EASE_OUT } } }}
                    whileHover={reducedMotion ? {} : { y: -3, boxShadow: '0 12px 40px rgba(56,29,160,0.14)', transition: { duration: 0.22, ease: EASE_OUT } }}
                    className="bg-white rounded-2xl overflow-hidden flex flex-col cursor-default"
                    style={{
                      border: '1px solid rgba(120,80,200,0.09)',
                      boxShadow: '0 2px 12px rgba(56,29,160,0.05)',
                    }}
                  >
                    {/* ── Cabecera con gradiente ── */}
                    {/* El pausado va en gris: en una cuadrícula de 40 fichas, el
                        color es lo que se nota antes de leer cualquier etiqueta */}
                    <div className="relative px-5 pt-5 pb-4" style={{ background: m.active === false ? 'linear-gradient(135deg,#A8A2B8,#7C7690)' : (ROLE_GRADIENT[m.role] ?? ROLE_GRADIENT.DEPORTISTA) }}>
                      {/* Patrón decorativo sutil */}
                      <div className="absolute inset-0 opacity-10" style={{
                        backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.6) 0%, transparent 60%)',
                      }} />
                      <div className="relative flex items-center gap-3">
                        {/* Avatar */}
                        {/* Blanco al 22% sobre la cabecera, que es el mismo
                            material de las pastillas de rol de al lado: la
                            cabecera se lee como una pieza sola en vez de tres
                            materiales distintos. Iba del mismo color que la
                            cabecera y no se veía —quedaban dos letras blancas
                            flotando sin disco— y en blanco sólido pesaba más
                            que el nombre. */}
                        <MemberAvatar
                          name={m.fullName}
                          photoUrl={m.pictureUrl}
                          gradient="rgba(255,255,255,0.22)"
                        />
                        <div className="min-w-0 flex-1">
                          <h3
                            className="text-white font-semibold text-[15px] leading-snug truncate"
                            style={{ fontFamily: 'inherit', textShadow: '0 1px 4px rgba(0,0,0,0.12)' }}
                          >
                            {m.fullName}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(255,255,255,0.22)', color: '#fff' }}
                            >
                              {ROLES[m.role]}
                            </span>
                            {m.active === false && (
                              <span
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"
                                style={{ background: 'rgba(0,0,0,0.28)', color: '#fff' }}
                              >
                                <IconDesactivar className="w-2.5 h-2.5" />
                                En pausa
                              </span>
                            )}
                            {m.tipo && (
                              <span
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.85)' }}
                              >
                                {m.tipo}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ── Cuerpo ── */}
                    <div className="px-5 pt-4 pb-3 flex-1 space-y-2.5">
                      {/* 1. Documento */}
                      {(m.docType || m.docNumber) && (
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(56,29,160,0.08)' }}>
                            <IconIdentificacion className="w-3 h-3" style={{ color: '#381DA0' }} />
                          </div>
                          <p className="text-[12px] font-medium" style={{ color: '#5A5278' }}>
                            {[m.docType, m.docNumber].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                      )}
                      {/* 2. Teléfono */}
                      {m.phone && (() => {
                        const { iso2, dialCode, number } = parsePhoneDisplay(m.phone);
                        return (
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(56,29,160,0.08)' }}>
                              <IconTelefono className="w-3 h-3" style={{ color: '#381DA0' }} />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="flex items-center gap-0.5">
                                <FlagImg code={iso2} size={16} />
                                <span className="text-[12px] font-medium" style={{ color: '#5A5278' }}>+{dialCode}</span>
                              </span>
                              <p className="text-[12px] font-medium" style={{ color: '#5A5278' }}>{number}</p>
                            </div>
                          </div>
                        );
                      })()}
                      {/* 3. Correo */}
                      {m.email && (
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(56,29,160,0.08)' }}>
                            <IconMail className="w-3 h-3" style={{ color: '#381DA0' }} />
                          </div>
                          <p className="text-[12px] font-medium truncate lowercase" style={{ color: '#5A5278' }}>{m.email}</p>
                        </div>
                      )}
                      {/* 4. Nacimiento */}
                      {m.birthDate && (
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(56,29,160,0.08)' }}>
                            <IconFechaNacimiento className="w-3 h-3" style={{ color: '#381DA0' }} />
                          </div>
                          <p className="text-[12px] font-medium" style={{ color: '#5A5278' }}>
                            {parseLocalDate(m.birthDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      )}
                      {/* 5. EPS */}
                      {m.eps && (
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(6,214,160,0.08)' }}>
                            <IconEps className="w-3 h-3" style={{ color: '#06D6A0' }} />
                          </div>
                          <p className="text-[12px] font-medium" style={{ color: '#5A5278' }}>{m.eps}</p>
                        </div>
                      )}

                      {/* Sedes */}
                      {m.locations.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {m.locations.map(l => (
                            <span
                              key={l.location.id}
                              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(56,29,160,0.08)', color: '#381DA0' }}
                            >
                              <IconUbicacion className="w-2.5 h-2.5" />
                              {l.location.name}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Acudiente — solo si existe */}
                      {m.emergencyContact && (
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(67,97,238,0.08)' }}>
                            <IconAcudiente className="w-3 h-3" style={{ color: '#4361EE' }} />
                          </div>
                          <p className="text-[12px] font-medium" style={{ color: '#5A5278' }}>{m.emergencyContact}</p>
                        </div>
                      )}
                    </div>

                    {/* ── Acciones ── */}
                    <div className="px-4 pb-4 pt-1 flex gap-2">
                      {canManage && (
                      <motion.button
                        onClick={() => openEdit(m)}
                        whileHover={reducedMotion ? {} : { scale: 1.02 }}
                        whileTap={reducedMotion ? {} : { scale: 0.97 }}
                        transition={{ duration: 0.12, ease: EASE_OUT }}
                        className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold text-white flex items-center justify-center gap-1.5 cursor-pointer"
                        style={{ background: '#381DA0', boxShadow: '0 3px 12px rgba(56,29,160,0.22)' }}
                      >
                        <Pencil className="w-3.5 h-3.5" /> Editar
                      </motion.button>
                      )}
                      {/* Sin permisos de gestion, ver el detalle es la unica accion
                          disponible, asi que ocupa toda la fila */}
                      <motion.button
                        onClick={() => setViewMember(m)}
                        whileHover={reducedMotion ? {} : { scale: 1.02 }}
                        whileTap={reducedMotion ? {} : { scale: 0.97 }}
                        transition={{ duration: 0.12, ease: EASE_OUT }}
                        className={canManage
                          ? 'w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer shrink-0'
                          : 'flex-1 py-2.5 rounded-xl text-[12px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer'}
                        style={{ background: 'rgba(56,29,160,0.08)', color: '#381DA0' }}
                        aria-label="Ver deportista"
                      >
                        <IconVer className="w-4 h-4" style={{ color: '#381DA0' }} />
                        {!canManage && 'Ver detalle'}
                      </motion.button>
                      {canManage && !esUnoMismo(m) && (
                      <motion.button
                        onClick={() => handleToggleEstado(m)}
                        disabled={cambiandoEstado === m.id}
                        whileHover={reducedMotion ? {} : { scale: 1.05 }}
                        whileTap={reducedMotion ? {} : { scale: 0.95 }}
                        transition={{ duration: 0.12, ease: EASE_OUT }}
                        className="w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer shrink-0 disabled:opacity-50"
                        style={{ background: m.active === false ? 'rgba(6,214,160,0.10)' : 'rgba(142,135,168,0.12)' }}
                        aria-label={m.active === false ? 'Reactivar miembro' : 'Desactivar miembro'}
                      >
                        {m.active === false
                          ? <PlayCircle className="w-4 h-4" style={{ color: '#06D6A0' }} />
                          : <IconDesactivar className="w-4 h-4" style={{ color: '#5B5470' }} />}
                      </motion.button>
                      )}
                      {/* Ni eliminar ni pausar la propia cuenta: las dos dejan a
                          quien las usa fuera de su club. La API ya rechaza ambas. */}
                      {canManage && !esUnoMismo(m) && (
                      <motion.button
                        onClick={() => handleDelete(m.id)}
                        whileHover={reducedMotion ? {} : { scale: 1.05 }}
                        whileTap={reducedMotion ? {} : { scale: 0.95 }}
                        transition={{ duration: 0.12, ease: EASE_OUT }}
                        className="w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer shrink-0"
                        style={{ background: 'rgba(239,71,111,0.08)' }}
                        aria-label="Eliminar miembro"
                      >
                        <IconEliminar className="w-4 h-4" style={{ color: '#EF476F' }} />
                      </motion.button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>
        </ModuleReveal>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          MOBILE LAYOUT
      ══════════════════════════════════════════════════════════════════ */}
      {mostrarCarga ? <div className="md:hidden"><ModuleLoader /></div> : (
      <motion.div variants={pageStagger} initial="hidden" animate="show" className="md:hidden px-4 pt-4 flex flex-col gap-3">
        <ModuleReveal>
        <PendientesInscripcion
          puedeAprobar={canManage}
          onCambio={() => qc.invalidateQueries({ queryKey: QK.members() })}
        />
        {/* Stats móvil como filtros */}
        <motion.div variants={pageCard} className="grid grid-cols-4 gap-2">
          {statsDesktop.map(s => {
            const active = roleFilter === s.filter;
            return (
              <button
                key={s.label}
                onClick={() => setRoleFilter(s.filter)}
                className="rounded-xl py-3 flex flex-col items-center justify-center transition-all text-center"
                style={{
                  background: active ? s.bg : '#fff',
                  border: active ? `1.5px solid ${s.color}40` : '1px solid rgba(120,80,200,0.08)',
                  boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
                }}
              >
                <p className="text-xl font-semibold leading-none mb-1" style={{ color: active ? s.color : '#1A1028', fontFamily: 'inherit' }}>{s.value}</p>
                <p className="text-[10px] font-semibold text-center leading-tight" style={{ color: active ? s.color : '#8E87A8' }}>{s.label}</p>
              </button>
            );
          })}
        </motion.div>

        {/* Búsqueda y filtros en la misma fila: en el celular cada uno en su
            renglón gastaba dos franjas de la pantalla antes de la lista. */}
        <motion.div variants={pageCard}>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <IconBuscar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-9 bg-white border-border rounded-xl" placeholder="Buscar miembro..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <BotonFiltros
              grupos={gruposFiltro}
              resultados={{ mostrados: filtered.length, total: members.length, sustantivo: 'miembros' }}
              alto={40}
              soloIcono
            />
          </div>
          <ChipsFiltros grupos={gruposFiltro} />
        </motion.div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-border p-10 text-center mt-2">
            <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{search ? 'Sin resultados.' : 'No hay miembros registrados aún.'}</p>
            {!search && canManage && (
              <button onClick={openNew} className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold border border-border text-muted-foreground hover:bg-secondary transition-colors">
                Agregar primer miembro
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2 pb-28">
            {filtered.map(m => {
              const rc = ROLE_COLORS[m.role] ?? ROLE_COLORS.DEPORTISTA;
              return (
                <motion.div key={m.id} layout
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: EASE_OUT }}
                  className="bg-white border border-border rounded-xl px-3 py-3">
                  <div className="flex items-center gap-3">
                  <MemberAvatar
                    name={m.fullName}
                    photoUrl={m.pictureUrl}
                    gradient={ROLE_GRADIENT[m.role] ?? ROLE_GRADIENT.DEPORTISTA}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="text-[13px] font-semibold text-foreground truncate">{m.fullName}</p>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style={{ color: rc.text, background: rc.bg }}>{ROLES[m.role]}</span>
                      {m.active === false && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style={{ color: '#5B5470', background: 'rgba(142,135,168,0.15)' }}>En pausa</span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate lowercase">{m.email ?? '—'}</p>
                    {m.role === 'DEPORTISTA' && (
                      <div className="flex gap-2 mt-0.5 flex-wrap">
                        {m.category && <span className="text-[10px] font-semibold" style={{ color: '#381DA0' }}>{m.category}</span>}
                        {m.tipo && <span className="text-[10px] text-muted-foreground">{m.tipo}</span>}
                        {m.paymentDueDay && <span className="text-[10px] text-muted-foreground">Día {m.paymentDueDay}</span>}
                      </div>
                    )}
                  </div>

                  {/* Las acciones viven en la hoja inferior, no en la ficha. Con
                      cuatro botones en cada fila la lista se leia como una lista
                      de botones y cada ficha gastaba unos 45 px de mas: en un club
                      de 40 deportistas, casi 1.800 px de recorrido.

                      Sin permisos de gestion solo se puede ver el detalle, y una
                      accion suelta no justifica un menu: el boton la ejecuta. */}
                  {canManage ? (
                    <motion.button
                      onClick={() => setAccionesMember(m)}
                      whileTap={reducedMotion ? {} : { scale: 0.9 }}
                      transition={{ duration: 0.12, ease: EASE_OUT }}
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ color: '#8E87A8' }}
                      aria-label={`Acciones de ${m.fullName}`}
                    >
                      <MoreVertical className="w-[18px] h-[18px]" />
                    </motion.button>
                  ) : (
                    <motion.button
                      onClick={() => setViewMember(m)}
                      whileTap={reducedMotion ? {} : { scale: 0.9 }}
                      transition={{ duration: 0.12, ease: EASE_OUT }}
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ color: '#381DA0' }}
                      aria-label={`Ver a ${m.fullName}`}
                    >
                      <IconVer className="w-[17px] h-[17px]" />
                    </motion.button>
                  )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
        </ModuleReveal>
      </motion.div>
      )}

      {/* ── Hoja de acciones del miembro (móvil) ─────────────────────────────
          Sube desde el borde inferior, que es donde el pulgar llega sin
          reacomodar la mano. A diferencia de un menú flotante, acá hay espacio
          para decir qué hace cada acción: "pausar" y "eliminar" no se explican
          solos con un ícono, y la diferencia entre los dos importa.

          Va en un portal al body a proposito. Dentro de la pagina, la hoja
          queda encerrada en el contexto de apilamiento del <main>, asi que su
          z-index compite solo ahi adentro y la barra de navegacion del layout
          le pasa por encima tapando las ultimas opciones. Montada en la raiz
          del documento, el z-index vuelve a valer contra la barra. */}
      {typeof document !== 'undefined' && createPortal(
      <AnimatePresence>
        {accionesMember && (
          <>
            <motion.div
              key="acciones-velo"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: EASE_OUT }}
              className="md:hidden fixed inset-0"
              style={{ background: 'rgba(15,10,30,0.5)', zIndex: 60 }}
              onClick={() => setAccionesMember(null)}
            />
            <motion.div
              key="acciones-hoja"
              role="dialog"
              aria-label={`Acciones de ${accionesMember.fullName}`}
              initial={reducedMotion ? { opacity: 0 } : { y: '100%' }}
              animate={reducedMotion ? { opacity: 1 } : { y: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { y: '100%' }}
              transition={reducedMotion ? { duration: 0.15 } : { duration: 0.3, ease: EASE_IOS }}
              className="md:hidden fixed left-0 right-0 bottom-0 bg-white"
              style={{
                zIndex: 61,
                borderRadius: '22px 22px 0 0',
                padding: '8px 12px calc(18px + env(safe-area-inset-bottom))',
                boxShadow: '0 -8px 32px rgba(26,16,40,0.18)',
              }}
            >
              <div className="mx-auto mb-3" style={{ width: 36, height: 4, borderRadius: 99, background: 'rgba(26,16,40,0.16)' }} />

              <div className="flex items-center gap-3 px-1 pb-3 mb-1" style={{ borderBottom: '1px solid rgba(26,16,40,0.07)' }}>
                <MemberAvatar
                  name={accionesMember.fullName}
                  photoUrl={accionesMember.pictureUrl}
                  gradient={ROLE_GRADIENT[accionesMember.role] ?? ROLE_GRADIENT.DEPORTISTA}
                />
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-foreground truncate">{accionesMember.fullName}</p>
                  <p className="text-[11px] text-muted-foreground truncate lowercase">{accionesMember.email ?? '—'}</p>
                </div>
              </div>

              {(() => {
                const m = accionesMember;
                const enPausa = m.active === false;
                const cerrarY = (accion: () => void) => () => { setAccionesMember(null); accion(); };
                // Pausarse a uno mismo deja fuera del club igual que borrarse, y
                // la API tambien lo rechaza: ofrecer el boton solo lleva a un
                // error seguro.
                const propio = esUnoMismo(m);
                const opciones = [
                  { icon: Pencil, label: 'Editar', hint: 'Datos, sede y rol', color: '#5B5470', onClick: cerrarY(() => openEdit(m)) },
                  { icon: IconVer, label: 'Ver detalle', hint: 'Ficha completa', color: '#5B5470', onClick: cerrarY(() => setViewMember(m)) },
                  ...(propio ? [] : [
                    enPausa
                      ? { icon: PlayCircle, label: 'Reactivar', hint: 'Vuelve a la asistencia y a la cuota', color: '#06D6A0', onClick: cerrarY(() => handleToggleEstado(m)) }
                      : { icon: IconDesactivar, label: 'Pausar', hint: 'Deja de generar cuota, conserva su historial', color: '#5B5470', onClick: cerrarY(() => handleToggleEstado(m)) },
                  ]),
                ];
                return (
                  <>
                    {opciones.map(op => (
                      <button
                        key={op.label}
                        onClick={op.onClick}
                        className="w-full flex items-center gap-3 px-2 py-3 rounded-xl text-left active:bg-secondary transition-colors"
                      >
                        <op.icon className="w-[18px] h-[18px] shrink-0" style={{ color: op.color }} />
                        <span className="min-w-0">
                          <span className="block text-[13.5px] font-semibold text-foreground">{op.label}</span>
                          <span className="block text-[11px] text-muted-foreground">{op.hint}</span>
                        </span>
                      </button>
                    ))}
                    {/* La propia cuenta no se puede eliminar: hacerlo revoca el
                        acceso y banea al que la borro. La API lo rechaza; aca ni
                        siquiera se ofrece. */}
                    {!propio && (<>
                    <div className="my-1 mx-2" style={{ height: 1, background: 'rgba(26,16,40,0.07)' }} />
                    <button
                      onClick={cerrarY(() => handleDelete(m.id))}
                      className="w-full flex items-center gap-3 px-2 py-3 rounded-xl text-left transition-colors"
                      style={{ color: '#EF476F' }}
                    >
                      <IconEliminar className="w-[18px] h-[18px] shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-[13.5px] font-semibold">Eliminar</span>
                        <span className="block text-[11px]" style={{ color: 'rgba(239,71,111,0.75)' }}>No se puede deshacer</span>
                      </span>
                    </button>
                    </>)}
                  </>
                );
              })()}
            </motion.div>
          </>
        )}
      </AnimatePresence>,
      document.body)}

      {/* ═══════════════════════════════════════════════════════════════════
          NUEVO PANEL — bottom sheet multi-paso
      ═══════════════════════════════════════════════════════════════════ */}

      {typeof document !== 'undefined' && createPortal(
      <>
      {/* Backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            className="fixed inset-0"
            style={{ background: 'rgba(15,10,30,0.52)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', zIndex: 100 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => !saving && setOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Modal centrado */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="sheet"
            className="fixed inset-0 flex items-center justify-center px-4"
            style={{ pointerEvents: 'none', zIndex: 101 }}
          >
            <motion.div
              className="bg-white flex flex-col w-full"
              style={{
                maxWidth: 760,
                borderRadius: 28,
                maxHeight: '92dvh',
                boxShadow: '0 24px 64px rgba(56,29,160,0.18), 0 4px 16px rgba(0,0,0,0.08)',
                pointerEvents: 'auto',
              }}
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: -12 }}
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: -12 }}
              transition={{ duration: 0.26, ease: EASE_OUT }}
            >

            {/* Header */}
            <div className="px-6 pt-5 pb-3 flex items-start justify-between shrink-0">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#381DA0' }}>
                  {editing ? 'Editar miembro' : 'Nuevo miembro'}
                </p>
                <h2 className="text-[22px] font-semibold text-foreground leading-tight mt-0.5" style={{ fontFamily: 'inherit' }}>
                  {editing ? editing.fullName : 'Datos del deportista'}
                </h2>
              </div>
              <motion.button
                whileTap={reducedMotion ? {} : { scale: 0.93 }}
                transition={{ duration: 0.1 }}
                onClick={() => !saving && setOpen(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center mt-1 shrink-0"
                style={{ background: 'rgba(142,135,168,0.12)' }}
              >
                <X className="w-4 h-4" style={{ color: '#8E87A8' }} />
              </motion.button>
            </div>

            {/* El formulario trae sus propios pasos y su pie: es el mismo
                recorrido que el formulario publico, para que quien llene uno
                reconozca el otro. */}
            <FichaDeportista
              datos={form}
              onCambio={setForm}
              sedes={locations}
              esNuevo={!editing}
              erroresServidor={erroresCampo}
              verificar={verificarDuplicado}
              archivos={{
                doc: editing?.docFileUrl ?? undefined,
                insurance: editing?.insuranceFileUrl ?? undefined,
              }}
              onArchivo={(campo, archivo) => setArchivos(a => ({ ...a, [campo]: archivo }))}
              onGuardar={handleSave}
              guardando={saving}
              onCancelar={() => !saving && setOpen(false)}
              botonGuardar={
                <ContenidoGuardado
                  estado={estadoGuardado}
                  textoGuardando="Guardando"
                  textoGuardado="Guardado"
                  color="#fff"
                  textoIdle={editing ? 'Guardar cambios' : 'Crear miembro'}
                />
              }
            />

            {error && (
              <p className="px-6 pb-4 text-[11.5px] m-0" style={{ color: '#EF476F' }}>{error}</p>
            )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </>,
      document.body
      )}

      {/* ── Modal Ver Deportista ────────────────────────────────────────── */}
      <div>
      <AnimatePresence>
        {viewMember && (
          <>
            <motion.div
              key="view-backdrop"
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(15,10,30,0.52)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setViewMember(null)}
            />
            <motion.div
              key="view-modal"
              className="fixed inset-0 z-50 flex items-center justify-center px-4"
              style={{ pointerEvents: 'none' }}
            >
              <motion.div
                className="bg-white flex flex-col w-full overflow-hidden"
                style={{
                  maxWidth: 440,
                  borderRadius: 28,
                  maxHeight: '88dvh',
                  boxShadow: '0 24px 64px rgba(56,29,160,0.18), 0 4px 16px rgba(0,0,0,0.08)',
                  pointerEvents: 'auto',
                }}
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: -12 }}
                animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: -12 }}
                transition={{ duration: 0.26, ease: EASE_OUT }}
              >
                {/* Hero del deportista */}
                <div className="relative px-6 pt-6 pb-5" style={{ background: ROLE_GRADIENT[viewMember.role] ?? ROLE_GRADIENT.DEPORTISTA }}>
                  <button
                    onClick={() => setViewMember(null)}
                    className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,0.2)' }}
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-semibold text-white shrink-0"
                      style={{ background: 'rgba(255,255,255,0.2)' }}>
                      {initials(viewMember.fullName)}
                    </div>
                    <div>
                      <p className="text-white/70 text-[11px] font-semibold uppercase tracking-widest mb-0.5">
                        {ROLES[viewMember.role]}
                      </p>
                      <h2 className="text-white font-semibold text-[18px] leading-tight" style={{ fontFamily: 'inherit' }}>
                        {viewMember.fullName}
                      </h2>
                      {viewMember.category && (
                        <p className="text-white/80 text-[12px] mt-0.5">{viewMember.category}{viewMember.tipo ? ` · ${viewMember.tipo}` : ''}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Info scrollable */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

                  {/* 1. Documento */}
                  {(viewMember.docType || viewMember.docNumber) && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Documento</p>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(56,29,160,0.08)' }}>
                          <IconIdentificacion className="w-3.5 h-3.5" style={{ color: '#381DA0' }} />
                        </div>
                        <div>
                          {viewMember.docType && (
                            <p className="text-[10px] text-muted-foreground">{viewMember.docType}</p>
                          )}
                          {viewMember.docNumber && (
                            <p className="text-[13px] font-semibold text-foreground">{viewMember.docNumber}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 2. Contacto */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Contacto</p>
                    <div className="space-y-2.5">
                      {viewMember.phone && (() => {
                        const { iso2, dialCode, number } = parsePhoneDisplay(viewMember.phone);
                        return (
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(56,29,160,0.08)' }}>
                              <IconTelefono className="w-3.5 h-3.5" style={{ color: '#381DA0' }} />
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground">Teléfono</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="flex items-center gap-0.5">
                                  <FlagImg code={iso2} size={16} />
                                  <span className="text-[13px] font-semibold text-foreground">+{dialCode}</span>
                                </span>
                                <p className="text-[13px] font-semibold text-foreground">{number}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                      {viewMember.email && (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(56,29,160,0.08)' }}>
                            <IconMail className="w-3.5 h-3.5" style={{ color: '#381DA0' }} />
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Correo</p>
                            <p className="text-[13px] font-semibold text-foreground">{viewMember.email}</p>
                          </div>
                        </div>
                      )}
                      {viewMember.birthDate && (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(56,29,160,0.08)' }}>
                            <IconFechaNacimiento className="w-3.5 h-3.5" style={{ color: '#381DA0' }} />
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Nacimiento</p>
                            <p className="text-[13px] font-semibold text-foreground">
                              {parseLocalDate(viewMember.birthDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3. Acudiente */}
                  {(viewMember.emergencyContact || viewMember.emergencyPhone) && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Acudiente</p>
                      <div className="space-y-2.5">
                        {viewMember.emergencyContact && (
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(67,97,238,0.08)' }}>
                              <IconAcudiente className="w-3.5 h-3.5" style={{ color: '#4361EE' }} />
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground">Nombre</p>
                              <p className="text-[13px] font-semibold text-foreground">{viewMember.emergencyContact}</p>
                            </div>
                          </div>
                        )}
                        {viewMember.emergencyPhone && (() => {
                          const { iso2, dialCode, number } = parsePhoneDisplay(viewMember.emergencyPhone);
                          return (
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(67,97,238,0.08)' }}>
                                <IconTelefono className="w-3.5 h-3.5" style={{ color: '#4361EE' }} />
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground">Teléfono</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="flex items-center gap-0.5">
                                    <FlagImg code={iso2} size={16} />
                                    <span className="text-[13px] font-semibold text-foreground">+{dialCode}</span>
                                  </span>
                                  <p className="text-[13px] font-semibold text-foreground">{number}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* 4. Salud */}
                  {viewMember.eps && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Salud</p>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(6,214,160,0.08)' }}>
                          <IconEps className="w-3.5 h-3.5" style={{ color: '#06D6A0' }} />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">EPS</p>
                          <p className="text-[13px] font-semibold text-foreground">{viewMember.eps}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Sedes */}
                  {viewMember.locations.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Sedes</p>
                      <div className="flex flex-wrap gap-2">
                        {viewMember.locations.map(l => (
                          <div key={l.location.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: 'rgba(56,29,160,0.08)' }}>
                            <IconUbicacion className="w-3 h-3 shrink-0" style={{ color: '#381DA0' }} />
                            <span className="text-[12px] font-semibold" style={{ color: '#381DA0' }}>{l.location.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Acción editar */}
                <div className="px-6 py-4 border-t border-border shrink-0">
                  <motion.button
                    whileTap={reducedMotion ? {} : { scale: 0.97 }}
                    transition={{ duration: 0.12, ease: EASE_OUT }}
                    onClick={() => { setViewMember(null); openEdit(viewMember); }}
                    className="w-full py-3.5 rounded-2xl font-semibold text-[14px] text-white flex items-center justify-center gap-2"
                    style={{ background: '#381DA0' }}
                  >
                    <Pencil className="w-4 h-4" />
                    Editar información
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      </div>

      {/* ── Modal importar Excel ────────────────────────────────────────────── */}
      {/* Las dos formas de traer una lista completa, colgadas del boton */}
      <MenuImportar
        abierto={menuImportar !== null}
        anclaje={menuImportar}
        onCerrar={() => setMenuImportar(null)}
        onFormulario={() => setInscripcionAbierta(true)}
        onExcel={() => setImportOpen(true)}
      />
      <PanelInscripcion
        abierto={inscripcionAbierta}
        onCerrar={() => setInscripcionAbierta(false)}
      />

      <Dialog open={importOpen} onOpenChange={v => { if (!importing) { setImportOpen(v); setImportErrors([]); setImportWarnings([]); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Importar desde Excel</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-[12px] text-muted-foreground">
              Sube el archivo Excel con la plantilla completada. Los deportistas con el mismo correo no se duplicarán.
            </p>
            {/* Input real oculto — evita que el file picker del OS cierre el dialog */}
            <label
              className="border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center gap-3 cursor-pointer hover:border-primary transition-colors"
              htmlFor="import-file-input"
            >
              <FileSpreadsheet className="w-8 h-8 text-muted-foreground/40" />
              {importing
                ? <p className="text-[12px] font-semibold text-primary">Importando...</p>
                : <p className="text-[12px] font-semibold text-muted-foreground">Toca para seleccionar .xlsx</p>
              }
            </label>
            <input
              id="import-file-input"
              type="file"
              accept=".xlsx,.xls"
              className="sr-only"
              disabled={importing}
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) {
                  handleImport(file);
                  // Limpiar el input para permitir seleccionar el mismo archivo de nuevo
                  e.target.value = '';
                }
              }}
            />
            {importErrors.length > 0 && (
              <div className="bg-red-50 rounded-xl p-3 space-y-1 max-h-40 overflow-y-auto">
                {importErrors.map((e, i) => <p key={i} className="text-[11px] text-red-600">{e}</p>)}
              </div>
            )}
            {importWarnings.length > 0 && (
              <div className="bg-amber-50 rounded-xl p-3 space-y-1 max-h-40 overflow-y-auto">
                <p className="text-[11px] font-semibold text-amber-800">
                  Se importaron todos, pero revisa esto:
                </p>
                {importWarnings.map((w, i) => <p key={i} className="text-[11px] text-amber-700">{w}</p>)}
              </div>
            )}
            <button
              onClick={() => downloadMembersTemplate(locations)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-border text-[12px] font-semibold text-muted-foreground hover:bg-secondary"
            >
              <FileSpreadsheet className="w-4 h-4" />Descargar plantilla
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
