'use client';

import { useState } from 'react';

const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

const SUSCRIPCIONES = [
  { clubId: 'c1', club: 'Club Velo Bogotá', plan: 450000, pagos: [
    { id: 'p1', mes: 'Enero',   monto: 225000, tipo: '50%', fecha: '2026-01-05', estado: 'PAID' },
    { id: 'p2', mes: 'Febrero', monto: 112500, tipo: '25%', fecha: '2026-02-03', estado: 'PAID' },
    { id: 'p3', mes: 'Marzo',   monto: 112500, tipo: '25%', fecha: null,         estado: 'PENDING' },
  ]},
  { clubId: 'c2', club: 'Patines Medellín', plan: 450000, pagos: [
    { id: 'p4', mes: 'Enero',   monto: 225000, tipo: '50%', fecha: '2026-01-08', estado: 'PAID' },
    { id: 'p5', mes: 'Febrero', monto: 112500, tipo: '25%', fecha: '2026-02-07', estado: 'PAID' },
    { id: 'p6', mes: 'Marzo',   monto: 112500, tipo: '25%', fecha: null,         estado: 'OVERDUE' },
  ]},
  { clubId: 'c3', club: 'Speed Cali', plan: 450000, pagos: [
    { id: 'p7', mes: 'Enero',   monto: 225000, tipo: '50%', fecha: null,         estado: 'PENDING' },
    { id: 'p8', mes: 'Febrero', monto: 112500, tipo: '25%', fecha: null,         estado: 'PENDING' },
    { id: 'p9', mes: 'Marzo',   monto: 112500, tipo: '25%', fecha: null,         estado: 'PENDING' },
  ]},
];


export default function FinanzasPage() {
  const [abonos, setAbonos] = useState(SUSCRIPCIONES);
  const [abonoOpen, setAbonoOpen] = useState<string | null>(null);
  const [abonoForm, setAbonoForm] = useState({ mes: '', monto: '', fecha: '' });

  const totalRecaudado = abonos.flatMap(s => s.pagos).filter(p => p.estado === 'PAID').reduce((a, p) => a + p.monto, 0);
  const totalPendiente = abonos.flatMap(s => s.pagos).filter(p => p.estado !== 'PAID').reduce((a, p) => a + p.monto, 0);
  const totalPlan = abonos.reduce((a, s) => a + s.plan, 0);
  const pct = Math.round(totalRecaudado / totalPlan * 100);

  function registrarAbono(clubId: string) {
    if (!abonoForm.mes || !abonoForm.monto) return;
    setAbonos(prev => prev.map(s => s.clubId !== clubId ? s : {
      ...s, pagos: [...s.pagos, {
        id: 'p' + Date.now(), mes: abonoForm.mes,
        monto: parseInt(abonoForm.monto), tipo: 'Abono',
        fecha: abonoForm.fecha || new Date().toISOString().split('T')[0], estado: 'PAID',
      }],
    }));
    setAbonoForm({ mes: '', monto: '', fecha: '' });
    setAbonoOpen(null);
  }

  const inputStyle = {
    width: '100%', padding: '7px 10px', borderRadius: 8,
    border: '1px solid rgba(120,80,200,0.10)',
    background: '#F7F7FB', color: '#1A1028', fontSize: 12, outline: 'none',
    boxSizing: 'border-box' as const, fontFamily: 'Plus Jakarta Sans, sans-serif',
  };

  return (
    <div style={{ background: '#F7F7FB', minHeight: '100%' }}>
      <div style={{ overflowY: 'auto' }}>
        <div style={{ padding: '12px 16px 0' }}>
          {/* Resumen card */}
          <div
            className="rounded-2xl mb-3"
            style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', padding: 14 }}
          >
            <p className="text-[11px] font-semibold uppercase mb-2.5 m-0" style={{ color: '#8E87A8', letterSpacing: '0.8px' }}>
              Resumen de suscripciones
            </p>
            <div className="flex justify-between mb-3">
              <div>
                <p className="text-[10px] font-semibold m-0" style={{ color: '#8E87A8' }}>RECAUDADO</p>
                <p className="text-[22px] font-extrabold m-0" style={{ color: '#06D6A0', fontFamily: 'Space Grotesk, sans-serif' }}>
                  {fmt.format(totalRecaudado)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold m-0" style={{ color: '#8E87A8' }}>PENDIENTE</p>
                <p className="text-[22px] font-extrabold m-0" style={{ color: '#EF476F', fontFamily: 'Space Grotesk, sans-serif' }}>
                  {fmt.format(totalPendiente)}
                </p>
              </div>
            </div>
            <div className="h-2 rounded-full overflow-hidden mb-1.5" style={{ background: 'rgba(120,80,200,0.10)' }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#06D6A0,#7C3AED)' }} />
            </div>
            <div className="flex justify-between mb-3.5">
              <span className="text-[10px] font-semibold" style={{ color: '#06D6A0' }}>{pct}% cobrado</span>
              <span className="text-[10px]" style={{ color: '#8E87A8' }}>Meta: {fmt.format(totalPlan)}</span>
            </div>
            {/* Bar chart */}
            <div className="flex gap-2 items-end" style={{ height: 72 }}>
              {abonos.map(s => {
                const rec = s.pagos.filter(p => p.estado === 'PAID').reduce((a, p) => a + p.monto, 0);
                const p = rec / s.plan;
                return (
                  <div key={s.clubId} className="flex-1 flex flex-col items-center gap-1">
                    <p className="text-[9px] font-bold m-0" style={{ color: '#06D6A0' }}>
                      {fmt.format(rec).replace('$ ', '$')}
                    </p>
                    <div
                      className="w-full rounded-t-[4px] transition-all"
                      style={{
                        height: `${Math.max(p * 52, 4)}px`,
                        background: 'linear-gradient(180deg,#7C3AED,#A855F7)',
                        opacity: p > 0 ? 1 : 0.25,
                      }}
                    />
                    <div className="w-full h-0.5" style={{ background: 'rgba(120,80,200,0.10)' }} />
                    <p className="text-[9px] text-center leading-tight m-0 truncate w-full" style={{ color: '#8E87A8' }}>
                      {s.club.split(' ').slice(0, 2).join(' ')}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Plan info */}
          <div
            className="rounded-xl mb-3"
            style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)', padding: '10px 12px' }}
          >
            <p className="text-[11px] font-bold mb-1.5 m-0" style={{ color: '#7C3AED' }}>Plan de suscripción anual</p>
            <div className="flex gap-1.5">
              {[['1er mes', '50%', '$225.000'], ['2do mes', '25%', '$112.500'], ['3er mes', '25%', '$112.500']].map(([mes, p, val]) => (
                <div
                  key={mes}
                  className="flex-1 rounded-xl text-center"
                  style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', padding: '6px 4px' }}
                >
                  <p className="text-[9px] m-0" style={{ color: '#8E87A8' }}>{mes}</p>
                  <p className="text-[13px] font-extrabold m-0" style={{ color: '#7C3AED', fontFamily: 'Space Grotesk, sans-serif' }}>{p}</p>
                  <p className="text-[9px] m-0" style={{ color: '#8E87A8' }}>{val}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] font-semibold uppercase mb-2 m-0" style={{ color: '#8E87A8', letterSpacing: '0.8px' }}>
            Detalle por club
          </p>
        </div>

        <div style={{ padding: '0 16px 80px' }}>
          {abonos.map(s => {
            const rec = s.pagos.filter(p => p.estado === 'PAID').reduce((a, p) => a + p.monto, 0);
            const pctClub = Math.round(rec / s.plan * 100);
            const colorPct = pctClub >= 100 ? '#06D6A0' : pctClub > 50 ? '#FFB703' : '#EF476F';
            return (
              <div
                key={s.clubId}
                className="rounded-2xl mb-2.5"
                style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', padding: 14 }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div>
                    <p className="text-[14px] font-bold m-0" style={{ color: '#1A1028' }}>{s.club}</p>
                    <p className="text-[11px] m-0 mt-0.5" style={{ color: '#8E87A8' }}>Plan anual · {fmt.format(s.plan)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[16px] font-extrabold m-0" style={{ color: colorPct, fontFamily: 'Space Grotesk, sans-serif' }}>
                      {pctClub}%
                    </p>
                    <p className="text-[10px] m-0" style={{ color: '#8E87A8' }}>{fmt.format(rec)}</p>
                  </div>
                </div>
                <div className="h-[5px] rounded-full overflow-hidden mb-2" style={{ background: 'rgba(120,80,200,0.10)' }}>
                  <div className="h-full rounded-full" style={{ width: `${pctClub}%`, background: 'linear-gradient(90deg,#06D6A0,#7C3AED)' }} />
                </div>
                {/* Cuotas */}
                <div className="flex gap-1 mb-2">
                  {s.pagos.map(p => {
                    const isPaid = p.estado === 'PAID';
                    const isOverdue = p.estado === 'OVERDUE';
                    const color = isPaid ? '#06D6A0' : isOverdue ? '#EF476F' : '#FFB703';
                    return (
                      <div
                        key={p.id}
                        className="flex-1 text-center rounded-[7px]"
                        style={{
                          padding: '5px 4px',
                          background: isPaid ? 'rgba(6,214,160,0.10)' : isOverdue ? 'rgba(239,71,111,0.10)' : 'rgba(255,183,3,0.07)',
                          border: `1px solid ${isPaid ? 'rgba(6,214,160,0.25)' : isOverdue ? 'rgba(239,71,111,0.25)' : 'rgba(255,183,3,0.20)'}`,
                        }}
                      >
                        <p className="text-[9px] font-bold m-0" style={{ color }}>{p.tipo}</p>
                        <p className="text-[9px] m-0 mt-0.5" style={{ color: '#8E87A8' }}>
                          {fmt.format(p.monto).replace('$ ', '').replace(',00', '')}
                        </p>
                        <p className="text-[10px] font-bold m-0 mt-0.5" style={{ color }}>
                          {isPaid ? '✓' : isOverdue ? '✗' : '·'}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {abonoOpen === s.clubId ? (
                  <div className="rounded-xl p-2.5" style={{ background: '#F0EEF8' }}>
                    <p className="text-[11px] font-bold mb-2 m-0" style={{ color: '#1A1028' }}>Registrar abono</p>
                    {[
                      { label: 'Concepto', key: 'mes', type: 'text', ph: 'Ej: Cuota Marzo' },
                      { label: 'Monto', key: 'monto', type: 'number', ph: '112500' },
                      { label: 'Fecha', key: 'fecha', type: 'date', ph: '' },
                    ].map(({ label, key, type, ph }) => (
                      <div key={key} className="mb-1.5">
                        <p className="text-[10px] font-semibold m-0 mb-0.5" style={{ color: '#8E87A8' }}>{label}</p>
                        <input
                          type={type}
                          placeholder={ph}
                          value={(abonoForm as Record<string, string>)[key]}
                          onChange={e => setAbonoForm(f => ({ ...f, [key]: e.target.value }))}
                          style={inputStyle}
                        />
                      </div>
                    ))}
                    <div className="flex gap-1.5 mt-2">
                      <button
                        onClick={() => { setAbonoOpen(null); setAbonoForm({ mes: '', monto: '', fecha: '' }); }}
                        className="flex-1 text-[11px] font-semibold py-1.5 rounded-xl"
                        style={{ border: '1px solid rgba(120,80,200,0.10)', background: 'transparent', color: '#8E87A8', cursor: 'pointer' }}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => registrarAbono(s.clubId)}
                        className="flex-[2] text-[11px] font-bold py-1.5 rounded-xl text-white"
                        style={{ background: '#7C3AED', border: 'none', cursor: 'pointer' }}
                      >
                        Registrar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAbonoOpen(s.clubId)}
                    className="w-full text-[11px] font-bold py-1.5 rounded-xl"
                    style={{ border: '1px solid rgba(124,58,237,0.30)', background: 'rgba(124,58,237,0.08)', color: '#7C3AED', cursor: 'pointer' }}
                  >
                    + Registrar abono
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
