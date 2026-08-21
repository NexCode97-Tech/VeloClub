import type { Metadata } from 'next';
import FormularioInscripcion from './formulario';

/**
 * Inscripción por enlace, pública.
 *
 * No lleva sesión ni layout de dashboard: se abre desde un WhatsApp, sin cuenta
 * y casi siempre desde el celular. Quien la llena es el deportista, o su
 * acudiente cuando es menor.
 */

export const metadata: Metadata = {
  title: 'Inscripción de deportistas',
  description: 'Completa tus datos para inscribirte al club.',
  // El enlace circula por chats. Que no lo indexe un buscador: lo comparte el
  // club con quien quiere, no es una página que deba encontrarse sola.
  robots: { index: false, follow: false },
};

export default async function PaginaInscripcion({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <FormularioInscripcion token={token} />;
}
