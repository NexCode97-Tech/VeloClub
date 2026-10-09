/**
 * Traduce lo que responde Clerk al crear una cuenta (VELOCLUB-API-9, 8-oct). Clerk responde 422
 * «Unprocessable Entity» y el motivo real viene en `errors[].code`, no en el mensaje; antes solo se miraba
 * el mensaje y la persona recibía «No se pudo crear la cuenta» sin saber qué corregir.
 */
export interface ErrorClerk { status: number; campo?: 'email' | 'password' | 'fullName'; error: string }

type DetalleClerk = { code?: string; message?: string; longMessage?: string; meta?: { paramName?: string } };

export function codigosClerk(err: unknown): string[] {
  const lista = (err as { errors?: DetalleClerk[] })?.errors;
  return Array.isArray(lista) ? lista.map(e => String(e?.code ?? '')).filter(Boolean) : [];
}

export function traducirErrorClerk(err: unknown): ErrorClerk | null {
  const lista = ((err as { errors?: DetalleClerk[] })?.errors ?? []) as DetalleClerk[];
  const msg = err instanceof Error ? err.message : String(err);
  for (const e of lista) {
    const code = String(e?.code ?? ''), param = String(e?.meta?.paramName ?? '');
    if (code === 'form_identifier_exists' || /already|taken|exists/i.test(e?.longMessage ?? ''))
      return { status: 409, campo: 'email', error: 'Ese correo ya tiene una cuenta. Usa otro para este deportista.' };
    if (code === 'form_password_pwned')
      return { status: 400, campo: 'password', error: 'Esa contraseña apareció en una filtración de datos. Elige otra.' };
    if (code === 'form_password_length_too_short')
      return { status: 400, campo: 'password', error: 'La contraseña debe tener al menos 8 caracteres.' };
    if (code === 'form_password_size_in_bytes_exceeded' || code === 'form_password_length_too_long')
      return { status: 400, campo: 'password', error: 'La contraseña es demasiado larga. Usa una más corta.' };
    if (code.startsWith('form_password'))
      return { status: 400, campo: 'password', error: 'Esa contraseña es muy fácil de adivinar. Elige otra más segura.' };
    if (param === 'email_address' || code === 'form_param_format_invalid' && /email/i.test(e?.longMessage ?? ''))
      return { status: 400, campo: 'email', error: 'Ese correo no es válido. Revísalo.' };
    if (param === 'first_name' || param === 'last_name')
      return { status: 400, campo: 'fullName', error: 'Revisa el nombre: tiene caracteres que no se aceptan.' };
  }
  // Respaldo: lo que ya reconocía el mensaje.
  if (/already|taken|exists/i.test(msg)) return { status: 409, campo: 'email', error: 'Ese correo ya tiene una cuenta. Usa otro para este deportista.' };
  if (/password|pwned|breach|weak|common/i.test(msg)) return { status: 400, campo: 'password', error: 'Esa contraseña es muy fácil de adivinar. Elige otra.' };
  return null;
}
