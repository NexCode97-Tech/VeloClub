/**
 * Las cuentas de color del carnet.
 *
 * Todo lo que decide si algo se lee vive acá. El club elige su color y nadie le
 * pregunta por el del texto: con color libre es fácil terminar con blanco sobre
 * amarillo, y eso no se corrige con una advertencia sino calculándolo.
 *
 * Está en lib y no dentro del componente porque el carnet se pinta dos veces:
 * en pantalla con HTML y en el canvas del que salen la imagen y el PDF. Las dos
 * tienen que llegar al mismo color.
 */

export interface Rgb { r: number; g: number; b: number }
export interface Hsv { h: number; s: number; v: number }

export const HEX = /^#[0-9A-Fa-f]{6}$/;

/** El que se usa cuando el club todavía no eligió ninguno. */
export const COLOR_NEUTRO = '#3D4557';

export function hexARgb(hex: string): Rgb {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbAHex(r: number, g: number, b: number): string {
  const dos = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
  return `#${dos(r)}${dos(g)}${dos(b)}`;
}

export function hsvARgb(h: number, s: number, v: number): Rgb {
  const hh = ((h % 360) + 360) % 360;
  const ss = s / 100;
  const vv = v / 100;
  const c = vv * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = vv - c;
  let r = 0, g = 0, b = 0;
  if (hh < 60)       { r = c; g = x; }
  else if (hh < 120) { r = x; g = c; }
  else if (hh < 180) { g = c; b = x; }
  else if (hh < 240) { g = x; b = c; }
  else if (hh < 300) { r = x; b = c; }
  else               { r = c; b = x; }
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

export function rgbAHsv(r: number, g: number, b: number): Hsv {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const mx = Math.max(rr, gg, bb);
  const mn = Math.min(rr, gg, bb);
  const d = mx - mn;
  let h = 0;
  if (d !== 0) {
    if (mx === rr)      h = 60 * (((gg - bb) / d) % 6);
    else if (mx === gg) h = 60 * ((bb - rr) / d + 2);
    else                h = 60 * ((rr - gg) / d + 4);
  }
  if (h < 0) h += 360;
  return { h, s: mx === 0 ? 0 : (d / mx) * 100, v: mx * 100 };
}

/** Luminancia relativa, la de la norma de contraste. */
export function luminancia(hex: string): number {
  const c = hexARgb(hex);
  const canal = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * canal(c.r) + 0.7152 * canal(c.g) + 0.0722 * canal(c.b);
}

export function contraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Blanco o negro, el que se lea contra ese fondo. */
export function tintaSobre(hex: string): string {
  return contraste(hex, '#FFFFFF') >= contraste(hex, '#1A1028') ? '#FFFFFF' : '#1A1028';
}

/**
 * El mismo color, oscurecido hasta que se lea sobre blanco.
 *
 * El color del club también va en texto pequeño, como el teléfono de quien
 * responde por el deportista. Un amarillo de club sobre blanco no se ve, así
 * que se le baja el brillo conservando el tono, que es lo que la gente
 * reconoce del club.
 */
export function paraTexto(hex: string): string {
  const c = hexARgb(hex);
  const hsv = rgbAHsv(c.r, c.g, c.b);
  let v = hsv.v;
  let salida = hex;
  for (let i = 0; i < 24; i++) {
    const rgb = hsvARgb(hsv.h, Math.max(hsv.s, 30), v);
    salida = rgbAHex(rgb.r, rgb.g, rgb.b);
    if (contraste(salida, '#FFFFFF') >= 4.5) break;
    v -= 4;
    if (v < 6) break;
  }
  return salida;
}

export interface ColoresCarnet {
  /** El color principal, o el neutro si el club no eligió. */
  a: string;
  /** El segundo, solo cuando hay degradado. */
  b: string | null;
  /** El texto que va sobre la banda. */
  tinta: string;
  /** El color del club, servido para texto sobre blanco. */
  texto: string;
  /** Listo para un `background` de CSS. */
  fondo: string;
}

/**
 * Los colores del carnet a partir de lo que el club guardó.
 *
 * Un color queda plano y dos hacen el degradado. Sin nada elegido va el gris
 * neutro, que se ve serio: un carnet no puede salir a medio hacer porque
 * todavía no pasaron por Ajustes.
 */
export function coloresDelCarnet(primario?: string | null, secundario?: string | null): ColoresCarnet {
  const a = primario && HEX.test(primario) ? primario : COLOR_NEUTRO;
  const b = secundario && HEX.test(secundario) ? secundario : null;
  // Con dos colores la tinta se decide por el promedio de los dos: mirar solo
  // el primero deja texto blanco sobre la mitad clara del degradado.
  const tinta = b
    ? ((luminancia(a) + luminancia(b)) / 2 > 0.35 ? '#1A1028' : '#FFFFFF')
    : tintaSobre(a);
  return {
    a,
    b,
    tinta,
    texto: paraTexto(a),
    fondo: b ? `linear-gradient(135deg, ${a}, ${b})` : a,
  };
}
