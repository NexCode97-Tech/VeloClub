'use client';
import { motion } from 'framer-motion';
import { stagger, cardVariant } from '@/lib/page-animations';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState, useRef, useCallback } from 'react';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, MapPin, Navigation, LocateFixed, X, Search, Loader2 } from 'lucide-react';

interface Location {
  id: string;
  name: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

// ── Íconos de apps de mapas ─────────────────────────────────────────────────

function GoogleMapsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#34A853"/>
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13V2z" fill="#4285F4"/>
      <path d="M12 2C15.87 2 19 5.13 19 9c0 2.5-1.5 5.2-3.5 7.8L12 2z" fill="#FBBC04"/>
      <path d="M5 9c0-3.87 3.13-7 7-7L8.5 16.8C6.5 14.2 5 11.5 5 9z" fill="#EA4335"/>
      <circle cx="12" cy="9" r="2.5" fill="white"/>
    </svg>
  );
}

function WazeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20.54 7.15C19.94 4.17 17.3 2 14.22 2H9.78C6.7 2 4.06 4.17 3.46 7.15L2.06 14.27C1.74 15.87 2.13 17.52 3.12 18.82C4.12 20.12 5.64 20.88 7.27 20.98L7.5 21H10v1h4v-1h2.5l.23-.02c1.63-.1 3.15-.86 4.15-2.16.99-1.3 1.38-2.95 1.06-4.55L20.54 7.15z" fill="#33CCFF"/>
      <circle cx="9" cy="12" r="1.5" fill="#1A1028"/>
      <circle cx="15" cy="12" r="1.5" fill="#1A1028"/>
      <path d="M9 15.5c1.5 1 4.5 1 6 0" stroke="#1A1028" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

function AppleMapsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="5" fill="url(#appleMapGrad)"/>
      <defs>
        <linearGradient id="appleMapGrad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34C759"/>
          <stop offset="100%" stopColor="#007AFF"/>
        </linearGradient>
      </defs>
      <path d="M12 6C9.24 6 7 8.24 7 11c0 3.75 5 9 5 9s5-5.25 5-9c0-2.76-2.24-5-5-5z" fill="white" fillOpacity="0.9"/>
      <circle cx="12" cy="11" r="1.8" fill="url(#appleMapGrad)"/>
    </svg>
  );
}

// ── Botones abrir en mapa ──────────────────────────────────────────────────

function MapButtons({ lat, lng }: { lat: number; lng: number }) {
  const googleUrl = `https://www.google.com/maps?q=${lat},${lng}`;
  const wazeUrl = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  const appleUrl = `https://maps.apple.com/?ll=${lat},${lng}`;

  return (
    <div className="flex items-center gap-1.5 mt-2.5">
      <span className="text-[10px] text-muted-foreground mr-0.5">Abrir en:</span>
      <a
        href={googleUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-secondary hover:bg-secondary/80 transition-colors"
        title="Google Maps"
      >
        <GoogleMapsIcon className="w-3.5 h-3.5" />
        <span>Google</span>
      </a>
      <a
        href={wazeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-secondary hover:bg-secondary/80 transition-colors"
        title="Waze"
      >
        <WazeIcon className="w-3.5 h-3.5" />
        <span>Waze</span>
      </a>
      <a
        href={appleUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-secondary hover:bg-secondary/80 transition-colors"
        title="Apple Maps"
      >
        <AppleMapsIcon className="w-3.5 h-3.5" />
        <span>Maps</span>
      </a>
    </div>
  );
}

// ── Buscador de ubicación (Nominatim) ─────────────────────────────────────

function LocationSearch({
  onSelect,
}: {
  onSelect: (lat: number, lng: number, displayName: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Cerrar al click fuera
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function search(q: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim() || q.length < 3) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&accept-language=es`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'es' } });
        const data: NominatimResult[] = await res.json();
        setResults(data);
        setOpen(data.length > 0);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 500);
  }

  function handleSelect(r: NominatimResult) {
    onSelect(parseFloat(r.lat), parseFloat(r.lon), r.display_name);
    setQuery('');
    setResults([]);
    setOpen(false);
  }

  // Formatear nombre de lugar — mostrar las 2 primeras partes (lugar, ciudad)
  function shortName(displayName: string) {
    const parts = displayName.split(', ');
    return parts.slice(0, 3).join(', ');
  }

  function fullDetail(displayName: string) {
    const parts = displayName.split(', ');
    return parts.slice(3).join(', ');
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); search(e.target.value); }}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Buscar dirección, lugar, ciudad..."
          className="w-full pl-9 pr-9 py-2.5 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
        />
        {searching ? (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
        ) : query ? (
          <button
            onClick={() => { setQuery(''); setResults([]); setOpen(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        ) : null}
      </div>

      {/* Dropdown de resultados */}
      {open && results.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-border rounded-xl shadow-lg overflow-hidden">
          {results.map((r) => (
            <button
              key={r.place_id}
              onClick={() => handleSelect(r)}
              className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-secondary/60 transition-colors text-left border-b border-border last:border-0"
            >
              <MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#7C3AED' }} />
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-foreground leading-snug truncate">
                  {shortName(r.display_name)}
                </p>
                {fullDetail(r.display_name) && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    {fullDetail(r.display_name)}
                  </p>
                )}
              </div>
            </button>
          ))}
          <div className="px-3 py-1.5 bg-muted/40 flex items-center gap-1.5">
            <svg className="w-3 h-3 opacity-40" viewBox="0 0 256 256" fill="currentColor"><path d="M128 16a112 112 0 1 0 112 112A112.12 112.12 0 0 0 128 16zm0 208a96 96 0 1 1 96-96 96.11 96.11 0 0 1-96 96zm16-88h-8V80a8 8 0 0 0-16 0v64a8 8 0 0 0 8 8h16a8 8 0 0 0 0-16z"/></svg>
            <span className="text-[9px] text-muted-foreground">OpenStreetMap · Nominatim</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────

export default function SedesPage() {
  const { getToken } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const token = await getToken();
    const res = await apiFetch<{ locations: Location[] }>('/locations', { token });
    setLocations(res.locations);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null);
    setName(''); setAddress('');
    setLat(null); setLng(null);
    setLocError(null); setError(null);
    setOpen(true);
  }

  function openEdit(loc: Location) {
    setEditing(loc);
    setName(loc.name);
    setAddress(loc.address ?? '');
    setLat(loc.latitude ?? null);
    setLng(loc.longitude ?? null);
    setLocError(null); setError(null);
    setOpen(true);
  }

  function handleGetLocation() {
    if (!navigator.geolocation) {
      setLocError('Tu navegador no soporta geolocalización.');
      return;
    }
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(parseFloat(pos.coords.latitude.toFixed(6)));
        setLng(parseFloat(pos.coords.longitude.toFixed(6)));
        setLocating(false);
      },
      () => {
        setLocError('No se pudo obtener la ubicación. Verifica los permisos.');
        setLocating(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  function handleSearchSelect(selLat: number, selLng: number, displayName: string) {
    setLat(selLat);
    setLng(selLng);
    // Si el campo dirección está vacío, rellenarlo con las primeras 2 partes del nombre
    if (!address.trim()) {
      const short = displayName.split(', ').slice(0, 2).join(', ');
      setAddress(short);
    }
    setLocError(null);
  }

  function clearLocation() {
    setLat(null);
    setLng(null);
    setLocError(null);
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

      {/* Dialog crear/editar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar sede' : 'Nueva sede'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Sede Norte" />
            </div>
            <div className="space-y-2">
              <Label>Dirección</Label>
              <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Ej: Calle 10 #45-20" />
            </div>

            {/* Selector de ubicación */}
            <div className="space-y-2.5">
              <Label>Ubicación GPS</Label>

              {/* Chip de ubicación guardada */}
              {lat && lng && (
                <div className="flex items-center justify-between bg-[rgba(6,214,160,0.08)] border border-[rgba(6,214,160,0.25)] rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <LocateFixed className="w-4 h-4 shrink-0" style={{ color: '#06D6A0' }} />
                    <div>
                      <p className="text-xs font-semibold text-foreground">Ubicación guardada</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{lat.toFixed(5)}, {lng.toFixed(5)}</p>
                    </div>
                  </div>
                  <button
                    onClick={clearLocation}
                    className="p-1 rounded-lg hover:bg-black/5 transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              )}

              {/* Buscador de dirección */}
              <LocationSearch onSelect={handleSearchSelect} />

              {/* Separador */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] text-muted-foreground font-medium">o</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Botón GPS */}
              <button
                onClick={handleGetLocation}
                disabled={locating}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:bg-secondary hover:border-primary/30 hover:text-foreground transition-all disabled:opacity-50"
              >
                {locating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Obteniendo ubicación...
                  </>
                ) : (
                  <>
                    <Navigation className="w-4 h-4" />
                    Usar mi ubicación actual
                  </>
                )}
              </button>

              {locError && <p className="text-xs text-destructive">{locError}</p>}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={handleSave} disabled={saving || !name.trim()} className="w-full">
              {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear sede'}
            </Button>
          </div>
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
              <motion.div variants={cardVariant} key={loc.id} className="bg-card border border-border rounded-xl px-4 py-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'rgba(6,214,160,0.12)' }}>
                      <MapPin className="w-5 h-5" style={{ color: '#06D6A0' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground">{loc.name}</p>
                      {loc.address && <p className="text-xs text-muted-foreground mt-0.5">{loc.address}</p>}
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
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
