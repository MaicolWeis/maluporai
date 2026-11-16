import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(3333),
    DATABASE_URL: z.string().url(),
    JWT_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    FRONTEND_URL: z.string().url(),
    ENCRYPTION_KEY: z
      .string()
      .regex(/^[0-9a-fA-F]{64}$/, 'ENCRYPTION_KEY deve ter 64 caracteres hexadecimais (32 bytes)'),
    // Caminho do cookie de refresh. Atrás do proxy /api da Vercel o navegador
    // enxerga as rotas como /api/auth/*, então em produção usamos /api/auth.
    REFRESH_COOKIE_PATH: z.string().startsWith('/').default('/auth'),
    // Quantos proxies confiáveis ficam na frente da API (Express "trust proxy").
    // Vercel (rewrite /api) + borda do Railway = 2. Só aplicado em produção.
    TRUST_PROXY: z.coerce.number().int().min(0).default(1),
    // Segredo compartilhado com a Vercel (transform em web/vercel.json). Quando
    // definido, a API só aceita requisições vindas pelo proxy da Vercel.
    ORIGIN_SECRET: z.string().min(32).optional(),
    // EmailService: driver console (só loga) ou Resend. Padrão: resend em
    // produção, console fora dela. EMAIL_DRIVER=console em produção é opção
    // explícita para ambiente de teste (links aparecem nos logs).
    EMAIL_DRIVER: z.enum(['console', 'resend']).optional(),
    RESEND_API_KEY: z.string().optional(),
    // Supabase Storage (P8.5) — opcional: sem ele, uploads ficam indisponíveis
    // em produção (503) e usam driver em memória em dev/test.
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_SERVICE_KEY: z.string().min(20).optional(),
    EMAIL_FROM: z.string().email().optional(),
  })
  .superRefine((val, ctx) => {
    const driver = val.EMAIL_DRIVER ?? (val.NODE_ENV === 'production' ? 'resend' : 'console');
    if (driver === 'resend') {
      if (!val.RESEND_API_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['RESEND_API_KEY'],
          message: 'RESEND_API_KEY é obrigatória com EMAIL_DRIVER=resend',
        });
      }
      if (!val.EMAIL_FROM) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['EMAIL_FROM'],
          message: 'EMAIL_FROM é obrigatória com EMAIL_DRIVER=resend',
        });
      }
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Variáveis de ambiente inválidas:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  EMAIL_DRIVER:
    parsed.data.EMAIL_DRIVER ?? (parsed.data.NODE_ENV === 'production' ? 'resend' : 'console'),
};
