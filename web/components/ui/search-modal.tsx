'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { apiFetch } from '@/lib/api-client';
import { Search, X, Building2, Loader2, BadgeCheck } from 'lucide-react';

interface ClubHit {
  id: string; name: string; city?: string | null; department?: string | null;
  logoUrl?: string | null; verified?: boolean; deporte?: string | null;
}
interface PersonHit {
  id: string; clerkId: string | null; fullName: string; pictureUrl?: string | null;
  role: string; club?: { id: string; name: string; logoUrl?: string | null } | null;
}
interface Results { clubs: ClubHit[]; athletes: PersonHit[]; coaches: PersonHit[]; }

const EMPTY: Results = { clubs: [], athletes: [], coaches: [] };

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

export function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Results>(EMPTY);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Enfocar el input y limpiar al abrir
  useEffect(() => {
    if (open) {
      setQ(''); setResults(EMPTY);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  // Cerrar con Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Búsqueda con debounce
  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) { setResults(EMPTY); setLoading(false); return; }
    setLoading(true);
    const id = setTimeout(async () => {
      try {
        const token = await getToken();
        const data = await apiFetch<Results>(`/search?q=${encodeURIComponent(term)}`, { token });
        setResults(data);
      } catch {
        setResults(EMPTY);
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => clearTimeout(id);
  }, [q, open, getToken]);

  if (!open || typeof document === 'undefined') return null;

  const goPerson = (p: PersonHit) => {
    if (!p.clerkId) return;
    onClose();
    router.push(`/dashboard/perfil/${p.clerkId}`);
  };
  const goClub = (c: ClubHit) => {
    onClose();
    router.push(`/dashboard/club/${c.id}`);
  };

  const total = results.clubs.length + results.athletes.length + results.coaches.length;
  const showEmpty = q.trim().length >= 2 && !loading && total === 0;

  const Avatar = ({ src, name, rounded }: { src?: string | null; name: string; rounded: string }) => (
    src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={name} className={`w-9 h-9 object-cover shrink-0 ${rounded}`} style={{ border: '1px solid rgba(0,0,0,0.06)' }} />
    ) : (
      <div className={`w-9 h-9 shrink-0 flex items-center justify-center text-[11px] font-bold text-white ${rounded}`}
        style={{ background: 'linear-gradient(135deg,#7C3AED,#4361EE)' }}>
        {initials(name)}
      </div>
    )
  );

  return createPortal(
    <div
      className="fixed inset-0 flex items-start justify-center px-4"
      style={{ zIndex: 120, background: 'rgba(15,10,30,0.45)', backdropFilter: 'blur(2px)', paddingTop: '10vh' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '75dvh', boxShadow: '0 24px 70px rgba(0,0,0,0.28)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border shrink-0">
          <Search className="w-4 h-4 shrink-0" style={{ color: '#8E87A8' }} />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar clubes, deportistas o entrenadores..."
            className="flex-1 outline-none text-[14px] text-foreground bg-transparent"
            style={{ fontSize: 16 }}
          />
          {loading && <Loader2 className="w-4 h-4 animate-spin shrink-0" style={{ color: '#7C3AED' }} />}
          <button onClick={onClose} className="shrink-0 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Resultados */}
        <div className="overflow-y-auto min-h-0">
          {q.trim().length < 2 && (
            <p className="px-4 py-8 text-center text-[12px] text-muted-foreground">
              Escribe al menos 2 letras para buscar.
            </p>
          )}

          {showEmpty && (
            <p className="px-4 py-8 text-center text-[12px] text-muted-foreground">
              Sin resultados para “{q.trim()}”.
            </p>
          )}

          {results.clubs.length > 0 && (
            <Group title="Clubes">
              {results.clubs.map(c => (
                <button key={c.id} onClick={() => goClub(c)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/60 transition-colors text-left">
                  <Avatar src={c.logoUrl} name={c.name} rounded="rounded-full" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="text-[13px] font-semibold text-foreground truncate">{c.name}</p>
                      {c.verified && <BadgeCheck className="w-3.5 h-3.5 shrink-0" style={{ color: '#4361EE' }} />}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {[c.deporte, c.city, c.department].filter(Boolean).join(' · ') || 'Club'}
                    </p>
                  </div>
                  <Building2 className="w-4 h-4 shrink-0" style={{ color: '#C4BEDA' }} />
                </button>
              ))}
            </Group>
          )}

          {results.athletes.length > 0 && (
            <Group title="Deportistas">
              {results.athletes.map(p => <PersonRow key={p.id} p={p} onClick={() => goPerson(p)} Avatar={Avatar} />)}
            </Group>
          )}

          {results.coaches.length > 0 && (
            <Group title="Entrenadores">
              {results.coaches.map(p => <PersonRow key={p.id} p={p} onClick={() => goPerson(p)} Avatar={Avatar} />)}
            </Group>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-1.5">
      <p className="px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function PersonRow({ p, onClick, Avatar }: {
  p: PersonHit;
  onClick: () => void;
  Avatar: (props: { src?: string | null; name: string; rounded: string }) => React.ReactElement;
}) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/60 transition-colors text-left">
      <Avatar src={p.pictureUrl} name={p.fullName} rounded="rounded-full" />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-foreground truncate">{p.fullName}</p>
        <p className="text-[11px] text-muted-foreground truncate">{p.club?.name ?? ''}</p>
      </div>
    </button>
  );
}
