import jsPDF from 'jspdf';
import { coloresDelCarnet, hexARgb } from '@/lib/color';

/**
 * El carnet, dibujado.
 *
 * En pantalla el carnet es HTML, porque tiene que ser accesible y adaptarse al
 * ancho del teléfono. Para salir de la app se dibuja acá, sobre un canvas, y de
 * ese mismo canvas salen **la imagen y el PDF**. Dos pinturas y no tres: la que
 * se lee y la que se lleva.
 *
 * El canvas va a triple resolución. Un carnet se mira de cerca y se imprime, y
 * a tamaño natural el texto de nueve puntos sale mordido.
 */

export interface DatosCarnet {
  miembro: {
    id: string;
    nombre: string;
    foto: string | null;
    docTipo: string | null;
    docNumero: string | null;
    nacimiento: string | null;
    categoria: string | null;
    tipo: string | null;
    rol: string;
    activo: boolean;
    desde: string;
    rh: string | null;
    alergias: string | null;
    eps: string | null;
    acudiente: string | null;
    acudienteTelefono: string | null;
    acudienteParentesco: string | null;
    sede: string | null;
    deporte: string | null;
  };
  club: {
    nombre: string;
    ciudad: string | null;
    logo: string | null;
    colorPrimario: string | null;
    colorSecundario: string | null;
  };
  vigencia: {
    estado: 'vigente' | 'vencido' | 'sin_registro';
    hasta: string | null;
  };
}

/** Las medidas del carnet, en puntos. Es la proporción de uno plastificado. */
export const ANCHO = 304;
export const ALTO = 476;
const ESCALA = 3;

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function fechaCorta(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function mesYAnio(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Las iniciales, para cuando no hay foto ni logo. */
export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

/**
 * El rótulo de vigencia.
 *
 * Sin pagos registrados no dice «vencido». Hay clubes que todavía no llevan las
 * mensualidades acá, y marcarle el carnet como vencido a todo su equipo sería
 * acusarlos de una mora que nadie registró.
 */
export function rotuloVigencia(v: DatosCarnet['vigencia']): { texto: string; alerta: boolean } {
  if (v.estado === 'vencido') return { texto: 'Vencido', alerta: true };
  return { texto: 'Vigente', alerta: false };
}

/** Carga una imagen sin romper el carnet si la URL falla. */
async function cargarImagen(url: string): Promise<HTMLImageElement | null> {
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  } catch {
    return null;
  }
}

function redondeado(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Recorta el texto con puntos suspensivos cuando no cabe. */
function recortar(ctx: CanvasRenderingContext2D, texto: string, ancho: number): string {
  if (ctx.measureText(texto).width <= ancho) return texto;
  let t = texto;
  while (t.length > 1 && ctx.measureText(t + '…').width > ancho) t = t.slice(0, -1);
  return t + '…';
}

const FUENTE = "'Geist', system-ui, -apple-system, 'Segoe UI', sans-serif";

/** El frente del carnet. */
async function dibujarFrente(ctx: CanvasRenderingContext2D, d: DatosCarnet) {
  const c = coloresDelCarnet(d.club.colorPrimario, d.club.colorSecundario);
  const m = d.miembro;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, ANCHO, ALTO);

  // La banda
  const ALTO_BANDA = 108;
  if (c.b) {
    const g = ctx.createLinearGradient(0, 0, ANCHO, ALTO_BANDA);
    g.addColorStop(0, c.a);
    g.addColorStop(1, c.b);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = c.a;
  }
  ctx.fillRect(0, 0, ANCHO, ALTO_BANDA);

  // El logo del club, o sus iniciales
  const logo = d.club.logo ? await cargarImagen(d.club.logo) : null;
  ctx.save();
  redondeado(ctx, 18, 18, 34, 34, 9);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fill();
  ctx.clip();
  if (logo) {
    ctx.drawImage(logo, 18, 18, 34, 34);
  } else {
    ctx.fillStyle = c.texto;
    ctx.font = `700 12px ${FUENTE}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(iniciales(d.club.nombre), 35, 36);
  }
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = c.tinta;
  ctx.font = `600 13px ${FUENTE}`;
  ctx.fillText(recortar(ctx, d.club.nombre, 168), 62, 32);
  ctx.globalAlpha = 0.82;
  ctx.font = `400 10.5px ${FUENTE}`;
  const abajo = [d.miembro.deporte, d.club.ciudad].filter(Boolean).join(' · ');
  ctx.fillText(recortar(ctx, abajo || 'VeloClub', 168), 62, 46);
  ctx.globalAlpha = 1;

  // El sello de vigencia
  const sello = rotuloVigencia(d.vigencia);
  ctx.font = `700 9px ${FUENTE}`;
  const anchoSello = ctx.measureText(sello.texto.toUpperCase()).width + 18;
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  redondeado(ctx, ANCHO - 18 - anchoSello, 18, anchoSello, 18, 9);
  ctx.fill();
  ctx.fillStyle = c.tinta;
  ctx.textAlign = 'center';
  ctx.fillText(sello.texto.toUpperCase(), ANCHO - 18 - anchoSello / 2, 30.5);

  // La foto, montada sobre la banda
  const foto = m.foto ? await cargarImagen(m.foto) : null;
  const cx = ANCHO / 2;
  const cy = ALTO_BANDA - 32 + 37;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, 40.5, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, 37, 0, Math.PI * 2);
  ctx.clip();
  if (foto) {
    // Recorte cuadrado centrado, para que no se deforme.
    const lado = Math.min(foto.width, foto.height);
    ctx.drawImage(foto, (foto.width - lado) / 2, (foto.height - lado) / 2, lado, lado, cx - 37, cy - 37, 74, 74);
  } else {
    ctx.fillStyle = '#A99FD0';
    ctx.fillRect(cx - 37, cy - 37, 74, 74);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `600 22px ${FUENTE}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(iniciales(m.nombre), cx, cy + 1);
  }
  ctx.restore();

  // Nombre y etiquetas
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#1A1028';
  ctx.font = `600 19px ${FUENTE}`;
  ctx.fillText(recortar(ctx, m.nombre, ANCHO - 40), cx, cy + 68);

  const etiquetas = [m.categoria, m.tipo].filter(Boolean) as string[];
  if (etiquetas.length) {
    ctx.font = `600 10.5px ${FUENTE}`;
    const anchos = etiquetas.map(t => ctx.measureText(t).width + 20);
    let x = cx - (anchos.reduce((a, b) => a + b, 0) + (etiquetas.length - 1) * 6) / 2;
    const rgb = hexARgb(c.texto);
    etiquetas.forEach((t, i) => {
      ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.11)`;
      redondeado(ctx, x, cy + 78, anchos[i], 20, 10);
      ctx.fill();
      ctx.fillStyle = c.texto;
      ctx.fillText(t, x + anchos[i] / 2, cy + 91.5);
      x += anchos[i] + 6;
    });
  }

  // Los datos
  const filas: [string, string][] = [
    ['Documento', [m.docTipo, m.docNumero].filter(Boolean).join(' ') || '—'],
    ['Nacimiento', fechaCorta(m.nacimiento)],
    ['Sede', m.sede ?? '—'],
    ['Vinculado desde', mesYAnio(m.desde)],
  ];
  let y = cy + 120;
  filas.forEach(([rotulo, valor], i) => {
    if (i > 0) {
      ctx.strokeStyle = 'rgba(120,80,200,0.07)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(20, y - 12);
      ctx.lineTo(ANCHO - 20, y - 12);
      ctx.stroke();
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = '#8E87A8';
    ctx.font = `400 11px ${FUENTE}`;
    ctx.fillText(rotulo, 20, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#1A1028';
    ctx.font = `600 12.5px ${FUENTE}`;
    ctx.fillText(recortar(ctx, valor, 165), ANCHO - 20, y);
    y += 26;
  });

  // El pie
  ctx.textAlign = 'left';
  ctx.fillStyle = '#8E87A8';
  ctx.font = `400 11px ${FUENTE}`;
  ctx.fillText(codigoDe(m.id), 20, ALTO - 24);
  ctx.textAlign = 'right';
  if (d.vigencia.hasta) {
    ctx.font = `400 10.5px ${FUENTE}`;
    ctx.fillText('Vigente hasta', ANCHO - 20, ALTO - 36);
    ctx.fillStyle = sello.alerta ? '#C62F50' : '#1A1028';
    ctx.font = `600 12px ${FUENTE}`;
    ctx.fillText(fechaCorta(d.vigencia.hasta), ANCHO - 20, ALTO - 22);
  } else {
    ctx.font = `400 10.5px ${FUENTE}`;
    ctx.fillText('Sin mensualidad registrada', ANCHO - 20, ALTO - 24);
  }
}

/** El reverso: lo que hace falta cuando pasa algo. */
function dibujarReverso(ctx: CanvasRenderingContext2D, d: DatosCarnet) {
  const c = coloresDelCarnet(d.club.colorPrimario, d.club.colorSecundario);
  const m = d.miembro;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, ANCHO, ALTO);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#C62F50';
  ctx.beginPath();
  ctx.arc(24.5, 25, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `700 12px ${FUENTE}`;
  ctx.fillText('EN CASO DE EMERGENCIA', 38, 29);

  // Sangre y alergias
  ctx.fillStyle = 'rgba(198,47,80,0.07)';
  redondeado(ctx, 20, 44, ANCHO - 40, 72, 16);
  ctx.fill();
  ctx.fillStyle = '#8E87A8';
  ctx.font = `400 11px ${FUENTE}`;
  ctx.fillText('Tipo de sangre', 38, 70);
  ctx.fillStyle = '#C62F50';
  ctx.font = `700 30px ${FUENTE}`;
  ctx.fillText(m.rh ?? '—', 38, 102);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#8E87A8';
  ctx.font = `400 11px ${FUENTE}`;
  ctx.fillText('Alergias', ANCHO - 38, 70);
  ctx.fillStyle = '#1A1028';
  ctx.font = `600 12.5px ${FUENTE}`;
  ctx.fillText(recortar(ctx, m.alergias ?? 'Ninguna registrada', 150), ANCHO - 38, 88);

  // Quien responde
  ctx.textAlign = 'left';
  ctx.fillStyle = '#8E87A8';
  ctx.font = `600 11px ${FUENTE}`;
  ctx.fillText('RESPONSABLE', 20, 142);

  ctx.strokeStyle = 'rgba(120,80,200,0.12)';
  ctx.lineWidth = 1;
  redondeado(ctx, 20, 152, ANCHO - 40, m.acudienteTelefono ? 78 : 56, 14);
  ctx.stroke();

  ctx.fillStyle = '#1A1028';
  ctx.font = `600 13.5px ${FUENTE}`;
  ctx.fillText(recortar(ctx, m.acudiente ?? 'Sin registrar', ANCHO - 68), 34, 176);
  if (m.acudienteParentesco) {
    ctx.fillStyle = '#8E87A8';
    ctx.font = `400 11px ${FUENTE}`;
    ctx.fillText(recortar(ctx, m.acudienteParentesco, ANCHO - 68), 34, 192);
  }
  if (m.acudienteTelefono) {
    ctx.fillStyle = c.texto;
    ctx.font = `700 16px ${FUENTE}`;
    ctx.fillText(m.acudienteTelefono, 34, 216);
  }

  // Salud
  const yBase = m.acudienteTelefono ? 262 : 240;
  ctx.fillStyle = '#8E87A8';
  ctx.font = `600 11px ${FUENTE}`;
  ctx.fillText('SALUD', 20, yBase);

  const filas: [string, string][] = [
    ['EPS', m.eps ?? '—'],
    ['Estado', m.activo ? 'Activo en el club' : 'En pausa'],
  ];
  let y = yBase + 26;
  filas.forEach(([rotulo, valor], i) => {
    if (i > 0) {
      ctx.strokeStyle = 'rgba(120,80,200,0.07)';
      ctx.beginPath();
      ctx.moveTo(20, y - 12);
      ctx.lineTo(ANCHO - 20, y - 12);
      ctx.stroke();
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = '#8E87A8';
    ctx.font = `400 11px ${FUENTE}`;
    ctx.fillText(rotulo, 20, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#1A1028';
    ctx.font = `600 12.5px ${FUENTE}`;
    ctx.fillText(recortar(ctx, valor, 175), ANCHO - 20, y);
    y += 26;
  });

  // El pie
  ctx.strokeStyle = 'rgba(120,80,200,0.07)';
  ctx.beginPath();
  ctx.moveTo(20, ALTO - 38);
  ctx.lineTo(ANCHO - 20, ALTO - 38);
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#8E87A8';
  ctx.font = `400 10px ${FUENTE}`;
  ctx.fillText('Emitido por VeloClub', 20, ALTO - 22);
  ctx.textAlign = 'right';
  ctx.fillText('veloclubtech.com', ANCHO - 20, ALTO - 22);
}

/** El código impreso en el carnet. Corto, legible y sin datos adentro. */
export function codigoDe(id: string): string {
  const limpio = id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const cola = limpio.slice(-8).padStart(8, '0');
  return `VC-${cola.slice(0, 4)}-${cola.slice(4)}`;
}

async function pintar(lado: 'frente' | 'reverso', d: DatosCarnet): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = ANCHO * ESCALA;
  canvas.height = ALTO * ESCALA;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo dibujar el carnet');
  ctx.scale(ESCALA, ESCALA);
  if (lado === 'frente') await dibujarFrente(ctx, d);
  else dibujarReverso(ctx, d);
  return canvas;
}

function archivoDe(nombre: string, sufijo: string): string {
  const base = nombre.trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `carnet-${base || 'deportista'}-${sufijo}`;
}

function descargar(url: string, nombre: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** La imagen, con los dos lados uno al lado del otro. */
export async function descargarImagen(d: DatosCarnet): Promise<void> {
  const [frente, reverso] = await Promise.all([pintar('frente', d), pintar('reverso', d)]);
  const hueco = 24 * ESCALA;
  const hoja = document.createElement('canvas');
  hoja.width = frente.width * 2 + hueco;
  hoja.height = frente.height;
  const ctx = hoja.getContext('2d');
  if (!ctx) throw new Error('No se pudo armar la imagen');
  ctx.fillStyle = '#F2F1F7';
  ctx.fillRect(0, 0, hoja.width, hoja.height);
  ctx.drawImage(frente, 0, 0);
  ctx.drawImage(reverso, frente.width + hueco, 0);

  const url = hoja.toDataURL('image/png');
  descargar(url, `${archivoDe(d.miembro.nombre, 'veloclub')}.png`);
}

/**
 * El PDF, a tamaño real de carnet.
 *
 * Los dos lados van en la misma hoja y no en dos páginas: se imprime, se corta
 * y se pega espalda con espalda, que es como termina dentro de una mica.
 */
export async function descargarPdf(d: DatosCarnet): Promise<void> {
  const [frente, reverso] = await Promise.all([pintar('frente', d), pintar('reverso', d)]);

  // 54 x 85,6 mm es el carnet de toda la vida, en vertical.
  const ANCHO_MM = 54;
  const ALTO_MM = ANCHO_MM * (ALTO / ANCHO);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const hoja = doc.internal.pageSize;
  const separacion = 8;
  const total = ANCHO_MM * 2 + separacion;
  const x = (hoja.getWidth() - total) / 2;
  const y = (hoja.getHeight() - ALTO_MM) / 2;

  doc.addImage(frente.toDataURL('image/png'), 'PNG', x, y, ANCHO_MM, ALTO_MM);
  doc.addImage(reverso.toDataURL('image/png'), 'PNG', x + ANCHO_MM + separacion, y, ANCHO_MM, ALTO_MM);

  // La línea de corte. Sin ella nadie sabe por dónde tijeretear.
  doc.setDrawColor(190, 190, 200);
  doc.setLineDashPattern([1, 1], 0);
  doc.setLineWidth(0.1);
  doc.rect(x, y, ANCHO_MM, ALTO_MM);
  doc.rect(x + ANCHO_MM + separacion, y, ANCHO_MM, ALTO_MM);

  doc.save(`${archivoDe(d.miembro.nombre, 'veloclub')}.pdf`);
}
