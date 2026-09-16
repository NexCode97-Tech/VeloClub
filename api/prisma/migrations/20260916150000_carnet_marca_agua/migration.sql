-- El interruptor de la marca de agua del carnet. Prendida por defecto: es lo
-- que distingue un carnet institucional de una tarjeta cualquiera.
ALTER TABLE "Club" ADD COLUMN "carnetMarcaAgua" BOOLEAN NOT NULL DEFAULT true;
