# Prototipos

Maquetas de una sola página, sin dependencias ni build. Se abren con doble clic
en el navegador y sirven para acordar diseño antes de llevarlo a `web/`.

No son código de producción y nada de `web/` los importa.

## `landing.html`

La landing pública. Trae el hero, la sección de funcionalidades con sus cuatro
pestañas, los planes y el cierre, más las notas de diseño al pie de cada vista
explicando por qué cada decisión quedó como quedó.

Lo que ya está acordado aquí y todavía **no** está en `web/app/page.tsx`:

- Hero en dos columnas, con el título a la izquierda y la bajada a su derecha.
- Registro de marca institucional, en tercera persona, sin apelar al lector.
- Fondo `#FDFCFC` en vez de blanco puro.
- Funcionalidades sin sub-pestañas, con las entradas de cada módulo en una
  rejilla de dos columnas.
- Íconos propios del proyecto, los mismos de `components/ui/custom-icons.tsx`.
