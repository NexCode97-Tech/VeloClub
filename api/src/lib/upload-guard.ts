/**
 * Validación de los payloads que se envían a Cloudinary.
 *
 * `cloudinary.uploader.upload` acepta tanto un data URI como una URL remota, así
 * que pasarle el string del cuerpo sin revisar permitía que un usuario
 * autenticado hiciera que Cloudinary buscara una URL arbitraria (incluidas
 * direcciones internas). Además no había tope de tamaño real ni control del tipo
 * de archivo. Estas funciones cierran ambas cosas antes de llamar a Cloudinary.
 */

const PREFIJOS_IMAGEN = ['data:image/png', 'data:image/jpeg', 'data:image/jpg', 'data:image/webp'];
const PREFIJOS_VIDEO  = ['data:video/mp4', 'data:video/quicktime', 'data:video/webm'];
const PREFIJOS_DOC    = ['data:application/pdf'];

export type TipoSubida = 'image' | 'video' | 'doc';

// Discriminado a propósito: al validar devuelve el payload ya comprobado, para que
// quien llame use ese valor y no el original, que puede ser undefined.
export type ResultadoValidacion =
  | { ok: true; data: string }
  | { ok: false; error: string };

/** Tamaños máximos del contenido real, ya descontado el inflado del base64. */
const MAX_BYTES: Record<TipoSubida, number> = {
  image: 5 * 1024 * 1024,
  video: 40 * 1024 * 1024,
  doc:   10 * 1024 * 1024,
};

function prefijosPermitidos(tipo: TipoSubida): string[] {
  if (tipo === 'video') return PREFIJOS_VIDEO;
  if (tipo === 'doc')   return [...PREFIJOS_DOC, ...PREFIJOS_IMAGEN]; // un soporte puede ser foto o PDF
  return PREFIJOS_IMAGEN;
}

/**
 * Comprueba que el payload sea un data URI del tipo esperado y que no exceda el
 * tamaño permitido. Rechaza cualquier cosa que parezca una URL remota.
 */
export function validarSubida(payload: unknown, tipo: TipoSubida): ResultadoValidacion {
  if (typeof payload !== 'string' || payload.length === 0) {
    return { ok: false, error: 'Archivo requerido' };
  }

  const permitidos = prefijosPermitidos(tipo);
  if (!permitidos.some(p => payload.startsWith(`${p};base64,`))) {
    return { ok: false, error: 'Formato de archivo no permitido' };
  }

  const base64 = payload.slice(payload.indexOf(',') + 1);
  // Cada 4 caracteres de base64 representan 3 bytes.
  const bytes = Math.floor(base64.length * 0.75);
  if (bytes > MAX_BYTES[tipo]) {
    const mb = Math.floor(MAX_BYTES[tipo] / (1024 * 1024));
    return { ok: false, error: `El archivo supera el máximo de ${mb} MB` };
  }

  return { ok: true, data: payload };
}
