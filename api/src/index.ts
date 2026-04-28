import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import meRouter from './routes/me';
import clubsRouter from './routes/clubs';
import locationsRouter from './routes/locations';
import membersRouter from './routes/members';
import superadminRouter from './routes/superadmin';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(cors({ origin: process.env.WEB_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'veloclub-api' });
});

// Endpoint temporal para resetear usuario superadmin
app.delete('/reset-user/:email', async (req, res) => {
  const secret = req.headers['x-reset-secret'];
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

app.use('/me', meRouter);
app.use('/clubs', clubsRouter);
app.use('/locations', locationsRouter);
app.use('/members', membersRouter);
app.use('/superadmin', superadminRouter);

app.listen(PORT, () => {
  console.log(`API en http://localhost:${PORT}`);
});
