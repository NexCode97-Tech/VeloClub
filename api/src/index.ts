import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import meRouter from './routes/me';
import clubsRouter from './routes/clubs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(cors({ origin: process.env.WEB_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'veloclub-api' });
});

app.use('/me', meRouter);
app.use('/clubs', clubsRouter);

app.listen(PORT, () => {
  console.log(`API en http://localhost:${PORT}`);
});
