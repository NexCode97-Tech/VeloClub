import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parsea una fecha sin perder el día por timezone.
 * new Date('2026-06-05') → UTC → Colombia (UTC-5) = 2026-06-04 ❌
 * parseLocalDate('2026-06-05') → local midnight = 2026-06-05 ✅
 */
export function parseLocalDate(dateStr: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(dateStr + 'T00:00:00');
  }
  return new Date(dateStr);
}
