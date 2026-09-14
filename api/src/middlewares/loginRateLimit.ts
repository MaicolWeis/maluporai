import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

/** 5 tentativas / 15min por e-mail+IP (seção 3). */
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    return `${req.ip}:${email}`;
  },
  handler: (_req, res) => {
    res.status(429).json({
      error: { code: 'RATE_LIMITED', message: 'Muitas tentativas. Tente novamente em alguns minutos.' },
    });
  },
});
