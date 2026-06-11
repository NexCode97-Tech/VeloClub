import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../db/client', () => ({
  prisma: {
    payment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    cashEntry: {
      findUnique: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    member: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../auth/middleware', () => ({
  requireAuth: vi.fn((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { id: 'user-test-id', clubId: 'club-test-id', role: 'ADMIN' };
    req.auth = { clerkId: 'clerk-test-id', email: 'test@test.com', name: 'Test User' };
    next();
  }),
  requireRole: vi.fn(() => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next()),
}));

vi.mock('../lib/sse', () => ({
  emitToClub: vi.fn(),
}));

vi.mock('cloudinary', () => ({
  v2: {
    config: vi.fn(),
    uploader: {
      upload: vi.fn(),
      destroy: vi.fn(),
    },
  },
}));

// ── Imports ───────────────────────────────────────────────────────────────────
import { prisma } from '../db/client';
import paymentsRouter from '../routes/payments';
import { requireAuth } from '../auth/middleware';

// ── App de test ───────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use('/payments', paymentsRouter);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /payments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as ReturnType<typeof vi.fn>).mockImplementation(
      (req: express.Request, _res: express.Response, next: express.NextFunction) => {
        req.user = { id: 'user-test-id', clubId: 'club-test-id', role: 'ADMIN' };
        req.auth = { clerkId: 'clerk-test-id', email: 'test@test.com', name: 'Test User' };
        next();
      }
    );
  });

  it('retorna 200 con lista de payments', async () => {
    (prisma.payment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'pay-1',
        amount: 50000,
        status: 'PENDING',
        month: 6,
        year: 2025,
        clubId: 'club-test-id',
        member: { id: 'member-1', fullName: 'Juan Pérez', email: null, phone: null },
      },
    ]);

    const res = await request(app)
      .get('/payments')
      .set('Authorization', 'Bearer fake-token');

    expect(res.status).toBe(200);
    expect(res.body.payments).toHaveLength(1);
    expect(res.body.payments[0].amount).toBe(50000);
  });
});

describe('POST /payments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as ReturnType<typeof vi.fn>).mockImplementation(
      (req: express.Request, _res: express.Response, next: express.NextFunction) => {
        req.user = { id: 'user-test-id', clubId: 'club-test-id', role: 'ADMIN' };
        req.auth = { clerkId: 'clerk-test-id', email: 'test@test.com', name: 'Test User' };
        next();
      }
    );
  });

  it('retorna 400 cuando el amount es negativo', async () => {
    const res = await request(app)
      .post('/payments')
      .set('Authorization', 'Bearer fake-token')
      .send({
        memberId: 'member-1',
        amount: -1000,
        month: 6,
        year: 2025,
        status: 'PENDING',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});

describe('PATCH /payments/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as ReturnType<typeof vi.fn>).mockImplementation(
      (req: express.Request, _res: express.Response, next: express.NextFunction) => {
        req.user = { id: 'user-test-id', clubId: 'club-test-id', role: 'ADMIN' };
        req.auth = { clerkId: 'clerk-test-id', email: 'test@test.com', name: 'Test User' };
        next();
      }
    );
  });

  it('retorna 200 al cambiar status a PAID', async () => {
    const existingPayment = {
      id: 'pay-1',
      amount: 50000,
      status: 'PENDING',
      month: 6,
      year: 2025,
      clubId: 'club-test-id',
      paidAt: null,
      receiptPublicId: null,
      member: { fullName: 'Juan Pérez' },
    };
    const updatedPayment = {
      ...existingPayment,
      status: 'PAID',
      paidAt: new Date(),
      member: { id: 'member-1', fullName: 'Juan Pérez', email: null },
    };

    (prisma.payment.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(existingPayment);
    (prisma.payment.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedPayment);
    (prisma.cashEntry.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.cashEntry.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const res = await request(app)
      .patch('/payments/pay-1')
      .set('Authorization', 'Bearer fake-token')
      .send({ status: 'PAID' });

    expect(res.status).toBe(200);
    expect(res.body.payment.status).toBe('PAID');
  });

  it('retorna 404 cuando el pago no existe', async () => {
    (prisma.payment.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await request(app)
      .delete('/payments/id-inexistente')
      .set('Authorization', 'Bearer fake-token');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Pago no encontrado');
  });
});

describe('DELETE /payments/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as ReturnType<typeof vi.fn>).mockImplementation(
      (req: express.Request, _res: express.Response, next: express.NextFunction) => {
        req.user = { id: 'user-test-id', clubId: 'club-test-id', role: 'ADMIN' };
        req.auth = { clerkId: 'clerk-test-id', email: 'test@test.com', name: 'Test User' };
        next();
      }
    );
  });

  it('retorna 404 cuando el pago no existe', async () => {
    (prisma.payment.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await request(app)
      .delete('/payments/id-inexistente')
      .set('Authorization', 'Bearer fake-token');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Pago no encontrado');
  });
});
