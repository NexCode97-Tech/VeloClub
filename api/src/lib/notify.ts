import { prisma } from '../db/client';
import { emitToClub } from './sse';

interface NotifPayload {
  tipo: string;
  titulo: string;
  cuerpo: string;
  link?: string;
}

/** Crea una notificación para un usuario y avisa en vivo por SSE. */
export async function notify(recipientClerkId: string, clubId: string | null, payload: NotifPayload) {
  if (!recipientClerkId) return;
  try {
    await prisma.notification.create({
      data: { recipientClerkId, clubId: clubId ?? null, ...payload },
    });
    if (clubId) emitToClub(clubId, 'notifications');
  } catch {
    /* la notificación nunca debe tumbar la operación principal */
  }
}

/** Notifica a todo el staff (ADMIN + COACH) de un club, excepto opcionalmente a un clerkId. */
export async function notifyClubStaff(clubId: string, payload: NotifPayload, exceptClerkId?: string) {
  if (!clubId) return;
  try {
    const staff = await prisma.member.findMany({
      where: { clubId, role: { in: ['ADMIN', 'COACH'] }, clerkId: { not: null } },
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
  } catch {
    /* silencioso */
  }
}

/** Notifica a todos los deportistas (STUDENT) de un club. */
export async function notifyClubStudents(clubId: string, payload: NotifPayload) {
  if (!clubId) return;
  try {
    const students = await prisma.member.findMany({
      where: { clubId, role: 'STUDENT', clerkId: { not: null } },
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
