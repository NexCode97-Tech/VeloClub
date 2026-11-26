-- Club de prueba: club inventado dentro de producción que vive en una burbuja.
-- Todos los clubes que ya existen quedan como reales.
ALTER TABLE "Club" ADD COLUMN "esPrueba" BOOLEAN NOT NULL DEFAULT false;
