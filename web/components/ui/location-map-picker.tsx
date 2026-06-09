'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, Loader2, X, LocateFixed, MapPin } from 'lucide-react';
import type { Map as LeafletMap, Marker } from 'leaflet';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface Props {
  initialLat?: number | null;
  initialLng?: number | null;
  onConfirm: (lat: number, lng: number, address: string) => void;
  onClose: () => void;
}

export function LocationMapPicker({ initialLat, initialLng, onConfirm, onClose }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);

  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(
    initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null
  );
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [locating, setLocating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Inicializar mapa
  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;

    import('leaflet').then((L) => {
      // Fix icono default de Leaflet con Next.js
      delete (L.Icon.Default.prototype as typeof L.Icon.Default.prototype & { _getIconUrl?: unknown })._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const startLat = pin?.lat ?? 4.5709;
      const startLng = pin?.lng ?? -74.2973;
      const startZoom = pin ? 15 : 6;

      const map = L.map(mapRef.current!, {
        center: [startLat, startLng],
        zoom: startZoom,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Ícono personalizado púrpura
      const purpleIcon = L.divIcon({
        html: `<div style="
          width: 32px; height: 32px;
          background: #7C3AED;
          border: 3px solid white;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 2px 8px rgba(124,58,237,0.5);
        "></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        className: '',
      });

      // Si hay pin inicial, ponerlo
      if (pin) {
        const m = L.marker([pin.lat, pin.lng], { icon: purpleIcon, draggable: true }).addTo(map);
        m.on('dragend', () => {
          const { lat, lng } = m.getLatLng();
          setPin({ lat: parseFloat(lat.toFixed(6)), lng: parseFloat(lng.toFixed(6)) });
        });
        markerRef.current = m;
      }

      // Click en el mapa → poner/mover pin
      map.on('click', (e: import('leaflet').LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        const rounded = { lat: parseFloat(lat.toFixed(6)), lng: parseFloat(lng.toFixed(6)) };

        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          const m = L.marker([lat, lng], { icon: purpleIcon, draggable: true }).addTo(map);
          m.on('dragend', () => {
            const pos = m.getLatLng();
            setPin({ lat: parseFloat(pos.lat.toFixed(6)), lng: parseFloat(pos.lng.toFixed(6)) });
          });
          markerRef.current = m;
        }
        setPin(rounded);
      });

      leafletMapRef.current = map;
    });

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  // Mover mapa cuando cambia pin externamente (GPS / búsqueda)
  function flyTo(lat: number, lng: number) {
    const map = leafletMapRef.current;
    if (!map) return;
    import('leaflet').then((L) => {
      map.flyTo([lat, lng], 16, { duration: 0.8 });

      const purpleIcon = L.divIcon({
        html: `<div style="
          width: 32px; height: 32px;
          background: #7C3AED;
          border: 3px solid white;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 2px 8px rgba(124,58,237,0.5);
        "></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        className: '',
      });

      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        const m = L.marker([lat, lng], { icon: purpleIcon, draggable: true }).addTo(map);
        m.on('dragend', () => {
          const pos = m.getLatLng();
          setPin({ lat: parseFloat(pos.lat.toFixed(6)), lng: parseFloat(pos.lng.toFixed(6)) });
        });
        markerRef.current = m;
      }
    });
  }

  // Búsqueda Nominatim
  function search(q: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim() || q.length < 3) { setResults([]); setShowResults(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&accept-language=es`;
        const res = await fetch(url);
        const data: NominatimResult[] = await res.json();
        setResults(data);
        setShowResults(data.length > 0);
      } catch { setResults([]); } finally { setSearching(false); }
    }, 500);
  }

  function handleSelectResult(r: NominatimResult) {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    const rounded = { lat: parseFloat(lat.toFixed(6)), lng: parseFloat(lng.toFixed(6)) };
    setPin(rounded);
    flyTo(lat, lng);
    setQuery(r.display_name.split(', ').slice(0, 2).join(', '));
    setShowResults(false);
    setResults([]);
  }

  // GPS
  function handleGPS() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        setPin({ lat, lng });
        flyTo(lat, lng);
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  // Cerrar resultados al hacer clic fuera
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleConfirm() {
    if (!pin) return;
    onConfirm(pin.lat, pin.lng, query || `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`);
  }

  return (
    <>
      {/* Importar CSS de Leaflet */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />

      <div className="flex flex-col gap-3">
        {/* Buscador */}
        <div ref={searchRef} className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); search(e.target.value); }}
              onFocus={() => results.length > 0 && setShowResults(true)}
              placeholder="Buscar dirección, lugar, ciudad..."
              className="w-full pl-9 pr-9 py-2.5 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            />
            {searching ? (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
            ) : query ? (
              <button onClick={() => { setQuery(''); setResults([]); setShowResults(false); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted transition-colors">
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            ) : null}
          </div>

          {/* Resultados */}
          {showResults && results.length > 0 && (
            <div className="absolute z-[9999] left-0 right-0 mt-1.5 bg-white border border-border rounded-xl shadow-xl overflow-hidden">
              {results.map(r => (
                <button key={r.place_id} onClick={() => handleSelectResult(r)}
                  className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-secondary/60 transition-colors text-left border-b border-border last:border-0">
                  <MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#7C3AED' }} />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-foreground leading-snug truncate">
                      {r.display_name.split(', ').slice(0, 3).join(', ')}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                      {r.display_name.split(', ').slice(3).join(', ')}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Mapa */}
        <div className="relative rounded-xl overflow-hidden border border-border" style={{ height: 280 }}>
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

          {/* Botón GPS sobre el mapa */}
          <button
            onClick={handleGPS}
            disabled={locating}
            title="Usar mi ubicación"
            className="absolute bottom-3 right-3 z-[1000] w-9 h-9 bg-white rounded-xl shadow-md border border-border flex items-center justify-center hover:bg-secondary transition-colors disabled:opacity-50"
          >
            {locating
              ? <Loader2 className="w-4 h-4 animate-spin text-primary" />
              : <LocateFixed className="w-4 h-4 text-primary" />
            }
          </button>

          {/* Hint */}
          {!pin && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur-sm border border-border rounded-full px-3 py-1.5 text-[11px] text-muted-foreground font-medium shadow-sm pointer-events-none">
              Toca el mapa para colocar el pin
            </div>
          )}
        </div>

        {/* Coordenadas + confirmar */}
        {pin ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-[rgba(6,214,160,0.08)] border border-[rgba(6,214,160,0.25)] rounded-xl px-3 py-2">
              <LocateFixed className="w-4 h-4 shrink-0" style={{ color: '#06D6A0' }} />
              <p className="text-[11px] font-mono text-foreground">{pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}</p>
            </div>
            <button
              onClick={handleConfirm}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 shrink-0"
              style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #4361EE 100%)' }}
            >
              Confirmar
            </button>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground text-center">
            Busca una dirección o toca el mapa para seleccionar la ubicación
          </p>
        )}
      </div>
    </>
  );
}
