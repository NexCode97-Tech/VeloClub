import './instrument'; // Sentry — debe ser el primer import
import { contextoPeticion } from './lib/contexto-peticion';
import * as Sentry from '@sentry/node';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { strictLimiter } from './lib/rate-limit';
import meRouter from './routes/me';
import clubsRouter from './routes/clubs';
import locationsRouter from './routes/locations';
import membersRouter from './routes/members';
import inscripcionRouter from './routes/inscripcion';
import superadminRouter from './routes/superadmin';
import eventsRouter from './routes/events';
import paymentsRouter from './routes/payments';
import competitionsRouter from './routes/competitions';
import cashflowRouter from './routes/cashflow';
import attendanceRouter from './routes/attendance';
import clasesRouter from './routes/clases';
import trainingRouter from './routes/training';
import streamRouter from './routes/stream';
import cronRouter from './routes/cron';
import postsRouter from './routes/posts';
import followsRouter from './routes/follows';
import profilesRouter from './routes/profiles';
import searchRouter from './routes/search';
import notificationsRouter from './routes/notifications';
import mercadopagoRouter, { reconciliarPagosPendientes } from './routes/mercadopago';
import deportesRouter from './routes/deportes';
import { clubEntero } from './auth/middleware';
import { SinCarpeta } from './lib/deportes';
import { startWorkers } from './workers';
import { prisma } from './db/client';
import { getRedis } from './lib/redis';
import { sincronizarMontosSuscripciones, recordarVencimientosProximos, desactivarClubesVencidos } from './lib/sync-suscripciones';
import { conciliarComisiones } from './lib/finanzas-plataforma';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Confiar en el proxy de Railway para leer X-Forwarded-For correctamente
app.set('trust proxy', 1);

// ── Compresión gzip/brotli ────────────────────────────────────────────────────
app.use(compression());

// ── Seguridad ─────────────────────────────────────────────────────────────────
app.use(helmet());
app.disable('x-powered-by');

const baseOrigin = (process.env.WEB_ORIGIN || 'http://localhost:3000').replace(/\/$/, '');
const allowedOrigins = [baseOrigin, baseOrigin.replace('https://', 'https://www.')].filter(Boolean);
app.use(cors({ origin: allowedOrigins, credentials: true }));

// Límite ampliado para soportar upload de imágenes en base64
app.use(express.json({ limit: '10mb' }));

// Contexto de la peticion, para que la auditoria sepa quien actua sin que cada
// consulta a la base tenga que recibir el `req`. Va antes de las rutas; el
// actor lo completa `requireAuth`, que corre despues.
app.use(contextoPeticion);

// Rate limiting global: 1000 req / 15min por IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intenta más tarde' },
});

// Los límites por endpoint viven en lib/rate-limit para poder aplicarlos dentro
// de cada router, en las rutas concretas que los necesitan.

app.use(globalLimiter);

// ── Logging estructurado ──────────────────────────────────────────────────────
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const reqId = Math.random().toString(36).slice(2, 9);
  res.on('finish', () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO';
    // El ticket del stream no debe quedar registrado
    const path = req.path === '/stream' ? '/stream?ticket=[REDACTED]' : req.originalUrl;
    console.log(JSON.stringify({ level, reqId, method: req.method, path, status: res.statusCode, ms }));
  });
  next();
});

// ── Health check profundo ─────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  const checks: Record<string, string> = {};

  // DB check
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = 'ok';
  } catch {
    checks.db = 'error';
  }

  // Redis check
  try {
    const redis = getRedis();
    if (redis) {
      await redis.ping();
      checks.redis = 'ok';
    } else {
      checks.redis = 'disabled';
    }
  } catch {
    checks.redis = 'error';
  }

  const allOk = Object.values(checks).every(v => v === 'ok' || v === 'disabled');
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    service: 'veloclub-api',
    checks,
  });
});

// Rate limiting para /me: por usuario (header clerk), no por IP
// 200 req / 15min — suficiente para uso intensivo sin bloquear usuarios legítimos
const meLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Usar el header de Clerk si está disponible, si no caer a IP (con soporte IPv6)
    const clerkUserId = req.headers['x-clerk-user-id'] as string | undefined;
    return clerkUserId ?? ipKeyGenerator(req.ip ?? 'unknown');
  },
  message: { error: 'Demasiadas solicitudes, intenta más tarde' },
});

// Rate limiting para /superadmin: por usuario (no por IP) y generoso — el panel
// refresca listas cada 15s y el superadmin trabaja de forma intensiva; el
// strictLimiter por IP (100/15min) lo bloqueaba con el solo polling.
const superadminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const clerkUserId = req.headers['x-clerk-user-id'] as string | undefined;
    return clerkUserId ?? ipKeyGenerator(req.ip ?? 'unknown');
  },
  message: { error: 'Demasiadas solicitudes, intenta más tarde' },
});

// ── Rutas ─────────────────────────────────────────────────────────────────────
// Las rutas que cruzan clubes a proposito se declaran antes de montarse: el
// buscador de la comunidad, el muro publico, los perfiles ajenos, el panel de
// superadmin y el arranque de sesion. Todo lo demas queda acotado a la carpeta
// de deporte de quien pregunta, sin que cada ruta tenga que acordarse.
//
// El sentido de la falla es a proposito: olvidar una declaracion aca hace que
// esa pantalla se vea vacia y alguien lo reporte el mismo dia. Al reves —
// tener que acordarse de filtrar en cada consulta — el olvido muestra datos de
// otro deporte y no lo nota nadie.
app.use(['/me', '/superadmin', '/posts', '/profiles', '/search', '/follows', '/deportes'], clubEntero);

app.use('/me', meLimiter, meRouter);
app.use('/clubs', clubsRouter);
app.use('/deportes', deportesRouter);
app.use('/locations', locationsRouter);
app.use('/members', membersRouter);
// La inscripcion por enlace tiene rutas publicas: el limitador va adentro, por
// endpoint, en vez de exigir sesion en todo el router.
app.use('/inscripcion', inscripcionRouter);
app.use('/superadmin', superadminLimiter, superadminRouter);
app.use('/events', eventsRouter);
app.use('/payments', paymentsRouter);
app.use('/competitions', competitionsRouter);
app.use('/cashflow', cashflowRouter);
app.use('/attendance', attendanceRouter);
app.use('/clases', clasesRouter);
app.use('/training', trainingRouter);
app.use('/stream', strictLimiter, streamRouter);
app.use('/cron', cronRouter);
app.use('/posts', postsRouter);
app.use('/follows', followsRouter);
app.use('/profiles', profilesRouter);
app.use('/search', searchRouter);
app.use('/notifications', notificationsRouter);
app.use('/mercadopago', mercadopagoRouter);

// ── Sentry error handler (debe ir antes del error handler custom) ─────────────
Sentry.setupExpressErrorHandler(app);

// ── Manejador global de errores ───────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  // Una cuenta sin deporte asignado no es un fallo del servidor: es algo que su
  // propio administrador puede arreglar, y el mensaje se lo dice.
  if (err instanceof SinCarpeta) {
    return res.status(409).json({ error: err.message });
  }
  console.error(JSON.stringify({ level: 'ERROR', msg: err.message }));
  res.status(500).json({ error: 'Error interno del servidor' });
});

const server = app.listen(PORT, () => {
  console.log(`API en http://localhost:${PORT}`);
  startWorkers();

  // Sincroniza el monto de las suscripciones con renovación automática y avisa
  // a los clubes sin ella que están por vencer (dunning) una vez al día — no
  // depende de un cron externo, corre sola mientras la API esté viva. Primer
  // chequeo a los 2 minutos de arrancar, luego cada 24h.
  setTimeout(() => {
    sincronizarMontosSuscripciones().catch(err => console.error('[sync-suscripciones-monto:boot]', err));
    recordarVencimientosProximos().catch(err => console.error('[recordar-vencimientos:boot]', err));
    desactivarClubesVencidos().catch(err => console.error('[desactivar-vencidos:boot]', err));
    conciliarComisiones().catch(err => console.error('[conciliar-comisiones:boot]', err));
    setInterval(() => {
      sincronizarMontosSuscripciones().catch(err => console.error('[sync-suscripciones-monto:interval]', err));
      recordarVencimientosProximos().catch(err => console.error('[recordar-vencimientos:interval]', err));
      desactivarClubesVencidos().catch(err => console.error('[desactivar-vencidos:interval]', err));
    }, 24 * 60 * 60 * 1000);
  }, 2 * 60 * 1000);

  // Reconciliación de pagos PSE/Efecty en proceso — red de seguridad por si la
  // notificación de Mercado Pago se demora o falla. Corre cada 20 minutos.
  //
  // En la misma vuelta se le pone comisión a los pagos que ya se acreditaron:
  // Mercado Pago la liquida un rato después de aprobar, así que preguntarla en
  // caliente daría cero. Es el único gasto de la plataforma que no hay que
  // escribir a mano.
  setInterval(() => {
    reconciliarPagosPendientes().catch(err => console.error('[reconciliar-pagos:interval]', err));
    conciliarComisiones().catch(err => console.error('[conciliar-comisiones:interval]', err));
  }, 20 * 60 * 1000);
});

// Timeout de 30s — evita que requests colgados bloqueen el servidor indefinidamente
server.timeout = 30_000;
