-- Respuestas a comentarios. Un solo nivel: el backend cuelga toda respuesta
-- del comentario raiz, asi que parentId nunca apunta a otro que ya tenga padre.
--
-- ON DELETE CASCADE a proposito: al borrar un comentario se van sus respuestas.
-- Una respuesta sin la pregunta que la origino no se entiende, y dejarla
-- huerfana en la lista plana es peor que borrarla.
ALTER TABLE "PostComment" ADD COLUMN "parentId" TEXT;

ALTER TABLE "PostComment"
  ADD CONSTRAINT "PostComment_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "PostComment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "PostComment_parentId_idx" ON "PostComment"("parentId");
