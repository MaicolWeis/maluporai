import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { requestId } from './middlewares/requestId.js';
import { healthRouter } from './routes/health.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(requestId);
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true }));

  app.use(healthRouter);

  app.use(errorHandler);
  return app;
}
