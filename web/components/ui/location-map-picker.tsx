'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, Loader2, X, LocateFixed } from 'lucide-react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

interface Props {
  initialLat?: number | null;
  initialLng?: number | null;
  onConfirm: (lat: number, lng: number, address: string) => void;
  onClose: () => void;
}

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? '';

export function LocationMapPicker({ initialLat, initialLng, onConfirm }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(
    initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null
  );
  const [query, setQuery] = useState('');
  const [locating, setLocating] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  function createPinElement(): HTMLElement {
    const el = document.createElement('div');
    el.style.cssText = `
      width: 32px; height: 32px;
      background: #7C3AED;
      border: 3px solid white;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 2px 8px rgba(124,58,237,0.5);
      cursor: grab;
    `;
    return el;
  }

  useEffect(() => {
    if (!mapRef.current || googleMapRef.current) return;

    async function initMap() {
      setOptions({ key: GOOGLE_MAPS_KEY });

      const { Map } = await importLibrary('maps') as google.maps.MapsLibrary;
      const { AdvancedMarkerElement } = await importLibrary('marker') as google.maps.MarkerLibrary;
      const { Autocomplete } = await importLibrary('places') as google.maps.PlacesLibrary;

      const startLat = initialLat ?? 4.5709;
      const startLng = initialLng ?? -74.2973;
      const startZoom = initialLat ? 15 : 6;

      const map = new Map(mapRef.current!, {
        center: { lat: startLat, lng: startLng },
        zoom: startZoom,
        mapId: 'veloclub-location-picker',
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
      });

      // Marker inicial
      if (initialLat && initialLng) {
        const m = new AdvancedMarkerElement({
          map,
          position: { lat: initialLat, lng: initialLng },
          content: createPinElement(),
          gmpDraggable: true,
        });
        m.addListener('dragend', () => {
          const pos = m.position as google.maps.LatLng;
          setPin({ lat: parseFloat(pos.lat().toFixed(6)), lng: parseFloat(pos.lng().toFixed(6)) });
        });
        markerRef.current = m;
      }

      // Click en mapa → colocar/mover pin
      map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        const lat = parseFloat(e.latLng.lat().toFixed(6));
        const lng = parseFloat(e.latLng.lng().toFixed(6));

        if (markerRef.current) {
          markerRef.current.position = { lat, lng };
        } else {
          const m = new AdvancedMarkerElement({
            map,
            position: { lat, lng },
            content: createPinElement(),
            gmpDraggable: true,
          });
          m.addListener('dragend', () => {
            const pos = m.position as google.maps.LatLng;
            setPin({ lat: parseFloat(pos.lat().toFixed(6)), lng: parseFloat(pos.lng().toFixed(6)) });
          });
          markerRef.current = m;
        }
        setPin({ lat, lng });
      });

      googleMapRef.current = map;

      // Autocomplete
      if (inputRef.current) {
        const ac = new Autocomplete(inputRef.current, {
          fields: ['geometry', 'formatted_address', 'name'],
        });
        ac.addListener('place_changed', () => {
          const place = ac.getPlace();
          if (!place.geometry?.location) return;
          const lat = parseFloat(place.geometry.location.lat().toFixed(6));
          const lng = parseFloat(place.geometry.location.lng().toFixed(6));
          const address = place.formatted_address ?? place.name ?? '';
          setPin({ lat, lng });
          setQuery(address);
          map.panTo({ lat, lng });
          map.setZoom(16);

          if (markerRef.current) {
            markerRef.current.position = { lat, lng };
          } else {
            const m = new AdvancedMarkerElement({
              map,
              position: { lat, lng },
              content: createPinElement(),
              gmpDraggable: true,
            });
            m.addListener('dragend', () => {
              const pos = m.position as google.maps.LatLng;
              setPin({ lat: parseFloat(pos.lat().toFixed(6)), lng: parseFloat(pos.lng().toFixed(6)) });
            });
            markerRef.current = m;
          }
        });
      }

      setMapReady(true);
    }

    initMap();

    return () => {
      googleMapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  function handleGPS() {
    if (!navigator.geolocation || !googleMapRef.current) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        setPin({ lat, lng });
        const map = googleMapRef.current!;
        map.panTo({ lat, lng });
        map.setZoom(16);

        if (markerRef.current) {
          markerRef.current.position = { lat, lng };
        } else {
          const { AdvancedMarkerElement } = await importLibrary('marker') as google.maps.MarkerLibrary;
          const m = new AdvancedMarkerElement({
            map,
            position: { lat, lng },
            content: createPinElement(),
            gmpDraggable: true,
          });
          m.addListener('dragend', () => {
            const p = m.position as google.maps.LatLng;
            setPin({ lat: parseFloat(p.lat().toFixed(6)), lng: parseFloat(p.lng().toFixed(6)) });
          });
          markerRef.current = m;
        }
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  function handleConfirm() {
    if (!pin) return;
    onConfirm(pin.lat, pin.lng, query || `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Buscador con Autocomplete de Google */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar dirección, lugar, ciudad..."
          className="w-full pl-9 pr-9 py-2.5 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted transition-colors z-10"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Mapa */}
      <div className="relative rounded-xl overflow-hidden border border-border" style={{ height: 280 }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

        {/* Botón GPS */}
        <button
          onClick={handleGPS}
          disabled={locating || !mapReady}
          title="Usar mi ubicación"
          className="absolute bottom-3 right-3 z-[1000] w-9 h-9 bg-white rounded-xl shadow-md border border-border flex items-center justify-center hover:bg-secondary transition-colors disabled:opacity-50"
        >
          {locating
            ? <Loader2 className="w-4 h-4 animate-spin text-primary" />
            : <LocateFixed className="w-4 h-4 text-primary" />
          }
        </button>

        {/* Hint */}
        {!pin && mapReady && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur-sm border border-border rounded-full px-3 py-1.5 text-[11px] text-muted-foreground font-medium shadow-sm pointer-events-none whitespace-nowrap">
            Toca el mapa para colocar el pin
          </div>
        )}

        {/* Loading */}
        {!mapReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-secondary/40 z-[1000]">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
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
  );
}
