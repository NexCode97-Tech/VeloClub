-- El color con el que se pinta un grupo, y el de una clase que quiera otro.
--
-- Hasta ahora el color salia de la posicion del grupo en la lista ordenada por
-- nombre. Eso funciona hasta que alguien renombra un grupo: la lista se
-- reordena y todos los grupos cambian de color de golpe, sin que nadie lo haya
-- pedido. Guardarlo lo deja quieto.
--
-- Se guarda como "#RRGGBB" y no como el nombre de un color de la paleta: la
-- paleta del selector puede crecer o cambiar, y los grupos ya pintados no
-- deberian moverse por eso.
--
-- Las dos columnas quedan NULL para lo que ya existe. Null no es «sin color»:
-- es «todavia no lo escogieron», y ahi sigue mandando la regla de la posicion.
-- Asi la migracion no le cambia el color a ningun club que ya este mirando su
-- horario.

ALTER TABLE "Grupo" ADD COLUMN "color" TEXT;
ALTER TABLE "ClaseHorario" ADD COLUMN "color" TEXT;
