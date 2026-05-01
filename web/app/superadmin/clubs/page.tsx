'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';

interface Club {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  _count: { members: number };
  users: { email: string; name: string }[];
}

function SAHeader({ title }: { title: string }) {
  return (
    <div
      className="flex items-center gap-2 shrink-0"
      style={{ padding: '12px 16px 10px', background: '#F7F7FB', borderBottom: '1px solid rgba(120,80,200,0.10)' }}
    >
      <h2 className="flex-1 text-[17px] font-bold m-0" style={{ fontFamily: 'Space Grotesk, sans-serif', color: '#1A1028' }}>
        {title}
      </h2>
      <button
        onClick={() => window.location.reload()}
        className="w-[34px] h-[34px] rounded-full flex items-center justify-center"
        style={{ background: '#F0EEF8', border: '1px solid rgba(120,80,200,0.10)', color: '#8E87A8' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
      </button>
    </div>
  );
}

export default function ClubsPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ clubName: '', adminEmail: '', adminName: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const token = await getToken();
      const res = await apiFetch<{ clubs: Club[] }>('/superadmin/clubs', { token });
      setClubs(res.clubs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar clubs');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { router.push('/sign-in'); return; }
    load();
  }, [isLoaded, isSignedIn]);

  async function handleCreate() {
    if (!form.clubName || !form.adminEmail || !form.adminName) return;
    setSaving(true); setError(null);
    try {
      const token = await getToken();
      await apiFetch('/superadmin/clubs', { method: 'POST', token, body: JSON.stringify(form) });
      setShowNew(false);
      setForm({ clubName: '', adminEmail: '', adminName: '' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(id: string) {
    const token = await getToken();
    await apiFetch(`/superadmin/clubs/${id}/toggle`, { method: 'PATCH', token });
    await load();
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este club? Esta acción no se puede deshacer.')) return;
    const token = await getToken();
    await apiFetch(`/superadmin/clubs/${id}`, { method: 'DELETE', token });
    await load();
  }

  const inputStyle = {
    width: '100%', padding: '8px 10px', borderRadius: 8,
    border: '1px solid rgba(120,80,200,0.10)',
    background: '#F7F7FB', color: '#1A1028', fontSize: 13, outline: 'none',
    boxSizing: 'border-box' as const, fontFamily: 'Plus Jakarta Sans, sans-serif',
  };

  return (
    <div style={{ background: '#F7F7FB', minHeight: '100%' }}>
      <SAHeader title="Clubs" />

      <div style={{ padding: '12px 16px 80px' }}>

        {/* Count + New button */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-[12px] m-0" style={{ color: '#8E87A8' }}>
            {clubs.length} club{clubs.length !== 1 ? 's' : ''} registrado{clubs.length !== 1 ? 's' : ''}
          </p>
          <button
            onClick={() => setShowNew(v => !v)}
            className="text-[12px] font-bold text-white px-3.5 py-1.5 rounded-xl"
            style={{ background: '#7C3AED', border: 'none', cursor: 'pointer' }}
          >
            + Nuevo
          </button>
        </div>

        {/* New club form */}
        {showNew && (
          <div
            className="rounded-2xl p-3.5 mb-3"
            style={{ background: '#fff', border: '1.5px solid #7C3AED' }}
          >
            <p className="text-[13px] font-bold mb-3 m-0" style={{ fontFamily: 'Space Grotesk, sans-serif', color: '#1A1028' }}>
              Nuevo club
            </p>
            {[
              { label: 'Nombre del club', key: 'clubName', type: 'text' },
              { label: 'Nombre del admin', key: 'adminName', type: 'text' },
              { label: 'Email del admin', key: 'adminEmail', type: 'email' },
            ].map(({ label, key, type }) => (
              <div key={key} className="mb-2">
                <p className="text-[11px] font-semibold mb-1 m-0" style={{ color: '#8E87A8' }}>{label}</p>
                <input
                  type={type}
                  value={(form as Record<string, string>)[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            ))}
            {error && <p className="text-[12px] mt-1" style={{ color: '#EF476F' }}>{error}</p>}
            <div className="flex gap-2 mt-2.5">
              <button
                onClick={() => setShowNew(false)}
                className="flex-1 text-[12px] font-semibold py-2 rounded-xl"
                style={{ border: '1px solid rgba(120,80,200,0.10)', background: 'transparent', color: '#8E87A8', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !form.clubName || !form.adminEmail || !form.adminName}
                className="flex-[2] text-[12px] font-bold py-2 rounded-xl text-white"
                style={{ background: saving ? '#A855F7' : '#7C3AED', border: 'none', cursor: 'pointer' }}
              >
                {saving ? 'Creando...' : 'Crear club'}
              </button>
            </div>
          </div>
        )}

        {/* Club list */}
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#7C3AED', borderTopColor: 'transparent' }} />
          </div>
        ) : clubs.length === 0 ? (
          <div
            className="rounded-2xl p-12 text-center"
            style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', color: '#8E87A8', fontSize: 13 }}
          >
            No hay clubs registrados aún.
          </div>
        ) : (
          clubs.map(club => (
            <div
              key={club.id}
              className="rounded-2xl mb-2.5"
              style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', padding: 14 }}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="text-[14px] font-bold m-0" style={{ color: '#1A1028' }}>{club.name}</p>
                    <span
                      className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{
                        background: club.active ? 'rgba(6,214,160,0.12)' : 'rgba(239,71,111,0.12)',
                        color: club.active ? '#06D6A0' : '#EF476F',
                      }}
                    >
                      {club.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <p className="text-[11px] m-0" style={{ color: '#8E87A8' }}>
                    {club._count.members} miembros · {club.users[0]?.email ?? '—'}
                  </p>
                  {club.users[0] && (
                    <p className="text-[10px] m-0 mt-0.5" style={{ color: '#8E87A8' }}>
                      Admin: {club.users[0].name}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleToggle(club.id)}
                  className="flex-1 text-[12px] font-semibold py-1.5 rounded-xl"
                  style={{
                    border: `1px solid ${club.active ? 'rgba(255,183,3,0.3)' : 'rgba(6,214,160,0.3)'}`,
                    background: club.active ? 'rgba(255,183,3,0.08)' : 'rgba(6,214,160,0.08)',
                    color: club.active ? '#FFB703' : '#06D6A0',
                    cursor: 'pointer',
                  }}
                >
                  {club.active ? '⏸ Desactivar' : '▶ Activar'}
                </button>
                <button
                  onClick={() => handleDelete(club.id)}
                  className="w-9 flex items-center justify-center rounded-xl"
                  style={{ border: '1px solid rgba(239,71,111,0.3)', background: 'rgba(239,71,111,0.08)', color: '#EF476F', cursor: 'pointer' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
