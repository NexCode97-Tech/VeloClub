import { Response } from 'express';

interface SSEClient {
  clubId: string;
  res: Response;
}

const clients: SSEClient[] = [];

export function addSSEClient(clubId: string, res: Response) {
  clients.push({ clubId, res });
}

export function removeSSEClient(res: Response) {
  const idx = clients.findIndex(c => c.res === res);
  if (idx !== -1) clients.splice(idx, 1);
}

/** Emite un evento nombrado a todos los clientes del club */
export function emitToClub(clubId: string, event: string) {
  clients
    .filter(c => c.clubId === clubId)
    .forEach(c => {
      try {
        c.res.write(`event: ${event}\ndata: {}\n\n`);
      } catch {
        removeSSEClient(c.res);
      }
    });
}
