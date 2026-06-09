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
import { Plus, Pencil, Trash2, MapPin, LocateFixed, X, ChevronRight, ChevronDown, AlertCircle } from 'lucide-react';

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
  const [loading, setLoading] = useState(true);
  const [clubDepartment, setClubDepartment] = useState<string | null>(null);

  // Dialog crear/editar
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');  // municipio
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
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
    const [locRes, clubRes] = await Promise.allSettled([
      apiFetch<{ locations: Location[] }>('/locations', { token }),
      apiFetch<{ club: { department?: string } }>('/clubs/settings', { token }),
    ]);
    if (locRes.status === 'fulfilled') setLocations(locRes.value.locations);
    if (clubRes.status === 'fulfilled') setClubDepartment(clubRes.value.club.department ?? null);
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
    if (!confirm('¿Eliminar esta sede?')) return;
    const token = await getToken();
    await apiFetch(`/locations/${id}`, { method: 'DELETE', token });
    await load();
  }

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div className="px-5 py-3 bg-background flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-foreground" style={{ fontFamily: 'inherit', lineHeight: 1.1 }}>
            Sedes
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Lugares de entrenamiento del club</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #4361EE 100%)' }}
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nueva sede</span>
        </button>
      </div>

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
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.10)' }}>
                      <MapPin className="w-4 h-4" style={{ color: '#7C3AED' }} />
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

      {/* Lista de sedes */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="px-4 pt-4 pb-4">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : locations.length === 0 ? (
          <motion.div variants={cardVariant} className="bg-card border border-border rounded-xl p-10 text-center">
            <MapPin className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No hay sedes registradas aun.</p>
            <button onClick={openNew} className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold border border-border text-muted-foreground hover:bg-secondary transition-colors">
              Agregar primera sede
            </button>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {locations.map(loc => (
              <motion.div variants={cardVariant} key={loc.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="flex items-start justify-between px-4 py-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'rgba(6,214,160,0.12)' }}>
                      <MapPin className="w-5 h-5" style={{ color: '#06D6A0' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground">{loc.name}</p>
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
                  <div className="flex gap-1 shrink-0 ml-2">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(loc)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(loc.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
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
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
