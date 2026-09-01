-- Se van los grupos. La planilla de una clase sale de su sede cruzada con su
-- categoria, y nada mas.
--
-- El grupo existio para el club que parte en mañana y tarde sin que la edad los
-- separe: la lista se marcaba a mano por clase. Resolvia ese caso, pero costaba
-- una pantalla propia en Ajustes, un campo obligatorio en el formulario de
-- inscripcion y una columna en la plantilla de Excel, y obligaba a mantener a
-- mano lo que la categoria ya dice. Un club que necesite separar dos clases les
-- pone categorias distintas.
--
-- Se borran de verdad y no se dejan sin usar. Dos tablas muertas con datos
-- adentro son peores que ninguna: el proximo que lea el esquema no va a saber
-- si mandan o no, y `MemberGrupo` guarda a que clase pertenece cada deportista,
-- que es justo lo que ya no queremos que este guardado en dos sitios.
--
-- Lo que se pierde: las asignaciones que se hicieron a mano. Lo que NO se
-- pierde: ninguna clase, ninguna asistencia y ningun deportista. `ClaseHorario`
-- solo suelta la columna que apuntaba al grupo.

ALTER TABLE "ClaseHorario" DROP COLUMN IF EXISTS "grupoId";

DROP TABLE IF EXISTS "MemberGrupo";
DROP TABLE IF EXISTS "Grupo";
