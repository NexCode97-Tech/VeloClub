import { Queue } from 'bullmq';

function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379'),
    password: parsed.password || undefined,
    username: parsed.username || undefined,
  };
}

export function getQueueConnection() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error('REDIS_URL no está configurado');
  return parseRedisUrl(url);
}

const queues = new Map<string, Queue>();

export function createQueue(name: string): Queue {
  if (!queues.has(name)) {
    const connection = getQueueConnection();
    queues.set(name, new Queue(name, { connection }));
  }
  return queues.get(name)!;
}
