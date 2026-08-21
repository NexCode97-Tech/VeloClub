-- Actualizacion de datos por el enlace de inscripcion.
--
-- El uso mas natural del enlace en un club que ya tiene gente cargada no es dar
-- de alta: es mandarselo a los que ya estan para que completen lo que falta.
-- Hasta ahora el formulario los rechazaba.
--
-- Los cambios NO se aplican solos: viven en esta columna hasta que el club los
-- revisa. Sin ese paso, saber una cedula y una fecha de nacimiento alcanzaria
-- para reescribir la ficha de otra persona.
ALTER TABLE "Member" ADD COLUMN "cambiosPendientes" JSONB;

-- La bandeja del club trae los que esperan visto bueno y los que proponen
-- cambios en la misma consulta.
CREATE INDEX "Member_clubId_cambiosPendientes_idx"
  ON "Member"("clubId")
  WHERE "cambiosPendientes" IS NOT NULL;
