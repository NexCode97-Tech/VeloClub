import { Job } from 'bullmq';
import { prisma } from '../db/client';
import { emitToClub } from '../lib/sse';

interface BulkPaymentsJob {
  clubId: string;
  deporteId: string;
  month: number;
  year: number;
}

export async function processBulkPayments(job: Job<BulkPaymentsJob>): Promise<void> {
  const { clubId, deporteId, month, year } = job.data;

  console.log(JSON.stringify({
    level: 'INFO',
    msg: 'bulk-payments job started',
    clubId,
    month,
    year,
    jobId: job.id,
  }));

  // El trabajo se acota al deporte desde el que se pidio. El worker corre fuera
  // de la peticion, asi que el filtro automatico no aplica aca: sin este
  // `deporteId`, el administrador de patinaje que genera el mes se lo generaria
  // tambien a los de natacion.
  const members = await prisma.member.findMany({
    where: {
      clubId,
      deporteId,
      monthlyFee:    { not: null },
      paymentDueDay: { not: null },
    },
    select: {
      id: true,
      fullName: true,
      monthlyFee: true,
      paymentDueDay: true,
      payments: { where: { month, year }, select: { id: true } },
    },
  });

  let created = 0;
  let skipped = 0;

  for (const m of members) {
    if (m.payments.length > 0) { skipped++; continue; }
    const dueDate = new Date(year, month - 1, m.paymentDueDay!);
    await prisma.payment.create({
      data: { clubId, deporteId, memberId: m.id, amount: m.monthlyFee!, month, year, status: 'PENDING', dueDate },
    });
    created++;
  }

  if (created > 0) emitToClub(clubId, 'payments');

  console.log(JSON.stringify({
    level: 'INFO',
    msg: 'bulk-payments job done',
    clubId,
    month,
    year,
    created,
    skipped,
    jobId: job.id,
  }));
}
