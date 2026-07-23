-- Activacion manual del superadmin: el chequeo de vencimiento no la pisa
ALTER TABLE "Club" ADD COLUMN "activadoManualmente" BOOLEAN NOT NULL DEFAULT false;
