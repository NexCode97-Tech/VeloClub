-- Los reembolsos que ya se hicieron entran como salida, con la fecha en que el
-- pago paso a REFUNDED. Sin esto, el pago reembolsado desaparecia de finanzas
-- como si nunca hubiera entrado, y la devolucion no se veia en ningun lado.
INSERT INTO "GastoPlataforma" (id, fecha, monto, categoria, descripcion, origen, "createdAt", "updatedAt")
SELECT 'reemb' || substr(md5(p.id), 1, 20),
       p."updatedAt",
       p.monto,
       'REEMBOLSOS',
       'Reembolso a ' || c.name,
       'reembolso:' || p."mpPaymentId",
       now(), now()
  FROM "SuscripcionPago" p
  JOIN "ClubSuscripcion" s ON s.id = p."suscripcionId"
  JOIN "Club" c            ON c.id = s."clubId"
 WHERE p.estado = 'REFUNDED' AND p."mpPaymentId" IS NOT NULL
ON CONFLICT (origen) DO NOTHING;
