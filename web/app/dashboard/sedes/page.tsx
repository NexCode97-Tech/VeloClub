'use client';
import { motion } from 'framer-motion';
import { stagger, cardVariant } from '@/lib/page-animations';
import dynamic from 'next/dynamic';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState, useRef } from 'react';
import { COLOMBIA } from '@/lib/colombia';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  LocateFixed, X, ChevronRight, ChevronDown, AlertCircle, AlertTriangle,
} from 'lucide-react';
import ModuleLoader, { useCargaMinima } from '@/components/ui/module-loader';
import ModuleReveal from '@/components/ui/module-reveal';
import {
  IconBuscar, IconEditar, IconEliminar, IconMas, IconUbicacion,
} from '@/components/ui/custom-icons';

// Carga dinámica del mapa (no SSR — Leaflet requiere window)
const LocationMapPicker = dynamic(
  () => import('@/components/ui/location-map-picker').then(m => m.LocationMapPicker),
  { ssr: false, loading: () => (
    <div className="flex items-center justify-center rounded-xl bg-muted" style={{ height: 280 }}>
      <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  )}
);

interface Location {
  id: string;
  name: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
}

// ── Botones de apps de mapas ─────────────────────────────────────────────────

function MapButtons({ lat, lng }: { lat: number; lng: number }) {
  return (
    <div className="flex items-center gap-1.5 mt-2.5">
      <span className="text-[10px] text-muted-foreground mr-0.5">Abrir en:</span>
      <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noopener noreferrer"
        className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors"
        style={{ background: 'rgba(120,80,200,0.08)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/google-maps-sign-logo.png" alt="Google Maps" className="w-3.5 h-3.5 object-contain shrink-0" />
        <span className="whitespace-nowrap">Google</span>
      </a>
      <a href={`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`} target="_blank" rel="noopener noreferrer"
        className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors"
        style={{ background: 'rgba(120,80,200,0.08)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/waze-icon-logo.png" alt="Waze" className="w-3.5 h-3.5 object-contain shrink-0" />
        <span className="whitespace-nowrap">Waze</span>
      </a>
      <a href={`https://maps.apple.com/?ll=${lat},${lng}`} target="_blank" rel="noopener noreferrer"
        className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors"
        style={{ background: 'rgba(120,80,200,0.08)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/apple-maps-icon-seeklogo.png" alt="Apple Maps" className="w-3.5 h-3.5 object-contain shrink-0" />
        <span className="whitespace-nowrap">Maps</span>
      </a>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────

export default function SedesPage() {
  const { getToken } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [loading, setLoading] = useState(true);
  // Sostiene el indicador un minimo de tiempo para que no parpadee
  const mostrarCarga = useCargaMinima(loading);
  const [clubDepartment, setClubDepartment] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);

  // Dialog crear/editar
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');  // municipio
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  // Un fallo al borrar tiene que verse. Antes no habia donde mostrarlo y la
  // pantalla se quedaba igual, como si no hubiera pasado nada.
  const [errorSede, setErrorSede] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Selector municipio
  const [muniOpen, setMuniOpen] = useState(false);
  const [muniSearch, setMuniSearch] = useState('');
  const muniRef = useRef<HTMLDivElement>(null);

  // Dialog mapa
  const [mapOpen, setMapOpen] = useState(false);

  // Municipios filtrados por departamento del club
  const municipios = clubDepartment ? (COLOMBIA[clubDepartment] ?? []).sort() : [];
  const filteredMunis = muniSearch.trim()
    ? municipios.filter(m => m.toLowerCase().includes(muniSearch.toLowerCase()))
    : municipios;

  // Cerrar dropdown al clic fuera
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (muniRef.current && !muniRef.current.contains(e.target as Node)) {
        setMuniOpen(false);
        setMuniSearch('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function load() {
    const token = await getToken();
    const [locRes, clubRes, meRes] = await Promise.allSettled([
      apiFetch<{ locations: Location[] }>('/locations', { token }),
      apiFetch<{ club: { department?: string } }>('/clubs/settings', { token }),
      apiFetch<{ status: string; user?: { role: string } }>('/me', { token }),
    ]);
    if (locRes.status === 'fulfilled') setLocations(locRes.value.locations);
    if (clubRes.status === 'fulfilled') setClubDepartment(clubRes.value.club.department ?? null);
    if (meRes.status === 'fulfilled') {
      // Solo el administrador gestiona sedes; el resto las ve sin editarlas
      setCanManage(meRes.value.user?.role === 'ADMIN');
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null);
    setName(''); setAddress('');
    setLat(null); setLng(null);
    setError(null);
    setOpen(true);
  }

  function openEdit(loc: Location) {
    setEditing(loc);
    setName(loc.name);
    setAddress(loc.address ?? '');
    setLat(loc.latitude ?? null);
    setLng(loc.longitude ?? null);
    setError(null);
    setOpen(true);
  }

  function handleMapConfirm(selLat: number, selLng: number, displayAddress: string) {
    setLat(selLat);
    setLng(selLng);
    if (!address.trim()) setAddress(displayAddress);
    setMapOpen(false);
  }

  function clearLocation() {
    setLat(null);
    setLng(null);
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true); setError(null);
    try {
      const token = await getToken();
      const body = JSON.stringify({
        name: name.trim(),
        address: address.trim() || undefined,
        latitude: lat,
        longitude: lng,
      });
      if (editing) {
        await apiFetch(`/locations/${editing.id}`, { method: 'PUT', token, body });
      } else {
        await apiFetch('/locations', { method: 'POST', token, body });
      }
      setOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const sede = locations.find(l => l.id === id);
    // La confirmacion dice lo que de verdad pasa. Borrar una sede no es solo
    // quitarla del listado: se lleva por delante las clases de su horario,
    // desasigna a los deportistas, y la asistencia, los pagos y los
    // movimientos de caja que tenia atribuidos quedan sin sede.
    const aviso =
      `¿Eliminar la sede «${sede?.name ?? ''}»?\n\n` +
      '• Se eliminan las clases de su horario.\n' +
      '• Los deportistas dejan de estar asignados a ella.\n' +
      '• La asistencia, los pagos y los movimientos de caja se conservan, pero quedan sin sede.\n\n' +
      'Esto no se puede deshacer.';
    if (!confirm(aviso)) return;

    setErrorSede('');
    try {
      const token = await getToken();
      await apiFetch(`/locations/${id}`, { method: 'DELETE', token });
      await load();
    } catch (err) {
      setErrorSede(err instanceof Error ? err.message : 'No se pudo eliminar la sede');
    }
  }

  // La busqueda ignora tildes: los municipios se escriben con y sin ellas
  // indistintamente, y comparando el texto crudo «Bucaramanga» encontraba
  // pero «Chinacota» no encontraba «Chinácota».
  const sinTilde = (t: string) =>
    t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const termino = sinTilde(busqueda.trim());
  const visibles = termino
    ? locations.filter(l =>
        sinTilde(l.name).includes(termino) ||
        sinTilde(l.address ?? '').includes(termino))
    : locations;

  return (
    <div className="min-h-full bg-background">
      {/* Header — borde inferior alineado con la fila del logo en el sidebar.
          Altura fija, no minima: cualquier hijo que pase de 34px estiraria la
          fila y bajaria la linea divisoria respecto a la del sidebar. */}
      <div className="px-5 h-[58px] bg-background flex items-center lg:border-b" style={{ borderColor: 'rgba(0,0,0,0.07)' }}>
        <div>
          <h1 className="text-[22px] font-semibold text-foreground" style={{ fontFamily: 'inherit', lineHeight: 1.1 }}>
            Sedes
          </h1>
        </div>
      </div>

      {errorSede && (
        <div className="mx-5 mt-3 flex items-start gap-2 rounded-xl px-4 py-3"
          style={{ background: 'rgba(239,71,111,0.08)', border: '1px solid rgba(239,71,111,0.20)' }}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#EF476F' }} />
          <p className="flex-1 text-[12.5px]" style={{ color: '#B02A47' }}>{errorSede}</p>
          <button onClick={() => setErrorSede('')} aria-label="Cerrar aviso"
            className="text-[11px] font-bold shrink-0" style={{ color: '#B02A47' }}>Cerrar</button>
        </div>
      )}

      {/* Dialog crear/editar sede */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar sede' : 'Nueva sede'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Sede Norte" />
            </div>
            {/* Selector de municipio */}
            <div className="space-y-2" ref={muniRef}>
              <Label>Municipio</Label>
              {!clubDepartment ? (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-muted/50">
                  <AlertCircle className="w-4 h-4 shrink-0 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    Configura el departamento del club en{' '}
                    <a href="/dashboard/ajustes" className="text-primary underline underline-offset-2">Ajustes</a>
                    {' '}para seleccionar municipio.
                  </p>
                </div>
              ) : (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { setMuniOpen(o => !o); setMuniSearch(''); }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  >
                    <span className={address ? 'text-foreground' : 'text-muted-foreground'}>
                      {address || `Seleccionar municipio de ${clubDepartment}`}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${muniOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {muniOpen && (
                    <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-border rounded-xl shadow-lg overflow-hidden">
                      {/* Búsqueda dentro del dropdown */}
                      <div className="p-2 border-b border-border">
                        <input
                          autoFocus
                          type="text"
                          value={muniSearch}
                          onChange={e => setMuniSearch(e.target.value)}
                          placeholder="Buscar municipio..."
                          className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-muted/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {filteredMunis.length === 0 ? (
                          <p className="px-3 py-3 text-xs text-muted-foreground text-center">Sin resultados</p>
                        ) : filteredMunis.map(m => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => { setAddress(m); setMuniOpen(false); setMuniSearch(''); }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-secondary/60 transition-colors ${address === m ? 'text-primary font-semibold bg-primary/5' : 'text-foreground'}`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Ubicación GPS */}
            <div className="space-y-2">
              <Label>Ubicación GPS</Label>

              {lat && lng ? (
                /* Chip coordenadas guardadas */
                <div className="flex items-center justify-between bg-[rgba(6,214,160,0.08)] border border-[rgba(6,214,160,0.25)] rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <LocateFixed className="w-4 h-4 shrink-0" style={{ color: '#06D6A0' }} />
                    <div>
                      <p className="text-xs font-semibold text-foreground">Ubicación guardada</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{lat.toFixed(5)}, {lng.toFixed(5)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setMapOpen(true)}
                      className="px-2 py-1 rounded-lg text-[11px] font-medium text-primary hover:bg-primary/10 transition-colors"
                    >
                      Editar
                    </button>
                    <button onClick={clearLocation} className="p-1 rounded-lg hover:bg-black/5 transition-colors">
                      <X className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              ) : (
                /* Botón abrir mapa */
                <button
                  onClick={() => setMapOpen(true)}
                  className="w-full flex items-center justify-between px-3 py-3 rounded-xl border border-dashed border-border hover:border-primary/40 hover:bg-secondary/40 transition-all group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(56,29,160,0.10)' }}>
                      <IconUbicacion className="w-4 h-4" style={{ color: '#381DA0' }} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-foreground">Seleccionar en el mapa</p>
                      <p className="text-[10px] text-muted-foreground">Busca o toca para colocar el pin</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </button>
              )}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={handleSave} disabled={saving || !name.trim()} className="w-full">
              {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear sede'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog mapa */}
      <Dialog open={mapOpen} onOpenChange={setMapOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Seleccionar ubicación</DialogTitle>
          </DialogHeader>
          <LocationMapPicker
            initialLat={lat}
            initialLng={lng}
            onConfirm={handleMapConfirm}
            onClose={() => setMapOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Buscador y accion, en la misma fila. El boton vivia en la cabecera;
          alli quedaba lejos de la lista y dejaba la fila del titulo desbalanceada
          contra el resto de modulos, que tampoco llevan acciones arriba. Las
          medidas son las de Miembros para que las dos pantallas se lean igual. */}
      {!mostrarCarga && locations.length > 0 && (
        <div className="px-4 pt-4 lg:pt-6">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <IconBuscar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#8E87A8' }} />
              <input
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-[13px] outline-none transition-all"
                style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.12)', color: '#1A1028' }}
                placeholder="Buscar por nombre o municipio..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
              />
            </div>
            {canManage && (
              <button
                onClick={openNew}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white shrink-0 cursor-pointer"
                style={{ background: '#381DA0', boxShadow: '0 4px 16px rgba(56,29,160,0.30)' }}
              >
                <IconMas className="w-4 h-4" /> Nueva sede
              </button>
            )}
          </div>
        </div>
      )}

      {/* Lista de sedes */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="px-4 pt-4 pb-4">
        {mostrarCarga ? (
          <ModuleLoader />
        ) : locations.length === 0 ? (
          <ModuleReveal>
          <div className="bg-card border border-border rounded-xl p-10 text-center">
            <IconUbicacion className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No hay sedes registradas aun.</p>
            {canManage && (
            <button onClick={openNew} className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold border border-border text-muted-foreground hover:bg-secondary transition-colors">
              Agregar primera sede
            </button>
            )}
          </div>
          </ModuleReveal>
        ) : visibles.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-10 text-center">
            <IconBuscar className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Ninguna sede coincide con «{busqueda.trim()}».
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <ModuleReveal>
            {visibles.map(loc => (
              <div key={loc.id} className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
                <div className="flex items-start justify-between px-4 py-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'rgba(6,214,160,0.12)' }}>
                      <IconUbicacion className="w-5 h-5" style={{ color: '#06D6A0' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground">{loc.name}</p>
                      {loc.address && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {loc.address}{clubDepartment ? `, ${clubDepartment}` : ''}
                        </p>
                      )}
                      {loc.latitude && loc.longitude && (
                        <MapButtons lat={loc.latitude} lng={loc.longitude} />
                      )}
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex gap-1 shrink-0 ml-2">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(loc)}>
                        <IconEditar className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(loc.id)}>
                        <IconEliminar className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
                {loc.latitude && loc.longitude && (
                  <div className="border-t border-border overflow-hidden" style={{ height: 200 }}>
                    <iframe
                      title={`Mapa ${loc.name}`}
                      width="100%"
                      height="200"
                      loading="lazy"
                      style={{ border: 0, display: 'block' }}
                      src={`https://maps.google.com/maps?q=${loc.latitude},${loc.longitude}&z=12&output=embed`}
                    />
                  </div>
                )}
              </div>
            ))}
            </ModuleReveal>
          </div>
        )}
      </motion.div>
    </div>
  );
}
