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
    req.deporteId = 'deporte-test-id';
    req.esDuenoDelClub = true;
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

vi.mock('../lib/clerk-sesiones', () => ({
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
import { Prisma } from '@prisma/client';
import { prisma } from '../db/client';
import { cacheGet } from '../lib/redis';
import membersRouter from '../routes/members';
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
    (requireAuth as ReturnType<typeof vi.fn>).mockImplementation((req: express.Request, _res: express.Response, next: express.NextFunction) => sesionDePrueba(req, next));
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
    (requireAuth as ReturnType<typeof vi.fn>).mockImplementation((req: express.Request, _res: express.Response, next: express.NextFunction) => sesionDePrueba(req, next));
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

describe('PATCH /members/me/contact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as ReturnType<typeof vi.fn>).mockImplementation((req: express.Request, _res: express.Response, next: express.NextFunction) => sesionDePrueba(req, next));
  });

  /**
   * El caso que tumbaba la ruta en produccion (VELOCLUB-API-8).
   *
   * `Member.clerkId` es unico en toda la tabla, no por club ni por deporte, asi
   * que la ficha que ya tiene esa cuenta puede estar donde esta busqueda no la
   * ve. El auto-vinculado choca contra la restriccion y antes se caia la
   * peticion entera, con lo cual el usuario no podia ni guardar su telefono.
   */
  it('guarda el telefono aunque el clerkId ya sea de otra ficha', async () => {
    (prisma.member.findFirst as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(null)                                   // no hay ficha por clerkId
      .mockResolvedValueOnce({ id: 'member-1', clerkId: null });     // si la hay por correo

    const choque = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`clerkId`)',
      { code: 'P2002', clientVersion: 'test' },
    );
    (prisma.member.update as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(choque)                                 // el intento con vinculo
      .mockResolvedValueOnce({ id: 'member-1', phone: '3001234567' }); // el reintento sin vinculo

    const res = await request(app)
      .patch('/members/me/contact')
      .set('Authorization', 'Bearer fake-token')
      .send({ phone: '3001234567' });

    expect(res.status).toBe(200);
    expect(res.body.member.phone).toBe('3001234567');

    // El reintento guarda el telefono y deja el vinculo quieto.
    const segundo = (prisma.member.update as ReturnType<typeof vi.fn>).mock.calls[1][0];
    expect(segundo.data).toEqual({ phone: '3001234567' });
  });

  /**
   * Con dos fichas del mismo correo, una vinculada y otra no, manda la
   * vinculada. Antes las dos entraban por un mismo OR y sin orderBy el orden no
   * estaba garantizado, asi que podia devolver la que no tiene clerkId y de ahi
   * salia el choque de arriba.
   */
  it('prefiere la ficha que ya tiene el clerkId sobre la del correo', async () => {
    (prisma.member.findFirst as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ id: 'member-vinculado', clerkId: 'clerk-test-id' });
    (prisma.member.update as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ id: 'member-vinculado', phone: '3009999999' });

    const res = await request(app)
      .patch('/members/me/contact')
      .set('Authorization', 'Bearer fake-token')
      .send({ phone: '3009999999' });

    expect(res.status).toBe(200);
    // Una sola busqueda: encontrada por clerkId, no se pregunta por correo.
    expect(prisma.member.findFirst).toHaveBeenCalledTimes(1);

    const llamada = (prisma.member.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(llamada.where).toEqual({ id: 'member-vinculado' });
    expect(llamada.data).not.toHaveProperty('clerkId');
  });
});

/**
 * Express atiende la primera ruta que encaja, no la mas especifica. Con
 * `/:id` declarada antes, `/members/verificar` entraba por ahi como si
 * «verificar» fuera el id de alguien, devolvia 404 y el aviso de correo o
 * documento repetido no salia nunca: el formulario se traga el error y sigue.
 *
 * Estas pruebas cuidan el orden. Si alguien vuelve a mover `/verificar`
 * debajo de `/:id`, la primera falla de una.
 */
describe('GET /members/verificar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as ReturnType<typeof vi.fn>).mockImplementation(
      (req: express.Request, _res: express.Response, next: express.NextFunction) => sesionDePrueba(req, next),
    );
  });

  it('no la atiende la ruta de :id', async () => {
    (prisma.member.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await request(app)
      .get('/members/verificar?email=juan@test.com')
      .set('Authorization', 'Bearer fake-token');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ correo: false, documento: false });
  });

  it('avisa cuando el correo ya esta usado en el club', async () => {
    (prisma.member.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'member-1' });

    const res = await request(app)
      .get('/members/verificar?email=juan@test.com')
      .set('Authorization', 'Bearer fake-token');

    expect(res.status).toBe(200);
    expect(res.body.correo).toBe(true);
  });
});
