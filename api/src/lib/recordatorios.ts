/**
 * Recordatorios que salen solos, revisados cada 5 minutos desde index.ts.
 *
 * - Clase en una hora: al entrenador de ese deporte y a los deportistas de la
 *   planilla de la clase (lib/planilla.ts). Solo push.
 * - Evento de mañana: a las 6 p. m., a los deportistas del deporte del evento.
 *   Solo eventos de una vez; los recurrentes son los entrenamientos de siempre
 *   y avisarlos cada día sería ruido. Solo push.
 * - Mensualidad por vencer: tres días antes del cobro, a partir de las 9 a. m.
 *   Va también a la campana (notify), que la manda al dispositivo.
 * - Mensualidad vencida: el día después del cobro, si sigue sin pagar y nadie
 *   se lo avisó todavía. La avisa también /cron/mark-overdue; si esa ya lo hizo
 *   no se repite.
 *
 * Todo en hora de Colombia (UTC-5, sin horario de verano). Cada recordatorio
 * deja una marca (RecordatorioEnviado) para no salir dos veces aunque la
 * revisión pase varias veces por la misma ventana o la API se reinicie.
 */
import * as Sentry from '@sentry/node';
import { prismaClubEntero as db } from '../db/client';
import { filtroDePlanilla } from './planilla';
import { enviarPush } from './push';
import { notify } from './notify';

const HUSO_MS = 5 * 60 * 60 * 1000;
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const FORMATO_HORA = /^(\d{2}):(\d{2})$/;

/** La hora de Colombia como piezas: fecha, día de la semana y minutos del día. */
export function enColombia(ahora: Date) {
  const local = new Date(ahora.getTime() - HUSO_MS);
  return {
    fecha: local.toISOString().slice(0, 10),
    dia: local.getUTCDay(),
    minutos: local.getUTCHours() * 60 + local.getUTCMinutes(),
  };
}

/** "17:30" → 1050. */
export function minutosDe(hora: string): number | null {
  const m = hora.match(FORMATO_HORA);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** "17:30" → "5:30 p. m." */
export function horaLegible(hora: string): string {
  const min = minutosDe(hora);
  if (min === null) return hora;
  const h = Math.floor(min / 60);
  const m = min % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

/**
 * Si una clase entra en la ventana del recordatorio: empieza entre 50 y 65
 * minutos desde ahora. La ventana es más ancha que los 5 minutos de la
 * revisión para no perder ninguna si una vuelta se atrasa; la marca evita el
 * doble envío.
 */
export function tocaAvisarClase(minutosAhora: number, minutosClase: number): boolean {
  const falta = minutosClase - minutosAhora;
  return falta > 50 && falta <= 65;
}

/** El día de Colombia de una fecha guardada, "YYYY-MM-DD". */
export function diaDe(fecha: Date): string {
  return new Date(fecha.getTime() - HUSO_MS).toISOString().slice(0, 10);
}

export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Pone la marca y dice si era nueva. Si ya existía, el recordatorio ya salió. */
async function marcar(clave: string): Promise<boolean> {
  try {
    await db.recordatorioEnviado.create({ data: { clave } });
    return true;
  } catch {
    return false; // clave repetida
  }
}

async function clasesEnUnaHora(ahora: Date): Promise<number> {
  const { fecha, dia, minutos } = enColombia(ahora);
  const clases = await db.claseHorario.findMany({
    where: { diaSemana: dia, activa: true, club: { active: true } },
    select: {
      id: true, clubId: true, deporteId: true, nombre: true, hora: true, locationId: true, categorias: true,
      location: { select: { name: true } },
      club: { select: { noAttendanceDays: true } },
    },
  });

  let avisadas = 0;
  for (const c of clases) {
    const min = minutosDe(c.hora);
    if (min === null || !tocaAvisarClase(minutos, min)) continue;
    if (c.club.noAttendanceDays.includes(dia)) continue;
    if (!(await marcar(`clase:${c.id}:${fecha}`))) continue;

    const [deportistas, entrenadores] = await Promise.all([
      db.member.findMany({
        where: { clubId: c.clubId, deporteId: c.deporteId, clerkId: { not: null }, ...filtroDePlanilla(c) },
        select: { clerkId: true },
      }),
      db.user.findMany({
        where: { clubId: c.clubId, role: 'ENTRENADOR', OR: [{ deporteId: c.deporteId }, { deporteId: null }] },
        select: { clerkId: true },
      }),
    ]);
    const donde = c.location?.name ? ` en ${c.location.name}` : '';
    const cuerpo = `${c.nombre} a las ${horaLegible(c.hora)}${donde}.`;
    await Promise.all([
      enviarPush(deportistas.map(d => d.clerkId!), { titulo: 'Tu clase empieza en una hora', cuerpo, link: '/calendario', etiqueta: `clase-${c.id}` }),
      enviarPush(entrenadores.map(e => e.clerkId), { titulo: 'Tu clase empieza en una hora', cuerpo, link: '/asistencia', etiqueta: `clase-${c.id}` }),
    ]);
    avisadas++;
  }
  return avisadas;
}

async function eventosDeManana(ahora: Date): Promise<number> {
  const { fecha, minutos } = enColombia(ahora);
  if (minutos < 18 * 60) return 0; // desde las 6 p. m.
  const manana = sumarDias(fecha, 1);
  // El día de mañana en Colombia, en UTC: de 05:00 a 05:00 del día siguiente.
  const desde = new Date(`${manana}T05:00:00.000Z`);
  const hasta = new Date(desde.getTime() + 24 * 60 * 60 * 1000);
  const eventos = await db.calendarEvent.findMany({
    where: { recurrence: 'NONE', startDate: { gte: desde, lt: hasta }, club: { active: true } },
    select: { id: true, clubId: true, deporteId: true, title: true, allDay: true, startDate: true, location: { select: { name: true } } },
  });

  let avisados = 0;
  for (const e of eventos) {
    if (!(await marcar(`evento:${e.id}:${manana}`))) continue;
    const deportistas = await db.member.findMany({
      where: { clubId: e.clubId, deporteId: e.deporteId, role: 'DEPORTISTA', active: true, clerkId: { not: null } },
      select: { clerkId: true },
    });
    const local = new Date(e.startDate.getTime() - HUSO_MS);
    const hhmm = `${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`;
    const hora = e.allDay ? '' : ` a las ${horaLegible(hhmm)}`;
    const donde = e.location?.name ? ` en ${e.location.name}` : '';
    await enviarPush(deportistas.map(d => d.clerkId!), {
      titulo: 'Mañana tienes un evento del club',
      cuerpo: `${e.title}${hora}${donde}.`,
      link: '/calendario',
      etiqueta: `evento-${e.id}`,
    });
    avisados++;
  }
  return avisados;
}

async function mensualidades(ahora: Date): Promise<number> {
  const { fecha, minutos } = enColombia(ahora);
  if (minutos < 9 * 60) return 0; // nada de avisos de plata de madrugada
  const enTres = sumarDias(fecha, 3);
  const ayer = sumarDias(fecha, -1);
  // Un margen de un día a cada lado: el filtro fino va por el día de Colombia.
  const desde = new Date(`${sumarDias(ayer, -1)}T00:00:00.000Z`);
  const hasta = new Date(`${sumarDias(enTres, 1)}T23:59:59.999Z`);
  const pagos = await db.payment.findMany({
    where: {
      status: { in: ['PENDING', 'OVERDUE'] },
      dueDate: { gte: desde, lte: hasta },
      club: { active: true },
      member: { active: true, clerkId: { not: null } },
    },
    select: { id: true, clubId: true, month: true, amount: true, dueDate: true, member: { select: { clerkId: true } } },
  });

  let avisados = 0;
  for (const p of pagos) {
    const dia = diaDe(p.dueDate!);
    const mes = MESES[p.month - 1] ?? '';
    const valor = Math.round(p.amount).toLocaleString('es-CO');
    if (dia === enTres) {
      if (!(await marcar(`pago:${p.id}:por-vencer`))) continue;
      await notify(p.member.clerkId!, p.clubId, {
        tipo: 'PAGO_POR_VENCER',
        titulo: 'Tu mensualidad vence en 3 días',
        cuerpo: `La mensualidad de ${mes} por $${valor} vence el ${Number(dia.slice(8))} de ${MESES[Number(dia.slice(5, 7)) - 1]}.`,
        link: '/pagos',
      });
      avisados++;
    } else if (dia === ayer) {
      if (!(await marcar(`pago:${p.id}:vencida`))) continue;
      // Si /cron/mark-overdue ya se lo dijo, no se repite.
      const yaAvisado = await db.notification.findFirst({
        where: { recipientClerkId: p.member.clerkId!, tipo: 'PAYMENT_DUE', createdAt: { gte: p.dueDate! } },
        select: { id: true },
      });
      if (yaAvisado) continue;
      await notify(p.member.clerkId!, p.clubId, {
        tipo: 'PAGO_VENCIDO_DEPORTISTA',
        titulo: 'Tu mensualidad está vencida',
        cuerpo: `La mensualidad de ${mes} por $${valor} venció ayer.`,
        link: '/pagos',
      });
      avisados++;
    }
  }
  return avisados;
}

let corriendo = false;

/** Una vuelta de los tres recordatorios. No se pisa consigo misma. */
export async function revisarRecordatorios(ahora = new Date()): Promise<void> {
  if (corriendo) return;
  corriendo = true;
  try {
    const [clases, eventos, pagos] = await Promise.all([
      clasesEnUnaHora(ahora), eventosDeManana(ahora), mensualidades(ahora),
    ]);
    if (clases || eventos || pagos) {
      console.log(`[recordatorios] clases ${clases}, eventos ${eventos}, mensualidades ${pagos}`);
    }
    // Las marcas viejas ya no sirven para nada.
    await db.recordatorioEnviado.deleteMany({ where: { createdAt: { lt: new Date(ahora.getTime() - 60 * 24 * 60 * 60 * 1000) } } });
  } catch (err) {
    Sentry.captureException(err, { tags: { tarea: 'recordatorios' } });
    console.error('[recordatorios]', err instanceof Error ? err.message : err);
  } finally {
    corriendo = false;
  }
}
