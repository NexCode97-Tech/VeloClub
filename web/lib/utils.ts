import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parsea una fecha sin perder el día por timezone.
 *
 * Casos:
 *  "2026-06-05"               → new Date("2026-06-05") = UTC midnight → Colombia = día anterior ❌
 *  "2026-06-05T00:00:00.000Z" → Prisma datetime → Colombia = día anterior ❌
 *
 * Solución: extraer YYYY-MM-DD y forzar hora local midnight ✅
 */
/** Primera letra en mayúscula, resto en minúscula. */
export function toSentenceCase(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function parseLocalDate(dateStr: string): Date {
  // Extrae solo la parte YYYY-MM-DD y la parsea como hora local
  const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return new Date(match[1] + 'T00:00:00');
  return new Date(dateStr);
}
