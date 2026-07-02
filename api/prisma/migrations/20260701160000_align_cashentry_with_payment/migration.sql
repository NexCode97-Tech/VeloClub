-- Alinea los ingresos automáticos (CashEntry con paymentId) con su mensualidad:
--
-- 1) FECHA: el ingreso debe caer en el mes/año de la cuota (contabilidad por devengo),
--    para que "Cobrado {mes}" e "Ingresos {mes}" del flujo de caja coincidan.
--    Solo se re-fechan los desalineados; se usa el día 15 al mediodía del mes de la cuota.
--
-- 2) MONTO: el ingreso debe reflejar el monto actual del pago (si se cambió la tarifa
--    después de pagar, el ingreso podía haber quedado con el monto viejo).

-- 1) Re-fechar ingresos cuyo mes/año no coincide con el de la mensualidad
UPDATE "CashEntry" ce
SET "date" = make_timestamp(p."year", p."month", 15, 12, 0, 0)
FROM "Payment" p
WHERE ce."paymentId" = p."id"
  AND (
    EXTRACT(YEAR  FROM ce."date") <> p."year"
    OR EXTRACT(MONTH FROM ce."date") <> p."month"
  );

-- 2) Sincronizar el monto del ingreso con el del pago
UPDATE "CashEntry" ce
SET "amount" = p."amount"
FROM "Payment" p
WHERE ce."paymentId" = p."id"
  AND ce."amount" <> p."amount";
