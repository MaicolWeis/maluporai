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

// 3. Buckets privados do Supabase Storage (P8.5), idempotente. Sem as
//    variáveis, uploads ficam desabilitados e o passo é pulado.
const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
  const base = SUPABASE_URL.replace(/\/$/, '');
  const buckets = [
    { id: 'comprovantes', allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] },
    { id: 'logos', allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp'] },
  ];
  for (const b of buckets) {
    const res = await fetch(`${base}/storage/v1/bucket`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        apikey: SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...b, name: b.id, public: false, file_size_limit: 5 * 1024 * 1024 }),
    });
    const corpo = await res.text();
    if (res.ok) console.log(`[release] bucket ${b.id} criado`);
    else if (/already exists|Duplicate/i.test(corpo)) console.log(`[release] bucket ${b.id} já existe`);
    else {
      console.error(`[release] falha ao criar bucket ${b.id}: HTTP ${res.status}`);
      process.exit(1);
    }
  }
} else {
  console.log('[release] Supabase Storage não configurado — pulando buckets');
}

console.log('[release] ok');
