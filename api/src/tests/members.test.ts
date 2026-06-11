import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// ── Mocks (deben declararse antes de cualquier import que los use) ──────────────

vi.mock('../db/client', () => ({
  prisma: {
    member: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    memberLocation: {
      deleteMany: vi.fn(),
    },
    user: {
      updateMany: vi.fn(),
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

vi.mock('../lib/redis', () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
  cacheDel: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/clerk-allowlist', () => ({
  addToAllowlist: vi.fn().mockResolvedValue(undefined),
  removeFromAllowlist: vi.fn().mockResolvedValue(undefined),
  revokeClerkAccess: vi.fn().mockResolvedValue(undefined),
  revokeClerkSessions: vi.fn().mockResolvedValue(undefined),
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

// ── Imports reales (después de los mocks) ─────────────────────────────────────
import { prisma } from '../db/client';
import { cacheGet } from '../lib/redis';
import membersRouter from '../routes/members';
import { requireAuth } from '../auth/middleware';

// ── App de test ───────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use('/members', membersRouter);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /members', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Asegurar que cacheGet retorne null para que siempre vaya a Prisma
    (cacheGet as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  });

  it('retorna 200 con lista de members cuando el usuario está autenticado', async () => {
    (prisma.member.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'member-1', fullName: 'Juan Pérez', clubId: 'club-test-id', locations: [] },
    ]);

    const res = await request(app)
      .get('/members')
      .set('Authorization', 'Bearer fake-token');

    expect(res.status).toBe(200);
    expect(res.body.members).toHaveLength(1);
    expect(res.body.members[0].fullName).toBe('Juan Pérez');
  });

  it('retorna 401 cuando no hay autenticación', async () => {
    // Sobreescribir requireAuth para este test para que devuelva 401
    (requireAuth as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (_req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(401).json({ error: 'No autenticado' });
      }
    );

    const res = await request(app).get('/members');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('No autenticado');
  });
});

describe('POST /members', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (cacheGet as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    // Restaurar requireAuth al comportamiento normal
    (requireAuth as ReturnType<typeof vi.fn>).mockImplementation(
      (req: express.Request, _res: express.Response, next: express.NextFunction) => {
        req.user = { id: 'user-test-id', clubId: 'club-test-id', role: 'ADMIN' };
        req.auth = { clerkId: 'clerk-test-id', email: 'test@test.com', name: 'Test User' };
        next();
      }
    );
  });

  it('crea un miembro y retorna 201 con datos válidos', async () => {
    const newMember = {
      id: 'member-new',
      fullName: 'Ana López',
      email: 'ana@test.com',
      clubId: 'club-test-id',
      locations: [],
    };
    (prisma.member.create as ReturnType<typeof vi.fn>).mockResolvedValue(newMember);

    const res = await request(app)
      .post('/members')
      .set('Authorization', 'Bearer fake-token')
      .send({ fullName: 'Ana López', email: 'ana@test.com' });

    expect(res.status).toBe(201);
    expect(res.body.member.fullName).toBe('Ana López');
  });

  it('retorna 400 cuando falta fullName', async () => {
    const res = await request(app)
      .post('/members')
      .set('Authorization', 'Bearer fake-token')
      .send({ email: 'sin-nombre@test.com' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});

describe('DELETE /members/:id', () => {
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

  it('retorna 404 cuando el miembro no existe', async () => {
    (prisma.member.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await request(app)
      .delete('/members/id-inexistente')
      .set('Authorization', 'Bearer fake-token');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Miembro no encontrado');
  });
});
