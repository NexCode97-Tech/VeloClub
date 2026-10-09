import type { z } from 'zod';

/**
 * Un error de validación de zod, dicho en una frase que se pueda mostrar.
 *
 * Existe porque las rutas devolvían `parsed.error.issues`, que es una lista, y
 * `apiFetch` solo pinta el campo `error` cuando es texto. Con la lista, la
 * pantalla caía en un mensaje genérico y nadie sabía qué dato corregir: así
 * se fueron siete intentos de crear un club el 9 de octubre de 2026.
 *
 * Toma el primer problema y no todos: corregir uno a la vez es lo que la gente
 * hace igual, y una lista de cuatro errores en un renglón rojo no se lee.
 *
 * `campos` nombra cada campo como lo ve la persona ("El correo del admin"), no
 * como se llama en el código.
 */
export function mensajeDeValidacion(
  issues: z.core.$ZodIssue[],
  campos: Record<string, string>,
): string {
  const primero = issues[0];
  if (!primero) return 'Revisa los datos del formulario.';

  const clave = String(primero.path[0] ?? '');
  // Por Map y no `campos[clave]`: la clave sale del cuerpo de la petición, y
  // leerla directo sobre el objeto alcanzaría `__proto__` y compañía.
  const campo = new Map(Object.entries(campos)).get(clave) ?? 'Un dato del formulario';

  switch (primero.code) {
    case 'invalid_format':
      return primero.format === 'email'
        ? `${campo} no es un correo válido. Revísalo.`
        : `${campo} no tiene el formato correcto.`;
    case 'too_small':
      return `${campo} es muy corto. Debe tener al menos ${String(primero.minimum)} caracteres.`;
    case 'too_big':
      return `${campo} es muy largo. Debe tener máximo ${String(primero.maximum)} caracteres.`;
    case 'invalid_type':
      return `Falta ${minuscula(campo)}.`;
    default:
      return `Revisa ${minuscula(campo)}.`;
  }
}

function minuscula(texto: string): string {
  return texto.charAt(0).toLowerCase() + texto.slice(1);
}
