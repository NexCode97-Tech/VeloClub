// Texto de "Fundado en ..." del perfil de un club.
//
// Hay dos fechas y no significan lo mismo: `foundedAt` es la que el club
// declara en Ajustes y es la verdadera, mientras que `createdAt` solo dice
// cuando se registraron en VeloClub. Mientras no declaren la suya mostramos la
// de registro, que es lo que se venia haciendo, pero sin dia: dar por fundado
// al club el dia exacto en que abrio su cuenta seria afirmar algo falso.

export function textoFundacion(
  foundedAt?: string | null,
  createdAt?: string | null,
): string | null {
  const declarada = foundedAt ? new Date(foundedAt) : null;
  if (declarada && !Number.isNaN(declarada.getTime())) {
    return `Fundado el ${declarada.toLocaleDateString('es-CO', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
    })}`;
  }

  const registro = createdAt ? new Date(createdAt) : null;
  if (registro && !Number.isNaN(registro.getTime())) {
    return `Fundado en ${registro.toLocaleDateString('es-CO', {
      month: 'long', year: 'numeric',
    })}`;
  }

  return null;
}
