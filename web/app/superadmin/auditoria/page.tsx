'use client';

import { useSession } from '@clerk/nextjs';
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { apiFetch } from '@/lib/api-client';
import { ShieldAlert, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import ModuleLoader, { useCargaMinima } from '@/components/ui/module-loader';

interface Registro {
  id: string;
  accion: string;
  entidad: string;
  entidadId: string | null;
  resumen: string;
  actorNombre: string | null;
  actorEmail: string | null;
  actorRol: string | null;
  clubNombre: string | null;
  datos: unknown;
  ip: string | null;
  createdAt: string;
}

// Etiqueta y color por acción. Las irreversibles van en rojo: al recorrer la
// bitácora, lo que no se puede deshacer tiene que saltar a la vista.
const ACCIONES: Record<string, { texto: string; color: string; fondo: string }> = {
  CLUB_ELIMINADO:         { texto: 'Club eliminado',        color: '#B02A47', fondo: 'rgba(239,71,111,0.12)' },
  MIEMBRO_ELIMINADO:      { texto: 'Miembro eliminado',     color: '#B02A47', fondo: 'rgba(239,71,111,0.12)' },
  PAGO_ELIMINADO:         { texto: 'Pago eliminado',        color: '#B02A47', fondo: 'rgba(239,71,111,0.12)' },
  MOVIMIENTO_ELIMINADO:   { texto: 'Movimiento eliminado',  color: '#B02A47', fondo: 'rgba(239,71,111,0.12)' },
  CONTENIDO_RETIRADO:     { texto: 'Contenido retirado',    color: '#854F0B', fondo: 'rgba(255,183,3,0.16)' },
  CLUB_DESACTIVADO:       { texto: 'Club desactivado',      color: '#854F0B', fondo: 'rgba(255,183,3,0.16)' },
  CLUB_ACTIVADO:          { texto: 'Club activado',         color: '#057A5C', fondo: 'rgba(6,214,160,0.14)' },
  MIEMBRO_PAUSADO:        { texto: 'Miembro pausado',       color: '#854F0B', fondo: 'rgba(255,183,3,0.16)' },
  MIEMBRO_REACTIVADO:     { texto: 'Miembro reactivado',    color: '#057A5C', fondo: 'rgba(6,214,160,0.14)' },
  ROL_CAMBIADO:           { texto: 'Rol cambiado',          color: '#2F4BC7', fondo: 'rgba(67,97,238,0.12)' },
  SUSCRIPCION_MODIFICADA: { texto: 'Suscripción cambiada',  color: '#2F4BC7', fondo: 'rgba(67,97,238,0.12)' },
};

function etiqueta(accion: string) {
  return ACCIONES[accion] ?? { texto: accion, color: '#5B5470', fondo: 'rgba(26,16,40,0.06)' };
}

function cuando(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function AuditoriaPage() {
  const { session } = useSession();
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [acciones, setAcciones]   = useState<{ accion: string; total: number }[]>([]);
  const [filtro, setFiltro]       = useState('');
  const [abierto, setAbierto]     = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const mostrarCarga = useCargaMinima(loading);
  const [error, setError]         = useState('');

  const cargar = useCallback(async (accion: string) => {
    setLoading(true);
    try {
      const token = await session?.getToken();
      const q = accion ? `?accion=${accion}` : '';
      const res = await apiFetch<{ registros: Registro[]; acciones: { accion: string; total: number }[] }>(
        `/superadmin/auditoria${q}`, { token }
      );
      setRegistros(res.registros);
      setAcciones(res.acciones);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la bitácora');
    } finally { setLoading(false); }
  }, [session]);

  useEffect(() => { cargar(filtro); }, [cargar, filtro]);

  return (
    <div className="min-h-full bg-background">
      <div className="px-5 py-3 bg-background flex items-center md:border-b"
        style={{ minHeight: 58, borderColor: 'rgba(0,0,0,0.07)' }}>
        <h1 className="text-[22px] font-semibold text-foreground" style={{ lineHeight: 1.1 }}>
          Auditoría
        </h1>
      </div>

      <div className="px-5 pt-4 pb-8 max-w-3xl mx-auto w-full flex flex-col gap-4">
        <p className="text-[12.5px] text-muted-foreground leading-relaxed">
          Todo lo que no se puede deshacer queda acá, con quién lo hizo y una copia de lo eliminado.
          El registro no se puede editar ni borrar.
        </p>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFiltro('')}
            className="px-3 py-1.5 rounded-xl text-[11.5px] font-semibold transition-colors"
            style={!filtro
              ? { background: 'rgba(124,58,237,0.10)', color: '#7C3AED', border: '1.5px solid rgba(124,58,237,0.28)' }
              : { background: '#fff', color: '#8E87A8', border: '1.5px solid rgba(26,16,40,0.08)' }}
          >
            Todo
          </button>
          {acciones.map(a => (
            <button
              key={a.accion}
              onClick={() => setFiltro(a.accion)}
              className="px-3 py-1.5 rounded-xl text-[11.5px] font-semibold transition-colors"
              style={filtro === a.accion
                ? { background: 'rgba(124,58,237,0.10)', color: '#7C3AED', border: '1.5px solid rgba(124,58,237,0.28)' }
                : { background: '#fff', color: '#8E87A8', border: '1.5px solid rgba(26,16,40,0.08)' }}
            >
              {etiqueta(a.accion).texto} <span className="opacity-60">{a.total}</span>
            </button>
          ))}
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl px-4 py-3"
            style={{ background: 'rgba(239,71,111,0.08)', border: '1px solid rgba(239,71,111,0.20)' }}>
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#EF476F' }} />
            <p className="text-[12.5px]" style={{ color: '#B02A47' }}>{error}</p>
          </div>
        )}

        {mostrarCarga ? (
          <ModuleLoader />
        ) : registros.length === 0 ? (
          <div className="rounded-2xl px-6 py-12 flex flex-col items-center text-center"
            style={{ background: 'rgba(124,58,237,0.03)', border: '1px solid rgba(124,58,237,0.08)' }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
              style={{ background: 'linear-gradient(135deg,#7C3AED,#4361EE)' }}>
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <p className="text-[14px] font-semibold text-foreground mb-1">Sin registros todavía</p>
            <p className="text-[12px] text-muted-foreground max-w-[36ch]">
              La bitácora empieza desde ahora. Lo ocurrido antes de este cambio no quedó registrado.
            </p>
          </div>
        ) : (
          registros.map(r => {
            const et = etiqueta(r.accion);
            const desplegado = abierto === r.id;
            return (
              <motion.div
                key={r.id}
                layout
                className="rounded-2xl bg-white overflow-hidden"
                style={{ border: '1px solid rgba(120,80,200,0.12)' }}
              >
                <button
                  onClick={() => setAbierto(desplegado ? null : r.id)}
                  className="w-full flex items-start gap-3 px-4 py-3.5 text-left"
                >
                  <span className="text-[9.5px] font-bold px-2 py-1 rounded-full shrink-0 mt-0.5"
                    style={{ background: et.fondo, color: et.color }}>
                    {et.texto}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] text-foreground leading-snug">{r.resumen}</span>
                    <span className="block text-[10.5px] text-muted-foreground mt-1">
                      {r.actorNombre ?? 'Desconocido'}
                      {r.actorEmail ? ` · ${r.actorEmail}` : ''}
                      {' · '}{cuando(r.createdAt)}
                      {r.clubNombre ? ` · ${r.clubNombre}` : ''}
                    </span>
                  </span>
                  {desplegado
                    ? <ChevronDown className="w-4 h-4 shrink-0 mt-1" style={{ color: '#8E87A8' }} />
                    : <ChevronRight className="w-4 h-4 shrink-0 mt-1" style={{ color: '#8E87A8' }} />}
                </button>

                {desplegado && (
                  <div className="px-4 pb-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                      Copia de lo guardado
                    </p>
                    {/* Con overflow propio: un JSON largo no puede empujar la
                        página entera hacia los lados. */}
                    <pre className="text-[10.5px] leading-relaxed rounded-xl p-3 overflow-x-auto"
                      style={{ background: 'rgba(26,16,40,0.04)', color: '#3B3550', maxHeight: 320 }}>
                      {JSON.stringify(r.datos, null, 2)}
                    </pre>
                    {r.ip && (
                      <p className="text-[10px] text-muted-foreground mt-2">Desde {r.ip}</p>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
