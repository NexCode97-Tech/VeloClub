'use client';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MapPin, X } from 'lucide-react';
import { LocationMapPicker } from './location-map-picker';

interface Props {
  value: string;
  hasCoords: boolean;
  onSelect: (place: string, lat: number, lng: number) => void;
  onClear: () => void;
  initialLat?: number | null;
  initialLng?: number | null;
}

export function LocationPicker({ value, hasCoords, onSelect, onClear, initialLat, initialLng }: Props) {
  const [open, setOpen] = useState(false);

  function handleConfirm(lat: number, lng: number, address: string) {
    onSelect(address, lat, lng);
    setOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onClear();
  }

  return (
    <>
      {/* ── Trigger ── */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 h-12 px-3 rounded-xl border border-input hover:border-ring transition-colors text-left"
        style={{ background: '#fff' }}
      >
        <MapPin className={`w-4 h-4 shrink-0 ${hasCoords ? 'text-emerald-500' : 'text-muted-foreground'}`} />
        <span className={`flex-1 text-sm truncate ${value ? 'text-foreground' : 'text-muted-foreground'}`}>
          {value || 'Seleccionar en el mapa…'}
        </span>
        {value && (
          <span
            onClick={handleClear}
            className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-secondary transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-3 h-3 text-muted-foreground" />
          </span>
        )}
      </button>
      {hasCoords && (
        <p className="text-[11px] text-emerald-600 flex items-center gap-1 mt-1">
          <MapPin className="w-3 h-3" />
          Enlace Google Maps disponible para los deportistas
        </p>
      )}

      {/* ── Modal mapa ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <MapPin className="w-4 h-4" style={{ color: '#7C3AED' }} />
              Seleccionar ubicación
            </DialogTitle>
          </DialogHeader>
          <LocationMapPicker
            initialLat={initialLat}
            initialLng={initialLng}
            onConfirm={handleConfirm}
            onClose={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
