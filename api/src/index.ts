import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import meRouter from './routes/me';
import clubsRouter from './routes/clubs';
import locationsRouter from './routes/locations';
import membersRouter from './routes/members';
import superadminRouter from './routes/superadmin';
import eventsRouter from './routes/events';
import paymentsRouter from './routes/payments';
import competitionsRouter from './routes/competitions';
import cashflowRouter from './routes/cashflow';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
const allowedOrigin = (process.env.WEB_ORIGIN || 'http://localhost:3000').replace(/\/$/, '');
app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'veloclub-api' });
});

// Endpoint temporal para resetear usuario superadmin (GET para evitar CORS)
app.get('/reset-user/:email', async (req, res) => {
  const secret = req.query['secret'];
  if (secret !== process.env.RESET_SECRET) return res.status(403).json({ error: 'Forbidden' });
  const { prisma } = await import('./db/client');
  const email = String(req.params.email);
  try {
    await prisma.user.delete({ where: { email } });
    res.json({ ok: true, deleted: email });
  } catch {
    res.json({ ok: false, message: 'User not found or already deleted' });
  }
});

// Endpoint temporal para listar usuarios en DB
app.get('/debug-users', async (req, res) => {
  const secret = req.query['secret'];
  if (secret !== process.env.RESET_SECRET) return res.status(403).json({ error: 'Forbidden' });
  const { prisma } = await import('./db/client');
  const users = await prisma.user.findMany({ select: { email: true, role: true, profileComplete: true, clerkId: true } });
  res.json({ users });
});

// Endpoint temporal para asignar rol SUPERADMIN por email
app.get('/make-superadmin/:email', async (req, res) => {
  const secret = req.query['secret'];
  if (secret !== process.env.RESET_SECRET) return res.status(403).json({ error: 'Forbidden' });
  const { prisma } = await import('./db/client');
  const email = String(req.params.email);
  try {
    const user = await prisma.user.update({
      where: { email },
      data: { role: 'SUPERADMIN', profileComplete: true, clubId: null },
    });
    res.json({ ok: true, user: { email: user.email, role: user.role } });
  } catch {
    res.json({ ok: false, message: 'User not found' });
  }
});

app.use('/me', meRouter);
app.use('/clubs', clubsRouter);
app.use('/locations', locationsRouter);
app.use('/members', membersRouter);
app.use('/superadmin', superadminRouter);
app.use('/events', eventsRouter);
app.use('/payments', paymentsRouter);
app.use('/competitions', competitionsRouter);
app.use('/cashflow', cashflowRouter);

app.listen(PORT, () => {
  console.log(`API en http://localhost:${PORT}`);
});
