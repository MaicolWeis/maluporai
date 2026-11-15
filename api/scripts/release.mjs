#!/usr/bin/env node
// Etapa de release (pre-deploy no Railway). Roda com a role de ADMIN
// (MIGRATION_DATABASE_URL), nunca com app_user:
//   1. prisma migrate deploy
//   2. gira a senha de app_user para APP_USER_PASSWORD — a migração de RLS
//      cria a role com uma senha placeholder que nunca pode valer em produção.
import { spawnSync } from 'node:child_process';

const { MIGRATION_DATABASE_URL, APP_USER_PASSWORD } = process.env;

if (!MIGRATION_DATABASE_URL) {
  console.error('MIGRATION_DATABASE_URL não definida.');
  process.exit(1);
}
if (!APP_USER_PASSWORD || APP_USER_PASSWORD.length < 24) {
  console.error('APP_USER_PASSWORD ausente ou curta (mínimo 24 caracteres).');
  process.exit(1);
}
if (APP_USER_PASSWORD.includes('changeme')) {
  console.error('APP_USER_PASSWORD não pode ser o placeholder de desenvolvimento.');
  process.exit(1);
}

function prisma(args, input) {
  const result = spawnSync('npx', ['prisma', ...args], {
    stdio: input ? ['pipe', 'inherit', 'inherit'] : 'inherit',
    input,
    env: { ...process.env, DATABASE_URL: MIGRATION_DATABASE_URL },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log('[release] aplicando migrações…');
prisma(['migrate', 'deploy']);

console.log('[release] girando senha de app_user…');
const escaped = APP_USER_PASSWORD.replace(/'/g, "''");
prisma(
  ['db', 'execute', '--stdin', '--url', MIGRATION_DATABASE_URL],
  `ALTER ROLE app_user WITH LOGIN NOBYPASSRLS PASSWORD '${escaped}';`,
);

console.log('[release] ok');
