import { Worker } from 'bullmq';
import { getQueueConnection } from '../lib/queue';
import { processBulkPayments } from './bulk-payments.worker';
import { processNotification } from './notifications.worker';

export function startWorkers() {
  if (!process.env.REDIS_URL) return;
  const connection = getQueueConnection();
  new Worker('bulk-payments', processBulkPayments, { connection });
  new Worker('notifications', processNotification, { connection });
  console.log(JSON.stringify({ level: 'INFO', msg: 'BullMQ workers started' }));
}
