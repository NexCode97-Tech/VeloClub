-- CreateTable
CREATE TABLE "Cupon" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "porcentaje" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "expiraEn" TIMESTAMP(3),
    "maxUsos" INTEGER,
    "usosActuales" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuponCanje" (
    "id" TEXT NOT NULL,
    "cuponId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "montoDescontado" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CuponCanje_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cupon_codigo_key" ON "Cupon"("codigo");

-- CreateIndex
CREATE INDEX "CuponCanje_clubId_idx" ON "CuponCanje"("clubId");

-- CreateIndex
CREATE UNIQUE INDEX "CuponCanje_cuponId_clubId_key" ON "CuponCanje"("cuponId", "clubId");

-- AddForeignKey
ALTER TABLE "CuponCanje" ADD CONSTRAINT "CuponCanje_cuponId_fkey" FOREIGN KEY ("cuponId") REFERENCES "Cupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuponCanje" ADD CONSTRAINT "CuponCanje_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
