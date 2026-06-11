import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mini-app solo con el health endpoint (sin dependencias externas)
const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'veloclub-api' });
});

describe('GET /health', () => {
  it('retorna 200 con status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
