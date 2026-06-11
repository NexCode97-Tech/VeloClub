import { Job } from 'bullmq';

interface NotificationJob {
  type: 'payment_due' | 'payment_overdue';
  memberId: string;
  clubId: string;
  data: Record<string, unknown>;
}

export async function processNotification(job: Job<NotificationJob>): Promise<void> {
  console.log(JSON.stringify({
    level: 'INFO',
    msg: 'notification job',
    ...job.data,
    jobId: job.id,
  }));
}
