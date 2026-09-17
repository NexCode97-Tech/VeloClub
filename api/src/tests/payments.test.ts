import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
    req.deporteId = 'deporte-test-id';
    req.esDuenoDelClub = true;
    next();
  }),
  requireRole: vi.fn(() => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next()),
}));

// Marcar un pago como pagado avisa al staff del club. Sin este doble, la
// notificacion sale a buscar usuarios en una tabla que este archivo no simula y
// la ruta responde 500 por algo que no tiene que ver con lo que se esta
// probando.
vi.mock('../lib/notify', () => ({
  notify: vi.fn(),
  notifyClubStaff: vi.fn(),
  notifyClubStudents: vi.fn(),
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

/**
 * La sesion que simulan estas pruebas. Un solo sitio: antes cada bloque repetia
 * el mismo objeto y agregarle un campo — la carpeta de deporte, por ejemplo —
 * dejaba a los otros bloques con una sesion a medias y fallando por algo que no
 * era lo que estaban probando.
 */
function sesionDePrueba(req: express.Request, next: express.NextFunction) {
  req.user  = { id: 'user-test-id', clubId: 'club-test-id', role: 'ADMIN' };
  req.auth  = { clerkId: 'clerk-test-id', email: 'test@test.com', name: 'Test User' };
  // El requireAuth de verdad resuelve la carpeta antes de seguir, y las rutas
  // la exigen para crear.
  req.deporteId      = 'deporte-test-id';
  req.esDuenoDelClub = true;
  next();
}

// ── App de test ───────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use('/payments', paymentsRouter);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /payments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as ReturnType<typeof vi.fn>).mockImplementation((req: express.Request, _res: express.Response, next: express.NextFunction) => sesionDePrueba(req, next));
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
    (requireAuth as ReturnType<typeof vi.fn>).mockImplementation((req: express.Request, _res: express.Response, next: express.NextFunction) => sesionDePrueba(req, next));
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
    (requireAuth as ReturnType<typeof vi.fn>).mockImplementation((req: express.Request, _res: express.Response, next: express.NextFunction) => sesionDePrueba(req, next));
  });

  it('retorna 200 al cambiar status a PAID', async () => {
    // El molde traia el pago sin `memberId` ni `locationId`, de cuando esos
    // campos no existian. Sin sede, la ruta sale a deducirla del miembro y toca
    // una tabla que este archivo no simula.
    const existingPayment = {
      id: 'pay-1',
      amount: 50000,
      status: 'PENDING',
      month: 6,
      year: 2025,
      clubId: 'club-test-id',
      memberId: 'member-1',
      locationId: 'loc-1',
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
    (requireAuth as ReturnType<typeof vi.fn>).mockImplementation((req: express.Request, _res: express.Response, next: express.NextFunction) => sesionDePrueba(req, next));
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

describe('GET /payments/comparativo', () => {
  // Filas que devolvería la base según lo que se le pregunte. Se decide por los
  // filtros y no por el orden de las llamadas, para que la prueba no dependa de
  // cómo la ruta reparta sus consultas.
  function responderSegun(where: Record<string, unknown>) {
    const mes = where.month;
    const esPagados = 'paidAt' in where && !('createdAt' in where);
    if (esPagados) return mes === 9 ? filas(24) : filas(20);
    return mes === 9 ? filas(12) : filas(16);
  }
  function filas(n: number) {
    return Array.from({ length: n }, (_, i) => ({ memberId: `m-${i}` }));
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-17T15:00:00Z')); // 10 a. m. en Colombia
    (requireAuth as ReturnType<typeof vi.fn>).mockImplementation((req: express.Request, _res: express.Response, next: express.NextFunction) => sesionDePrueba(req, next));
    (prisma.payment.findMany as ReturnType<typeof vi.fn>).mockImplementation(
      async ({ where }: { where: Record<string, unknown> }) => responderSegun(where),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('compara el mes en curso contra el anterior al mismo día', async () => {
    const res = await request(app).get('/payments/comparativo?month=9&year=2026');

    expect(res.status).toBe(200);
    expect(res.body.comparacion.etiqueta).toBe('17 ago');
    expect(res.body.comparacion.pagados).toEqual({ actual: 24, anterior: 20, variacion: 20 });
    expect(res.body.comparacion.pendientes).toEqual({ actual: 12, anterior: 16, variacion: -25 });
  });

  it('cuenta pagados por la fecha en que se pagaron, no por el estado de hoy', async () => {
    await request(app).get('/payments/comparativo?month=9&year=2026');

    const llamadas = (prisma.payment.findMany as ReturnType<typeof vi.fn>).mock.calls
      .map(([arg]) => arg as { where: Record<string, unknown>; distinct?: string[] });
    const pagadosAgosto = llamadas.find(c => c.where.month === 8 && !('createdAt' in c.where))!;
    expect(pagadosAgosto.where.paidAt).toEqual({ lte: new Date('2026-08-18T04:59:59.999Z') });
    // Por deportista, no por cobro: uno con dos cobros cuenta una vez.
    expect(pagadosAgosto.distinct).toEqual(['memberId']);
  });

  it('respeta la sede elegida', async () => {
    await request(app).get('/payments/comparativo?month=9&year=2026&locationId=sede-1');

    const llamadas = (prisma.payment.findMany as ReturnType<typeof vi.fn>).mock.calls;
    for (const [arg] of llamadas) {
      expect((arg as { where: Record<string, unknown> }).where.locationId).toBe('sede-1');
    }
  });

  it('un mes que no ha empezado no trae comparación', async () => {
    const res = await request(app).get('/payments/comparativo?month=10&year=2026');

    expect(res.status).toBe(200);
    expect(res.body.comparacion).toBeNull();
    expect(prisma.payment.findMany).not.toHaveBeenCalled();
  });

  it('un deportista no ve las cifras del club', async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockImplementation((req: express.Request, _res: express.Response, next: express.NextFunction) => {
      sesionDePrueba(req, () => {});
      req.user = { ...req.user!, role: 'DEPORTISTA' };
      next();
    });

    const res = await request(app).get('/payments/comparativo?month=9&year=2026');
    expect(res.status).toBe(403);
  });

  it('rechaza un mes inválido', async () => {
    const res = await request(app).get('/payments/comparativo?month=13&year=2026');
    expect(res.status).toBe(400);
  });
});
