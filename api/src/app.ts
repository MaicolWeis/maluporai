import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { requestId } from './middlewares/requestId.js';
import { authRouter } from './routes/auth.routes.js';
import { configuracoesRouter } from './routes/configuracoes.routes.js';
import { healthRouter } from './routes/health.js';
import { usuariosRouter } from './routes/usuarios.routes.js';
import { viagensRouter } from './routes/viagens.routes.js';

export function createApp() {
  const app = express();

  // Atrás de proxy (Railway etc.) em produção, para req.ip refletir o
  // cliente real — sem isso o rate limit por IP colapsaria tudo num só IP.
  if (env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  app.use(helmet());
  app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(requestId);
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true }));

  app.use(healthRouter);
  app.use('/auth', authRouter);
  app.use('/usuarios', usuariosRouter);
  app.use('/configuracoes', configuracoesRouter);
  app.use('/viagens', viagensRouter);

  app.use(errorHandler);
  return app;
}
