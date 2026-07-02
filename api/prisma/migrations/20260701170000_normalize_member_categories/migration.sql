-- Normaliza las categorías de los miembros a las 3 oficiales.
-- Datos viejos quedaron con variantes por tildes, espacios o redacción
-- (ej: "Transicion 11-13 años", "Menores 3 - 10 años", "Mayores 14"),
-- que aparecían como grupos separados en Asistencia/Miembros.
-- El formulario y la plantilla de Excel ya usan estos valores canónicos.

UPDATE "Member"
SET "category" = 'Menores 3-10 años'
WHERE "category" IS NOT NULL
  AND "category" ILIKE '%menor%'
  AND "category" <> 'Menores 3-10 años';

UPDATE "Member"
SET "category" = 'Transición 11-13 años'
WHERE "category" IS NOT NULL
  AND "category" ILIKE '%transic%'
  AND "category" <> 'Transición 11-13 años';

UPDATE "Member"
SET "category" = 'Mayores 14+ años'
WHERE "category" IS NOT NULL
  AND "category" ILIKE '%mayor%'
  AND "category" <> 'Mayores 14+ años';
