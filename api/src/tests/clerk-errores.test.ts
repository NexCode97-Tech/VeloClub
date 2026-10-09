import { describe, it, expect } from 'vitest';
import { traducirErrorClerk, codigosClerk } from '../lib/clerk-errores';

/**
 * La inscripción por enlace crea la cuenta del deportista en Clerk, y Clerk
 * rechaza con 422 y el motivo en `errors[].code`.
 *
 * Hasta el 8 de octubre de 2026 ese motivo no se leía: el deportista veía «No
 * se pudo crear la cuenta. Intenta de nuevo» y reintentaba con lo mismo. Así
 * se fueron los doce intentos de Nueva Generación del 7 de octubre, y así es
 * como nadie había entrado nunca por un enlace en producción.
 *
 * Producción exige una clave medianamente fuerte (zxcvbn 2) y rechaza las que
 * salieron en filtraciones, así que la clave es el rechazo que más va a pasar.
 */

/** Un error con la forma que trae `ClerkAPIResponseError`. */
function rechazo(code: string, extra: { longMessage?: string; paramName?: string } = {}) {
  const e = new Error('Unprocessable Entity') as Error & { errors: unknown[] };
  e.errors = [{
    code,
    message: 'msg',
    longMessage: extra.longMessage ?? '',
    meta: extra.paramName ? { paramName: extra.paramName } : {},
  }];
  return e;
}

describe('la contraseña', () => {
  it('una clave débil se le explica, no se reintenta a ciegas', () => {
    const t = traducirErrorClerk(rechazo('form_password_not_strong_enough'));
    expect(t?.campo).toBe('password');
    expect(t?.status).toBe(400);
    expect(t?.error).toMatch(/fácil de adivinar/);
  });

  it('una clave filtrada dice que salió en una filtración', () => {
    expect(traducirErrorClerk(rechazo('form_password_pwned'))?.error).toMatch(/filtración/);
  });

  it('una clave corta dice cuántos caracteres', () => {
    expect(traducirErrorClerk(rechazo('form_password_length_too_short'))?.error).toMatch(/8 caracteres/);
  });

  it('cualquier otro rechazo de clave cae en el de clave, no en el genérico', () => {
    expect(traducirErrorClerk(rechazo('form_password_validation_failed'))?.campo).toBe('password');
  });
});

describe('el correo', () => {
  it('un correo ya usado lo manda al campo del correo', () => {
    const t = traducirErrorClerk(rechazo('form_identifier_exists', { paramName: 'email_address' }));
    expect(t?.campo).toBe('email');
    expect(t?.status).toBe(409);
  });

  it('un correo mal escrito dice que no es válido', () => {
    const t = traducirErrorClerk(rechazo('form_param_format_invalid', {
      paramName: 'email_address', longMessage: 'email_address must be a valid email address.',
    }));
    expect(t?.campo).toBe('email');
    expect(t?.error).toMatch(/no es válido/);
  });
});

describe('lo que no se reconoce', () => {
  // Esto sí debe llegar a Sentry: es un motivo nuevo que no sabemos explicar.
  it('devuelve null para que la ruta lo reporte', () => {
    expect(traducirErrorClerk(rechazo('algo_nuevo_de_clerk'))).toBeNull();
  });

  it('saca los códigos para el reporte', () => {
    expect(codigosClerk(rechazo('form_password_pwned'))).toEqual(['form_password_pwned']);
    expect(codigosClerk(new Error('sin lista'))).toEqual([]);
  });
});
