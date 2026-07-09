'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, ExternalLink, Check } from 'lucide-react';

const EASE = [0.23, 1, 0.32, 1] as [number, number, number, number];

export default function TermsGateModal({ open, onAccept }: { open: boolean; onAccept: () => Promise<void> }) {
  const [checked, setChecked] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  if (typeof document === 'undefined') return null;

  async function handleContinue() {
    if (!checked || saving) return;
    setSaving(true); setError(null);
    try {
      await onAccept();
    } catch {
      setError('No pudimos guardar tu aceptación. Intenta de nuevo.');
      setSaving(false);
    }
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15,5,30,0.55)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.26, ease: EASE }}
            style={{ width: '100%', maxWidth: 440, background: '#fff', borderRadius: 22, padding: '26px 24px', boxShadow: '0 24px 70px rgba(80,40,180,0.28)' }}
          >
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(124,58,237,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <ShieldCheck size={22} color="#7C3AED" />
            </div>

            <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: '#1A1028', fontFamily: 'inherit' }}>
              Antes de continuar
            </h2>
            <p style={{ margin: '0 0 18px', fontSize: 13, lineHeight: 1.6, color: '#5A5278' }}>
              Actualizamos nuestra Política de Tratamiento de Datos Personales y nuestros Términos y Condiciones. Para seguir usando VeloClub necesitamos tu aceptación.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
              <Link href="/legal/politica-datos" target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 13px', borderRadius: 12, border: '1px solid rgba(120,80,200,0.15)', background: '#FAFAFC', color: '#1A1028', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
                <span style={{ flex: 1 }}>Política de Tratamiento de Datos</span>
                <ExternalLink size={14} color="#8E87A8" />
              </Link>
              <Link href="/legal/terminos" target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 13px', borderRadius: 12, border: '1px solid rgba(120,80,200,0.15)', background: '#FAFAFC', color: '#1A1028', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
                <span style={{ flex: 1 }}>Términos y Condiciones de Uso</span>
                <ExternalLink size={14} color="#8E87A8" />
              </Link>
            </div>

            <button
              type="button"
              onClick={() => setChecked(v => !v)}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', padding: '12px 13px', borderRadius: 12, border: `1.5px solid ${checked ? 'rgba(124,58,237,0.35)' : 'rgba(120,80,200,0.15)'}`, background: checked ? 'rgba(124,58,237,0.05)' : 'transparent', cursor: 'pointer', textAlign: 'left', marginBottom: 16, transition: 'all 0.15s' }}
            >
              <div style={{ width: 19, height: 19, borderRadius: 6, border: `1.5px solid ${checked ? '#7C3AED' : 'rgba(120,80,200,0.30)'}`, background: checked ? '#7C3AED' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1, transition: 'all 0.15s' }}>
                {checked && <Check size={13} color="#fff" strokeWidth={3} />}
              </div>
              <span style={{ fontSize: 12.5, lineHeight: 1.55, color: '#4A4560' }}>
                He leído y acepto la <strong style={{ color: '#1A1028' }}>Política de Tratamiento de Datos Personales</strong> y los <strong style={{ color: '#1A1028' }}>Términos y Condiciones de Uso</strong> de VeloClub.
              </span>
            </button>

            {error && <p style={{ margin: '0 0 12px', fontSize: 12, color: '#EF476F' }}>{error}</p>}

            <button
              type="button"
              onClick={handleContinue}
              disabled={!checked || saving}
              style={{
                width: '100%', padding: '13px 0', borderRadius: 14, border: 'none',
                background: !checked ? 'rgba(120,80,200,0.15)' : saving ? '#A855F7' : '#7C3AED',
                color: !checked ? '#A79ECC' : '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                cursor: !checked || saving ? 'default' : 'pointer',
                boxShadow: checked && !saving ? '0 4px 16px rgba(124,58,237,0.30)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {saving ? 'Guardando...' : 'Aceptar y continuar'}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
