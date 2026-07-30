/**
 * Restricción de audiencia de los JWT de Clerk.
 *
 * `verifyToken` solo comprueba que el token lo haya firmado nuestra instancia de
 * Clerk, no para qué origen se emitió. Sin esta verificación, un token emitido
 * para otra aplicación de la misma instancia sirve para llamar a esta API.
 *
 * Se valida el claim `azp` a mano en lugar de pasar `authorizedParties` a
 * `verifyToken` a propósito: si Clerk dejara de incluir `azp`, esa opción
 * rechazaría todos los tokens y tumbaría el acceso de todos los usuarios. Aquí un
 * token sin `azp` se acepta y solo se rechaza el que declara un origen ajeno.
 */

const origenesPermitidos = (): string[] => {
  const base = (process.env.WEB_ORIGIN || 'http://localhost:3000').replace(/\/$/, '');
  return [base, base.replace('https://', 'https://www.')];
};

/** Devuelve false solo si el token declara un origen que no es el nuestro. */
export function audienciaEsValida(payload: { azp?: unknown }): boolean {
  const azp = payload.azp;
  if (typeof azp !== 'string' || azp.length === 0) return true; // sin azp no hay nada que contrastar
  const azpNormalizado = azp.replace(/\/$/, '');
  return origenesPermitidos().includes(azpNormalizado);
}
