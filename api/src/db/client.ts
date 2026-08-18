import { PrismaClient } from '@prisma/client';
import { extensionAuditoria } from '../lib/auditoria';

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof crear> | undefined;
};

function crear() {
  // La extension de auditoria va aca y no en cada endpoint: instrumentar las
  // rutas a mano significa olvidarse de la proxima que alguien agregue, y una
  // bitacora con huecos da una falsa sensacion de control. Montada en el
  // cliente, no hay forma de escribir en la base sin quedar registrado.
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error'] : ['error'],
  }).$extends(extensionAuditoria());
}

export const prisma = globalForPrisma.prisma ?? crear();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
