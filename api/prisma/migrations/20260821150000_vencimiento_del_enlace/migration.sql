-- Cierre automatico del enlace de inscripcion.
--
-- Opcional. Si el club pone una fecha, pasada esa fecha el enlace deja de
-- recibir. El token no se toca: al reabrir vale el mismo enlace, para no
-- obligar al club a repartirlo de nuevo por WhatsApp.
ALTER TABLE "Club" ADD COLUMN "inscripcionVenceAt" TIMESTAMP(3);
