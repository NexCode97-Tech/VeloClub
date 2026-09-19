import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Una planilla no se pierde entera por un deportista.
//
// Guardar asistencia rechazaba la jornada completa con 403 cuando venia un id
// que no estaba activo, y el entrenador se quedaba sin poder registrar a nadie
// por alguien que pausaron mientras tenia la pantalla abierta. Lo que se fija
// aca es la separacion de los dos casos: el de otro club sigue siendo un no
// rotundo, el del club en pausa se salta y el resto se guarda.

vi.mock('../db/client', () => ({
  prisma: {
    member: { findMany: vi.fn() },
    attendance: { findMany: vi.fn(), createMany: vi.fn(), updateMany: vi.fn() },
    claseHorario: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('../auth/middleware', () => ({
  requireAuth: vi.fn((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { id: 'user-test-id', clubId: 'club-test-id', role: 'ENTRENADOR' };
    req.auth = { clerkId: 'clerk-test-id', email: 'test@test.com', name: 'Test User' };
    req.deporteId = 'deporte-test-id';
    next();
  }),
}));

vi.mock('../lib/sse', () => ({ emitToClub: vi.fn() }));
vi.mock('../lib/sedes', () => ({ sedeEsDelClub: vi.fn().mockResolvedValue(true) }));
vi.mock('../lib/deportes', () => ({ carpetaDe: () => 'deporte-test-id' }));

import { prisma } from '../db/client';
import { sedeEsDelClub } from '../lib/sedes';
import attendanceRouter from '../routes/attendance';

const app = express();
app.use(express.json());
app.use('/attendance', attendanceRouter);

/** La planilla que manda la pantalla de Asistencia. */
function planilla(ids: string[]) {
  return {
    date: '2026-09-18',
    locationId: 'sede-1',
    records: ids.map(id => ({ memberId: id, status: 'PRESENT' as const })),
  };
}

function $transaccion() {
  return prisma.$transaction as ReturnType<typeof vi.fn>;
}

beforeEach(() => {
  // clearAllMocks tambien borra lo que devuelven los dobles, asi que la sede se
  // vuelve a dar por buena aca. Sin esto la ruta cortaba en el 403 de sede y la
  // prueba fallaba por algo que no es lo que se esta probando.
  vi.clearAllMocks();
  (sedeEsDelClub as ReturnType<typeof vi.fn>).mockResolvedValue(true);
  (prisma.attendance.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  $transaccion().mockResolvedValue([]);
});

describe('POST /attendance/bulk con alguien en pausa', () => {
  it('guarda a los demas y devuelve a quien se salto', async () => {
    (prisma.member.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'm-1', fullName: 'Mariana Ortiz', active: true },
      { id: 'm-2', fullName: 'Tomás Ruiz',   active: false },
      { id: 'm-3', fullName: 'Sara Vélez',   active: true },
    ]);

    const res = await request(app)
      .post('/attendance/bulk')
      .send(planilla(['m-1', 'm-2', 'm-3']));

    expect(res.status).toBe(200);
    expect(res.body.saved).toBe(2);
    expect(res.body.omitidos).toEqual([{ id: 'm-2', nombre: 'Tomás Ruiz' }]);
  });

  it('no manda al pausado a la escritura', async () => {
    (prisma.member.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'm-1', fullName: 'Mariana Ortiz', active: true },
      { id: 'm-2', fullName: 'Tomás Ruiz',   active: false },
    ]);

    await request(app).post('/attendance/bulk').send(planilla(['m-1', 'm-2']));

    // La escritura se mira en createMany, no en lo que recibe la transaccion:
    // ahi adentro solo hay promesas de los dobles.
    const crear = prisma.attendance.createMany as ReturnType<typeof vi.fn>;
    expect(crear).toHaveBeenCalledTimes(1);
    const filas = crear.mock.calls[0][0].data as { memberId: string }[];
    expect(filas.map(f => f.memberId)).toEqual(['m-1']);
  });

  it('si toda la planilla esta en pausa no escribe nada y tampoco falla', async () => {
    (prisma.member.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'm-2', fullName: 'Tomás Ruiz', active: false },
    ]);

    const res = await request(app).post('/attendance/bulk').send(planilla(['m-2']));

    expect(res.status).toBe(200);
    expect(res.body.saved).toBe(0);
    expect(res.body.omitidos).toHaveLength(1);
    expect($transaccion()).not.toHaveBeenCalled();
  });
});

describe('POST /attendance/bulk con un id de otro club', () => {
  it('sigue rechazando la peticion entera', async () => {
    // El de otro club ni siquiera aparece en la consulta, que filtra por clubId.
    (prisma.member.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'm-1', fullName: 'Mariana Ortiz', active: true },
    ]);

    const res = await request(app)
      .post('/attendance/bulk')
      .send(planilla(['m-1', 'ajeno-1']));

    expect(res.status).toBe(403);
    expect($transaccion()).not.toHaveBeenCalled();
    // El id ajeno no se devuelve: quien lo ve no puede hacer nada con el.
    expect(JSON.stringify(res.body)).not.toContain('ajeno-1');
  });
});
