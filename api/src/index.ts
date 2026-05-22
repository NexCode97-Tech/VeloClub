import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Confiar en el proxy de Railway para leer X-Forwarded-For correctamente
app.set('trust proxy', 1);

// ── Seguridad ─────────────────────────────────────────────────────────────────
app.use(helmet());
app.disable('x-powered-by');

const allowedOrigin = (process.env.WEB_ORIGIN || 'http://localhost:3000').replace(/\/$/, '');
app.use(cors({ origin: allowedOrigin, credentials: true }));

// Límite de body reducido — ningún endpoint necesita más de 100kb
app.use(express.json({ limit: '100kb' }));

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

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'veloclub-api' });
});

// ── Rutas ─────────────────────────────────────────────────────────────────────
app.use('/me', meRouter); // /me se llama en cada carga — el globalLimiter es suficiente
app.use('/clubs', clubsRouter);
app.use('/locations', locationsRouter);
app.use('/members', membersRouter);
app.use('/superadmin', superadminRouter); // ya protegido por requireSuperadmin, globalLimiter es suficiente
app.use('/events', eventsRouter);
app.use('/payments', paymentsRouter);
app.use('/competitions', competitionsRouter);
app.use('/cashflow', cashflowRouter);
app.use('/attendance', attendanceRouter);
app.use('/training', trainingRouter);
app.use('/stream', streamRouter);

// ── Manejador global de errores ───────────────────────────────────────────────
// Evita que stack traces o mensajes internos lleguen al cliente
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Error]', err.message, err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`API en http://localhost:${PORT}`);
});
