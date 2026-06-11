-- Índices de rendimiento para queries frecuentes
-- Payment: filtrar por estado dentro de un club (PENDING, OVERDUE, PAID)
CREATE INDEX IF NOT EXISTS "Payment_clubId_status_idx" ON "Payment"("clubId", "status");

-- Member: filtrar por estado de invitación dentro de un club
CREATE INDEX IF NOT EXISTS "Member_clubId_inviteStatus_idx" ON "Member"("clubId", "inviteStatus");

-- Notificacion: filtrar notificaciones no leídas del superadmin
CREATE INDEX IF NOT EXISTS "Notificacion_leida_createdAt_idx" ON "Notificacion"("leida", "createdAt");
