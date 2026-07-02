-- Alinea los ingresos automáticos (CashEntry con paymentId) con su mensualidad.
--
-- El agrupamiento por mes en el flujo de caja ahora usa el mes/año de la CUOTA
-- (ver GET /cashflow), no la fecha del ingreso. Por eso aquí solo corregimos:
--
-- 1) FECHA: que el ingreso muestre el DÍA REAL en que se pagó (payment.paidAt),
--    en vez de la fecha en que se creó el registro.
-- 2) MONTO: que refleje el monto actual del pago (si se cambió la tarifa tras pagar).

-- 1) Restaurar el día real de pago en los ingresos que tengan paidAt
UPDATE "CashEntry" ce
SET "date" = p."paidAt"
FROM "Payment" p
WHERE ce."paymentId" = p."id"
  AND p."paidAt" IS NOT NULL
  AND ce."date" <> p."paidAt";

-- 2) Sincronizar el monto del ingreso con el del pago
UPDATE "CashEntry" ce
SET "amount" = p."amount"
FROM "Payment" p
WHERE ce."paymentId" = p."id"
  AND ce."amount" <> p."amount";
