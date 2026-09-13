#!/usr/bin/env node
// Executa comandos do Prisma CLI (migrate dev/deploy) autenticado com a role
// de admin (MIGRATION_DATABASE_URL), nunca com app_user (DATABASE_URL), que
// não tem privilégio para criar/alterar tabelas nem roles.
import { spawnSync } from 'node:child_process';

const envFile = process.env.ENV_FILE ?? '.env';

try {
  process.loadEnvFile(envFile);
} catch {
  // Segue em frente: variáveis podem já estar definidas no ambiente (CI/Railway).
}

if (!process.env.MIGRATION_DATABASE_URL) {
  console.error(`MIGRATION_DATABASE_URL não definida (esperado em ${envFile}).`);
  process.exit(1);
}

const prismaArgs = process.argv.slice(2);
const result = spawnSync('npx', ['prisma', ...prismaArgs], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: process.env.MIGRATION_DATABASE_URL },
});

process.exit(result.status ?? 1);
