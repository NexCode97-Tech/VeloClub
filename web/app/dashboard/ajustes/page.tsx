'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DAYS = [
  { label: 'Domingo',   value: 0 },
  { label: 'Lunes',     value: 1 },
  { label: 'Martes',    value: 2 },
  { label: 'Miércoles', value: 3 },
  { label: 'Jueves',    value: 4 },
  { label: 'Viernes',   value: 5 },
  { label: 'Sábado',    value: 6 },
];

export default function AjustesPage() {
  const { getToken } = useAuth();
  const [noAttDays, setNoAttDays] = useState<number[]>([]);
  const [clubName, setClubName]   = useState('');
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [role, setRole]           = useState('');

  useEffect(() => {
    (async () => {
      const token = await getToken();
      const [meRes, clubRes] = await Promise.all([
        apiFetch<{ status: string; user?: { role: string } }>('/me', { token }),
        apiFetch<{ club: { name: string; noAttendanceDays: number[] } }>('/clubs/settings', { token }),
      ]);
      setRole(meRes.user?.role ?? '');
      setClubName(clubRes.club.name);
      setNoAttDays(clubRes.club.noAttendanceDays ?? []);
      setLoading(false);
    })();
  }, []);

  function toggleDay(day: number) {
    setNoAttDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true); setSaved(false);
    try {
      const token = await getToken();
      await apiFetch('/clubs/settings', {
        method: 'PATCH', token,
        body: JSON.stringify({ noAttendanceDays: noAttDays }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  const isAdmin = role === 'ADMIN';

  return (
    <div className="min-h-full bg-background">
      <div className="px-5 py-3 bg-background border-b border-border">
        <h1 className="text-[17px] font-bold text-foreground" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
          Ajustes del club
        </h1>
        {clubName && <p className="text-xs text-muted-foreground mt-0.5">{clubName}</p>}
      </div>

      <div className="px-4 pt-4 space-y-4 max-w-lg">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : (
          <>
            <div className="bg-white border border-border rounded-xl p-4 space-y-3">
              <div>
                <p className="text-[13px] font-bold text-foreground">Días sin entrenamiento</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  La asistencia no se registrará estos días de la semana
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                {DAYS.map(({ label, value }) => {
                  const active = noAttDays.includes(value);
                  return (
                    <button
                      key={value}
                      onClick={() => isAdmin && toggleDay(value)}
                      disabled={!isAdmin}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all"
                      style={active
                        ? { background: 'rgba(239,71,111,0.08)', borderColor: '#EF476F', color: '#EF476F' }
                        : { background: '#fff', borderColor: 'rgba(120,80,200,0.12)', color: '#8E87A8' }
                      }
                    >
                      <div
                        className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                        style={active ? { borderColor: '#EF476F', background: '#EF476F' } : { borderColor: '#C4C2CF' }}
                      >
                        {active && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <span className="text-[12px] font-semibold">{label}</span>
                    </button>
                  );
                })}
              </div>

              {noAttDays.length === 0 && (
                <p className="text-[11px] text-muted-foreground text-center pt-1">
                  Ningún día bloqueado — se registra asistencia todos los días
                </p>
              )}
            </div>

            {isAdmin && (
              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full"
                style={saved ? { background: '#06D6A0' } : {}}
              >
                {saved
                  ? <><CheckCircle2 className="w-4 h-4 mr-2" />Guardado</>
                  : saving ? 'Guardando...' : 'Guardar ajustes'
                }
              </Button>
            )}

            {!isAdmin && (
              <p className="text-[11px] text-muted-foreground text-center">
                Solo el administrador puede modificar los ajustes
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
