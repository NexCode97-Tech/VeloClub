-- De donde salio el gasto cuando no lo escribio nadie: `mp:<paymentId>` para la
-- comision de Mercado Pago. Unico, porque un pago llega a PAID desde cuatro
-- sitios distintos y sin esto la misma comision entraria varias veces.
ALTER TABLE "GastoPlataforma" ADD COLUMN "origen" TEXT;

CREATE UNIQUE INDEX "GastoPlataforma_origen_key" ON "GastoPlataforma"("origen");
