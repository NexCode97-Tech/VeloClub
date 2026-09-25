import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { revisarSalud } from '../lib/salud';

/**
 * El chequeo de salud.
 *
 * Lo que de verdad hay que sostener acá es que **arrancando no es lo mismo que
 * roto**. Antes el primer `/health` de cada despliegue devolvía 503 y el
 * siguiente 200, porque el cliente de Redis abre el socket en el primer comando
 * y ese primer comando no espera. Para un monitor externo eso es una caída y una
 * recuperación cada vez que Railway despierta el servicio.
 */

const dbSana = { $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]) };
const dbCaida = { $queryRaw: vi.fn().mockRejectedValue(new Error('no reachable')) };

/** Un doble de ioredis con el estado que interese. */
function cache(status: string, pingFalla = false) {
  return {
    status,
    ping: pingFalla
      ? vi.fn().mockRejectedValue(new Error('Stream no escribible'))
      : vi.fn().mockResolvedValue('PONG'),
  } as unknown as Parameters<typeof revisarSalud>[1];
}

describe('revisarSalud', () => {
  it('con todo arriba responde ok', async () => {
    const salud = await revisarSalud(dbSana, cache('ready'));
    expect(salud.status).toBe('ok');
    expect(salud.checks).toEqual({ db: 'ok', redis: 'ok' });
  });

  it('sin Redis configurado sigue siendo ok, porque el cache es opcional', async () => {
    const salud = await revisarSalud(dbSana, null);
    expect(salud.status).toBe('ok');
    expect(salud.checks.redis).toBe('apagado');
  });

  // El caso que motivó todo esto.
  it.each(['wait', 'connecting', 'connect', 'reconnecting'])(
    'con Redis en «%s» responde ok, porque está arrancando y no averiado',
    async (status) => {
      const redis = cache(status, true);
      const salud = await revisarSalud(dbSana, redis);
      expect(salud.status).toBe('ok');
      expect(salud.checks.redis).toBe('iniciando');
      // Y ni siquiera se le pregunta: el ping fallaría y no dice nada útil.
      expect((redis as unknown as { ping: ReturnType<typeof vi.fn> }).ping)
        .not.toHaveBeenCalled();
    },
  );

  it('con Redis conectado pero sin responder, degrada', async () => {
    const salud = await revisarSalud(dbSana, cache('ready', true));
    expect(salud.status).toBe('degraded');
    expect(salud.checks.redis).toBe('error');
  });

  it('sin base de datos degrada, aunque el resto esté bien', async () => {
    const salud = await revisarSalud(dbCaida, cache('ready'));
    expect(salud.status).toBe('degraded');
    expect(salud.checks.db).toBe('error');
  });
});

describe('GET /health', () => {
  function servidor(db: typeof dbSana, redis: Parameters<typeof revisarSalud>[1]) {
    const app = express();
    app.get('/health', async (_req, res) => {
      const salud = await revisarSalud(db, redis);
      res.status(salud.status === 'ok' ? 200 : 503).json(salud);
    });
    return app;
  }

  it('devuelve 200 cuando está sano', async () => {
    const res = await request(servidor(dbSana, cache('ready'))).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('veloclub-api');
  });

  it('devuelve 200 en el arranque en frío, no 503', async () => {
    const res = await request(servidor(dbSana, cache('wait', true))).get('/health');
    expect(res.status).toBe(200);
  });

  it('devuelve 503 cuando la base no contesta', async () => {
    const res = await request(servidor(dbCaida, cache('ready'))).get('/health');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
  });
});
