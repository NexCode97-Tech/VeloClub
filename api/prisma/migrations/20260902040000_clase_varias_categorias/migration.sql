-- Una clase puede ser de varias categorias.
--
-- Con una sola, un club cuya clase de la mañana recibe menores Y transicion
-- tenia que partirla en dos clases a la misma hora en la misma sede, o dejarla
-- en «todas» y que la planilla trajera tambien a los mayores.
--
-- La columna nueva se llena con la vieja antes de borrarla, asi que ninguna
-- clase pierde su filtro: la que decia «Menores 3-10 años» queda con esa sola
-- adentro, y la que estaba en null queda con la lista vacia, que significa lo
-- mismo que significaba el null: la sede entera.

ALTER TABLE "ClaseHorario" ADD COLUMN "categorias" TEXT[] DEFAULT ARRAY[]::TEXT[];

UPDATE "ClaseHorario"
   SET "categorias" = ARRAY["categoria"]
 WHERE "categoria" IS NOT NULL;

ALTER TABLE "ClaseHorario" ALTER COLUMN "categorias" SET NOT NULL;
ALTER TABLE "ClaseHorario" DROP COLUMN "categoria";
