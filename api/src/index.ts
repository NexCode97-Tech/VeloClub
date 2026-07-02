import './instrument'; // Sentry — debe ser el primer import
import * as Sentry from '@sentry/node';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import meRouter from './routes/me';
import clubsRouter from './routes/clubs';
import locationsRouter from './routes/locations';
import membersRouter from './routes/members';
import superadminRouter from './routes/superadmin';
import eventsRouter from './routes/events';
import paymentsRouter from './routes/payments';
import competitionsRouter from './routes/competitions';
import cashflowRouter from './routes/cashflow';
import attendanceRouter from './routes/attendance';
import trainingRouter from './routes/training';
import streamRouter from './routes/stream';
import cronRouter from './routes/cron';
import postsRouter from './routes/posts';
import followsRouter from './routes/follows';
import profilesRouter from './routes/profiles';
import searchRouter from './routes/search';
import { startWorkers } from './workers';
import { prisma } from './db/client';
import { getRedis } from './lib/redis';

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

// Rate limiting global: 1000 req / 15min por IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intenta más tarde' },
});

// Rate limiting estricto para endpoints sensibles: 100 req / 15min
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intenta más tarde' },
});

app.use(globalLimiter);

// ── Logging estructurado ──────────────────────────────────────────────────────
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const reqId = Math.random().toString(36).slice(2, 9);
  res.on('finish', () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO';
    // Ocultar token SSE en los logs
    const path = req.path === '/stream' ? '/stream?token=[REDACTED]' : req.originalUrl;
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

// ── Rutas ─────────────────────────────────────────────────────────────────────
app.use('/me', meLimiter, meRouter);
app.use('/clubs', clubsRouter);
app.use('/locations', locationsRouter);
app.use('/members', membersRouter);
app.use('/superadmin', strictLimiter, superadminRouter);
app.use('/events', eventsRouter);
app.use('/payments', paymentsRouter);
app.use('/competitions', competitionsRouter);
app.use('/cashflow', cashflowRouter);
app.use('/attendance', attendanceRouter);
app.use('/training', trainingRouter);
app.use('/stream', strictLimiter, streamRouter);
app.use('/cron', cronRouter);
app.use('/posts', postsRouter);
app.use('/follows', followsRouter);
app.use('/profiles', profilesRouter);
app.use('/search', searchRouter);

// ── Sentry error handler (debe ir antes del error handler custom) ─────────────
Sentry.setupExpressErrorHandler(app);

// ── Manejador global de errores ───────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(JSON.stringify({ level: 'ERROR', msg: err.message }));
  res.status(500).json({ error: 'Error interno del servidor' });
});

const server = app.listen(PORT, () => {
  console.log(`API en http://localhost:${PORT}`);
  startWorkers();
});

// Timeout de 30s — evita que requests colgados bloqueen el servidor indefinidamente
server.timeout = 30_000;
