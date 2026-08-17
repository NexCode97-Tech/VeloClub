-- Sede en los movimientos de dinero, para poder ver las finanzas por sede.
--
-- Muchos clubes usan las sedes como disciplinas: uno con cuatro deportes crea
-- cuatro "sedes". Querian ver cuanto genera cada una por separado, y hasta
-- ahora la plata solo estaba atada al club.
--
-- NULL significa "General": lo que no corresponde a ninguna sede en particular
-- —la suscripcion a VeloClub, la contabilidad, la publicidad— y tambien todo
-- lo registrado antes de que existiera este campo.
--
-- SET NULL y no CASCADE: borrar una sede no puede borrar el historial contable
-- del club. Los movimientos quedan como General.

ALTER TABLE "Payment"   ADD COLUMN "locationId" TEXT;
ALTER TABLE "CashEntry" ADD COLUMN "locationId" TEXT;

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CashEntry"
  ADD CONSTRAINT "CashEntry_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Payment_clubId_locationId_idx"   ON "Payment"("clubId", "locationId");
CREATE INDEX "CashEntry_clubId_locationId_idx" ON "CashEntry"("clubId", "locationId");

-- ─── Relleno del historico ───────────────────────────────────────────────────
--
-- Solo para los deportistas que estan en UNA sola sede: ahi la atribucion es
-- exacta y no hay nada que adivinar. Al momento de escribir esto son 1.167 de
-- 1.266 en produccion.
--
-- Los que estan en varias (67) y los que no tienen ninguna (32) quedan en NULL
-- a proposito. No hay forma de saber a que disciplina correspondia cada
-- mensualidad, e inventarlo ensuciaria los numeros que el club va a mirar.

UPDATE "Payment" p
SET "locationId" = ml."locationId"
FROM (
  SELECT "memberId", MIN("locationId") AS "locationId"
  FROM "MemberLocation"
  GROUP BY "memberId"
  HAVING COUNT(*) = 1
) ml
WHERE p."memberId" = ml."memberId"
  AND p."locationId" IS NULL;

-- Las entradas de caja que nacieron de un pago heredan la sede de ese pago.
-- Los movimientos manuales ya registrados se quedan en General: nadie pregunto
-- por la sede cuando se crearon, y asignarles una seria inventar el dato.
UPDATE "CashEntry" c
SET "locationId" = p."locationId"
FROM "Payment" p
WHERE c."paymentId" = p."id"
  AND p."locationId" IS NOT NULL
  AND c."locationId" IS NULL;
