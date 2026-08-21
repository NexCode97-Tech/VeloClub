-- Genero y datos de emergencia del deportista.
--
-- Los tres van opcionales: exigirlos frenaria una inscripcion por un dato que
-- la familia puede no tener a mano en ese momento, y el objetivo del formulario
-- es que lo terminen.

-- La rama con la que compite. Las competencias de patinaje se dividen por sexo
-- y el dato no existia: el club lo sabia de memoria, asi que los resultados no
-- se podian separar ni filtrar por rama.
ALTER TABLE "Member" ADD COLUMN "gender" TEXT;

-- Es un deporte de caidas, con menores, y muchas veces sin un adulto de la
-- familia presente. La ficha ya tenia EPS y contacto de emergencia, pero si un
-- nino se golpeaba el entrenador no tenia el tipo de sangre ni sabia si era
-- alergico a algo.
ALTER TABLE "Member" ADD COLUMN "rh"        TEXT;
ALTER TABLE "Member" ADD COLUMN "allergies" TEXT;
