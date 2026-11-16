import { pino } from 'pino';

// Logger estruturado. NUNCA logar dados sensíveis (senha, CPF, tokens).
export const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : process.env.NODE_ENV === 'test' ? 'silent' : 'debug',
  redact: ['req.headers.authorization', 'req.headers.cookie', '*.senha', '*.cpf', '*.token'],
});
