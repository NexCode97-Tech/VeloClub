'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Ticket, X } from 'lucide-react';

const EASE = [0.23, 1, 0.32, 1] as [number, number, number, number];
const ACCENT = '#7C3AED';

interface Cupon {
  id: string;
  codigo: string;
  porcentaje: number;
  activo: boolean;
  expiraEn: string | null;
  maxUsos: number | null;
  usosActuales: number;
  createdAt: string;
  _count: { canjes: number };
}

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  border: '1.5px solid rgba(120,80,200,0.18)', background: '#fff', color: '#1A1028',
  fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};

function estadoCupon(c: Cupon): { label: string; color: string; bg: string } {
  if (!c.activo) return { label: 'Inactivo', color: '#8E87A8', bg: 'rgba(142,135,168,0.12)' };
  if (c.expiraEn && new Date(c.expiraEn).getTime() < Date.now()) return { label: 'Expirado', color: '#EF476F', bg: 'rgba(239,71,111,0.10)' };
  if (c.maxUsos != null && c.usosActuales >= c.maxUsos) return { label: 'Agotado', color: '#FFB703', bg: 'rgba(255,183,3,0.12)' };
  return { label: 'Activo', color: '#06D6A0', bg: 'rgba(6,214,160,0.12)' };
}

export default function CuponesPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [cupones, setCupones] = useState<Cupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ codigo: '', porcentaje: '', expiraEn: '', maxUsos: '' });

  async function load() {
    try {
      const token = await getToken();
      const res = await apiFetch<{ cupones: Cupon[] }>('/superadmin/cupones', { token });
      setCupones(res.cupones);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los cupones');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isLoaded && isSignedIn) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn]);

  async function crearCupon() {
    const porcentaje = Number(form.porcentaje);
    if (!form.codigo.trim()) { setError('Ingresa el código del cupón'); return; }
    if (!Number.isInteger(porcentaje) || porcentaje < 1 || porcentaje > 100) { setError('El porcentaje debe estar entre 1 y 100'); return; }
    const maxUsos = form.maxUsos.trim() ? Number(form.maxUsos) : null;
    if (maxUsos != null && (!Number.isInteger(maxUsos) || maxUsos < 1)) { setError('El límite de usos debe ser un número mayor a 0'); return; }

    setSaving(true); setError(null);
    try {
      const token = await getToken();
      await apiFetch('/superadmin/cupones', {
        method: 'POST', token,
        body: JSON.stringify({
          codigo: form.codigo.trim().toUpperCase(),
          porcentaje,
          expiraEn: form.expiraEn ? new Date(form.expiraEn + 'T23:59:59').toISOString() : null,
          maxUsos,
        }),
      });
      setForm({ codigo: '', porcentaje: '', expiraEn: '', maxUsos: '' });
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el cupón');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActivo(c: Cupon) {
    try {
      const token = await getToken();
      await apiFetch(`/superadmin/cupones/${c.id}`, {
        method: 'PATCH', token, body: JSON.stringify({ activo: !c.activo }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar el cupón');
    }
  }

  async function eliminar(c: Cupon) {
    if (!confirm(`¿Eliminar el cupón ${c.codigo}? Esta acción no se puede deshacer.`)) return;
    try {
      const token = await getToken();
      await apiFetch(`/superadmin/cupones/${c.id}`, { method: 'DELETE', token });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar el cupón');
    }
  }

  return (
    <div style={{ background: '#F7F7FB', minHeight: '100%', padding: '16px 16px 80px' }}>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[17px] font-semibold m-0" style={{ color: '#1A1028' }}>Cupones de descuento</p>
            <p className="text-[12px] m-0" style={{ color: '#8E87A8' }}>{cupones.length} {cupones.length === 1 ? 'cupón' : 'cupones'}</p>
          </div>
          <button
            onClick={() => { setShowForm(s => !s); setError(null); }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-semibold text-white"
            style={{ background: ACCENT }}
          >
            {showForm ? <X size={15} /> : <Plus size={15} />}
            {showForm ? 'Cancelar' : 'Nuevo cupón'}
          </button>
        </div>

        {error && (
          <div className="mb-3 px-3 py-2 rounded-lg text-[12px]" style={{ background: 'rgba(239,71,111,0.10)', color: '#EF476F' }}>
            {error}
          </div>
        )}

        <AnimatePresence initial={false}>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              style={{ overflow: 'hidden' }}
            >
              <div className="rounded-2xl bg-white border p-4 mb-4" style={{ borderColor: 'rgba(120,80,200,0.10)' }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold" style={{ color: '#8E87A8' }}>Código</label>
                    <input style={{ ...inp, textTransform: 'uppercase' }} value={form.codigo}
                      onChange={e => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))} placeholder="VELO20" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold" style={{ color: '#8E87A8' }}>Descuento (%)</label>
                    <input style={inp} type="number" min={1} max={100} value={form.porcentaje}
                      onChange={e => setForm(f => ({ ...f, porcentaje: e.target.value }))} placeholder="20" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold" style={{ color: '#8E87A8' }}>Expira (opcional)</label>
                    <input style={inp} type="date" value={form.expiraEn}
                      onChange={e => setForm(f => ({ ...f, expiraEn: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold" style={{ color: '#8E87A8' }}>Límite total de usos (opcional)</label>
                    <input style={inp} type="number" min={1} value={form.maxUsos}
                      onChange={e => setForm(f => ({ ...f, maxUsos: e.target.value }))} placeholder="Sin límite" />
                  </div>
                </div>
                <button onClick={crearCupon} disabled={saving}
                  className="mt-3 w-full py-2.5 rounded-xl text-[13px] font-semibold text-white disabled:opacity-60" style={{ background: ACCENT }}>
                  {saving ? 'Creando...' : 'Crear cupón'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: ACCENT, borderTopColor: 'transparent' }} />
          </div>
        ) : cupones.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(124,58,237,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(124,58,237,0.5)' }}>
              <Ticket size={24} />
            </div>
            <p className="text-[13px] font-semibold m-0" style={{ color: '#8E87A8' }}>Aún no hay cupones</p>
            <p className="text-[11px] m-0" style={{ color: '#C4BFD8' }}>Crea el primero con el botón de arriba</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {cupones.map(c => {
              const est = estadoCupon(c);
              return (
                <div key={c.id} className="rounded-2xl bg-white border p-3.5 flex items-center gap-3" style={{ borderColor: 'rgba(120,80,200,0.10)' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(124,58,237,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT, flexShrink: 0 }}>
                    <Ticket size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-semibold m-0 truncate" style={{ color: '#1A1028', letterSpacing: '0.02em' }}>{c.codigo}</p>
                      <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full" style={{ background: est.bg, color: est.color }}>{est.label}</span>
                    </div>
                    <p className="text-[11px] m-0" style={{ color: '#8E87A8' }}>
                      {c.porcentaje}% de descuento · {c.usosActuales}{c.maxUsos != null ? `/${c.maxUsos}` : ''} {c._count.canjes === 1 ? 'uso' : 'usos'}
                      {c.expiraEn ? ` · vence ${new Date(c.expiraEn).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}
                    </p>
                  </div>
                  <button onClick={() => toggleActivo(c)}
                    className="shrink-0 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg"
                    style={{ background: c.activo ? 'rgba(142,135,168,0.12)' : 'rgba(6,214,160,0.12)', color: c.activo ? '#8E87A8' : '#06D6A0' }}>
                    {c.activo ? 'Desactivar' : 'Activar'}
                  </button>
                  <button onClick={() => eliminar(c)} className="shrink-0 flex items-center justify-center rounded-lg" style={{ width: 30, height: 30, color: '#EF476F' }} title="Eliminar">
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
