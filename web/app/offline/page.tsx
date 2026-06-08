'use client';

export default function OfflinePage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#F7F7FB', padding: '0 24px', textAlign: 'center', fontFamily: 'Open Sans, sans-serif' }}>
      <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(124,58,237,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <line x1="1" y1="1" x2="23" y2="23"/>
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
          <path d="M10.71 5.05A16 16 0 0 1 22.56 9"/>
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
          <line x1="12" y1="20" x2="12.01" y2="20"/>
        </svg>
      </div>
      <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800, color: '#1A1028', fontFamily: 'Open Sans, sans-serif' }}>
        Sin conexión
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: '#8E87A8', lineHeight: 1.6 }}>
        Verifica tu conexión a internet e intenta de nuevo.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{ padding: '12px 28px', borderRadius: 14, border: 'none', background: '#7C3AED', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Open Sans, sans-serif' }}
      >
        Reintentar
      </button>
    </div>
  );
}
