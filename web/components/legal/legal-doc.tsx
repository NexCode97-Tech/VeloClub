'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';

// Parser minimalista de markdown para documentos legales — evita traer una
// librería completa de markdown solo para renderizar texto con encabezados,
// listas, negrita y notas. Soporta: ##, ###, -, 1., **bold**, > nota, ---.
function renderInline(text: string, key: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={`${key}-${i}`} style={{ color: '#1A1028' }}>{part.slice(2, -2)}</strong>
          : <span key={`${key}-${i}`}>{part}</span>
      )}
    </>
  );
}

function LegalContent({ markdown }: { markdown: string }) {
  const lines = markdown.split('\n');
  const blocks: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let listOrdered = false;

  function flushList(key: string) {
    if (listBuffer.length === 0) return;
    const Tag = listOrdered ? 'ol' : 'ul';
    blocks.push(
      <Tag key={key} style={{ margin: '0 0 14px', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {listBuffer.map((item, i) => (
          <li key={i} style={{ fontSize: 14, lineHeight: 1.65, color: '#4A4560' }}>{renderInline(item, `${key}-${i}`)}</li>
        ))}
      </Tag>
    );
    listBuffer = [];
  }

  lines.forEach((raw, idx) => {
    const line = raw.trim();
    const key = `b${idx}`;

    if (line === '' ) { flushList(key); return; }
    if (line === '---') { flushList(key); blocks.push(<div key={key} style={{ height: 1, background: 'rgba(120,80,200,0.10)', margin: '20px 0' }} />); return; }
    if (line.startsWith('### ')) { flushList(key); blocks.push(<h3 key={key} style={{ margin: '18px 0 8px', fontSize: 15, fontWeight: 600, color: '#1A1028' }}>{line.slice(4)}</h3>); return; }
    if (line.startsWith('## ')) { flushList(key); blocks.push(<h2 key={key} style={{ margin: '26px 0 10px', fontSize: 18, fontWeight: 800, color: '#7C3AED' }}>{line.slice(3)}</h2>); return; }
    if (line.startsWith('# ')) { flushList(key); return; } // el H1 ya se muestra en el header de la página
    if (line.startsWith('> ')) { flushList(key); blocks.push(
      <div key={key} style={{ margin: '0 0 16px', padding: '12px 14px', borderRadius: 12, background: 'rgba(255,183,3,0.08)', border: '1px solid rgba(255,183,3,0.22)', fontSize: 12.5, lineHeight: 1.6, color: '#8A6A00', fontStyle: 'italic' }}>
        {renderInline(line.slice(2).replace(/^\*|\*$/g, ''), key)}
      </div>
    ); return; }
    if (/^\d+\.\s/.test(line)) { listOrdered = true; listBuffer.push(line.replace(/^\d+\.\s/, '')); return; }
    if (line.startsWith('- ')) { listOrdered = false; listBuffer.push(line.slice(2)); return; }

    flushList(key);
    blocks.push(<p key={key} style={{ margin: '0 0 14px', fontSize: 14, lineHeight: 1.7, color: '#4A4560' }}>{renderInline(line, key)}</p>);
  });
  flushList('end');

  return <>{blocks}</>;
}

export default function LegalDoc({ title, subtitle, updatedAt, markdown }: {
  title: string; subtitle: string; updatedAt: string; markdown: string;
}) {
  return (
    <div style={{ background: '#F7F7FB', minHeight: '100dvh', fontFamily: 'inherit' }}>
      {/* Header público */}
      <div style={{ background: '#fff', borderBottom: '1px solid rgba(120,80,200,0.10)', padding: '14px 20px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Image src="/logo.png" alt="VeloClub" width={30} height={30} className="object-contain shrink-0" style={{ borderRadius: 8 }} />
          <span style={{ fontSize: 15, fontWeight: 800, color: '#1A1028' }}>VeloClub</span>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 20px 80px' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#7C3AED', textDecoration: 'none', marginBottom: 18 }}>
          <ArrowLeft size={15} /> Volver
        </Link>

        <div style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.10)', borderRadius: 20, padding: '28px 24px', boxShadow: '0 2px 20px rgba(124,58,237,0.06)' }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 800, color: '#1A1028', lineHeight: 1.2 }}>{title}</h1>
          <p style={{ margin: '0 0 4px', fontSize: 13, color: '#8E87A8' }}>{subtitle}</p>
          <p style={{ margin: '0 0 22px', fontSize: 11, color: '#C4BFD8' }}>Última actualización: {updatedAt}</p>
          <LegalContent markdown={markdown} />
        </div>
      </div>
    </div>
  );
}
