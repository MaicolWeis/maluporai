import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { env } from './config/env.js';
import { despesasPorViagemRouter, despesasRouter } from './routes/despesas.routes.js';
import { dashboardRouter, financeiroViagemRouter } from './routes/financeiro.routes.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { requestId } from './middlewares/requestId.js';
import { authRouter } from './routes/auth.routes.js';
import { clientesRouter } from './routes/clientes.routes.js';
import { configuracoesRouter } from './routes/configuracoes.routes.js';
import { healthRouter } from './routes/health.js';
import { inscricoesPorViagemRouter, inscricoesRouter } from './routes/inscricoes.routes.js';
import { pagamentosPorInscricaoRouter, pagamentosRouter } from './routes/pagamentos.routes.js';
import { usuariosRouter } from './routes/usuarios.routes.js';
import { viagensRouter } from './routes/viagens.routes.js';

export function createApp() {
  const app = express();

  // Atrás de proxy (Vercel + Railway) em produção, para req.ip refletir o
  // cliente real — sem isso o rate limit por IP colapsaria tudo num só IP.
  if (env.NODE_ENV === 'production') {
    app.set('trust proxy', env.TRUST_PROXY);
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
  app.use('/clientes', clientesRouter);
  app.use('/viagens', viagensRouter);
  app.use('/viagens/:viagemId/inscricoes', inscricoesPorViagemRouter);
  app.use('/viagens/:viagemId/despesas', despesasPorViagemRouter);
  app.use('/viagens/:viagemId/financeiro', financeiroViagemRouter);
  app.use('/dashboard', dashboardRouter);
  app.use('/inscricoes/:inscricaoId/pagamentos', pagamentosPorInscricaoRouter);
  app.use('/inscricoes', inscricoesRouter);
  app.use('/pagamentos', pagamentosRouter);
  app.use('/despesas', despesasRouter);

  app.use(errorHandler);
  return app;
}
