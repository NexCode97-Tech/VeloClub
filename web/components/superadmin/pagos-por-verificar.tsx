'use client';

import { useAuth } from '@clerk/nextjs';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { motion } from 'framer-motion';
import { cardVariant } from '@/lib/page-animations';
import { Zap, ExternalLink, Check, X } from 'lucide-react';

/**
 * Pagos por Bre-B esperando verificación.
 *
 * Una transferencia a una llave Bre-B no le avisa a nadie: no hay webhook que
 * la acredite. El club sube el comprobante, el pago queda PENDING y solo sale
 * de ahí cuando un superadministrador confirma que el dinero llegó de verdad.
 *
 * Va en el panel principal y no en una pantalla aparte porque es trabajo que
 * caduca: un club esperando la activación de su plan no puede depender de que
 * alguien se acuerde de entrar a una sección escondida.
 */

interface PagoPendiente {
  id: string;
  concepto: string;
  monto: number;
  creadoEn: string;
  comprobanteUrl: string | null;
  tipoPlan: string;
  club: { id: string; name: string; email: string | null };
}

const pesos = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const enPesos = (n: number) => pesos.format(n);

/** «hace 2 h», «ayer» — cuánto lleva esperando el club. */
function esperando(desde: string): string {
  const min = Math.floor((Date.now() - new Date(desde).getTime()) / 60_000);
  if (min < 60) return `hace ${Math.max(1, min)} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'ayer' : `hace ${dias} días`;
}

export function PagosPorVerificar() {
  const { getToken } = useAuth();
  const [pagos, setPagos] = useState<PagoPendiente[]>([]);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await apiFetch<{ pagos: PagoPendiente[] }>('/superadmin/suscripciones/breb-pendientes', { token });
      setPagos(res.pagos);
    } catch { /* el panel no puede caerse por esta sección */ }
  }, [getToken]);

  useEffect(() => { cargar(); }, [cargar]);

  async function resolver(pago: PagoPendiente, accion: 'aprobar' | 'rechazar') {
    // Aprobar activa el club y no se deshace con un clic: se confirma antes.
    if (accion === 'aprobar' && !confirm(
      `¿Confirmas que recibiste ${enPesos(pago.monto)} de ${pago.club.name}?\n\n` +
      'Se activa el plan del club de inmediato.'
    )) return;

    let motivo: string | undefined;
    if (accion === 'rechazar') {
      const escrito = prompt(
        `Rechazar el pago de ${pago.club.name}.\n\n` +
        '¿Qué le decimos? (opcional, se le envía tal cual)'
      );
      if (escrito === null) return;   // canceló el diálogo
      motivo = escrito.trim() || undefined;
    }

    setTrabajando(pago.id);
    setError(null);
    try {
      const token = await getToken();
      await apiFetch(`/superadmin/suscripciones/pagos/${pago.id}/${accion}`, {
        method: 'POST', token,
        body: JSON.stringify({ motivo }),
      });
      setPagos(p => p.filter(x => x.id !== pago.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la acción.');
    } finally {
      setTrabajando(null);
    }
  }

  if (pagos.length === 0) return null;

  return (
    <motion.div variants={cardVariant}>
      <div style={{
        borderRadius: 18, marginBottom: 10, padding: '14px 16px',
        background: '#fff', border: '1px solid rgba(120,80,200,0.10)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 11, flexShrink: 0,
            background: 'rgba(255,183,3,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={16} color="#B88A00" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1A1028' }}>
              Pagos por verificar
            </p>
            <p style={{ margin: 0, fontSize: 11.5, color: '#8E87A8' }}>
              Transferencias por Bre-B · el que más lleva esperando va primero
            </p>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99,
            background: 'rgba(255,183,3,0.14)', color: '#B88A00', flexShrink: 0,
          }}>
            {pagos.length}
          </span>
        </div>

        {error && (
          <p style={{ margin: '8px 0 0', fontSize: 12, color: '#EF476F' }}>{error}</p>
        )}

        <div style={{ marginTop: 8 }}>
          {pagos.map(pago => (
            <div key={pago.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              padding: '11px 0', borderTop: '1px solid #F1EEF6',
            }}>
              <div style={{ flex: '1 1 190px', minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 650, color: '#1A1028', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pago.club.name}
                </p>
                <p style={{ margin: 0, fontSize: 11.5, color: '#8E87A8' }}>
                  {enPesos(pago.monto)} · {pago.concepto} · {esperando(pago.creadoEn)}
                </p>
              </div>

              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {pago.comprobanteUrl && (
                  <a
                    href={pago.comprobanteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 650,
                      padding: '6px 10px', borderRadius: 9, textDecoration: 'none',
                      background: '#F1EEF6', color: '#5B5474',
                    }}
                  >
                    <ExternalLink size={12} /> Ver
                  </a>
                )}
                <button
                  onClick={() => resolver(pago, 'rechazar')}
                  disabled={trabajando === pago.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 650,
                    padding: '6px 10px', borderRadius: 9, cursor: 'pointer',
                    background: '#FBECEC', color: '#A33A3A', border: 'none',
                    opacity: trabajando === pago.id ? 0.5 : 1,
                  }}
                >
                  <X size={12} /> Rechazar
                </button>
                <button
                  onClick={() => resolver(pago, 'aprobar')}
                  disabled={trabajando === pago.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 650,
                    padding: '6px 10px', borderRadius: 9, cursor: 'pointer',
                    background: '#0E7C57', color: '#fff', border: 'none',
                    opacity: trabajando === pago.id ? 0.5 : 1,
                  }}
                >
                  <Check size={12} /> {trabajando === pago.id ? '...' : 'Aprobar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
