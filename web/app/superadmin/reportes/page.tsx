'use client';

import { useSession } from '@clerk/nextjs';
import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '@/lib/api-client';
import { Flag, ShieldCheck, Globe, Lock, AlertTriangle } from 'lucide-react';
import { AccionesCabecera } from '@/components/superadmin/acciones-cabecera';
import ModuleLoader, { useCargaMinima } from '@/components/ui/module-loader';
import { IconEliminar } from '@/components/ui/custom-icons';

type Estado = 'PENDIENTE' | 'ELIMINADO' | 'DESESTIMADO';

interface Reporte {
  id: string;
  postId: string;
  commentId: string | null;
  reporterName: string;
  clubNombre: string | null;
  motivo: string;
  detalle: string | null;
  estado: Estado;
  // Texto al momento de reportar. Se guarda porque el autor puede editarlo o
  // borrarlo, y sin la copia se revisaria un reporte sobre algo que ya no esta.
  contenidoCopia: string;
  contenidoActual: string | null;
  existe: boolean;
  imagenUrl: string | null;
  alcance: 'PUBLIC' | 'PRIVATE' | null;
  autorNombre: string;
  resueltoPor: string | null;
  createdAt: string;
}

const MOTIVOS: Record<string, string> = {
  SPAM:             'Spam o publicidad engañosa',
  ACOSO:            'Acoso, insultos o difamación',
  ODIO:             'Discriminación u odio',
  CONTENIDO_SEXUAL: 'Contenido sexual u obsceno',
  VIOLENCIA:        'Violencia o contenido perturbador',
  SUPLANTACION:     'Suplantación de identidad',
  DERECHOS_AUTOR:   'Uso de contenido sin permiso',
  OTRO:             'Otro motivo',
};

const PESTANAS: { valor: Estado; etiqueta: string }[] = [
  { valor: 'PENDIENTE',   etiqueta: 'Pendientes' },
  { valor: 'ELIMINADO',   etiqueta: 'Retirados' },
  { valor: 'DESESTIMADO', etiqueta: 'Desestimados' },
];

function cuando(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export default function ReportesPage() {
  const { session } = useSession();
  const [reportes, setReportes]   = useState<Reporte[]>([]);
  const [pendientes, setPendientes] = useState(0);
  const [estado, setEstado]       = useState<Estado>('PENDIENTE');
  const [loading, setLoading]     = useState(true);
  const mostrarCarga = useCargaMinima(loading);
  const [resolviendo, setResolviendo] = useState<string | null>(null);
  const [error, setError]         = useState('');

  const cargar = useCallback(async (cual: Estado) => {
    setLoading(true);
    try {
      const token = await session?.getToken();
      const res = await apiFetch<{ reportes: Reporte[]; pendientes: number }>(
        `/superadmin/reportes?estado=${cual}`, { token }
      );
      setReportes(res.reportes);
      setPendientes(res.pendientes);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los reportes');
    } finally { setLoading(false); }
  }, [session]);

  useEffect(() => { cargar(estado); }, [cargar, estado]);

  async function resolver(id: string, accion: 'ELIMINAR' | 'DESESTIMAR') {
    if (resolviendo) return;
    setResolviendo(id);
    try {
      const token = await session?.getToken();
      await apiFetch(`/superadmin/reportes/${id}`, {
        token, method: 'PATCH', body: JSON.stringify({ accion }),
      });
      await cargar(estado);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo resolver el reporte');
    } finally { setResolviendo(null); }
  }

  return (
    <div className="min-h-full bg-background">
      {/* El nombre de la pantalla ya lo dice la barra de arriba. Acá solo sube
          cuántos quedan sin revisar, que es el dato que hace volver. */}
      {pendientes > 0 && (
        <AccionesCabecera>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(239,71,111,0.12)', color: '#EF476F' }}>
            {pendientes} sin revisar
          </span>
        </AccionesCabecera>
      )}

      <div className="px-5 pt-4 pb-8 max-w-3xl mx-auto w-full flex flex-col gap-4">
        <div className="flex gap-2">
          {PESTANAS.map(p => (
            <button
              key={p.valor}
              onClick={() => setEstado(p.valor)}
              className="px-3.5 py-2 rounded-xl text-[12px] font-semibold transition-colors"
              style={estado === p.valor
                ? { background: 'rgba(56,29,160,0.10)', color: '#381DA0', border: '1.5px solid rgba(56,29,160,0.28)' }
                : { background: '#fff', color: '#8E87A8', border: '1.5px solid rgba(26,16,40,0.08)' }}
            >
              {p.etiqueta}
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
        ) : reportes.length === 0 ? (
          <div className="rounded-2xl px-6 py-12 flex flex-col items-center text-center"
            style={{ background: 'rgba(56,29,160,0.03)', border: '1px solid rgba(56,29,160,0.08)' }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
              style={{ background: '#381DA0' }}>
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <p className="text-[14px] font-semibold text-foreground mb-1">
              {estado === 'PENDIENTE' ? 'Nada por revisar' : 'Nada acá'}
            </p>
            <p className="text-[12px] text-muted-foreground">
              {estado === 'PENDIENTE'
                ? 'La comunidad no ha reportado contenido.'
                : 'Todavía no hay reportes en este estado.'}
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {reportes.map(r => (
              <motion.div
                key={r.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.2 }}
                className="rounded-2xl bg-white overflow-hidden"
                style={{ border: '1px solid rgba(120,80,200,0.12)' }}
              >
                <div className="flex items-start gap-3 px-4 pt-4 pb-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(239,71,111,0.10)' }}>
                    <Flag className="w-4 h-4" style={{ color: '#EF476F' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-semibold text-foreground leading-tight">
                      {MOTIVOS[r.motivo] ?? r.motivo}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {r.commentId ? 'Comentario' : 'Publicación'} de {r.autorNombre || 'alguien'}
                      {' · '}reportado por {r.reporterName}
                      {' · '}{cuando(r.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {r.alcance && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(26,16,40,0.05)', color: '#8E87A8' }}>
                        {r.alcance === 'PUBLIC'
                          ? <><Globe className="w-2.5 h-2.5" /> Público</>
                          : <><Lock className="w-2.5 h-2.5" /> {r.clubNombre ?? 'Club'}</>}
                      </span>
                    )}
                  </div>
                </div>

                <div className="px-4 pb-3 flex flex-col gap-2">
                  <div className="rounded-xl px-3 py-2.5"
                    style={{ background: 'rgba(26,16,40,0.03)', border: '1px solid rgba(26,16,40,0.06)' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                      Al momento de reportar
                    </p>
                    <p className="text-[12.5px] text-foreground leading-relaxed whitespace-pre-wrap">
                      {r.contenidoCopia || '— sin texto —'}
                    </p>
                  </div>

                  {/* Solo se muestra si difiere: repetir lo mismo dos veces
                      obliga a compararlo a ojo sin que haya nada que comparar. */}
                  {r.existe && r.contenidoActual !== null && r.contenidoActual !== r.contenidoCopia && (
                    <div className="rounded-xl px-3 py-2.5"
                      style={{ background: 'rgba(255,183,3,0.06)', border: '1px solid rgba(255,183,3,0.22)' }}>
                      <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: '#854F0B' }}>
                        Editado desde entonces, así está ahora
                      </p>
                      <p className="text-[12.5px] text-foreground leading-relaxed whitespace-pre-wrap">
                        {r.contenidoActual}
                      </p>
                    </div>
                  )}

                  {!r.existe && (
                    <p className="text-[11.5px] font-semibold" style={{ color: '#8E87A8' }}>
                      El contenido ya no existe: el autor lo borró.
                    </p>
                  )}

                  {r.imagenUrl && r.existe && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.imagenUrl} alt="Contenido reportado"
                      className="rounded-xl max-h-56 w-auto object-cover" />
                  )}

                  {r.detalle && (
                    <p className="text-[12px] text-muted-foreground leading-relaxed">
                      <span className="font-semibold">Dice quien reporta:</span> {r.detalle}
                    </p>
                  )}
                </div>

                {r.estado === 'PENDIENTE' ? (
                  <div className="flex gap-2 px-4 py-3 border-t border-border/50">
                    <button
                      onClick={() => resolver(r.id, 'ELIMINAR')}
                      disabled={resolviendo === r.id}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12.5px] font-semibold text-white disabled:opacity-50 transition-opacity"
                      style={{ background: '#EF476F' }}
                    >
                      <IconEliminar className="w-3.5 h-3.5" /> Retirar contenido
                    </button>
                    <button
                      onClick={() => resolver(r.id, 'DESESTIMAR')}
                      disabled={resolviendo === r.id}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12.5px] font-semibold disabled:opacity-50 transition-opacity"
                      style={{ background: 'rgba(26,16,40,0.05)', color: '#5B5470' }}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" /> No incumple
                    </button>
                  </div>
                ) : (
                  <div className="px-4 py-2.5 border-t border-border/50">
                    <p className="text-[11px] text-muted-foreground">
                      {r.estado === 'ELIMINADO' ? 'Retirado' : 'Desestimado'}
                      {r.resueltoPor ? ` por ${r.resueltoPor}` : ''}
                    </p>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
