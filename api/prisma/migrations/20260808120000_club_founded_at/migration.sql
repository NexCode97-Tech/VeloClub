-- Fecha real de fundacion del club. Queda en NULL para los clubes existentes:
-- el perfil sigue mostrando createdAt hasta que el admin declare la verdadera.
ALTER TABLE "Club" ADD COLUMN "foundedAt" TIMESTAMP(3);
