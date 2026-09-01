-- El modal de «arma tu horario» que se le lanza a un administrador al entrar.
--
-- Estas dos columnas son el freno, no el disparador. Quien decide si el modal
-- aparece es el club: sigue apareciendo mientras no tenga ningun grupo, y por
-- eso la tarea pasa sola al siguiente administrador que entre.
--
-- Lo que se guarda aca es cuando ESTA persona lo aplazo y cuantas veces, para
-- que no se lo vuelva a encontrar en el siguiente refresco. Va en User y no en
-- Club porque la tarea es del club pero el fastidio es de cada uno: si el freno
-- viviera en el club, el primero que aplaza le apaga el aviso a los demas.

ALTER TABLE "User" ADD COLUMN "horarioAplazadoAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "horarioAplazos" INTEGER NOT NULL DEFAULT 0;
