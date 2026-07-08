'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';

const EASE = [0.23, 1, 0.32, 1] as [number, number, number, number];

const DEPORTES = ['Patinaje','Ciclismo','Fútbol','Natación','Atletismo','Baloncesto','Voleibol','Tenis','Natación artística','Otro'];

interface MenuCoords { left: number; width: number; top?: number; bottom?: number; maxHeight: number; openUp: boolean; }

// SportSelect — reemplaza el <select> nativo de deporte con un dropdown en portal
// (fixed + clamp al viewport) para que no lo recorte ningún contenedor con overflow.
export default function SportSelect({ value, onChange, placeholder = 'Seleccionar deporte' }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const btnRef  = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function recalc() {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const vw = window.innerWidth;
    const GAP = 6;
    const spaceBelow = vh - r.bottom;
    const spaceAbove = r.top;
    const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(140, (openUp ? spaceAbove : spaceBelow) - GAP - 10);
    const left = Math.max(8, Math.min(r.left, vw - r.width - 8));
    setCoords({
      left, width: r.width, maxHeight, openUp,
      top:    openUp ? undefined : r.bottom + GAP,
      bottom: openUp ? vh - r.top + GAP : undefined,
    });
  }

  useEffect(() => {
    if (!open) return;
    recalc();
    const onScroll = () => recalc();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    window.visualViewport?.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      window.visualViewport?.removeEventListener('resize', onScroll);
    };
  }, [open]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const optionBtn = (label: string, selected: boolean, onClick: () => void, borderTop: boolean) => (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ background: 'rgba(124,58,237,0.05)' }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.10 }}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', border: 'none', cursor: 'pointer',
        background: selected ? 'rgba(124,58,237,0.07)' : 'transparent',
        borderTop: borderTop ? '1px solid rgba(120,80,200,0.06)' : 'none',
        fontFamily: 'inherit',
      }}
    >
      <span style={{ fontSize: 12, color: selected ? '#7C3AED' : '#1A1028', fontWeight: selected ? 700 : 500 }}>{label}</span>
      {selected && <Check size={13} strokeWidth={2.5} color="#7C3AED" />}
    </motion.button>
  );

  return (
    <div style={{ position: 'relative' }}>
      <motion.button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.10, ease: EASE }}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px', borderRadius: 10, cursor: 'pointer', boxSizing: 'border-box',
          border: open ? '1.5px solid rgba(124,58,237,0.45)' : '1.5px solid rgba(120,80,200,0.18)',
          background: '#fff', fontFamily: 'inherit',
          boxShadow: open ? '0 0 0 3px rgba(124,58,237,0.08)' : 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
      >
        <span style={{ fontSize: 13, color: value ? '#1A1028' : '#8E87A8', fontWeight: value ? 600 : 400 }}>{value || placeholder}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.18, ease: EASE }} style={{ display: 'flex', color: '#7C3AED' }}>
          <ChevronDown size={15} strokeWidth={2.5} />
        </motion.span>
      </motion.button>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && coords && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, y: coords.openUp ? 6 : -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: coords.openUp ? 4 : -4, scale: 0.97 }}
              transition={{ duration: 0.18, ease: EASE }}
              style={{
                position: 'fixed', left: coords.left, width: coords.width,
                ...(coords.openUp ? { bottom: coords.bottom } : { top: coords.top }),
                maxHeight: coords.maxHeight, overflowY: 'auto',
                background: '#fff', borderRadius: 14, zIndex: 1000,
                border: '1.5px solid rgba(124,58,237,0.15)',
                boxShadow: '0 8px 32px rgba(80,40,180,0.13), 0 2px 8px rgba(0,0,0,0.06)',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {optionBtn('Sin especificar', !value, () => { onChange(''); setOpen(false); }, false)}
              {DEPORTES.map((d, i) => optionBtn(d, value === d, () => { onChange(d); setOpen(false); }, i >= 0))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
