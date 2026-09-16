-- Colores del club, para el carnet digital.
-- El segundo es opcional: sin el, la banda del carnet va plana.
ALTER TABLE "Club" ADD COLUMN "colorPrimario" TEXT;
ALTER TABLE "Club" ADD COLUMN "colorSecundario" TEXT;
