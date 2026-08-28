'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

/**
 * Última red de seguridad de la aplicación.
 *
 * Sin este archivo, un error dentro del render de React no llega a Sentry: el
 * App Router lo atrapa antes y pinta su propia pantalla en blanco, así que el
 * fallo más visible para el usuario era justo el que nosotros no veíamos.
 *
 * Reemplaza al documento entero, por eso lleva sus propias etiquetas html y
 * body y no puede apoyarse en el layout ni en los estilos de la app.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: '#F7F7FB',
          color: '#1A1028',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        }}
      >
        <div style={{ maxWidth: 380, textAlign: 'center' }}>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              margin: '0 0 8px',
            }}
          >
            Algo se rompió de nuestro lado
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: '#8E87A8', margin: '0 0 20px' }}>
            Ya nos llegó el aviso y lo estamos revisando. Vuelve a cargar la
            página; si sigue igual, escríbenos.
          </p>
          <a
            href="/dashboard"
            style={{
              display: 'inline-block',
              padding: '10px 20px',
              borderRadius: 12,
              background: '#381DA0',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Volver al inicio
          </a>
        </div>
      </body>
    </html>
  );
}
