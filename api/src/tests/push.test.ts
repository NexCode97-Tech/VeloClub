import { describe, it, expect, vi, beforeEach } from 'vitest';

// Notificaciones push y recordatorios. Lo que importa: que el servidor solo le
// hable a servicios de push de verdad, que un dispositivo muerto se borre, y
// que las horas se calculen en hora de Colombia y no en la del servidor.

vi.mock('web-push', () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: vi.fn() },
}));
vi.mock('@sentry/node', () => ({ captureException: vi.fn() }));
vi.mock('../db/client', () => ({
  prisma: {},
  prismaClubEntero: {
    pushDispositivo: { findMany: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn() },
  },
}));

process.env.VAPID_PUBLICA = 'clave-publica-de-prueba';
process.env.VAPID_PRIVADA = 'clave-privada-de-prueba';

const webpush = (await import('web-push')).default;
const { prismaClubEntero } = await import('../db/client');
const { endpointValido, enviarPush } = await import('../lib/push');
const { enColombia, minutosDe, horaLegible, tocaAvisarClase, diaDe, sumarDias } = await import('../lib/recordatorios');

const enviar = webpush.sendNotification as unknown as ReturnType<typeof vi.fn>;
const buscar = prismaClubEntero.pushDispositivo.findMany as unknown as ReturnType<typeof vi.fn>;
const borrar = prismaClubEntero.pushDispositivo.deleteMany as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

describe('endpointValido', () => {
  it('acepta los servicios de push de Chrome, Edge, Firefox y Apple', () => {
    expect(endpointValido('https://fcm.googleapis.com/fcm/send/abc')).toBe(true);
    expect(endpointValido('https://wns2-bl2p.notify.windows.com/w/?token=x')).toBe(true);
    expect(endpointValido('https://updates.push.services.mozilla.com/wpush/v2/x')).toBe(true);
    expect(endpointValido('https://web.push.apple.com/QK2x')).toBe(true);
  });

  it('rechaza cualquier otra dirección, para que el servidor no le hable a quien sea', () => {
    expect(endpointValido('https://evil.example.com/fcm.googleapis.com')).toBe(false);
    expect(endpointValido('https://fcm.googleapis.com.evil.com/x')).toBe(false);
    expect(endpointValido('http://fcm.googleapis.com/fcm/send/abc')).toBe(false);
    expect(endpointValido('http://169.254.169.254/latest')).toBe(false);
    expect(endpointValido('no es una url')).toBe(false);
  });
});

describe('enviarPush', () => {
  const dispositivo = (id: string) => ({ id, endpoint: `https://fcm.googleapis.com/${id}`, p256dh: 'p', auth: 'a' });

  it('manda a todos los dispositivos de la persona', async () => {
    buscar.mockResolvedValue([dispositivo('d1'), dispositivo('d2')]);
    enviar.mockResolvedValue({});
    expect(await enviarPush(['user_1'], { titulo: 'Hola', cuerpo: 'Prueba' })).toBe(2);
    expect(enviar).toHaveBeenCalledTimes(2);
  });

  it('borra el dispositivo que el servicio dice que ya no existe', async () => {
    buscar.mockResolvedValue([dispositivo('vivo'), dispositivo('muerto')]);
    enviar.mockImplementation(({ endpoint }: { endpoint: string }) =>
      endpoint.endsWith('muerto') ? Promise.reject(Object.assign(new Error('Gone'), { statusCode: 410 })) : Promise.resolve({}));
    expect(await enviarPush(['user_1'], { titulo: 'Hola', cuerpo: 'Prueba' })).toBe(1);
    expect(borrar).toHaveBeenCalledWith({ where: { id: { in: ['muerto'] } } });
  });

  it('sin destinatarios no consulta nada', async () => {
    expect(await enviarPush([], { titulo: 'Hola', cuerpo: 'Prueba' })).toBe(0);
    expect(buscar).not.toHaveBeenCalled();
  });

  it('nunca lanza, aunque falle la base', async () => {
    buscar.mockRejectedValue(new Error('sin base'));
    await expect(enviarPush(['user_1'], { titulo: 'Hola', cuerpo: 'Prueba' })).resolves.toBe(0);
  });
});

describe('la hora de Colombia', () => {
  it('las 2 a. m. UTC del jueves son las 9 p. m. del miércoles en Colombia', () => {
    const c = enColombia(new Date('2026-11-26T02:00:00Z'));
    expect(c.fecha).toBe('2026-11-25');
    expect(c.dia).toBe(3);
    expect(c.minutos).toBe(21 * 60);
  });

  it('lee y escribe las horas del horario', () => {
    expect(minutosDe('17:30')).toBe(1050);
    expect(minutosDe('5:30')).toBeNull();
    expect(horaLegible('17:30')).toBe('5:30 p. m.');
    expect(horaLegible('08:00')).toBe('8:00 a. m.');
    expect(horaLegible('12:15')).toBe('12:15 p. m.');
    expect(horaLegible('00:05')).toBe('12:05 a. m.');
  });

  it('el día de un cobro guardado a medianoche UTC es el anterior en Colombia', () => {
    expect(diaDe(new Date('2026-12-05T00:00:00Z'))).toBe('2026-12-04');
    expect(diaDe(new Date('2026-12-05T12:00:00Z'))).toBe('2026-12-05');
  });

  it('suma días cruzando el fin de mes', () => {
    expect(sumarDias('2026-11-29', 3)).toBe('2026-12-02');
    expect(sumarDias('2026-12-01', -1)).toBe('2026-11-30');
  });
});

describe('tocaAvisarClase', () => {
  it('avisa cuando falta alrededor de una hora', () => {
    expect(tocaAvisarClase(16 * 60, 17 * 60)).toBe(true);       // falta 60
    expect(tocaAvisarClase(16 * 60 + 5, 17 * 60)).toBe(true);   // falta 55
  });

  it('no avisa demasiado temprano ni cuando ya casi empieza', () => {
    expect(tocaAvisarClase(15 * 60, 17 * 60)).toBe(false);      // faltan 120
    expect(tocaAvisarClase(16 * 60 + 15, 17 * 60)).toBe(false); // faltan 45
    expect(tocaAvisarClase(18 * 60, 17 * 60)).toBe(false);      // ya pasó
  });
});
