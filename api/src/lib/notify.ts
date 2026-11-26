import { prisma } from '../db/client';
import { emitToClub } from './sse';
import { enviarPush, PUSH_PERSONAL, PUSH_STAFF } from './push';

interface NotifPayload {
  tipo: string;
  titulo: string;
  cuerpo: string;
  link?: string;
}

function aPush(payload: NotifPayload) {
  return { titulo: payload.titulo, cuerpo: payload.cuerpo, link: payload.link, etiqueta: payload.tipo };
}

/** Crea una notificación para un usuario y avisa en vivo por SSE. */
export async function notify(recipientClerkId: string, clubId: string | null, payload: NotifPayload) {
  if (!recipientClerkId) return;
  try {
    await prisma.notification.create({
      data: { recipientClerkId, clubId: clubId ?? null, ...payload },
    });
    if (clubId) emitToClub(clubId, 'notifications');
    // Los tipos aprobados salen también al dispositivo (lib/push.ts). Sin
    // await: la respuesta de la ruta no espera a los servicios de push.
    if (PUSH_PERSONAL.has(payload.tipo)) void enviarPush([recipientClerkId], aPush(payload));
  } catch {
    /* la notificación nunca debe tumbar la operación principal */
  }
}

/** Notifica a todo el staff (ADMIN + ENTRENADOR) de un club, excepto opcionalmente a un clerkId. */
export async function notifyClubStaff(clubId: string, payload: NotifPayload, exceptClerkId?: string) {
  if (!clubId) return;
  try {
    const staff = await prisma.member.findMany({
      where: { clubId, role: { in: ['ADMIN', 'ENTRENADOR'] }, clerkId: { not: null } },
      select: { clerkId: true },
    });
    const recipients = staff
      .map(s => s.clerkId!)
      .filter(id => id && id !== exceptClerkId);
    if (recipients.length === 0) return;
    await prisma.notification.createMany({
      data: recipients.map(recipientClerkId => ({ recipientClerkId, clubId, ...payload })),
    });
    emitToClub(clubId, 'notifications');
    if (PUSH_STAFF.has(payload.tipo)) void enviarPush(recipients, aPush(payload));
  } catch {
    /* silencioso */
  }
}

/** Notifica a todos los deportistas (DEPORTISTA) de un club. */
export async function notifyClubStudents(clubId: string, payload: NotifPayload) {
  if (!clubId) return;
  try {
    const students = await prisma.member.findMany({
      // Un deportista desactivado no recibe avisos del club mientras esté en pausa
      where: { clubId, role: 'DEPORTISTA', active: true, clerkId: { not: null } },
      select: { clerkId: true },
    });
    const recipients = students.map(s => s.clerkId!).filter(Boolean);
    if (recipients.length === 0) return;
    await prisma.notification.createMany({
      data: recipients.map(recipientClerkId => ({ recipientClerkId, clubId, ...payload })),
    });
    emitToClub(clubId, 'notifications');
  } catch {
    /* silencioso */
  }
}
