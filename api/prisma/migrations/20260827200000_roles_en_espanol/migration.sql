-- Los roles del enum pasan al español: COACH -> ENTRENADOR, STUDENT -> DEPORTISTA.
--
-- Se usa ALTER TYPE ... RENAME VALUE y no se recrea el tipo: renombrar el valor
-- conserva el OID, así que las filas que ya lo tienen quedan apuntando al mismo
-- sitio y no hay que migrar ni una. Los @default del esquema también sobreviven
-- por la misma razón.
--
-- Lo que el renombrado NO alcanza son las columnas que guardan el rol como texto
-- libre, que son "Post"."authorRole" y "PostComment"."authorRole": ahí el valor
-- es un String suelto y hay que actualizarlo a mano. Si se omite, las
-- publicaciones viejas seguirían diciendo COACH y la interfaz no sabría
-- traducirlo.

ALTER TYPE "Role" RENAME VALUE 'COACH' TO 'ENTRENADOR';
ALTER TYPE "Role" RENAME VALUE 'STUDENT' TO 'DEPORTISTA';

UPDATE "Post"        SET "authorRole" = 'ENTRENADOR' WHERE "authorRole" = 'COACH';
UPDATE "Post"        SET "authorRole" = 'DEPORTISTA' WHERE "authorRole" = 'STUDENT';
UPDATE "PostComment" SET "authorRole" = 'ENTRENADOR' WHERE "authorRole" = 'COACH';
UPDATE "PostComment" SET "authorRole" = 'DEPORTISTA' WHERE "authorRole" = 'STUDENT';
