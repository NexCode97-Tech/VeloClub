'use client';

import { useAuth } from '@clerk/nextjs';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { motion } from 'framer-motion';
import { cardVariant } from '@/lib/page-animations';
import { CreditCard } from 'lucide-react';

/**
 * Pagos que Mercado Pago rechazó en los últimos días.
 *
 * Un rechazo no crea ninguna fila de pago, así que antes no quedaba rastro en
 * ninguna parte: cuando un club decía "no me deja pagar" había que consultarle
 * a la API de Mercado Pago con credenciales de producción para saber el motivo.
 *
 * Se muestra solo si hubo alguno. Un club que reintenta y falla es una venta a
 * punto de perderse, no una estadística: sale a la vista sin que nadie la pida.
 */

interface Rechazo {
  id: string;
  cuando: string;
  club: string | null;
  clubId: string | null;
  medio: string;
  motivo: string;
  monto: number;
  bancoId: string | null;
}

const pesos = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const enPesos = pesos.format.bind(pesos);

/** El motivo técnico de Mercado Pago, en algo que se entienda de un vistazo. */
const MOTIVO: Record<string, string> = {
  bank_error:                           'el banco falló',
  rejected_by_bank:                     'el banco lo rechazó',
  cc_rejected_insufficient_amount:      'sin fondos',
  cc_rejected_bad_filled_card_number:   'número de tarjeta mal',
  cc_rejected_bad_filled_date:          'fecha de vencimiento mal',
  cc_rejected_bad_filled_security_code: 'CVV mal',
  cc_rejected_bad_filled_other:         'datos de la tarjeta mal',
  cc_rejected_call_for_authorize:       'el banco pide autorizar',
  cc_rejected_card_disabled:            'tarjeta inactiva',
  cc_rejected_high_risk:                'rechazado por seguridad',
  cc_rejected_max_attempts:             'demasiados intentos',
  cc_rejected_duplicated_payment:       'pago duplicado',
  expired:                              'expiró',
};

function cuandoFue(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 60) return `hace ${Math.max(1, min)} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'ayer' : `hace ${dias} días`;
}

export function PagosRechazados() {
  const { getToken } = useAuth();
  const [rechazos, setRechazos] = useState<Rechazo[]>([]);

  const cargar = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await apiFetch<{ rechazos: Rechazo[] }>('/superadmin/pagos-rechazados?dias=7', { token });
      setRechazos(res.rechazos);
    } catch { /* el panel no puede caerse por esta sección */ }
  }, [getToken]);

  useEffect(() => { cargar(); }, [cargar]);

  if (rechazos.length === 0) return null;

  // Un club que aparece varias veces es el dato que importa: son reintentos del
  // mismo pago, no clubes distintos con mala suerte.
  const porClub = new Map<string, number>();
  for (const r of rechazos) porClub.set(r.club ?? '—', (porClub.get(r.club ?? '—') ?? 0) + 1);
  const insistiendo = [...porClub.entries()].filter(([, n]) => n >= 3);

  return (
    <motion.div variants={cardVariant}>
      <div style={{
        borderRadius: 18, marginBottom: 10, padding: '14px 16px',
        background: '#fff', border: '1px solid rgba(120,80,200,0.10)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 11, flexShrink: 0,
            background: 'rgba(239,71,111,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CreditCard size={16} color="#EF476F" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1A1028' }}>
              Pagos rechazados
            </p>
            <p style={{ margin: 0, fontSize: 11.5, color: '#8E87A8' }}>
              Últimos 7 días · el club no pudo pagar
            </p>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99,
            background: 'rgba(239,71,111,0.12)', color: '#EF476F', flexShrink: 0,
          }}>
            {rechazos.length}
          </span>
        </div>

        {insistiendo.length > 0 && (
          <p style={{
            margin: '8px 0 0', fontSize: 12, padding: '8px 10px', borderRadius: 9,
            background: 'rgba(255,183,3,0.12)', color: '#8A6216',
          }}>
            {insistiendo.map(([club, n]) => `${club} lleva ${n} intentos`).join(' · ')}. Conviene escribirle.
          </p>
        )}

        <div style={{ marginTop: 8 }}>
          {rechazos.slice(0, 8).map(r => (
            <div key={r.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              padding: '9px 0', borderTop: '1px solid #F1EEF6',
            }}>
              <div style={{ flex: '1 1 190px', minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 650, color: '#1A1028', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.club ?? 'Club desconocido'}
                </p>
                <p style={{ margin: 0, fontSize: 11.5, color: '#8E87A8' }}>
                  {enPesos(r.monto)} · {r.medio} · {cuandoFue(r.cuando)}
                </p>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 650, padding: '4px 9px', borderRadius: 8, flexShrink: 0,
                background: '#FBECEC', color: '#A33A3A',
              }}>
                {MOTIVO[r.motivo] ?? r.motivo}
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
