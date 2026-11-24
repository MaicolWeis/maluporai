import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { agendarRetencaoDiaria } from './services/retencao.service.js';
import { agendarVerificacaoDiaria } from './services/verificacao.service.js';

const app = createApp();

app.listen(env.PORT, () => {
  logger.info(`maluporai-api rodando na porta ${env.PORT} [${env.NODE_ENV}]`);
  agendarRetencaoDiaria();
  agendarVerificacaoDiaria();
});
